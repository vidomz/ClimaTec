import * as THREE from 'three';
import { listo } from './visor.js?v=20261110a';
import { posicionSolar } from './rayo_sol.js?v=20261104a';

const PARAMS = new URLSearchParams(location.search);
const CASO = PARAMS.has('caso') && PARAMS.has('rom');
const ACTIVO = PARAMS.get('semantica') !== null || CASO;
const VERSION = '20261101a';
const CELDA_M = 2, ALTURA_AIRE_M = 2, ALTURA_COPA_M = 6, H_MAX_M = 80, ALCANCE_SOMBRA_M = 300;
const ELEVA_M = 0.05;
const RESERVADO = new URLSearchParams(location.search).get('herramientas') === 'izquierda'
  ? () => ({ arriba: 52, derecha: innerWidth <= 760 ? 252 : 316, izquierda: 62 })
  : () => ({ arriba: 0, derecha: 0, izquierda: 0 });

export const CLASES = {
  1: { clave: 'concreto', nombre: 'Concrete (Sidewalks and Plazas)' },
  2: { clave: 'asfalto', nombre: 'Asphalt (Roads)' },
  3: { clave: 'pasto', nombre: 'Natural Grass' },
  4: { clave: 'sintetico', nombre: 'Artificial Turf (Stadium)' },
};
function claseDe(objeto, material) {
  const o = objeto.name ?? '', m = material?.name ?? '';
  if (/^(Cancha_Americano|EndZone|Lineas_Americano)/.test(o) || /^(EndZone|Lineas_Americano|Cesped_Americano)/.test(m)) return 4;
  if (/^Pasto/.test(m) || /^Cancha( \(shader\))?$/.test(m) || /^Cesped_Futbol/.test(m)) return 3;
  if (/^(Asfalto|LineaBlanca)/.test(m)) return 2;
  if (/^(Piso|Plano_Blanco|Cancha_Azul|Lineas_Cancha)/.test(m)) return 1;
  return 0;
}

function rejeb(sr, taC, u, albedo) {
  const A = sr, B = taC + 273.15, C = Math.min(Math.max(u, 1), 5), D = albedo;
  return 23.38284 + 0.051878 * A + 0.923209 * B - 3.36889 * C - 18.70588 * D - 0.000036 * A * B - 0.002273 * A * C
    - 0.034224 * A * D + 0.008294 * B * C + 0.037607 * B * D + 2.47232 * C * D - 273.15;
}
const ALBEDO = { concreto: 0.25, asfalto: 0.125 };
const B_SINTETICO = ((80.1 + 84.5 + 77.7 + 74.3) / 4 - 32) / 940, B_PASTO = B_SINTETICO * (7 / 24.75);
const CITA = {
  rejeb: 'Rejeb et al. (2022), <i>Case Stud. Constr. Mater.</i> 16, e00923',
  seifeddine: 'Seifeddine et al. (2023), <i>Urban Clim.</i> 51, 101667',
  pfautsch: 'Pfautsch et al. (2022), <i>Build. Environ.</i> 223, 109500',
};
const ECUACION_REJEB = (alb) => `Quadratic correlation T<sub>s</sub>(S<sub>R</sub>, T<sub>air</sub>, W<sub>s</sub>, α), α = ${alb}`;
export const MODELOS = {
  concreto: { Ts: (ta, sr, u) => rejeb(sr, ta, u, ALBEDO.concreto), ecuacion: ECUACION_REJEB(ALBEDO.concreto),
    cita: `${CITA.rejeb}; α: ${CITA.seifeddine}` },
  asfalto: { Ts: (ta, sr, u) => rejeb(sr, ta, u, ALBEDO.asfalto), ecuacion: ECUACION_REJEB(ALBEDO.asfalto),
    cita: `${CITA.rejeb}; α: ${CITA.seifeddine}` },
  pasto: { Ts: (ta, sr) => ta + B_PASTO * sr, ecuacion: `T<sub>s</sub> = T<sub>air</sub> + ${B_PASTO.toFixed(4)}·S<sub>R</sub>`,
    cita: `b from ${CITA.pfautsch}, Table 2` },
  sintetico: { Ts: (ta, sr) => ta + B_SINTETICO * sr, ecuacion: `T<sub>s</sub> = T<sub>air</sub> + ${B_SINTETICO.toFixed(4)}·S<sub>R</sub>`,
    cita: `b from ${CITA.pfautsch}, Table 2` },
};

