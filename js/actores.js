import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { listo } from './visor.js?v=20261110a';

const ACTIVO = new URLSearchParams(location.search).has('actores');
const VERSION = '20261030d';
const ESTATURA_M = 1.65;
const ARRIBA = new THREE.Vector3(0, 1, 0);
const ALTURA_POSTE_M = 37.5, GROSOR_POSTE_PX = 1.5, AZUL_TEC = '#0039a6';
const LARGO_AUTO_M = 4.5;
const ICONO_M = { persona: 12, vehiculo: 9 };
const GIRO_ICONO = { persona: 0.35, vehiculo: Math.PI / 2 - 0.5 };
const Z_PERSONA_M = 1.5;
const HI_LIMITES = [26.67, 32.22, 39.44, 51.67];
const HI_NIVELES = ['Comfortable', 'Caution', 'Extreme caution', 'Danger', 'Extreme danger'];
const NIVEL_COLOR = ['#22c363', '#ffd11a', '#ff901a', '#e8432a', '#c71585'];
const BLANCO = '#f4f4f1';
const RESERVADO = new URLSearchParams(location.search).get('herramientas') === 'izquierda'
  ? () => ({ arriba: 52, derecha: innerWidth <= 760 ? 252 : 316, izquierda: 62 })
  : () => ({ arriba: 0, derecha: 0, izquierda: 0 });

const presionSaturacion = (t) => 6.112 * Math.exp((17.62 * t) / (243.12 + t));

function indiceCalor(tC, hr) {
  const t = (tC * 9) / 5 + 32;
  const simple = 0.5 * (t + 61 + (t - 68) * 1.2 + hr * 0.094);
  if ((simple + t) / 2 < 80) return ((simple - 32) * 5) / 9;
  let hi = -42.379 + 2.04901523 * t + 10.14333127 * hr - 0.22475541 * t * hr - 0.00683783 * t * t - 0.05481717 * hr * hr
    + 0.00122874 * t * t * hr + 0.00085282 * t * hr * hr - 0.00000199 * t * t * hr * hr;
  if (hr < 13 && t >= 80 && t <= 112) hi -= ((13 - hr) / 4) * Math.sqrt(Math.max((17 - Math.abs(t - 95)) / 17, 0));
  if (hr > 85 && t >= 80 && t <= 87) hi += ((hr - 85) / 10) * ((87 - t) / 5);
  return ((hi - 32) * 5) / 9;
}
const nivelHI = (x) => (x < HI_LIMITES[0] ? 1 : x < HI_LIMITES[1] ? 2 : x < HI_LIMITES[2] ? 3 : x < HI_LIMITES[3] ? 4 : 5);

function tramo(a, b, ra, rb, partes, seg = 16) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(rb, ra, L, seg, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  partes.push(g);
  for (const [p, r] of [[a, ra], [b, rb]]) partes.push(new THREE.SphereGeometry(r, seg, 10).translate(p.x, p.y, p.z));
}

function geometriaPersona() {
  const p = [];
  const v = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  p.push(new THREE.SphereGeometry(1, 28, 18).scale(0.078, 0.104, 0.09).translate(0, 1.548, 0.005));
  p.push(new THREE.CylinderGeometry(0.044, 0.05, 0.11, 16).translate(0, 1.43, 0));
  const perfil = [[0.001, 0.855], [0.105, 0.86], [0.132, 0.9], [0.14, 0.97], [0.128, 1.05], [0.124, 1.1], [0.136, 1.18],
    [0.152, 1.26], [0.17, 1.315], [0.158, 1.355], [0.11, 1.39], [0.06, 1.41], [0.001, 1.415]].map(([r, y]) => new THREE.Vector2(r, y));
  p.push(new THREE.LatheGeometry(perfil, 32).scale(1, 1, 0.66));
  for (const s of [-1, 1]) {
    tramo(v(0.082 * s, 0.9), v(0.088 * s, 0.49), 0.078, 0.052, p);
    tramo(v(0.088 * s, 0.49), v(0.092 * s, 0.085), 0.052, 0.036, p);
    p.push(new THREE.SphereGeometry(1, 16, 10).scale(0.046, 0.038, 0.118).translate(0.094 * s, 0.04, 0.045));
    tramo(v(0.168 * s, 1.315), v(0.228 * s, 1.04), 0.05, 0.038, p);
    tramo(v(0.228 * s, 1.04), v(0.268 * s, 0.8), 0.038, 0.03, p);
    p.push(new THREE.SphereGeometry(1, 14, 10).scale(0.03, 0.07, 0.045).translate(0.276 * s, 0.735, 0.005));
  }
  const g = mergeGeometries(p.map((x) => x.toNonIndexed()));
  g.scale(ESTATURA_M / 1.652, ESTATURA_M / 1.652, ESTATURA_M / 1.652);
  return g;
}

