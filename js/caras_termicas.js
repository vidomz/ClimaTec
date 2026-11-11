import * as THREE from 'three';
import { listo } from './visor.js?v=20261110a';
import { AJUSTES, ajustar } from './materiales_tec.js?v=20261031a';
import { posicionSolar } from './rayo_sol.js?v=20261104a';

const PARAMS = new URLSearchParams(location.search);
const CASO = PARAMS.has('caso') && PARAMS.has('rom');
const ACTIVO = PARAMS.get('semantica') !== null || CASO;
const VERSION = '20261031b';
const SIGMA = 5.67e-8, K0 = 273.15;
const PRUEBA_M = 40;
const PUNTO_PX = 12, SOBRE_PX = 10, SEPARA_M = 2, FRENTE_M = 4, H_MAX_M = 80, ALCANCE_SOMBRA_M = 300, PASO_M = 2;
const PSI = 0.5, ALBEDO_PISO = 0.2, EPS_PISO = 0.95, U_MAX = 5, MIN_PCT = 3;
const RESERVADO = new URLSearchParams(location.search).get('herramientas') === 'izquierda'
  ? () => ({ arriba: 52, derecha: innerWidth <= 760 ? 252 : 316, izquierda: 62 })
  : () => ({ arriba: 0, derecha: 0, izquierda: 0 });

export const MATERIALES = {
  concreto: { nombre: 'concrete', modelo: 'escalon', eps: 0.93, lambda: 1.7, L: 0.2 },
  piedra: { nombre: 'stone', modelo: 'escalon', eps: 0.87, lambda: 0.84, L: 0.1 },
  vidrio: { nombre: 'glass', modelo: 'lamina', a: 0.35, eps: 0.84 },
  metal: { nombre: 'metal', modelo: 'lamina', eps: 0.16, epsRecubierto: 0.87, albedoBrillante: 0.5 },
  pintura: { nombre: 'paint', modelo: 'escalon', eps: 0.9, lambda: 1.7, L: 0.2 },
};
const R_ESCALON = (m) => m.L / (Math.PI ** 1.5 * m.lambda);

export function albedoCelniker(hex) {
  const lin = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const Y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  const L = Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
  return 9.44e-5 * L * L;
}

function epsCielo(ta, e) {
  const w = (46.5 * Math.max(e, 0.1)) / (ta + K0);
  return 1 - (1 + w) * Math.exp(-Math.sqrt(1.2 + 3 * w));
}

const presionSaturacion = (t) => 6.112 * Math.exp((17.62 * t) / (243.12 + t));

function tEscalon(m, albedo, ta, K, Lin) {
  const dosR = 2 * R_ESCALON(m);
  let ts = ta;
  for (let i = 0; i < 30; i++) {
    const nuevo = ta + dosR * ((1 - albedo) * K + Lin - m.eps * SIGMA * (ts + K0) ** 4);
    if (Math.abs(nuevo - ts) < 0.01) return nuevo;
    ts = 0.5 * (ts + nuevo);
  }
  return ts;
}

function tLamina(m, a, ta, K, Lin, u, eps = m.eps) {
  const hw = 5.6 + 4 * Math.min(Math.max(u, 0), U_MAX);
  const Tr = (Lin / SIGMA) ** 0.25, Ta = ta + K0;
  let Ts = Ta;
  for (let i = 0; i < 8; i++) {
    const hr = eps * SIGMA * (Tr * Tr + Ts * Ts) * (Tr + Ts);
    Ts = (a * K + hr * Tr + hw * Ta) / (hr + hw);
  }
  return Ts - K0;
}

let deseado = false, aplicar = null;
addEventListener('message', (ev) => {
  if (ev.origin !== location.origin) return;
  if (ev.data?.tipo === 'climatec-semantica') deseado = !!ev.data.activo;
  else return;
  aplicar?.(deseado);
});