const T_ALTA = [28, 30, 33, 36], T_BAJA = [6, 4, 1, -2];
export const COLOR_NIVEL = ['#22c363', '#ffd11a', '#ff901a', '#e8432a', '#c71585'];
const RGB_NIVEL = COLOR_NIVEL.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const nivelAlta = (x, l) => 1 + (x >= l[0]) + (x > l[1]) + (x > l[2]) + (x > l[3]);
const nivelBaja = (x, l) => 1 + (x <= l[0]) + (x < l[1]) + (x < l[2]) + (x < l[3]);
const nivelT = (t) => Math.max(nivelAlta(t, T_ALTA), nivelBaja(t, T_BAJA));

function fraccionDifusa(SR, elevacionDeg, dia) {
  const s = Math.sin((elevacionDeg * Math.PI) / 180);
  if (s <= 0.02 || SR <= 0) return 1;
  const kt = Math.min(SR / (1361 * (1 + 0.033 * Math.cos((2 * Math.PI * dia) / 365)) * s), 1);
  if (kt <= 0.22) return 1 - 0.09 * kt;
  if (kt <= 0.8) return 0.9511 - 0.1604 * kt + 4.388 * kt ** 2 - 16.638 * kt ** 3 + 12.336 * kt ** 4;
  return 0.165;
}

let deseado = false, aplicar = null;
addEventListener('message', (ev) => {
  if (ev.origin !== location.origin) return;
  if (ev.data?.tipo === 'climatec-semantica') deseado = !!ev.data.activo;
  else return;
  aplicar?.(deseado);
});