function extruir(puntos, ancho, bisel = 0.04) {
  const forma = new THREE.Shape(puntos.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(forma, { depth: ancho - 2 * bisel, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 3, curveSegments: 8 });
  g.rotateY(-Math.PI / 2);
  g.translate(ancho / 2 - bisel, 0, 0);
  return g;
}

function geometriasVehiculo() {
  const carroceria = extruir([[-2.2, 0.3], [2.18, 0.3], [2.22, 0.55], [2.16, 0.74], [1.15, 0.86], [-1.15, 0.9], [-2.12, 0.86], [-2.22, 0.62]], 1.78);
  const cabina = extruir([[-1.12, 0.86], [1.12, 0.84], [0.42, 1.36], [-0.82, 1.38]], 1.56, 0.03);
  const techo = extruir([[-0.8, 1.36], [0.4, 1.34], [0.36, 1.41], [-0.76, 1.43]], 1.5, 0.02);
  const llanta = [], rin = [];
  for (const [x, z] of [[-0.79, 1.36], [0.79, 1.36], [-0.79, -1.36], [0.79, -1.36]]) {
    llanta.push(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 24).rotateZ(Math.PI / 2).translate(x, 0.33, z));
    rin.push(new THREE.CylinderGeometry(0.2, 0.2, 0.235, 18).rotateZ(Math.PI / 2).translate(x, 0.33, z));
  }
  const luz = (x, y, z) => new THREE.BoxGeometry(0.42, 0.1, 0.06).translate(x, y, z);
  return {
    carroceria: mergeGeometries([carroceria, techo].map((g) => g.toNonIndexed())),
    vidrio: cabina,
    llanta: mergeGeometries(llanta),
    rin: mergeGeometries(rin),
    frente: mergeGeometries([luz(-0.6, 0.66, 2.2), luz(0.6, 0.66, 2.2)]),
    atras: mergeGeometries([luz(-0.62, 0.74, -2.2), luz(0.62, 0.74, -2.2)]),
  };
}