const RUMBOS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const ANGOSTO_M = 4, PEGADO_M = 3, MARGEN_M = 3, RELIEVE_M = 6;
function fachadas(lista, k) {
  const info = lista.map((c) => {
    const n = [c.normal[0], c.normal[2]], L = Math.hypot(...n);
    const nx = n[0] / L, nz = n[1] / L, P = c.puntos.map((p) => [p[0] / k, p[2] / k]);
    const s = P.map(([x, z]) => -nz * x + nx * z), d = P.map(([x, z]) => nx * x + nz * z);
    return { c, nx, nz, P, ancho: Math.max(...s) - Math.min(...s), smin: Math.min(...s), smax: Math.max(...s), d: d.reduce((a, b) => a + b, 0) / d.length };
  });
  const padre = new Map();
  for (const f of info) {
    if (f.ancho >= ANGOSTO_M) continue;
    let mejor = null;
    for (const g of info) {
      if (g === f || g.ancho < ANGOSTO_M) continue;
      const pegado = f.P.every(([x, z]) => Math.abs(g.nx * x + g.nz * z - g.d) <= PEGADO_M
        && -g.nz * x + g.nx * z >= g.smin - MARGEN_M && -g.nz * x + g.nx * z <= g.smax + MARGEN_M);
      if (pegado && (!mejor || g.ancho > mejor.ancho)) mejor = g;
    }
    if (mejor) padre.set(f, mejor);
  }
  let sx = 0, sy = 0;
  for (const f of info) {
    if (padre.has(f)) continue;
    const a = Math.atan2(f.nx, -f.nz);
    sx += f.c.area_m2 * Math.cos(4 * a); sy += f.c.area_m2 * Math.sin(4 * a);
  }
  const eje = Math.atan2(sy, sx) / 4;
  const lado = (f) => ((Math.round((Math.atan2(f.nx, -f.nz) - eje) / (Math.PI / 2)) % 4) + 4) % 4;
  const lados = [0, 1, 2, 3].map(() => ({ planos: [], relieves: [] }));
  for (const f of info) {
    if (padre.has(f)) lados[lado(padre.get(f))].relieves.push(f.c);
    else lados[lado(f)].planos.push(f.c);
  }
  return lados.filter((x) => x.planos.length);
}

function texturaPunto() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.beginPath(); g.arc(32, 32, 26, 0, 2 * Math.PI);
  g.fillStyle = '#ffffff'; g.fill();
  g.lineWidth = 9; g.strokeStyle = 'rgba(40, 48, 62, 0.9)'; g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