async function iniciar() {
  const visor = await listo;
  const { escena, georef, pedirRender, camara, lienzo, nivelSuelo } = visor;
  const k = georef.k;
  while (!window.climatec.rom?.alturas || !window.climatec.rom?.vegetacion) await new Promise((r) => setTimeout(r, 300));
  const alturas = window.climatec.rom.alturas, veg = window.climatec.rom.vegetacion;
  const recorte = CASO ? await fetch(`datos/caso_fechas.json?v=${VERSION}`, { cache: 'no-cache' })
    .then((r) => r.json()).then((d) => d.lineas?.recorte ?? null).catch(() => null) : null;
  const fuera = (e, n) => !!recorte && (e < recorte.E0 || e > recorte.E1 || n < recorte.N0 || n > recorte.N1);

  const mallas = [];
  const caja = new THREE.Box3();
  escena.updateMatrixWorld();
  escena.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position || o.userData.sueloTermico) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const clase = Math.max(...mats.map((m) => claseDe(o, m)));
    if (!clase) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.y - bb.min.y > 3 * k) return;
    mallas.push({ o, clase });
    if (clase === 1 && /^Piso/.test(mats[0]?.name ?? '')) caja.union(bb);
  });
  const x0 = caja.min.x, z0 = caja.min.z, c = CELDA_M * k;
  const nx = Math.ceil((caja.max.x - x0) / c), nz = Math.ceil((caja.max.z - z0) / c);
  const clase = new Uint8Array(nx * nz);

  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  for (const { o, clase: cl } of mallas) {
    const pos = o.geometry.attributes.position, idx = o.geometry.index, M = o.matrixWorld;
    const nt = idx ? idx.count / 3 : pos.count / 3;
    for (let t = 0; t < nt; t++) {
      const i0 = idx ? idx.getX(3 * t) : 3 * t, i1 = idx ? idx.getX(3 * t + 1) : 3 * t + 1, i2 = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(M); b.fromBufferAttribute(pos, i1).applyMatrix4(M); d.fromBufferAttribute(pos, i2).applyMatrix4(M);
      const ia = Math.max(Math.floor((Math.min(a.x, b.x, d.x) - x0) / c), 0), ib = Math.min(Math.ceil((Math.max(a.x, b.x, d.x) - x0) / c), nx - 1);
      const ja = Math.max(Math.floor((Math.min(a.z, b.z, d.z) - z0) / c), 0), jb = Math.min(Math.ceil((Math.max(a.z, b.z, d.z) - z0) / c), nz - 1);
      const det = (b.z - d.z) * (a.x - d.x) + (d.x - b.x) * (a.z - d.z);
      if (Math.abs(det) < 1e-9) continue;
      for (let j = ja; j <= jb; j++) {
        const pz = z0 + (j + 0.5) * c;
        for (let i = ia; i <= ib; i++) {
          const q = j * nx + i;
          if (clase[q] >= cl) continue;
          const px = x0 + (i + 0.5) * c;
          const l0 = ((b.z - d.z) * (px - d.x) + (d.x - b.x) * (pz - d.z)) / det;
          const l1 = ((d.z - a.z) * (px - d.x) + (a.x - d.x) * (pz - d.z)) / det;
          if (l0 >= -1e-6 && l1 >= -1e-6 && l0 + l1 <= 1 + 1e-6) clase[q] = cl;
        }
      }
    }
  }

  const aUTM = (x, z) => georef.aUTM(...georef.aLonLat(new THREE.Vector3(x, nivelSuelo, z)));
  const [Ea, Na] = aUTM(x0, z0), [Eb, Nb] = aUTM(x0 + 1000, z0), [Ec, Nc] = aUTM(x0, z0 + 1000);
  const ENde = (x, z) => [Ea + ((Eb - Ea) * (x - x0) + (Ec - Ea) * (z - z0)) / 1000, Na + ((Nb - Na) * (x - x0) + (Nc - Na) * (z - z0)) / 1000];
  const E = new Float64Array(nx * nz), N = new Float64Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const q = j * nx + i;
      [E[q], N[q]] = ENde(x0 + (i + 0.5) * c, z0 + (j + 0.5) * c);
      if (clase[q] && (fuera(E[q], N[q]) || alturas.alturaEdificio(E[q], N[q]) > 1)) clase[q] = 0;
    }
  }
  const conteo = Object.fromEntries(Object.values(CLASES).map((x, n) => [x.clave, 0]));
  clase.forEach((v) => { if (v) conteo[CLASES[v].clave]++; });

  const datos = new Uint8Array(4 * nx * nz);
  const textura = new THREE.DataTexture(datos, nx, nz, THREE.RGBAFormat);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.magFilter = THREE.LinearFilter;
  textura.minFilter = THREE.LinearFilter;
  const material = new THREE.ShaderMaterial({
    uniforms: { mapa: { value: textura }, origen: { value: new THREE.Vector2(x0, z0) }, tam: { value: new THREE.Vector2(nx * c, nz * c) },
      eleva: { value: ELEVA_M * k } },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      uniform float eleva;
      varying vec2 vXZ;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        w.y += eleva;
        vXZ = w.xz;
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D mapa;
      uniform vec2 origen, tam;
      varying vec2 vXZ;
      void main() {
        #include <logdepthbuf_fragment>
        vec4 col = texture2D(mapa, (vXZ - origen) / tam);
        if (col.a < 0.5) discard;
        gl_FragColor = vec4(col.rgb, 0.5);
        #include <colorspace_fragment>
      }`,
    transparent: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16, depthWrite: false, toneMapped: false,
  });
  const copias = mallas.map(({ o }) => {
    const m = new THREE.Mesh(o.geometry, material);
    m.userData.sueloTermico = true;
    m.renderOrder = 1;
    m.visible = false;
    o.add(m);
    return m;
  });

  const Ts = new Float32Array(nx * nz).fill(NaN), Ta = new Float32Array(nx * nz), SRl = new Float32Array(nx * nz);
  const Ws = new Float32Array(nx * nz);
  const nivel = new Uint8Array(nx * nz);
  const sombra = new Uint8Array(nx * nz);
  const out = [0, 0, 0, 0, 0];
  const hora = { corrida: null, SR: 0, elevacion: 0, azimut: 0, difusa: 1, conteo: [0, 0, 0, 0, 0], frio: false };
  const copaEn = (e, n) => {
    const i = Math.floor((e - veg.E0) / veg.celda), j = Math.floor((n - veg.N0) / veg.celda);
    return i >= 0 && j >= 0 && i < veg.nx && j < veg.ny ? veg.copa[j * veg.nx + i] : 0;
  };
  const R = new Float32Array(nx * nz), G = new Float32Array(nx * nz), B = new Float32Array(nx * nz), P = new Float32Array(nx * nz);
  const tR = new Float32Array(nx * nz), tG = new Float32Array(nx * nz), tB = new Float32Array(nx * nz), tP = new Float32Array(nx * nz);
  const NUCLEO = [1, 4, 6, 4, 1];
  function pasada(paso, largo, cuenta, origenes, destinos) {
    const [r0, g0, b0, p0] = origenes, [r1, g1, b1, p1] = destinos;
    for (let linea = 0; linea < cuenta; linea++) {
      const base = paso === 1 ? linea * nx : linea;
      for (let a = 0; a < largo; a++) {
        let r = 0, g = 0, b = 0, p = 0;
        for (let d = -2; d <= 2; d++) {
          const x = a + d;
          if (x < 0 || x >= largo) continue;
          const q = base + x * paso, w = NUCLEO[d + 2] * p0[q];
          r += w * r0[q]; g += w * g0[q]; b += w * b0[q]; p += w;
        }
        const q = base + a * paso;
        r1[q] = p > 0 ? r / p : 0; g1[q] = p > 0 ? g / p : 0; b1[q] = p > 0 ? b / p : 0; p1[q] = p > 0 ? p / 16 : 0;
      }
    }
  }
  function suavizar() {
    for (let q = 0; q < R.length; q++) {
      const o = 4 * q;
      P[q] = datos[o + 3] ? 1 : 0;
      R[q] = datos[o]; G[q] = datos[o + 1]; B[q] = datos[o + 2];
    }
    pasada(1, nx, nz, [R, G, B, P], [tR, tG, tB, tP]);
    pasada(nx, nz, nx, [tR, tG, tB, tP], [R, G, B, P]);
    for (let q = 0; q < R.length; q++) {
      if (P[q] <= 0) continue;
      const o = 4 * q;
      datos[o] = Math.round(R[q]); datos[o + 1] = Math.round(G[q]); datos[o + 2] = Math.round(B[q]);
    }
  }
  function sombraCelda(q, dE, dN, tanE, alcance, dCopa) {
    for (let dd = CELDA_M; dd <= alcance; dd += CELDA_M) {
      if (alturas.alturaEdificio(E[q] + dE * dd, N[q] + dN * dd) > dd * tanE) return 1;
    }
    return copaEn(E[q] + dE * dCopa, N[q] + dN * dCopa);
  }
  function tCelda(q, SR, difusa, elevacion, azimut, ta, u, material) {
    const modelo = MODELOS[material ?? CLASES[clase[q]]?.clave];
    if (!modelo) return NaN;
    let s = 0;
    if (SR > 0 && elevacion > 0) {
      const tanE = Math.tan((Math.max(elevacion, 0.1) * Math.PI) / 180);
      s = sombraCelda(q, Math.sin((azimut * Math.PI) / 180), Math.cos((azimut * Math.PI) / 180), tanE,
        Math.min(ALCANCE_SOMBRA_M, H_MAX_M / tanE), Math.min(ALTURA_COPA_M / tanE, 60));
    }
    return modelo.Ts(ta, SR * (difusa + (1 - difusa) * (1 - s)), u);
  }
  function calcular(corrida) {
    const dic = window.climatec.rom?.diccionario;
    if (!dic || !corrida) return false;
    const m = /(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/.exec(corrida);
    const t = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + 6, +m[5])) : new Date();
    const [lon, lat] = georef.aLonLat(new THREE.Vector3(x0 + (nx * c) / 2, nivelSuelo, z0 + (nz * c) / 2));
    const sol = posicionSolar(t, lat, lon);
    const dia = Math.floor((t - Date.UTC(t.getUTCFullYear(), 0, 0)) / 864e5);
    Object.assign(hora, { corrida, SR: Math.max(dic.SR ?? 0, 0), elevacion: sol.elevacion, azimut: sol.azimut });
    hora.difusa = fraccionDifusa(hora.SR, sol.elevacion, dia);
    const dE = Math.sin((sol.azimut * Math.PI) / 180), dN = Math.cos((sol.azimut * Math.PI) / 180);
    const tanE = Math.tan((Math.max(sol.elevacion, 0.1) * Math.PI) / 180);
    const alcance = Math.min(ALCANCE_SOMBRA_M, H_MAX_M / tanE), dCopa = Math.min(ALTURA_COPA_M / tanE, 60);
    let tMedia = 0, nMedia = 0;
    for (let q = 0; q < Ta.length; q++) {
      if (clase[q] && dic.muestra(E[q], N[q], ALTURA_AIRE_M, out)) {
        Ta[q] = out[3]; Ws[q] = Math.hypot(out[0], out[1]); tMedia += out[3]; nMedia++;
      } else { Ta[q] = NaN; Ws[q] = NaN; }
    }
    tMedia = nMedia ? tMedia / nMedia : 25;
    for (let q = 0; q < Ts.length; q++) {
      if (!clase[q]) { Ts[q] = NaN; continue; }
      const s = hora.SR > 0 && sol.elevacion > 0 ? sombraCelda(q, dE, dN, tanE, alcance, dCopa) : 0;
      sombra[q] = Math.round(s * 255);
      const sr = hora.SR * (hora.difusa + (1 - hora.difusa) * (1 - s));
      SRl[q] = sr;
      const ta = Number.isFinite(Ta[q]) ? Ta[q] : tMedia;
      const modelo = MODELOS[CLASES[clase[q]].clave];
      Ts[q] = modelo ? modelo.Ts(ta, sr, Number.isFinite(Ws[q]) ? Ws[q] : 2) : NaN;
    }
    const conteo = [0, 0, 0, 0, 0];
    let frio = false;
    for (let q = 0; q < Ts.length; q++) {
      const o = 4 * q;
      if (!Number.isFinite(Ts[q])) { nivel[q] = 0; datos[o + 3] = 0; continue; }
      nivel[q] = nivelT(Ts[q]);
      if (nivel[q] > 1 && Ts[q] <= T_BAJA[0]) frio = true;
      conteo[nivel[q] - 1]++;
      const rgb = RGB_NIVEL[nivel[q] - 1];
      datos[o] = rgb[0]; datos[o + 1] = rgb[1]; datos[o + 2] = rgb[2]; datos[o + 3] = 255;
    }
    suavizar();
    Object.assign(hora, { conteo, frio });
    textura.needsUpdate = true;
    parent.postMessage({ tipo: 'climatec-suelo-niveles', conteo, frio }, location.origin);
    dispatchEvent(new CustomEvent('climatec-suelo-calculado', { detail: { corrida } }));
    pedirRender();
    return true;
  }
  addEventListener('climatec-rom-campo', (ev) => calcular(ev.detail?.corrida));
  calcular(window.climatec.rom?.corrida);

  const aviso = document.createElement('div');
  Object.assign(aviso.style, {
    position: 'fixed', pointerEvents: 'none', display: 'none', zIndex: 30, background: 'rgba(255,255,255,0.96)', color: '#1d2433',
    border: '1px solid #c9d1de', borderRadius: '6px', boxShadow: '0 3px 9px rgba(0,0,0,0.17)', padding: '4.5px 8.25px',
    font: '11.25px/1.35 Poppins, system-ui, sans-serif', width: 'max-content', whiteSpace: 'nowrap',
  });
  document.body.appendChild(aviso);
  const fmt = (x, dd = 1) => (Number.isFinite(x) ? x.toFixed(dd) : '—');
  const SUBINDICE = { concreto: 'concrete', asfalto: 'asphalt', pasto: 'grass', sintetico: 'turf' };
  function texto(q, pp) {
    const [lon, lat] = georef.aLonLat(pp);
    return `<div style="font-weight:600">T<sub>${SUBINDICE[CLASES[clase[q]].clave]}</sub> = ${fmt(Ts[q])} °C</div>`
      + `<div style="font-size:9.75px;color:#5b6577">${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}, `
      + `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'E' : 'W'}</div>`;
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -nivelSuelo);
  const p = new THREE.Vector3();
  function tapado(pp) {
    const [e1, n1] = ENde(pp.x, pp.z), [e0, n0] = ENde(camara.position.x, camara.position.z);
    const h0 = (camara.position.y - nivelSuelo) / k, L = Math.hypot(e1 - e0, n1 - n0), pasos = Math.min(Math.ceil(L / 2), 600);
    for (let s = 1; s < pasos; s++) {
      const f = s / pasos;
      if (alturas.alturaEdificio(e0 + f * (e1 - e0), n0 + f * (n1 - n0)) > h0 * (1 - f)) return true;
    }
    return false;
  }
  const ocultar = () => { aviso.style.display = 'none'; };
  lienzo.addEventListener('pointermove', (ev) => {
    if (!copias[0]?.visible || !hora.corrida) return;
    if (ev.tarjetaCara) { ocultar(); return; }
    const r = lienzo.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camara);
    if (!ray.ray.intersectPlane(plano, p)) { ocultar(); return; }
    const i = Math.floor((p.x - x0) / c), j = Math.floor((p.z - z0) / c);
    const q = i >= 0 && j >= 0 && i < nx && j < nz ? j * nx + i : -1;
    if (q < 0 || !clase[q] || !Number.isFinite(Ts[q]) || tapado(p)) { ocultar(); return; }
    aviso.innerHTML = texto(q, p);
    aviso.style.display = 'block';
    const w = aviso.offsetWidth, h = aviso.offsetHeight, z = RESERVADO();
    let x = ev.clientX + 11, y = ev.clientY - h - 9;
    if (x + w > innerWidth - z.derecha - 6) x = ev.clientX - w - 11;
    if (y < z.arriba + 6) y = ev.clientY + 12;
    aviso.style.left = `${Math.max(z.izquierda + 6, Math.min(x, innerWidth - w - 6))}px`;
    aviso.style.top = `${Math.max(6, Math.min(y, innerHeight - h - 6))}px`;
  });
  lienzo.addEventListener('pointerleave', ocultar);
  window.climatec.controles?.addEventListener('change', ocultar);


  aplicar = (si) => {
    for (const m of copias) m.visible = si;
    if (!si) ocultar();
    pedirRender();
  };
  aplicar(deseado);
  window.climatec.suelo = { clase, nx, nz, x0, z0, celda: c, Ts, Ta, SR: SRl, Ws, sombra, nivel, hora, conteo, calcular, MODELOS,
    ocultarTarjeta: ocultar, rejeb, recorte, tCelda, fraccionDifusa };
  console.info('[suelo] listo', { celdas: nx * nz, ...conteo });
}

if (ACTIVO) iniciar().catch((err) => console.error('[suelo]', err));