async function iniciar() {
  const [visor, datos] = await Promise.all([listo,
    fetch(`modelo/actores.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json())]);
  const { escena, georef, pedirRender, camara, lienzo } = visor;
  const k = georef.k;
  const grupo = new THREE.Group();
  grupo.name = 'Actores';

  const gPersona = geometriaPersona();
  const personas = [];
  for (const p of datos.personas) {
    const m = new THREE.Mesh(gPersona, new THREE.MeshStandardMaterial({ color: BLANCO, roughness: 0.62, metalness: 0 }));
    m.position.set(p.x, p.y, p.z);
    m.rotation.y = p.rumbo;
    m.scale.setScalar(k);
    m.userData = { ...p, actor: 'persona' };
    grupo.add(m);
    personas.push(m);
  }

  const gV = geometriasVehiculo();
  const comunes = {
    vidrio: new THREE.MeshStandardMaterial({ color: '#1d2731', roughness: 0.08, metalness: 0.65 }),
    llanta: new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.9, metalness: 0 }),
    rin: new THREE.MeshStandardMaterial({ color: '#b7bcc2', roughness: 0.3, metalness: 0.9 }),
    frente: new THREE.MeshStandardMaterial({ color: '#f4f1e6', emissive: '#d8d4c4', emissiveIntensity: 0.35, roughness: 0.2 }),
    atras: new THREE.MeshStandardMaterial({ color: '#b3161b', emissive: '#7a0d10', emissiveIntensity: 0.4, roughness: 0.3 }),
  };
  for (const v of datos.vehiculos) {
    const auto = new THREE.Group();
    auto.add(new THREE.Mesh(gV.carroceria, new THREE.MeshStandardMaterial({ color: v.color, roughness: 0.32, metalness: 0.45 })));
    for (const parte of ['vidrio', 'llanta', 'rin', 'frente', 'atras']) auto.add(new THREE.Mesh(gV[parte], comunes[parte]));
    auto.position.set(v.x, v.y, v.z);
    auto.rotation.y = v.rumbo;
    auto.scale.setScalar(k);
    auto.userData = { ...v, actor: 'vehiculo' };
    grupo.add(auto);
  }
  const sinIndice = (g) => (g.index ? g.toNonIndexed() : g);
  const gAutoIcono = mergeGeometries(['carroceria', 'vidrio', 'llanta', 'rin', 'frente', 'atras'].map((p) => sinIndice(gV[p])), true);
  const materialPoste = new LineMaterial({ color: 0xffffff, linewidth: GROSOR_POSTE_PX, toneMapped: false });
  const iconos = [], partesVehiculos = [];
  for (const obj of [...grupo.children]) {
    const tipo = obj.userData.actor;
    const { x, y, z } = obj.position, top = y + ALTURA_POSTE_M * k;
    const poste = new LineSegments2(new LineSegmentsGeometry().setPositions([x, y, z, x, top, z]), materialPoste);
    poste.renderOrder = 11;
    const icono = tipo === 'persona'
      ? new THREE.Mesh(gPersona, obj.material)
      : new THREE.Mesh(gAutoIcono, [obj.children[0].material, comunes.vidrio, comunes.llanta, comunes.rin, comunes.frente, comunes.atras]);
    icono.position.set(x, top, z);
    icono.frustumCulled = false;
    icono.renderOrder = 12;
    icono.userData = { actor: obj };
    const escala = (ICONO_M[tipo] / (tipo === 'persona' ? ESTATURA_M : LARGO_AUTO_M)) * k;
    icono.onBeforeRender = (_r, _s, cam) => {
      icono.scale.setScalar(escala);
      icono.rotation.set(0, Math.atan2(cam.position.x - icono.position.x, cam.position.z - icono.position.z) + GIRO_ICONO[tipo], 0);
      icono.updateMatrixWorld();
    };
    obj.userData.icono = icono;
    obj.visible = false;
    grupo.add(poste, icono);
    iconos.push(icono);
    if (tipo === 'vehiculo') partesVehiculos.push(poste, icono);
  }
  function verVehiculos(variable) {
    const ver = variable !== 'AQ';
    if (partesVehiculos[0]?.visible === ver) return;
    for (const o of partesVehiculos) o.visible = ver;
    pedirRender();
  }
  addEventListener('message', (ev) => {
    if (ev.origin === location.origin && ev.data?.tipo === 'climatec-rom-estado') verVehiculos(ev.data.variable);
  });
  verVehiculos(window.climatec?.rom?.variable);

  const valores = new Map();
  let hora = null;
  function calcularHI(corrida) {
    const L = window.climatec?.rom?.lineas;
    if (!L?.campo) return;
    hora = corrida;
    const out = [0, 0, 0, 0, 0], o = [0, 0, 0], v = new THREE.Vector3();
    for (const m of personas) {
      const ll = georef.aLonLat(v.copy(m.position));
      const [E, N] = georef.aUTM(ll[0], ll[1]);
      let p = null;
      for (let r = 0; r <= 12 && !p; r += 2) {
        const n = r ? Math.max(8, Math.round(Math.PI * r)) : 1;
        for (let q = 0; q < n && !p; q++) {
          const a = (2 * Math.PI * q) / n, e = E + r * Math.cos(a), nn = N + r * Math.sin(a);
          if (L.campo(e, nn, Z_PERSONA_M, out)) p = { e, n: nn, d: r };
        }
      }
      if (!p) { valores.delete(m); continue; }
      let T = out[3], ev = out[4];
      if (L.corregir) {
        const hz = Math.hypot(out[0], out[1]) || 1;
        o[0] = Math.hypot(out[0], out[1], out[2]); o[1] = T; o[2] = ev;
        if (L.corregir(p.e, p.n, Z_PERSONA_M, out[0] / hz, out[1] / hz, o)) { T = o[1]; ev = o[2]; }
      }
      const HR = Math.min(100, (100 * ev) / presionSaturacion(T));
      const HI = indiceCalor(T, HR), nivel = nivelHI(HI);
      valores.set(m, { T, HR, HI, nivel, d: p.d });
      m.material.color.set(NIVEL_COLOR[nivel - 1]);
      m.material.emissive.set(NIVEL_COLOR[nivel - 1]);
      m.material.emissiveIntensity = 0.32;
    }
    pedirRender();
    if (parent !== window) {
      parent.postMessage({ tipo: 'climatec-hi', corrida, personas: [...valores].map(([m, x]) => ({ id: m.userData.id,
        nombre: m.userData.nombre, contexto: m.userData.contexto, T: x.T, HR: x.HR, HI: x.HI })) }, location.origin);
    }
    console.info('[actores] HI', corrida, Object.fromEntries([...valores].map(([m, x]) => [m.userData.id, `${x.HI.toFixed(1)} °C (${HI_NIVELES[x.nivel - 1]})`])));
  }
  addEventListener('climatec-rom-campo', (ev) => calcularHI(ev.detail?.corrida));
  if (window.climatec?.rom?.lineas) calcularHI(null);


  const CABINA = { exceso: 69 - 40, G: 800, n: 0.55, t50: 31, T0: 21.5 };
  const VIENTO_CABINA = [[0, 1], [5, 24 / 29], [10, 21 / 29]];
  const ESTACIONADO_MIN = [12, 25, 40, 60, 90, 120, 180, 240, 300, 360];
  const T_ALTA = [28, 30, 33, 36], T_BAJA = [6, 4, 1, -2];
  const nivelT = (t) => Math.max(1 + (t >= T_ALTA[0]) + (t > T_ALTA[1]) + (t > T_ALTA[2]) + (t > T_ALTA[3]),
    1 + (t <= T_BAJA[0]) + (t < T_BAJA[1]) + (t < T_BAJA[2]) + (t < T_BAJA[3]));
  const NIVELES_T = ['Acceptable', 'Low', 'Moderate', 'High', 'Extreme'];
  const factorViento = (v) => {
    if (v >= 10) return VIENTO_CABINA[2][1];
    const i = v >= 5 ? 1 : 0, [v0, f0] = VIENTO_CABINA[i], [v1, f1] = VIENTO_CABINA[i + 1];
    return f0 + ((Math.max(v, 0) - v0) / (v1 - v0)) * (f1 - f0);
  };
  const autos = [...grupo.children].filter((o) => o.userData.actor === 'vehiculo');
  const cabinas = new Map();
  function calcularCabinas() {
    const dic = window.climatec?.rom?.diccionario, S = window.climatec?.suelo;
    if (!dic) return;
    const out = [0, 0, 0, 0, 0], v = new THREE.Vector3();
    autos.forEach((a, i) => {
      const [E, N] = georef.aUTM(...georef.aLonLat(v.copy(a.position)));
      if (!dic.muestra(E, N, 2, out)) return;
      const Ta = out[3];
      const W10 = dic.muestra(E, N, 10, out) ? Math.hypot(out[0], out[1]) : 2;
      let G = Math.max(dic.SR ?? 0, 0), luz = G > 0 ? 'sun' : 'night';
      if (S) {
        const ii = Math.floor((a.position.x - S.x0) / S.celda), jj = Math.floor((a.position.z - S.z0) / S.celda);
        const q = jj * S.nx + ii;
        if (ii >= 0 && jj >= 0 && ii < S.nx && jj < S.nz && Number.isFinite(S.SR[q]) && S.clase[q]) {
          G = S.SR[q];
          if (G > 0) luz = S.sombra[q] > 200 ? 'shade' : S.sombra[q] > 25 ? 'partial shade' : 'sun';
        }
      }
      const thetaE = Ta + CABINA.exceso * (G / CABINA.G) ** CABINA.n * factorViento(W10);
      const t = ESTACIONADO_MIN[i % ESTACIONADO_MIN.length];
      const Tc = CABINA.T0 + (thetaE - CABINA.T0) * (1 - 2 ** (-t / CABINA.t50));
      cabinas.set(a, { Tc, thetaE, Ta, G, W10, t, luz, nivel: nivelT(Tc) });
    });
    console.info('[actores] cabinas', Object.fromEntries([...cabinas].map(([a, x]) => [a.userData.id, `${x.Tc.toFixed(1)} °C (${x.t} min)`])));
  }
  addEventListener('climatec-rom-campo', () => setTimeout(calcularCabinas, 0));
  if (window.climatec?.rom?.diccionario) setTimeout(calcularCabinas, 0);

  const aviso = document.createElement('div');
  Object.assign(aviso.style, {
    position: 'fixed', pointerEvents: 'none', display: 'none', zIndex: 30, background: 'rgba(255,255,255,0.97)', color: '#1d2433',
    border: '1px solid #c9d1de', borderRadius: '8px', boxShadow: '0 4px 14px rgba(0,0,0,0.18)', padding: '8px 10px',
    font: '12px/1.4 Poppins, system-ui, sans-serif', width: 'max-content', maxWidth: '260px',
  });
  document.body.appendChild(aviso);
  const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '—');
  function texto(obj) {
    const u = obj.userData;
    if (u.actor === 'vehiculo') {
      const x = cabinas.get(obj);
      if (!x) return '<div style="font-weight:600">Parked Vehicle</div>';
      const celdaV = 'padding:2px 0 2px 12px;text-align:right;white-space:nowrap';
      const filaV = (a, b, estilo = '') => `<tr style="${estilo}"><td style="padding:2px 0;white-space:nowrap">${a}</td><td style="${celdaV}">${b}</td></tr>`;
      const chipV = `<span style="display:inline-block;padding:1px 7px;border-radius:99px;background:${NIVEL_COLOR[x.nivel - 1]};color:${x.nivel >= 4 ? '#fff' : '#1d2433'};font-weight:600">${NIVELES_T[x.nivel - 1]}</span>`;
      return '<div style="font-weight:600;margin-bottom:3px">Parked Vehicle</div><table style="border-collapse:collapse">'
        + filaV('<b>T<sub>cabin</sub></b>', `<b>${fmt(x.Tc)} °C</b>`, `color:${AZUL_TEC}`)
        + filaV('Level', chipV)
        + filaV('Parked for', `${x.t} min`, 'border-top:1px solid #e3e8f0')
        + filaV('T<sub>air</sub>', `${fmt(x.Ta)} °C`) + '</table>';
    }
    const x = valores.get(obj);
    const celda = 'padding:2px 0 2px 12px;text-align:right;white-space:nowrap';
    const fila = (a, b, estilo = '') => `<tr style="${estilo}"><td style="padding:2px 0;white-space:nowrap">${a}</td><td style="${celda}">${b}</td></tr>`;
    const chip = x ? `<span style="display:inline-block;padding:1px 7px;border-radius:99px;background:${NIVEL_COLOR[x.nivel - 1]};color:${x.nivel >= 4 ? '#fff' : '#1d2433'};font-weight:600">${HI_NIVELES[x.nivel - 1]}</span>` : '—';
    return '<table style="border-collapse:collapse">'
      + fila('<b>Heat Index</b>', `<b>${fmt(x?.HI)} °C</b>`, `color:${AZUL_TEC}`)
      + fila('Level', chip)
      + fila('T<sub>air</sub>', `${fmt(x?.T)} °C`, 'border-top:1px solid #e3e8f0')
      + fila('H<sub>R</sub>', `${fmt(x?.HR, 0)} %`) + '</table>';
  }
  const rayo = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const ocultar = () => { aviso.style.display = 'none'; };
  lienzo.addEventListener('pointermove', (ev) => {
    const r = lienzo.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(ndc, camara);
    const ic = rayo.intersectObjects(iconos.filter((i) => i.visible), false)[0]?.object;
    if (!ic) { ocultar(); return; }
    aviso.innerHTML = texto(ic.userData.actor);
    aviso.style.display = 'block';
    const w = aviso.offsetWidth, h = aviso.offsetHeight, z = RESERVADO();
    let x = ev.clientX + 14, y = ev.clientY - h - 12;
    if (x + w > innerWidth - z.derecha - 6) x = ev.clientX - w - 14;
    if (y < z.arriba + 6) y = ev.clientY + 16;
    aviso.style.left = `${Math.max(z.izquierda + 6, Math.min(x, innerWidth - w - 6))}px`;
    aviso.style.top = `${Math.max(6, Math.min(y, innerHeight - h - 6))}px`;
  });
  lienzo.addEventListener('pointerleave', ocultar);

  grupo.traverse((o) => { o.matrixAutoUpdate = true; });
  escena.add(grupo);
  pedirRender();
  window.climatec.actores = { grupo, personas: datos.personas, vehiculos: datos.vehiculos, iconos, texto,
    get hora() { return hora; }, get hi() { return Object.fromEntries([...valores].map(([m, x]) => [m.userData.id, x])); } };
  console.info('[actores] listos', { personas: datos.personas.length, vehiculos: datos.vehiculos.length });
}

if (ACTIVO) iniciar().catch((err) => console.error('[actores]', err));