async function iniciar() {
  const [visor, datos, comp, techosJ, edificiosJ] = await Promise.all([
    listo,
    fetch(`modelo/caras_tec.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json()),
    fetch(`modelo/caras_materiales.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json()),
    fetch(`modelo/techos_tec.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json()),
    fetch(`modelo/edificios.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json()),
  ]);
  const { escena, georef, pedirRender, camara, lienzo, nivelSuelo } = visor;
  const k = georef.k;
  const albedoMedio = {};
  for (const x of ['concreto', 'piedra', 'metal']) {
    const v = Object.values(comp.caras).map((f) => f.albedo?.[x]).filter(Number.isFinite);
    albedoMedio[x] = v.length ? v.reduce((s, y) => s + y, 0) / v.length : 0.3;
  }
  while (!window.climatec.rom?.alturas || !window.climatec.rom?.vegetacion || !window.climatec.suelo) {
    await new Promise((r) => setTimeout(r, 300));
  }
  const alturas = window.climatec.rom.alturas, veg = window.climatec.rom.vegetacion, S = window.climatec.suelo;

  const aUTM = (x, z) => georef.aUTM(...georef.aLonLat(new THREE.Vector3(x, nivelSuelo, z)));
  const [Ea, Na] = aUTM(0, 0), [Eb, Nb] = aUTM(1000, 0), [Ec, Nc] = aUTM(0, 1000);
  const ENde = (x, z) => [Ea + ((Eb - Ea) * x + (Ec - Ea) * z) / 1000, Na + ((Nb - Na) * x + (Nc - Na) * z) / 1000];
  const R = S.recorte;
  const fuera = ([e, n]) => !!R && (e < R.E0 || e > R.E1 || n < R.N0 || n > R.N1);

  const caras = [];
  escena.updateMatrixWorld(true);
  const mallasDe = (objetos) => objetos.map((o) => escena.getObjectByName(o) ?? escena.getObjectByName(o.replace(/\./g, ''))).filter(Boolean);
  const rayo = new THREE.Raycaster(), atras = new THREE.Vector3();
  for (const e of datos.edificios) {
    if (AJUSTES[e.corto]?.sinCaras) continue;
    const mallas = mallasDe(e.objetos ?? []);
    for (const { planos, relieves } of fachadas(e.caras, k)) {
      const n = planos.reduce((s, c) => s.addScaledVector(new THREE.Vector3(...c.normal), c.area_m2), new THREE.Vector3());
      n.y = 0; n.normalize();
      const t = new THREE.Vector3(-n.z, 0, n.x);
      const azimut = (THREE.MathUtils.radToDeg(Math.atan2(n.x, -n.z)) + 360) % 360;
      const P = planos.flatMap((c) => c.puntos).map((p) => new THREE.Vector3(...p));
      const todos = [...P, ...relieves.flatMap((c) => c.puntos).map((p) => new THREE.Vector3(...p))];
      const s = P.map((p) => p.dot(t)), y = P.map((p) => p.y);
      const s0 = (Math.min(...s) + Math.max(...s)) / 2, y0 = (Math.min(...y) + Math.max(...y)) / 2;
      let mejor = 0;
      P.forEach((p, i) => { if (Math.hypot(s[i] - s0, y[i] - y0) < Math.hypot(s[mejor] - s0, y[mejor] - y0)) mejor = i; });
      const d0 = P[mejor].dot(n);
      const cerca = todos.map((p) => p.dot(n) - d0)
        .filter((dd, i) => dd > 0 && dd <= RELIEVE_M * k && Math.abs(todos[i].dot(t) - s[mejor]) <= RELIEVE_M * k);
      const punto = P[mejor].clone().addScaledVector(n, Math.max(0, ...cerca) + SEPARA_M * k);
      for (let vez = 0; vez < 4 && mallas.length; vez++) {
        rayo.set(punto.clone().addScaledVector(n, PRUEBA_M * k), atras.copy(n).negate());
        rayo.far = PRUEBA_M * k;
        const choque = rayo.intersectObjects(mallas, true)[0];
        if (!choque) break;
        punto.copy(choque.point).addScaledVector(n, SEPARA_M * k);
      }
      const EN = ENde(punto.x, punto.z);
      if (fuera(EN)) continue;
      const imp = {}, alb = {};
      for (const c of [...planos, ...relieves]) {
        const m = comp.caras[c.id] ?? {};
        for (const x of Object.keys(MATERIALES)) {
          const n_ = ((m[x] ?? 0) / 100) * (m.impactos ?? 0);
          if (!(n_ > 0)) continue;
          imp[x] = (imp[x] ?? 0) + n_;
          if (Number.isFinite(m.albedo?.[x])) alb[x] = [(alb[x]?.[0] ?? 0) + n_ * m.albedo[x], (alb[x]?.[1] ?? 0) + n_];
        }
      }
      const f = ajustar(e.corto, imp);
      let mats = Object.keys(MATERIALES).filter((x) => f[x] >= MIN_PCT).sort((a, b) => f[b] - f[a]);
      if (!mats.length) mats = ['concreto'];
      const suma = mats.reduce((a, x) => a + (f[x] ?? 0), 0);
      const frente = punto.clone().addScaledVector(n, FRENTE_M * k);
      caras.push({
        id: planos.map((c) => c.id).join('+'), partes: planos.length + relieves.length, edificio: e.corto,
        rumbo: RUMBOS[Math.round(azimut / 22.5) % 16], azimut, n, punto,
        EN, z: (punto.y - nivelSuelo) / k, frente: [frente.x, frente.z],
        mats, pct: Object.fromEntries(mats.map((x) => [x, suma > 0 ? (100 * (f[x] ?? 0)) / suma : 100])),
        albedo: Object.fromEntries(mats.filter((x) => x !== 'vidrio').map((x) => [x, alb[x] ? alb[x][0] / alb[x][1] : albedoMedio[x]])),
        muestras: P.map((p) => {
          const q = p.clone().addScaledVector(n, 1 * k);
          return [...ENde(q.x, q.z), (p.y - nivelSuelo) / k];
        }),
        T: {}, sol: 0, K: 0,
      });
    }
  }

  const CONCRETO_MIN = 20;
  const conConcreto = Object.values(techosJ.edificios).filter((t) => (t.concreto ?? 0) >= CONCRETO_MIN && Number.isFinite(t.albedo?.concreto));
  const albedoTecho = conConcreto.reduce((a, t) => a + t.albedo.concreto, 0) / Math.max(conConcreto.length, 1) || 0.55;
  const techos = new Map();
  for (const e of edificiosJ.edificios) {
    const t = techosJ.edificios[e.nombre];
    if (!t || !e.pos) continue;
    const propio = (t.concreto ?? 0) >= CONCRETO_MIN && Number.isFinite(t.albedo?.concreto);
    techos.set(e.nombre, { albedo: propio ? t.albedo.concreto : albedoTecho, EN: ENde(e.pos[0], e.pos[2]), z: t.altura_m, T: NaN });
  }

  const CLAVE = { Concrete: 'concreto', Metal: 'metal', Glass: 'vidrio', Paint: 'pintura' };
  const ETIQUETA = Object.fromEntries(Object.entries(CLAVE).map(([a, b]) => [b, a]));
  const casoCaras = [];
  if (CASO) {
    while (!window.climatec.casoEstudio) await new Promise((r) => setTimeout(r, 300));
    const ce = window.climatec.casoEstudio;
    for (const p of ce.puntos) {
      const pct = Object.fromEntries(Object.entries(p.pct).filter(([, v]) => v > 0).map(([m, v]) => [CLAVE[m], v]));
      const mats = Object.keys(pct).sort((a, b) => pct[b] - pct[a]);
      const albedo = p.techo ? { concreto: albedoCelniker(ce.colorAzotea) }
        : Object.fromEntries(mats.filter((x) => x !== 'vidrio').map((x) => [x, albedoCelniker(ce.colores[p.cual][ETIQUETA[x]])]));
      const frente = p.punto.clone().addScaledVector(p.n, FRENTE_M * k);
      casoCaras.push({
        ref: p, techo: !!p.techo, edificio: `Building ${p.cual.toUpperCase()}`, rumbo: p.cara, n: p.n, punto: p.punto,
        azimut: (THREE.MathUtils.radToDeg(Math.atan2(p.n.x, -p.n.z)) + 360) % 360,
        EN: ENde(p.punto.x, p.punto.z), z: p.techo ? p.alto : (p.punto.y - nivelSuelo) / k, frente: [frente.x, frente.z],
        mats, pct, albedo,
        muestras: (p.muestras ?? []).map((q0) => {
          const q = q0.clone().addScaledVector(p.n, 1 * k);
          return [...ENde(q.x, q.z), (q0.y - nivelSuelo) / k];
        }),
        T: {}, sol: 0, K: 0,
      });
    }
  }

  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(caras.flatMap((c) => c.punto.toArray()), 3));
  const puntos = new THREE.Points(geo, new THREE.PointsMaterial({
    size: PUNTO_PX, sizeAttenuation: false, map: texturaPunto(), transparent: true, alphaTest: 0.4, toneMapped: false,
  }));
  puntos.name = 'Puntos_Caras_T';
  puntos.renderOrder = 11;
  puntos.visible = false;
  escena.add(puntos);

  const out = [0, 0, 0, 0, 0];
  const copaEn = (E, N, z) => {
    const i = Math.floor((E - veg.E0) / veg.celda), j = Math.floor((N - veg.N0) / veg.celda);
    if (i < 0 || j < 0 || i >= veg.nx || j >= veg.ny) return false;
    const q = j * veg.nx + i;
    return veg.copa[q] > 0.5 && z >= veg.base[q] && z <= veg.tope[q];
  };
  const hora = { corrida: null };
  function horaSolar(SR, difusa, elevacion, azimut) {
    const sol = SR > 0 && elevacion > 0;
    const sinE = Math.sin((Math.max(elevacion, 0) * Math.PI) / 180), cosE = Math.cos((elevacion * Math.PI) / 180);
    const tanE = Math.tan((Math.max(elevacion, 0.1) * Math.PI) / 180);
    return { SR, sol, cosE, azimut, tanE, alcance: Math.min(ALCANCE_SOMBRA_M, H_MAX_M / tanE), D: SR * difusa,
      I: sol ? Math.min((SR * (1 - difusa)) / Math.max(sinE, 0.05), 1100) : 0,
      dE: Math.sin((azimut * Math.PI) / 180), dN: Math.cos((azimut * Math.PI) / 180) };
  }
  function radiacionCara(c, H) {
    const cosZ = H.sol ? H.cosE * Math.cos(((H.azimut - c.azimut) * Math.PI) / 180) : 0;
    let soleados = 0;
    if (cosZ > 0) {
      for (const [E0, N0, z0] of c.muestras) {
        let libre = true;
        for (let d = PASO_M; d <= H.alcance; d += PASO_M) {
          const E = E0 + H.dE * d, N = N0 + H.dN * d, z = z0 + d * H.tanE;
          if (alturas.alturaEdificio(E, N) > z || copaEn(E, N, z)) { libre = false; break; }
        }
        if (libre) soleados++;
      }
    }
    c.sol = cosZ > 0 ? soleados / c.muestras.length : 0;
    c.K = H.I * Math.max(cosZ, 0) * c.sol + H.D * PSI + H.SR * ALBEDO_PISO * (1 - PSI);
  }
  const celdaFrente = (c) => {
    const i = Math.floor((c.frente[0] - S.x0) / S.celda), j = Math.floor((c.frente[1] - S.z0) / S.celda);
    return i >= 0 && j >= 0 && i < S.nx && j < S.nz ? j * S.nx + i : -1;
  };
  function muestraCara(c, dic) {
    const z = Math.min(Math.max(c.z, 2), 30), campo = c.ref ? window.climatec.rom?.campoGemelo : null;
    return campo?.muestra(c.EN[0], c.EN[1], z, out) || dic.muestra(c.EN[0], c.EN[1], z, out);
  }
  function balanceCara(c, ta, e, u, tp) {
    c.Lin = epsCielo(ta, e) * SIGMA * (ta + K0) ** 4 * PSI + EPS_PISO * SIGMA * (tp + K0) ** 4 * (1 - PSI);
    c.Ta = ta; c.u = u;
    for (const x of c.mats) {
      const m = MATERIALES[x];
      c.T[x] = m.modelo === 'escalon' ? tEscalon(m, c.albedo[x], ta, c.K, c.Lin)
        : tLamina(m, m.a ?? 1 - c.albedo[x], ta, c.K, c.Lin, u,
          x === 'metal' && c.albedo[x] < m.albedoBrillante ? m.epsRecubierto : m.eps);
    }
  }
  function calcular(corrida) {
    const dic = window.climatec.rom?.diccionario, h = S.hora;
    if (!dic || !corrida || h.corrida !== corrida) return false;
    const SR = h.SR, H = horaSolar(SR, h.difusa, h.elevacion, h.azimut);
    for (const c of [...caras, ...casoCaras.filter((x) => !x.techo)]) {
      if (!muestraCara(c, dic)) continue;
      const ta = out[3], e = out[4], u = Math.hypot(out[0], out[1]);
      radiacionCara(c, H);
      const q = celdaFrente(c);
      balanceCara(c, ta, e, u, q >= 0 && Number.isFinite(S.Ts[q]) ? S.Ts[q] : ta);
    }
    for (const t of techos.values()) {
      if (!dic.muestra(t.EN[0], t.EN[1], Math.min(Math.max(t.z, 2), 40), out)) continue;
      t.Ta = out[3];
      t.T = S.rejeb(SR, out[3], Math.hypot(out[0], out[1]), t.albedo);
    }
    window.climatec.techosT = techos;
    dispatchEvent(new CustomEvent('climatec-techos', { detail: { corrida } }));
    for (const c of casoCaras) {
      if (c.techo) {
        if (!dic.muestra(c.EN[0], c.EN[1], Math.min(Math.max(c.z, 2), 40), out)) continue;
        c.Ta = out[3];
        c.T.concreto = S.rejeb(SR, out[3], Math.hypot(out[0], out[1]), c.albedo.concreto);
      }
      c.ref.T = Object.fromEntries(c.mats.filter((x) => Number.isFinite(c.T[x])).map((x) => [ETIQUETA[x], c.T[x]]));
      c.ref.sol = c.sol;
    }
    if (casoCaras.length) {
      console.info('[caras T] caso', Object.fromEntries(casoCaras.map((c) => [`${c.edificio} ${c.rumbo}`,
        Object.entries(c.ref.T).map(([m, t]) => `${m} ${t.toFixed(1)}`).join(', ')])));
      dispatchEvent(new CustomEvent('climatec-caras-calculadas', { detail: { corrida } }));
    }
    hora.corrida = corrida;
    const resumen = {};
    for (const x of Object.keys(MATERIALES)) {
      const v = caras.filter((c) => Number.isFinite(c.T[x])).map((c) => c.T[x]);
      if (v.length) resumen[x] = `${Math.min(...v).toFixed(1)}–${Math.max(...v).toFixed(1)} °C (${v.length} caras)`;
    }
    console.info('[caras T]', corrida, resumen);
    return true;
  }
  function cicloCaso(horas, ref, factorK = 1) {
    const dic = window.climatec.rom?.diccionario;
    if (!dic) return null;
    const [lon, lat] = georef.aLonLat(casoCaras[0].punto);
    const soles = horas.map((h) => {
      const [a, m, d, hh] = h.t.split(/[-T:]/).map(Number);
      const t = new Date(Date.UTC(a, m - 1, d, hh + 6, -30));
      const sol = posicionSolar(t, lat, lon), dia = Math.floor((t - Date.UTC(t.getUTCFullYear(), 0, 0)) / 864e5);
      const difusa = S.fraccionDifusa(h.SR, sol.elevacion, dia);
      return { sol, difusa, H: horaSolar(Math.max(h.SR, 0), difusa, sol.elevacion, sol.azimut) };
    });
    const techos = casoCaras.filter((c) => c.techo).map((c) => {
      if (!muestraCara(c, dic)) return null;
      const dT = out[3] - ref.T, fU = ref.Ws > 0 ? Math.hypot(out[0], out[1]) / (ref.Ws / 3.6) : 1;
      return { edificio: c.ref.cual, cara: 'R', T: { concreto: horas.map((h, n) => S.rejeb(soles[n].H.SR, h.T + dT, (h.Ws / 3.6) * fU, c.albedo.concreto)) } };
    });
    return [...techos, ...casoCaras.filter((c) => !c.techo).map((c) => {
      if (!muestraCara(c, dic)) return null;
      const dT = out[3] - ref.T, fU = ref.Ws > 0 ? Math.hypot(out[0], out[1]) / (ref.Ws / 3.6) : 1;
      const r = { edificio: c.ref.cual, cara: c.rumbo, dT, fU, K: [], sol: [], Ta: [], HR: [], u: [],
        T: Object.fromEntries(c.mats.map((x) => [x, []])) };
      const guardado = { sol: c.sol, K: c.K, Lin: c.Lin, Ta: c.Ta, u: c.u, T: { ...c.T } };
      const q = celdaFrente(c);
      horas.forEach((h, n) => {
        const { sol, difusa, H } = soles[n], ta = h.T + dT, u = (h.Ws / 3.6) * fU;
        const e = (h.HR / 100) * presionSaturacion(h.T);
        radiacionCara(c, H);
        c.K *= factorK;
        const tp = q >= 0 && S.clase[q] ? S.tCelda(q, H.SR, difusa, sol.elevacion, sol.azimut, ta, u) : ta;
        balanceCara(c, ta, e, u, tp);
        r.K.push(c.K); r.sol.push(c.sol); r.Ta.push(ta); r.u.push(u); r.HR.push(Math.min((100 * e) / presionSaturacion(ta), 100));
        for (const x of c.mats) r.T[x].push(c.T[x]);
      });
      Object.assign(c, guardado);
      return r;
    })].filter(Boolean);
  }
  function cicloPisoCaso(horas, ref, bandaM, pasilloM) {
    const dic = window.climatec.rom?.diccionario, { centro } = window.climatec.casoEstudio;
    if (!dic) return null;
    const celdas = [], mitad = 18, conteo = {};
    for (let j = 0; j < S.nz; j++) {
      for (let i = 0; i < S.nx; i++) {
        const q = j * S.nx + i;
        if (!S.clase[q]) continue;
        const x = S.x0 + (i + 0.5) * S.celda - centro.x, z = S.z0 + (j + 0.5) * S.celda - centro.z;
        const dx = Math.abs(x) / k, dz = Math.abs(z) / k, d = Math.max(dx, dz);
        if (d <= mitad || d > mitad + bandaM || (x < 0 && dz <= pasilloM / 2)) continue;
        celdas.push(q);
        conteo[S.clase[q]] = (conteo[S.clase[q]] ?? 0) + 1;
      }
    }
    const locales = casoCaras.filter((c) => !c.techo).map((c) => (muestraCara(c, dic) ? [out[3] - ref.T, Math.hypot(out[0], out[1]) / (ref.Ws / 3.6)] : null)).filter(Boolean);
    const dT = locales.reduce((s, v) => s + v[0], 0) / locales.length, fU = locales.reduce((s, v) => s + v[1], 0) / locales.length;
    const [lon, lat] = georef.aLonLat(casoCaras[0].punto);
    const sin = [], con = [];
    for (const h of horas) {
      const [a, m, d, hh] = h.t.split(/[-T:]/).map(Number);
      const t = new Date(Date.UTC(a, m - 1, d, hh + 6, -30));
      const sol = posicionSolar(t, lat, lon), dia = Math.floor((t - Date.UTC(t.getUTCFullYear(), 0, 0)) / 864e5);
      const SR = Math.max(h.SR, 0), difusa = S.fraccionDifusa(SR, sol.elevacion, dia), ta = h.T + dT, u = (h.Ws / 3.6) * fU;
      const media = (material) => celdas.reduce((s, q) => s + S.tCelda(q, SR, difusa, sol.elevacion, sol.azimut, ta, u, material), 0) / celdas.length;
      sin.push(media()); con.push(media('pasto'));
    }
    return { celdas: celdas.length, conteo, dT, fU, sin, con };
  }
  addEventListener('climatec-suelo-calculado', (ev) => calcular(ev.detail?.corrida));
  if (S.hora.corrida) calcular(S.hora.corrida);

  const aviso = document.createElement('div');
  Object.assign(aviso.style, {
    position: 'fixed', pointerEvents: 'none', display: 'none', zIndex: 31, background: 'rgba(255,255,255,0.96)', color: '#1d2433',
    border: '1px solid #c9d1de', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.18)', padding: '5px 10px',
    font: '13px/1.35 Poppins, system-ui, sans-serif', width: 'max-content', whiteSpace: 'nowrap',
  });
  document.body.appendChild(aviso);
  const fmt = (x, dd = 1) => (Number.isFinite(x) ? x.toFixed(dd) : '—');
  function texto(c) {
    const filas = c.mats.map((x) => `<div><b>T<sub>${MATERIALES[x].nombre}</sub> = ${fmt(c.T[x])} °C</b>`
      + `<span style="color:#5b6577"> · ${Math.round(c.pct[x])} %</span></div>`).join('');
    return filas + `<div style="font-size:11px;color:#5b6577">${c.edificio} · ${c.rumbo} Face</div>`;
  }
  function tapado(c) {
    const [e0, n0] = ENde(camara.position.x, camara.position.z), [e1, n1] = c.EN;
    const h0 = (camara.position.y - nivelSuelo) / k, L = Math.hypot(e1 - e0, n1 - n0), pasos = Math.min(Math.ceil(L / 2), 600);
    for (let s = 1; s < pasos; s++) {
      const f = s / pasos;
      if ((1 - f) * L < 3) break;
      if (alturas.alturaEdificio(e0 + f * (e1 - e0), n0 + f * (n1 - n0)) > h0 + f * (c.z - h0)) return true;
    }
    return false;
  }
  const v = new THREE.Vector3(), aCam = new THREE.Vector3();
  const ocultar = () => { aviso.style.display = 'none'; };
  lienzo.addEventListener('pointermove', (ev) => {
    if (!puntos.visible || !hora.corrida) return;
    if (ev.tarjetaCara) { ocultar(); return; }
    const r = lienzo.getBoundingClientRect();
    const cercanas = [];
    for (const c of caras) {
      if (aCam.subVectors(camara.position, c.punto).dot(c.n) <= 0) continue;
      v.copy(c.punto).project(camara);
      if (v.z > 1 || v.z < -1) continue;
      const dx = r.left + ((v.x + 1) / 2) * r.width - ev.clientX, dy = r.top + ((1 - v.y) / 2) * r.height - ev.clientY;
      const d2 = dx * dx + dy * dy;
      if (d2 <= SOBRE_PX * SOBRE_PX) cercanas.push([d2, c]);
    }
    cercanas.sort((a, b) => a[0] - b[0]);
    const c = cercanas.find(([, x]) => !tapado(x))?.[1];
    if (!c || !c.mats.some((x) => Number.isFinite(c.T[x]))) { ocultar(); return; }
    S.ocultarTarjeta?.();
    aviso.innerHTML = texto(c);
    aviso.style.display = 'block';
    const w = aviso.offsetWidth, h = aviso.offsetHeight, z = RESERVADO();
    let x = ev.clientX + 14, y = ev.clientY - h - 12;
    if (x + w > innerWidth - z.derecha - 6) x = ev.clientX - w - 14;
    if (y < z.arriba + 6) y = ev.clientY + 16;
    aviso.style.left = `${Math.max(z.izquierda + 6, Math.min(x, innerWidth - w - 6))}px`;
    aviso.style.top = `${Math.max(6, Math.min(y, innerHeight - h - 6))}px`;
  });
  lienzo.addEventListener('pointerleave', ocultar);
  window.climatec.controles?.addEventListener('change', ocultar);

  aplicar = (si) => {
    puntos.visible = si;
    if (!si) ocultar();
    pedirRender();
  };
  aplicar(deseado);
  window.climatec.carasT = { caras, techos, casoCaras, puntos, calcular, cicloCaso, cicloPisoCaso, MATERIALES, hora, get activo() { return puntos.visible; } };
  console.info('[caras T] listas', { caras: caras.length });
}

if (ACTIVO) iniciar().catch((err) => console.error('[caras T]', err));
