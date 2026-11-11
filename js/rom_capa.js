import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { listo } from './visor.js?v=20261110a';
import { modeloVegetacion } from './vegetacion_rom.js?v=20261022n';
import { crearCielo, cieloEnTiempoReal } from './cielo.js?v=20261030a';

const ACTIVO = new URLSearchParams(location.search).has('rom');
const VERSION = '20261030b';

const SEMILLAS_MUESTRA = 420;
const SEMILLAS_FUERA = 380;
const PASO_M = 2.0;
const LARGO_MAX_M = 3000;
const PASO_RELLENO_M = 9;
const ALTURAS_RELLENO_M = [1.5, 4, 8, 14];
const RADIO_HUECO_M = 7;
const RADIO_UNION_M = 1.2;
const RADIO_CIERRE_M = 6;
const LARGO_MAX_RELLENO_M = 900;
const TIEMPO_RELLENO_MS = 2500;
const TECHO_MIN_M = 6, TECHO_SOBRE_M = 1.5, VECINDAD_M = 12;
const TECHO_MIN_T_M = 3.5, ALTURAS_RELLENO_T_M = [1.5, 2.5, 4, 8];
const DESCENSO_T_M = 0.4, PEATON_T_M = 2.5;
const TECHO_COLONIA_M = 3;
const CERCA_CASA_M = 8, TRANSICION_CASA_M = 12;
const MATERIAL_CASA = /^(CASAS|OXXO)/;
const NO_EDIFICIO = /^(Luminaria|Poste|Postes_|Reja|Semaforo|Senal|Tubular|Porteria|Letrero|OXXO_Letrero|Lineas|LineaBlanca|Cancha|EndZone|Copa_|Pasto|Piso|Asfalto|Plano_Blanco|Material\.)/;
const HOLGURA_EDIFICIO_M = 0.3;
const SIN_EDIFICIOS = new URLSearchParams(location.search).has('sinedificios');
const GIRO_BIFURCA = 40, SEPARACION_BIFURCA_M = 15, BIFURCACIONES_POR_LINEA = 3, TIEMPO_BIFURCACION_MS = 1500;
const SIN_UNION_RAMA_M = 10;
const RADIO_RODEO_M = 16, AVANCE_RODEO_M = 8, ALINEADO_RODEO = 0.6, RODEOS_POR_MITAD = 6;
const RADIO_RODEO_AMPLIO_M = 24, RADIO_RODEO_ULTIMO_M = 40;
const CERCA_TEC_M = 20, TRANSICION_TEC_M = 40;
const MARGEN_PISO_M = 4;
const ALTURA_MIN_CAMPO_M = 0.5, TECHO_CAMPO_M = 1.5;
const MARGEN_CAMPO_M = 8, TRANSICION_CAMPO_M = 20;
const RADIO_TRONCO_M = 1.0, ALTURA_TRONCO_M = 3;
const AREA_PARQUE_M2 = 1500;
const SUAVIZADO_PASADAS = 3;
const MEZCLA_M = 20;
const ANOMALIA_RADIO_M = 40;
const Z0 = 1 / 9.793;
const VIENTO_MIN = 0.03;
const ALTURA_MIN_M = 1.2;
const GIROS = [20, -20, 40, -40, 60, -60, 80, -80, 100, -100];
const DENSIDAD_MAX = 1;
const LEJOS_ACEPTA = 0.25;
const GROSOR_PX = 2.2;
const RAPIDEZ_ANIMACION = 1.5;
const FLECHAS = {
  U: { grosor: 4, periodo: 2.2, largo: 1.2, colita: 0 },
  T: { grosor: 4.3, periodo: 1.6, largo: 1.3, colita: 0.8 },
};
const GROSOR_COLITA = 0.4;

const PURPLEAIR = {
  I: ['228383', 'Estadio Banorte'], II: ['286240', 'Casa Naranjos'], III: ['228407', 'CEDES'], IV: ['227879', 'Rectoría'],
  V: ['308956', 'Jardín de las Carreras'], VI: ['285170', 'Residencias XII'], VII: ['305232', 'Ancira Mty'],
  VIII: ['286238', 'Oasis'], IX: ['284960', 'Altavista'], X: ['292893', 'TEC-AMM-RB-005'],
};
const ALTURA_POSTE_M = 37.5;
const PUNTO_ESCALA = 0.03;
const GROSOR_POSTE_PX = 1.5;
const Z_SENSOR_M = 1.5;
const AZUL_TEC = '#0039a6';

const PUNTOS_TOTAL = 26000;
const Z_VIENTO_PUNTOS_M = 2;
const ACELERACION = 6;
const VIDA_S = [1.5, 4];
const DIFUSION_M = 0.8;
const ALTURA_PUNTOS_M = [1.2, 3.5];
const TAM_PUNTO_PX = 4;
const ESCALA_F = [0, 2.25];
const YLORRD = ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'];
const PASO_MAPA_F_M = 2, Z_MAPA_F_M = 0.04, OPACIDAD_MAPA_F = 0.82;
const OPACIDAD_ARBOLES = 0.4;
const SOL_NOCHE_DEG = 10, HORA_TARDE = 15;
const CIELO_RELOJ = new URLSearchParams(location.search).get('cielo') === 'reloj';

const $ = (id) => document.getElementById(id);

function transformacion(rejilla) {
  const { origen: [ox, oz], paso_i: [ax, az], paso_j: [bx, bz] } = rejilla.three;
  const det = ax * bz - az * bx;
  return {
    aCelda: (X, Z) => {
      const dx = X - ox, dz = Z - oz;
      return [(bz * dx - bx * dz) / det, (-az * dx + ax * dz) / det];
    },
    aThree: (i, j) => [ox + i * ax + j * bx, oz + i * az + j * bz],
  };
}

function posiciones(g, e = null) {
  const pos = g.attributes.position;
  const W = new Float32Array(pos.count * 3);
  for (let v = 0; v < pos.count; v++) {
    const px = pos.getX(v), py = pos.getY(v), pz = pos.getZ(v);
    if (!e) { W[3 * v] = px; W[3 * v + 1] = py; W[3 * v + 2] = pz; continue; }
    W[3 * v] = e[0] * px + e[4] * py + e[8] * pz + e[12];
    W[3 * v + 1] = e[1] * px + e[5] * py + e[9] * pz + e[13];
    W[3 * v + 2] = e[2] * px + e[6] * py + e[10] * pz + e[14];
  }
  return W;
}

const presionSaturacion = (t) => 6.112 * Math.exp((17.62 * t) / (243.12 + t));
const VARIABLES = {
  U: (U) => U * 3.6,
  T: (U, T) => T,
};

const INICIO_TURBO = 0.1;
const TURBO = Array.from({ length: 256 }, (_, n) => {
  const x = INICIO_TURBO + ((1 - INICIO_TURBO) * n) / 255;
  const r = 0.13572138 + x * (4.6153926 + x * (-42.66032258 + x * (132.13108234 + x * (-152.94239396 + x * 59.28637943))));
  const g = 0.09140261 + x * (2.19418839 + x * (4.84296658 + x * (-14.18503333 + x * (4.27729857 + x * 2.82956604))));
  const b = 0.1066733 + x * (12.64194608 + x * (-60.58204836 + x * (110.36276771 + x * (-89.90310912 + x * 27.34824973))));
  const c = new THREE.Color().setRGB(...[r, g, b].map((v) => Math.min(Math.max(v, 0), 1)), THREE.SRGBColorSpace);
  return [c.r, c.g, c.b];
});

let indice3d = null;
const campos3d = new Map();

function anomaliaMuestra(c, dic) {
  if (c.anomalia) return;
  const { nx, ny, nz, paso, E0, N0, T } = c, capa = nx * ny, s = [0, 0, 0, 0, 0];
  const Td = new Float32Array(capa).fill(NaN);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (dic.muestra(E0 + i * paso, N0 + j * paso, 10, s)) Td[j * nx + i] = s[3];
  const D = new Float32Array(T.length);
  for (let q = 0; q < T.length; q++) D[q] = Number.isFinite(T[q]) && Number.isFinite(Td[q % capa]) ? T[q] - Td[q % capa] : NaN;
  const R = referenciaPeaton(D, nx, ny, paso);
  for (let q = 0; q < T.length; q++) if (Number.isFinite(D[q])) T[q] = Td[q % capa] + D[q] - R[q % capa];
  c.anomalia = true;
}

const carpetaPropia = (corrida) => (corrida.startsWith('tiemporeal_') ? `rom/tiempo_real/${corrida}/`
  : corrida.startsWith('caso_') ? `rom/caso/${corrida}/` : null);
const indicesManuales = new Map();
async function indiceManual(corrida) {
  if (!indicesManuales.has(corrida)) {
    indicesManuales.set(corrida, await fetch(`${carpetaPropia(corrida)}indice.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json()));
  }
  return indicesManuales.get(corrida);
}

async function cargarCampo3D(corrida, fuente) {
  indice3d ??= await fetch(`rom/campos3d/indice.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json());
  const clave = `${corrida}_${fuente}`;
  if (campos3d.has(clave)) return campos3d.get(clave);
  const propia = carpetaPropia(corrida);
  const info = (await indiceManual(corrida)).campo3d;
  const ruta = `${propia}campo3d_ROM.bin`;
  const buf = await fetch(`${ruta}?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.arrayBuffer());
  const { nx, ny, niveles, paso, E0, N0 } = indice3d.rejilla;
  const nz = niveles.length, n = nx * ny * nz;
  const b = new Int8Array(buf, 0, 4 * n);
  const u = new Float32Array(n), v = new Float32Array(n), w = new Float32Array(n), T = new Float32Array(n);
  for (let q = 0; q < n; q++) {
    if (b[q] === -128) { u[q] = v[q] = w[q] = T[q] = NaN; continue; }
    u[q] = b[q] * info.escala_uvw;
    v[q] = b[n + q] * info.escala_uvw;
    w[q] = b[2 * n + q] * info.escala_uvw;
    T[q] = (b[3 * n + q] + 127) * info.escala_T + info.T_min;
  }
  const campo = { nx, ny, nz, niveles, paso, E0, N0, u, v, w, T, e: new Float32Array(buf, 4 * n, nx * ny) };
  campos3d.clear();
  campos3d.set(clave, campo);
  return campo;
}

function muestreador(c) {
  const { nx, ny, nz, niveles, paso, E0, N0, u, v, w, T, e } = c;
  const capa = nx * ny, techo = niveles[nz - 1];
  return (E, N, z, out) => {
    const fi = (E - E0) / paso, fj = (N - N0) / paso;
    if (!(fi >= 0 && fj >= 0 && fi < nx - 1 && fj < ny - 1 && z < techo)) return false;
    let k = 0, tk = 0;
    if (z > niveles[0]) {
      while (k < nz - 2 && niveles[k + 1] <= z) k++;
      tk = (z - niveles[k]) / (niveles[k + 1] - niveles[k]);
    }
    const i = Math.floor(fi), j = Math.floor(fj), ti = fi - i, tj = fj - j;
    let su = 0, sv = 0, sw = 0, sT = 0, se = 0, sp = 0, sq = 0;
    for (let c8 = 0; c8 < 8; c8++) {
      const di = c8 & 1, dj = (c8 >> 1) & 1, dk = c8 >> 2;
      const p = (di ? ti : 1 - ti) * (dj ? tj : 1 - tj) * (dk ? tk : 1 - tk);
      if (p <= 0) continue;
      const col = (j + dj) * nx + i + di;
      const q = (k + dk) * capa + col;
      if (Number.isNaN(u[q])) continue;
      su += p * u[q]; sv += p * v[q]; sw += p * w[q]; sT += p * T[q]; sp += p;
      if (Number.isFinite(e[col])) { se += p * e[col]; sq += p; }
    }
    if (sp < 0.35) return false;
    out[0] = su / sp; out[1] = sv / sp; out[2] = sw / sp; out[3] = sT / sp; out[4] = sq > 0 ? se / sq : NaN;
    return true;
  };
}

function mediaLocal(V, W, nx, ny, r) {
  let a = Float64Array.from(V, (x, q) => x * W[q]), b = Float64Array.from(W);
  const caja = (A, largo, paso, cuantas, salto) => {
    const fila = new Float64Array(largo + 1), sal = new Float64Array(A.length);
    for (let c = 0; c < cuantas; c++) {
      const base = c * salto;
      for (let q = 0; q < largo; q++) fila[q + 1] = fila[q] + A[base + q * paso];
      for (let q = 0; q < largo; q++) sal[base + q * paso] = fila[Math.min(q + r + 1, largo)] - fila[Math.max(q - r, 0)];
    }
    return sal;
  };
  for (let pasada = 0; pasada < 2; pasada++) {
    a = caja(caja(a, nx, 1, ny, nx), ny, nx, nx, 1);
    b = caja(caja(b, nx, 1, ny, nx), ny, nx, nx, 1);
  }
  return Float32Array.from(a, (x, q) => (b[q] > 1e-6 ? x / b[q] : NaN));
}

function referenciaPeaton(D, nx, ny, celda) {
  const capa = nx * ny, V = new Float32Array(capa), W = new Float32Array(capa);
  for (let q = 0; q < capa; q++) {
    let sv = 0, sw = 0;
    for (const k of [0, 1]) { const x = D[k * capa + q]; if (Number.isFinite(x)) { sv += x; sw++; } }
    if (sw) { V[q] = sv / sw; W[q] = 1; }
  }
  const R = mediaLocal(V, W, nx, ny, Math.round(ANOMALIA_RADIO_M / celda));
  for (let q = 0; q < capa; q++) if (!Number.isFinite(R[q])) R[q] = 0;
  return R;
}

function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


function campoDiccionario(dic) {
  const xs = [...new Set(dic.x)].sort((a, b) => a - b), ys = [...new Set(dic.y)].sort((a, b) => a - b);
  const d = xs[1] - xs[0];
  const nx = Math.round((xs.at(-1) - xs[0]) / d) + 1, ny = Math.round((ys.at(-1) - ys[0]) / d) + 1;
  const U = new Float32Array(nx * ny).fill(NaN), V = U.slice(), T = U.slice(), E = U.slice();
  dic.x.forEach((x, n) => {
    const q = Math.round((dic.y[n] - ys[0]) / d) * nx + Math.round((x - xs[0]) / d);
    const ws = dic.valores.Ws[n] / 3.6, wd = (dic.valores.Wd[n] * Math.PI) / 180, t = dic.valores.T[n];
    U[q] = -ws * Math.sin(wd);
    V[q] = -ws * Math.cos(wd);
    T[q] = t;
    E[q] = (dic.valores.HR[n] / 100) * presionSaturacion(t);
  });
  const perfil10 = Math.log((10 + Z0) / Z0);
  const media = (A) => { const x = A.filter((a) => a !== null); return x.reduce((a, b) => a + b, 0) / x.length; };
  return {
    limites: { E0: xs[0], E1: xs.at(-1), N0: ys[0], N1: ys.at(-1) },
    SR: media(dic.valores.SR), Patm: media(dic.valores.Patm),
    solArriba: Array.isArray(dic.entradas?.sol_arriba) ? media(dic.entradas.sol_arriba) : (dic.entradas?.sol_arriba ?? 0),
    estaciones: dic.estaciones ?? [],
    muestra(Ep, Np, z, out) {
      const fi = (Ep - xs[0]) / d, fj = (Np - ys[0]) / d;
      if (!(fi >= 0 && fj >= 0 && fi < nx - 1 && fj < ny - 1)) return false;
      const i = Math.floor(fi), j = Math.floor(fj), s = fi - i, t = fj - j;
      const f = Math.log((Math.max(z, 0.2) + Z0) / Z0) / perfil10;
      let su = 0, sv = 0, sT = 0, se = 0, sw = 0;
      for (const [di, dj, w] of [[0, 0, (1 - s) * (1 - t)], [1, 0, s * (1 - t)], [0, 1, (1 - s) * t], [1, 1, s * t]]) {
        const q = (j + dj) * nx + i + di;
        if (w <= 0 || Number.isNaN(U[q])) continue;
        su += w * U[q]; sv += w * V[q]; sT += w * T[q]; se += w * E[q]; sw += w;
      }
      if (sw < 0.3) return false;
      out[0] = (su / sw) * f; out[1] = (sv / sw) * f; out[2] = 0; out[3] = sT / sw; out[4] = se / sw;
      return true;
    },
  };
}

function mapaAlturas({ escena, nivelSuelo, k }, tr, rejilla, lim, ocultos = new Set()) {
  const c = rejilla.celda;
  const E0 = Math.floor((lim.E0 - 20) / c) * c, N0 = Math.floor((lim.N0 - 20) / c) * c;
  const nx = Math.ceil((lim.E1 + 20 - E0) / c), ny = Math.ceil((lim.N1 + 20 - N0) / c);
  const h = new Float32Array(nx * ny), he = new Float32Array(nx * ny), casa = new Uint8Array(nx * ny);
  const P = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const yMin = nivelSuelo + 1.5 * k;
  escena.updateMatrixWorld();
  escena.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.name) return;
    for (let p = o; p; p = p.parent) if (ocultos.has(p)) return;
    const esCasa = MATERIAL_CASA.test(o.material?.name ?? '');
    const esEdificio = !NO_EDIFICIO.test(o.material?.name ?? '');
    const g = o.geometry, pos = g.attributes.position;
    if (!pos) return;
    if (!g.boundingBox) g.computeBoundingBox();
    if (new THREE.Box3().copy(g.boundingBox).applyMatrix4(o.matrixWorld).max.y < yMin) return;
    const W = posiciones(g, o.matrixWorld.elements), idx = g.index?.array;
    const nt = (idx ? idx.length : pos.count) / 3;
    for (let t = 0; t < nt; t++) {
      for (let v = 0; v < 3; v++) {
        const q = idx ? idx[3 * t + v] : 3 * t + v;
        const [ic, jc] = tr.aCelda(W[3 * q], W[3 * q + 2]);
        P[v][0] = (rejilla.E0 + c * ic - E0) / c; P[v][1] = (rejilla.N0 + c * jc - N0) / c; P[v][2] = W[3 * q + 1];
      }
      if (Math.min(P[0][2], P[1][2], P[2][2]) < yMin) continue;
      const [a, b, cc] = P;
      const det = (b[1] - cc[1]) * (a[0] - cc[0]) + (cc[0] - b[0]) * (a[1] - cc[1]);
      const z = (Math.max(a[2], b[2], cc[2]) - nivelSuelo) / k;
      const i0 = Math.max(Math.floor(Math.min(a[0], b[0], cc[0])), 0), i1 = Math.min(Math.ceil(Math.max(a[0], b[0], cc[0])), nx - 1);
      const j0 = Math.max(Math.floor(Math.min(a[1], b[1], cc[1])), 0), j1 = Math.min(Math.ceil(Math.max(a[1], b[1], cc[1])), ny - 1);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          if (Math.abs(det) > 1e-9) {
            const l1 = ((b[1] - cc[1]) * (i + 0.5 - cc[0]) + (cc[0] - b[0]) * (j + 0.5 - cc[1])) / det;
            const l2 = ((cc[1] - a[1]) * (i + 0.5 - cc[0]) + (a[0] - cc[0]) * (j + 0.5 - cc[1])) / det;
            if (l1 < -0.05 || l2 < -0.05 || 1 - l1 - l2 < -0.05) continue;
          }
          const q = j * nx + i;
          if (z > h[q]) h[q] = z;
          if (esEdificio && z > he[q]) he[q] = z;
          if (esCasa) casa[q] = 1;
        }
      }
    }
  });
  const dc = new Float32Array(nx * ny);
  for (let q = 0; q < nx * ny; q++) dc[q] = casa[q] ? 0 : 1e9;
  const d1 = c, d2 = c * Math.SQRT2;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const q = j * nx + i;
    let v = dc[q];
    if (i > 0) v = Math.min(v, dc[q - 1] + d1);
    if (j > 0) { v = Math.min(v, dc[q - nx] + d1); if (i > 0) v = Math.min(v, dc[q - nx - 1] + d2); if (i < nx - 1) v = Math.min(v, dc[q - nx + 1] + d2); }
    dc[q] = v;
  }
  for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const q = j * nx + i;
    let v = dc[q];
    if (i < nx - 1) v = Math.min(v, dc[q + 1] + d1);
    if (j < ny - 1) { v = Math.min(v, dc[q + nx] + d1); if (i < nx - 1) v = Math.min(v, dc[q + nx + 1] + d2); if (i > 0) v = Math.min(v, dc[q + nx - 1] + d2); }
    dc[q] = v;
  }
  const ladoBusqueda = 2 * Math.round(RADIO_RODEO_ULTIMO_M / c) + 1;
  const busqueda = { n: 0, visto: new Uint32Array(nx * ny), padre: new Int32Array(nx * ny), cola: new Int32Array(ladoBusqueda * ladoBusqueda) };
  const r = Math.round(VECINDAD_M / c);
  const tmp = new Float32Array(nx * ny), techo = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let m = 0;
    for (let d = -r; d <= r; d++) { const ii = i + d; if (ii >= 0 && ii < nx) m = Math.max(m, h[j * nx + ii]); }
    tmp[j * nx + i] = m;
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let m = 0;
    for (let d = -r; d <= r; d++) { const jj = j + d; if (jj >= 0 && jj < ny) m = Math.max(m, tmp[jj * nx + i]); }
    techo[j * nx + i] = m + TECHO_SOBRE_M;
  }
  const indice = (E, N) => {
    const i = Math.floor((E - E0) / c), j = Math.floor((N - N0) / c);
    return i >= 0 && j >= 0 && i < nx && j < ny ? j * nx + i : -1;
  };
  return {
    raster: { E0, N0, celda: c, nx, ny, h, he },
    altura: (E, N) => { const q = indice(E, N); return q < 0 ? 0 : h[q]; },
    alturaEdificio: (E, N) => { const q = indice(E, N); return q < 0 ? 0 : he[q]; },
    esCasa: (E, N) => { const q = indice(E, N); return q >= 0 && casa[q] === 1; },
    cercaCasa: (E, N) => {
      const q = indice(E, N);
      if (q < 0) return 0;
      const x = Math.min(Math.max((dc[q] - CERCA_CASA_M) / TRANSICION_CASA_M, 0), 1);
      return 1 - x * x * (3 - 2 * x);
    },
    rodeo: (E, N, z, dx, dy, valida, radio = RADIO_RODEO_M) => {
      const i0 = Math.floor((E - E0) / c), j0 = Math.floor((N - N0) / c);
      if (i0 < 0 || j0 < 0 || i0 >= nx || j0 >= ny) return null;
      const R = Math.round(radio / c), q0 = j0 * nx + i0;
      const marca = ++busqueda.n;
      busqueda.visto[q0] = marca;
      busqueda.cola[0] = q0;
      let fin = 1;
      for (let a = 0; a < fin; a++) {
        const q = busqueda.cola[a], i = q % nx, j = (q - i) / nx;
        const Ec = E0 + (i + 0.5) * c, Nc = N0 + (j + 0.5) * c;
        if (a > 0 && (Ec - E) * dx + (Nc - N) * dy >= AVANCE_RODEO_M && valida(Ec, Nc)) {
          const camino = [];
          for (let r = q; r !== q0; r = busqueda.padre[r]) { const ii = r % nx; camino.unshift(E0 + (ii + 0.5) * c, N0 + ((r - ii) / nx + 0.5) * c); }
          return camino;
        }
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = i + di, jj = j + dj, n = jj * nx + ii;
          if ((!di && !dj) || ii < 0 || jj < 0 || ii >= nx || jj >= ny || Math.abs(ii - i0) > R || Math.abs(jj - j0) > R || busqueda.visto[n] === marca) continue;
          busqueda.visto[n] = marca;
          if (h[n] > z - 0.3) continue;
          if (di && dj && (h[j * nx + ii] > z - 0.3 || h[jj * nx + i] > z - 0.3)) { busqueda.visto[n] = 0; continue; }
          busqueda.padre[n] = q;
          busqueda.cola[fin++] = n;
        }
      }
      return null;
    },
    techo: (E, N, minimo = TECHO_MIN_M) => { const q = indice(E, N); return q < 0 ? minimo : Math.max(minimo, techo[q]); },
  };
}

async function cercaniaTec(piso, tr, rejilla) {
  const img = await new Promise((ok, mal) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => mal(new Error('no se pudo leer modelo/mascara_campus.png'));
    i.src = 'modelo/mascara_campus.png';
  });
  const c = 4, [ox, oy] = piso.mascara_origen, [tx, ty] = piso.mascara_tam;
  const nx = Math.round(tx / c), ny = Math.round(ty / c);
  const lienzo = document.createElement('canvas');
  lienzo.width = nx; lienzo.height = ny;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, nx, ny);
  const px = ctx.getImageData(0, 0, nx, ny).data;
  const d = new Float32Array(nx * ny);
  for (let q = 0; q < nx * ny; q++) d[q] = px[4 * q] > 127 ? 0 : 1e9;
  const a = c, b = c * Math.SQRT2;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const q = j * nx + i;
    let v = d[q];
    if (i > 0) v = Math.min(v, d[q - 1] + a);
    if (j > 0) {
      v = Math.min(v, d[q - nx] + a);
      if (i > 0) v = Math.min(v, d[q - nx - 1] + b);
      if (i < nx - 1) v = Math.min(v, d[q - nx + 1] + b);
    }
    d[q] = v;
  }
  for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const q = j * nx + i;
    let v = d[q];
    if (i < nx - 1) v = Math.min(v, d[q + 1] + a);
    if (j < ny - 1) {
      v = Math.min(v, d[q + nx] + a);
      if (i < nx - 1) v = Math.min(v, d[q + nx + 1] + b);
      if (i > 0) v = Math.min(v, d[q + nx - 1] + b);
    }
    d[q] = v;
  }
  const peso = new Float32Array(nx * ny);
  for (let q = 0; q < nx * ny; q++) {
    const x = Math.min(Math.max((d[q] - CERCA_TEC_M) / TRANSICION_TEC_M, 0), 1);
    peso[q] = 1 - x * x * (3 - 2 * x);
  }
  return (E, N) => {
    const [X, Z] = tr.aThree((E - rejilla.E0) / rejilla.celda, (N - rejilla.N0) / rejilla.celda);
    const fi = (X - ox) / c - 0.5, fj = (oy + ty + Z) / c - 0.5;
    if (!(fi >= 0 && fj >= 0 && fi < nx - 1 && fj < ny - 1)) return 0;
    const i = Math.floor(fi), j = Math.floor(fj), ti = fi - i, tj = fj - j, q = j * nx + i;
    return (peso[q] * (1 - ti) + peso[q + 1] * ti) * (1 - tj) + (peso[q + nx] * (1 - ti) + peso[q + nx + 1] * ti) * tj;
  };
}

function envolvente(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const abajo = [], arriba = [];
  for (const q of p) {
    while (abajo.length >= 2 && cruz(abajo[abajo.length - 2], abajo[abajo.length - 1], q) <= 0) abajo.pop();
    abajo.push(q);
  }
  for (const q of p.reverse()) {
    while (arriba.length >= 2 && cruz(arriba[arriba.length - 2], arriba[arriba.length - 1], q) <= 0) arriba.pop();
    arriba.push(q);
  }
  return abajo.slice(0, -1).concat(arriba.slice(0, -1));
}

function camposYParques({ escena, bosque }, tr, rejilla, tec) {
  const aEN = (X, Z) => { const [i, j] = tr.aCelda(X, Z); return [rejilla.E0 + i * rejilla.celda, rejilla.N0 + j * rejilla.celda]; };
  const poligonos = [];
  const agregar = (pts) => {
    const P = envolvente(pts);
    const E = P.map((p) => p[0]), N = P.map((p) => p[1]);
    poligonos.push({ P, E0: Math.min(...E), E1: Math.max(...E), N0: Math.min(...N), N1: Math.max(...N) });
  };
  const v = new THREE.Vector3();
  let campos = 0, parques = 0;
  escena.updateMatrixWorld();
  escena.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const material = o.material?.name ?? '';
    const g = o.geometry, pos = g.attributes.position;
    if (/^Cancha( \(shader\))?$/.test(material)) {
      const pts = [];
      for (let q = 0; q < pos.count; q++) { v.fromBufferAttribute(pos, q).applyMatrix4(o.matrixWorld); pts.push(aEN(v.x, v.z)); }
      agregar(pts);
      campos++;
      return;
    }
    if (!/^Pasto/.test(material) || !/^Cesped/.test(o.name) || !g.index) return;
    const idx = g.index.array, padre = Int32Array.from({ length: pos.count }, (_, q) => q);
    const raiz = (a) => { while (padre[a] !== a) a = padre[a] = padre[padre[a]]; return a; };
    for (let t = 0; t < idx.length; t += 3) { const a = raiz(idx[t]); padre[raiz(idx[t + 1])] = a; padre[raiz(idx[t + 2])] = a; }
    const EN = [];
    for (let q = 0; q < pos.count; q++) { v.fromBufferAttribute(pos, q).applyMatrix4(o.matrixWorld); EN.push(aEN(v.x, v.z)); }
    const grupos = new Map();
    for (let t = 0; t < idx.length; t += 3) {
      const r = raiz(idx[t]);
      if (!grupos.has(r)) grupos.set(r, { area: 0, tri: [] });
      const [a, b, c] = [EN[idx[t]], EN[idx[t + 1]], EN[idx[t + 2]]];
      const gr = grupos.get(r);
      gr.area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
      gr.tri.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    for (const { area, tri } of grupos.values()) {
      if (area < AREA_PARQUE_M2) continue;
      const pts = [...new Set(tri)].map((q) => EN[q]);
      const cE = pts.reduce((a, p) => a + p[0], 0) / pts.length, cN = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      if (tec(cE, cN) >= 0.5) continue;
      agregar(pts);
      parques++;
    }
  });
  const alcance = MARGEN_CAMPO_M + TRANSICION_CAMPO_M;
  const distancia = (E, N) => {
    let d = Infinity;
    for (const { P, E0, E1, N0, N1 } of poligonos) {
      if (E < E0 - alcance || E > E1 + alcance || N < N0 - alcance || N > N1 + alcance) continue;
      let dentro = true, de = Infinity;
      for (let a = 0; a < P.length; a++) {
        const [x0, y0] = P[a], [x1, y1] = P[(a + 1) % P.length];
        const ex = x1 - x0, ey = y1 - y0, l2 = ex * ex + ey * ey || 1;
        if (ex * (N - y0) - ey * (E - x0) < 0) dentro = false;
        const t = Math.min(Math.max(((E - x0) * ex + (N - y0) * ey) / l2, 0), 1);
        de = Math.min(de, Math.hypot(E - x0 - t * ex, N - y0 - t * ey));
      }
      d = Math.min(d, dentro ? 0 : de);
    }
    return d;
  };
  const peso = (E, N) => {
    const d = distancia(E, N);
    if (!(d < alcance)) return 0;
    const x = Math.min(Math.max((d - MARGEN_CAMPO_M) / TRANSICION_CAMPO_M, 0), 1);
    return 1 - x * x * (3 - 2 * x);
  };
  const troncos = new Map();
  const clave = (E, N) => Math.floor(E / 4) * 100003 + Math.floor(N / 4);
  let nTroncos = 0;
  const M = bosque?.matrices;
  for (let s = 0; M && s < M.length; s += 16) {
    const [E, N] = aEN(M[s + 12], M[s + 14]);
    if (!(distancia(E, N) <= MARGEN_CAMPO_M + 4)) continue;
    const c = clave(E, N);
    if (!troncos.has(c)) troncos.set(c, []);
    troncos.get(c).push(E, N);
    nTroncos++;
  }
  const enTronco = (E, N) => {
    if (!nTroncos) return false;
    const i = Math.floor(E / 4), j = Math.floor(N / 4);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const l = troncos.get((i + di) * 100003 + j + dj);
      if (!l) continue;
      for (let q = 0; q < l.length; q += 2) if ((l[q] - E) ** 2 + (l[q + 1] - N) ** 2 < RADIO_TRONCO_M ** 2) return true;
    }
    return false;
  };
  return { peso, enTronco, campos, parques, troncos: nTroncos };
}

function perfilCopa(geos) {
  const pts = [];
  for (const g of geos) {
    const p = g.attributes.position;
    for (let q = 0; q < p.count; q++) pts.push(p.getX(q), p.getY(q), p.getZ(q));
  }
  let y0 = Infinity, y1 = -Infinity;
  for (let q = 1; q < pts.length; q += 3) { y0 = Math.min(y0, pts[q]); y1 = Math.max(y1, pts[q]); }
  let cx = 0, cz = 0, n = 0;
  for (let q = 0; q < pts.length; q += 3) if (pts[q + 1] < y0 + 0.1 * (y1 - y0)) { cx += pts[q]; cz += pts[q + 2]; n++; }
  cx /= n || 1; cz /= n || 1;
  const NB = 40, r = new Float32Array(NB);
  for (let q = 0; q < pts.length; q += 3) {
    const b = Math.min(Math.floor(((pts[q + 1] - y0) / (y1 - y0)) * NB), NB - 1);
    r[b] = Math.max(r[b], Math.hypot(pts[q] - cx, pts[q + 2] - cz));
  }
  const R = Math.max(...r), rt = r[1] || r[0];
  let b = 0;
  while (b < NB - 1 && r[b] <= Math.max(3 * rt, 0.35 * R)) b++;
  return { cx, cz, base: y0 + (b / NB) * (y1 - y0), tope: y1, R };
}

function mapaVegetacion({ escena, bosque, nivelSuelo, k }, tr, rejilla, cajaPiso) {
  const aEN = (X, Z) => { const [i, j] = tr.aCelda(X, Z); return [rejilla.E0 + i * rejilla.celda, rejilla.N0 + j * rejilla.celda]; };
  const esquinas = [[cajaPiso.min.x, cajaPiso.min.z], [cajaPiso.max.x, cajaPiso.min.z], [cajaPiso.min.x, cajaPiso.max.z], [cajaPiso.max.x, cajaPiso.max.z]].map(([X, Z]) => aEN(X, Z));
  const celda = 2;
  const E0 = Math.floor(Math.min(...esquinas.map((e) => e[0]))), N0 = Math.floor(Math.min(...esquinas.map((e) => e[1])));
  const nx = Math.ceil((Math.max(...esquinas.map((e) => e[0])) - E0) / celda) + 1, ny = Math.ceil((Math.max(...esquinas.map((e) => e[1])) - N0) / celda) + 1;
  const copa = new Float32Array(nx * ny), base = new Float32Array(nx * ny).fill(99), tope = new Float32Array(nx * ny), pasto = new Float32Array(nx * ny);
  let arboles = 0;
  const M = bosque?.matrices;
  for (const especie of bosque?.especies ?? []) {
    const p = perfilCopa(especie.lods[0].instancias.map((im) => im.geometry));
    for (let t = especie.inicio; t < especie.inicio + especie.cantidad; t++) {
      if (bosque.radios?.[t] === 0) continue;
      const s = t * 16;
      const ex = Math.hypot(M[s], M[s + 1], M[s + 2]), ey = Math.hypot(M[s + 4], M[s + 5], M[s + 6]);
      const [E, N] = aEN(M[s] * p.cx + M[s + 8] * p.cz + M[s + 12], M[s + 2] * p.cx + M[s + 10] * p.cz + M[s + 14]);
      const zb = (M[s + 13] + ey * p.base - nivelSuelo) / k, zt = (M[s + 13] + ey * p.tope - nivelSuelo) / k, R = (p.R * ex) / k;
      const i0 = Math.max(Math.floor((E - R - E0) / celda), 0), i1 = Math.min(Math.ceil((E + R - E0) / celda), nx - 1);
      const j0 = Math.max(Math.floor((N - R - N0) / celda), 0), j1 = Math.min(Math.ceil((N + R - N0) / celda), ny - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const f = Math.min(Math.max((R - Math.hypot(E0 + i * celda - E, N0 + j * celda - N)) / celda + 0.5, 0), 1);
        if (f <= 0) continue;
        const q = j * nx + i;
        copa[q] = Math.max(copa[q], f);
        base[q] = Math.min(base[q], Math.max(zb, 0));
        tope[q] = Math.max(tope[q], zt);
      }
      arboles++;
    }
  }
  const v = new THREE.Vector3();
  const sinteticos = [];
  escena.updateMatrixWorld();
  escena.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry.index) return;
    const material = o.material?.name ?? '';
    const cancha = /^Cancha( \(shader\))?$/.test(material);
    if (!((/^Pasto/.test(material) && /^Cesped/.test(o.name)) || cancha)) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index.array;
    const EN = [];
    for (let q = 0; q < pos.count; q++) { v.fromBufferAttribute(pos, q).applyMatrix4(o.matrixWorld); EN.push(aEN(v.x, v.z)); }
    if (cancha && /^Cancha_Americano/.test(o.name)) { sinteticos.push(envolvente(EN)); return; }
    for (let t = 0; t < idx.length; t += 3) {
      const [a, b, c] = [EN[idx[t]], EN[idx[t + 1]], EN[idx[t + 2]]];
      const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(det) < 1e-9) continue;
      const i0 = Math.max(Math.ceil((Math.min(a[0], b[0], c[0]) - E0) / celda), 0), i1 = Math.min(Math.floor((Math.max(a[0], b[0], c[0]) - E0) / celda), nx - 1);
      const j0 = Math.max(Math.ceil((Math.min(a[1], b[1], c[1]) - N0) / celda), 0), j1 = Math.min(Math.floor((Math.max(a[1], b[1], c[1]) - N0) / celda), ny - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const E = E0 + i * celda, N = N0 + j * celda;
        const l1 = ((b[1] - c[1]) * (E - c[0]) + (c[0] - b[0]) * (N - c[1])) / det;
        const l2 = ((c[1] - a[1]) * (E - c[0]) + (a[0] - c[0]) * (N - c[1])) / det;
        if (l1 >= 0 && l2 >= 0 && l1 + l2 <= 1) pasto[j * nx + i] = 1;
      }
    }
  });
  for (const P of sinteticos) {
    const Es = P.map((p) => p[0]), Ns = P.map((p) => p[1]);
    const i0 = Math.max(Math.floor((Math.min(...Es) - E0) / celda), 0), i1 = Math.min(Math.ceil((Math.max(...Es) - E0) / celda), nx - 1);
    const j0 = Math.max(Math.floor((Math.min(...Ns) - N0) / celda), 0), j1 = Math.min(Math.ceil((Math.max(...Ns) - N0) / celda), ny - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const E = E0 + i * celda, N = N0 + j * celda;
      if (P.every(([x0, y0], a) => { const [x1, y1] = P[(a + 1) % P.length]; return (x1 - x0) * (N - y0) - (y1 - y0) * (E - x0) >= 0; })) pasto[j * nx + i] = 0;
    }
  }
  let sumaCopa = 0, sumaPasto = 0;
  for (let q = 0; q < nx * ny; q++) { sumaCopa += copa[q]; sumaPasto += pasto[q]; if (!copa[q]) base[q] = 0; }
  return {
    E0, N0, celda, nx, ny, copa, base, tope, pasto,
    resumen: { arboles, copa_ha: +((sumaCopa * celda * celda) / 1e4).toFixed(1), pasto_ha: +((sumaPasto * celda * celda) / 1e4).toFixed(1), canchas_sinteticas: sinteticos.length },
  };
}

let indiceGemelo = null;
let campoGemelo = null;

async function cargarCampoGemelo(corrida, dic) {
  indiceGemelo ??= await fetch(`rom/campos3d_gemelo/indice.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null));
  const propia = carpetaPropia(corrida);
  const info = (await indiceManual(corrida)).gemelo;
  if (!info || !indiceGemelo) return null;
  const ruta = `${propia}gemelo.bin.gz`;
  const r = await fetch(`${ruta}?v=${VERSION}`, { cache: 'no-cache' });
  const buf = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const { nx, ny, E0, N0, escala_uvw: esc, escala_dT: escT } = info;
  const niveles = indiceGemelo.niveles, paso = indiceGemelo.paso, nz = niveles.length, capa = nx * ny, n = capa * nz;
  const b = new Int8Array(buf);
  const U = new Float32Array(n), V = new Float32Array(n), W = new Float32Array(n), D = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    if (b[p] === -128) { U[p] = V[p] = W[p] = D[p] = NaN; continue; }
    U[p] = b[p] * esc; V[p] = b[n + p] * esc; W[p] = b[2 * n + p] * esc;
    D[p] = escT && b[3 * n + p] !== -128 ? b[3 * n + p] * escT : 0;
  }
  const R = referenciaPeaton(D, nx, ny, paso);
  for (let p = 0; p < n; p++) if (Number.isFinite(D[p])) D[p] -= R[p % capa];
  const T2 = new Float32Array(capa), e2 = new Float32Array(capa), s = [0, 0, 0, 0, 0];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const ok = dic.muestra(E0 + i * paso, N0 + j * paso, 10, s);
      T2[j * nx + i] = ok ? s[3] : NaN;
      e2[j * nx + i] = ok ? s[4] : NaN;
    }
  }
  return {
    muestra(E, N, z, out) {
      const fi = (E - E0) / paso, fj = (N - N0) / paso;
      if (!(fi >= 0 && fj >= 0 && fi < nx - 1 && fj < ny - 1 && z < niveles[nz - 1])) return false;
      let k = 0, tk = 0;
      if (z > niveles[0]) {
        while (k < nz - 2 && niveles[k + 1] <= z) k++;
        tk = (z - niveles[k]) / (niveles[k + 1] - niveles[k]);
      }
      const i = Math.floor(fi), j = Math.floor(fj), ti = fi - i, tj = fj - j;
      let su = 0, sv = 0, sw = 0, sp = 0, sT = 0, se = 0, sq = 0, sd = 0;
      for (let c8 = 0; c8 < 8; c8++) {
        const di = c8 & 1, dj = (c8 >> 1) & 1, dk = c8 >> 2;
        const pw = (di ? ti : 1 - ti) * (dj ? tj : 1 - tj) * (dk ? tk : 1 - tk);
        if (pw <= 0) continue;
        const col = (j + dj) * nx + i + di, p = (k + dk) * capa + col;
        if (Number.isNaN(U[p])) continue;
        su += pw * U[p]; sv += pw * V[p]; sw += pw * W[p]; sd += pw * D[p]; sp += pw;
        if (Number.isFinite(T2[col])) { sT += pw * T2[col]; se += pw * e2[col]; sq += pw; }
      }
      if (sp < 0.35 || sq <= 0) return false;
      out[0] = su / sp; out[1] = sv / sp; out[2] = sw / sp; out[3] = sT / sq + sd / sp; out[4] = se / sq;
      return true;
    },
  };
}

let indiceAcumulacion = null;
async function cargarAcumulacion(corrida) {
  const propia = carpetaPropia(corrida);
  indiceAcumulacion ??= await fetch(`rom/acumulacion/indice.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null));
  const info = (await indiceManual(corrida)).acumulacion;
  if (!info) return null;
  const ruta = `${propia}acumulacion.bin.gz`;
  const r = await fetch(`${ruta}?v=${VERSION}`, { cache: 'no-cache' });
  const b = new Int8Array(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const F = new Float32Array(b.length);
  for (let q = 0; q < b.length; q++) F[q] = b[q] === -128 ? NaN : Math.exp(b[q] * info.escala);
  return { ...info, paso: indiceAcumulacion?.paso ?? 4, F };
}

function pesoMuestra(poligono, nx, ny, celda) {
  const d = new Float32Array(nx * ny).fill(Infinity);
  const cola = [];
  for (let q = 0; q < nx * ny; q++) if (!poligono[q]) { d[q] = 0; cola.push(q); }
  for (let i = 0; i < nx; i++) for (const j of [0, ny - 1]) if (d[j * nx + i] > 1) { d[j * nx + i] = 1; cola.push(j * nx + i); }
  for (let j = 0; j < ny; j++) for (const i of [0, nx - 1]) if (d[j * nx + i] > 1) { d[j * nx + i] = 1; cola.push(j * nx + i); }
  for (let c = 0; c < cola.length; c++) {
    const q = cola[c], i = q % nx, j = (q - i) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
      const w = jj * nx + ii;
      if (d[w] > d[q] + 1) { d[w] = d[q] + 1; cola.push(w); }
    }
  }
  const peso = new Float32Array(nx * ny);
  for (let q = 0; q < nx * ny; q++) peso[q] = Math.min(Math.max(((d[q] - 0.5) * celda) / MEZCLA_M, 0), 1);
  return peso;
}

function trazarLineas({ rom, dic, urbano, peso, rejilla, alturas: alturasBase, tec, campos, semilla, dentroDelGemelo, perfil = 'U',
  recorte = null, foco = null }) {
  const cajaCon = (b) => (recorte ? { E0: Math.max(b.E0, recorte.E0), E1: Math.min(b.E1, recorte.E1),
    N0: Math.max(b.N0, recorte.N0), N1: Math.min(b.N1, recorte.N1) } : b);
  const techoMin = perfil === 'T' ? TECHO_MIN_T_M : TECHO_MIN_M;
  const alturas = { ...alturasBase, techo: (E, N) => alturasBase.techo(E, N, techoMin) };
  const muestraROM = muestreador(rom);
  const sR = [0, 0, 0, 0, 0], sD = [0, 0, 0, 0, 0], s = [0, 0, 0, 0, 0];
  const pesoEn = (E, N) => {
    const i = Math.round((E - rejilla.E0) / rejilla.celda), j = Math.round((N - rejilla.N0) / rejilla.celda);
    return i >= 0 && j >= 0 && i < rejilla.nx && j < rejilla.ny ? peso[j * rejilla.nx + i] : 0;
  };
  const techoEn = (E, N) => {
    let t = alturas.techo(E, N);
    const w = tec(E, N) * (1 - alturas.cercaCasa(E, N)), wc = campos.peso(E, N);
    if (w < 1 && t > TECHO_COLONIA_M) t = TECHO_COLONIA_M + w * (t - TECHO_COLONIA_M);
    if (wc > 0 && t > TECHO_CAMPO_M) t += wc * (TECHO_CAMPO_M - t);
    return t;
  };
  const sinSubir = (E, N) => alturas.cercaCasa(E, N) > 0.5;
  const pisoEn = (E, N) => ALTURA_MIN_M - campos.peso(E, N) * (ALTURA_MIN_M - ALTURA_MIN_CAMPO_M);
  const limMuestra = { E0: rom.E0, E1: rom.E0 + (rom.nx - 1) * rom.paso, N0: rom.N0, N1: rom.N0 + (rom.ny - 1) * rom.paso };
  const lim = dic ? dic.limites : limMuestra;
  const enDominio = (E, N) => (dic
    ? E > lim.E0 + 6 && E < lim.E1 - 6 && N > lim.N0 + 6 && N < lim.N1 - 6 && dentroDelGemelo(E, N)
    : pesoEn(E, N) >= 0.5);
  const campo = (E, N, z, out) => {
    if (z < ALTURA_MIN_CAMPO_M || (z < ALTURA_MIN_M && z < pisoEn(E, N))) return false;
    if (z < ALTURA_TRONCO_M && campos.enTronco(E, N)) return false;
    if (!SIN_EDIFICIOS && z < alturas.alturaEdificio(E, N) + HOLGURA_EDIFICIO_M) return false;
    const w = pesoEn(E, N);
    const okR = w > 0 && muestraROM(E, N, z, sR);
    if (w >= 1 || !dic) {
      if (!okR || w < 0.5) return false;
      for (let q = 0; q < 5; q++) out[q] = sR[q];
      return true;
    }
    if (!okR && w >= 0.5) return false;
    if (!okR && z < alturas.altura(E, N) + 0.3) return false;
    if (!urbano.muestra(E, N, z, sD)) return false;
    for (let q = 0; q < 5; q++) out[q] = okR ? w * sR[q] + (1 - w) * sD[q] : sD[q];
    return true;
  };
  const libre = (E, N, z) => campo(E, N, z, s);
  const libreTramo = (a0, a1, a2, b0, b1, b2) => libre(b0, b1, b2) && (SIN_EDIFICIOS || libre((a0 + b0) / 2, (a1 + b1) / 2, (a2 + b2) / 2));
  const direccion = (E, N, z, d) => {
    if (!campo(E, N, z, s)) return false;
    const m = Math.hypot(s[0], s[1], s[2]);
    if (m < VIENTO_MIN) return false;
    d[0] = s[0] / m; d[1] = s[1] / m; d[2] = s[2] / m; d[3] = m;
    return true;
  };
  const k1 = [0, 0, 0, 0], k2 = [0, 0, 0, 0], k3 = [0, 0, 0, 0], k4 = [0, 0, 0, 0];
  const h = PASO_M;

  const cd = 4, ncx = Math.ceil((lim.E1 - lim.E0) / cd) + 1, ncy = Math.ceil((lim.N1 - lim.N0) / cd) + 1, ncz = 16;
  const densidad = new Uint8Array(ncx * ncy * ncz);
  const celda = (E, N, z) => {
    const i = Math.floor((E - lim.E0) / cd), j = Math.floor((N - lim.N0) / cd), kk = Math.floor(z / 3);
    return i >= 0 && j >= 0 && i < ncx && j < ncy && kk < ncz ? (kk * ncy + j) * ncx + i : -1;
  };

  const CUBETA = 2;
  const cubetas = new Map();
  const claveCubeta = (i, j, kk) => (kk * 4096 + j) * 4096 + i;
  const registrarPuntos = (L) => {
    for (let a = 0; a < L.E.length; a++) {
      const key = claveCubeta(Math.floor((L.E[a] - lim.E0) / CUBETA), Math.floor((L.N[a] - lim.N0) / CUBETA), Math.floor(L.z[a] / CUBETA));
      let lista = cubetas.get(key);
      if (!lista) cubetas.set(key, (lista = []));
      lista.push(L.E[a], L.N[a], L.z[a]);
    }
  };
  const lineaCercana = (E, N, z, radio) => {
    const i0 = Math.floor((E - lim.E0) / CUBETA), j0 = Math.floor((N - lim.N0) / CUBETA), k0 = Math.floor(z / CUBETA);
    const r = Math.ceil(radio / CUBETA);
    let mejor = null, d2min = radio * radio;
    for (let dk = -r; dk <= r; dk++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const lista = cubetas.get(claveCubeta(i0 + di, j0 + dj, k0 + dk));
      if (!lista) continue;
      for (let q = 0; q < lista.length; q += 3) {
        const d2 = (lista[q] - E) ** 2 + (lista[q + 1] - N) ** 2 + (lista[q + 2] - z) ** 2;
        if (d2 < d2min) { d2min = d2; mejor = [lista[q], lista[q + 1], lista[q + 2]]; }
      }
    }
    return mejor;
  };

  function mitad(E, N, z, signo, unir, op = {}) {
    const pts = [];
    let ultimaBifurcacion = -Infinity;
    let p0 = E, p1 = N, p2 = z, deslices = 0, subida = false, recorrido = 0;
    let a0 = 0, a1 = 0, inercia = 0, rodeos = 0;
    const propios = unir ? new Map() : null;
    const cerrar = (motivo) => {
      const clave = (unir ? 'rama_' : 'principal_') + motivo;
      motivos[clave] = (motivos[clave] ?? 0) + 1;
      if (!unir || recorrido < 6) return { pts, fin: 'libre' };
      const c = lineaCercana(p0, p1, p2, RADIO_CIERRE_M);
      if (!c || !campo(c[0], c[1], c[2], s)) return { pts, fin: 'libre' };
      pts.push(c[0], c[1], c[2], 0, Math.hypot(s[0], s[1], s[2]), s[3], s[4]);
      return { pts, fin: 'union' };
    };
    const largoMax = unir ? LARGO_MAX_RELLENO_M : LARGO_MAX_M;
    for (let n = 0; n < largoMax / h; n++) {
      if (!direccion(p0, p1, p2, k1)) return cerrar(campo(p0, p1, p2, s) ? 'aire_quieto' : 'solido');
      let d0 = k1[0], d1 = k1[1], d2 = k1[2];
      if (n === 0 && op.giro0 !== undefined) {
        const hz = Math.hypot(d0, d1) || 1, sg = Math.sign(op.giro0);
        let salio = false;
        for (const g of [op.giro0, op.giro0 + 20 * sg, op.giro0 + 40 * sg]) {
          if (Math.abs(g) > 100) break;
          const a = (g * Math.PI) / 180, r0 = (d0 * Math.cos(a) - d1 * Math.sin(a)) / hz, r1 = (d0 * Math.sin(a) + d1 * Math.cos(a)) / hz;
          const e0 = p0 + signo * h * r0, e1 = p1 + signo * h * r1;
          if (!enDominio(e0, e1) || !libreTramo(p0, p1, p2, e0, e1, p2) || !campo(e0, e1, p2, s)) continue;
          pts.push(e0, e1, p2, 0, Math.hypot(s[0], s[1], s[2]), s[3], s[4]);
          a0 = signo * r0; a1 = signo * r1;
          p0 = e0; p1 = e1;
          recorrido += h;
          salio = true;
          break;
        }
        if (!salio) return { pts, fin: 'libre' };
        continue;
      }
      if (direccion(p0 + signo * h / 2 * k1[0], p1 + signo * h / 2 * k1[1], p2 + signo * h / 2 * k1[2], k2)
        && direccion(p0 + signo * h / 2 * k2[0], p1 + signo * h / 2 * k2[1], p2 + signo * h / 2 * k2[2], k3)
        && direccion(p0 + signo * h * k3[0], p1 + signo * h * k3[1], p2 + signo * h * k3[2], k4)) {
        d0 = (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6;
        d1 = (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6;
        d2 = (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]) / 6;
        const m = Math.hypot(d0, d1, d2) || 1;
        d0 /= m; d1 /= m; d2 /= m;
      }
      const zSube = p2 + 0.8 * h;
      const puedeSubir = () => zSube <= alturas.techo(p0, p1) && libre(p0, p1, zSube);
      let q0, q1, q2, trepa = false, giroUsado = 0;
      const dh = Math.hypot(d0, d1);
      if (recorrido > 0 && dh > 0.3 && signo * (d0 * a0 + d1 * a1) < -0.2 * dh) {
        if (++inercia > 3) {
          if (!puedeSubir() || ++deslices > 80) return cerrar('choque');
          trepa = true;
        } else { d0 = signo * a0; d1 = signo * a1; d2 = 0; }
      } else inercia = 0;
      if (trepa) { q0 = p0; q1 = p1; q2 = zSube; subida = true; }
      else {
        q0 = p0 + signo * h * d0; q1 = p1 + signo * h * d1; q2 = p2 + signo * h * d2;
        if (!enDominio(q0, q1)) return { pts, fin: 'borde' };
        q2 = Math.max(q2, pisoEn(q0, q1));
        const techo = Math.max(techoEn(q0, q1), Math.min(alturas.altura(q0, q1) + 1.2, alturas.techo(q0, q1)));
        const bajo = Math.max(1 - tec(q0, q1), campos.peso(q0, q1), alturas.cercaCasa(q0, q1));
        if (q2 > techo) q2 = Math.max(techo, p2 - 0.8 * (1 + bajo));
        if (!libreTramo(p0, p1, p2, q0, q1, q2)) {
          let ok = false;
          const hq = alturas.altura(q0, q1);
          if (pesoEn(q0, q1) < 0.5 && bajo < 0.5 && hq > 0 && hq - p2 < 5 && hq + 1 <= techo) {
            const zs = Math.min(p2 + 2.4, hq + 1.0);
            if (libreTramo(p0, p1, p2, q0, q1, zs)) { q2 = zs; ok = true; subida = true; }
          }
          if (!ok) {
            const hz = Math.hypot(d0, d1) || 1;
            const zg = Math.max(Math.min(p2, Math.max(techo, p2 - 0.8 * (1 + bajo))), pisoEn(p0, p1));
            for (const g of GIROS) {
              const a = (g * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
              const r0 = (d0 * ca - d1 * sa) / hz, r1 = (d0 * sa + d1 * ca) / hz;
              if (recorrido > 0 && signo * (r0 * a0 + r1 * a1) < -0.2) continue;
              q0 = p0 + signo * h * r0; q1 = p1 + signo * h * r1; q2 = zg;
              if (!enDominio(q0, q1)) return { pts, fin: 'borde' };
              if (libreTramo(p0, p1, p2, q0, q1, q2)) { ok = true; giroUsado = g; break; }
            }
          }
          if (!ok && rodeos < RODEOS_POR_MITAD && sinSubir(p0, p1)) {
            const dh = Math.hypot(d0, d1) || 1, ex = (signo * d0) / dh, ey = (signo * d1) / dh;
            const ze = Math.max(Math.min(p2, techo), pisoEn(p0, p1));
            const hacia = (minimo) => (Ec, Nc) => enDominio(Ec, Nc) && direccion(Ec, Nc, ze, k2)
              && signo * (k2[0] * ex + k2[1] * ey) > minimo * Math.hypot(k2[0], k2[1]);
            const tr0 = performance.now();
            const camino = alturas.rodeo(p0, p1, ze, ex, ey, hacia(ALINEADO_RODEO))
              ?? alturas.rodeo(p0, p1, ze, ex, ey, hacia(0), RADIO_RODEO_AMPLIO_M)
              ?? alturas.rodeo(p0, p1, ze, ex, ey, hacia(-0.3), RADIO_RODEO_ULTIMO_M);
            estadisticaRodeo.n++; estadisticaRodeo.ms += performance.now() - tr0; if (camino) estadisticaRodeo.ok++;
            if (camino) {
              rodeos++;
              for (let a = 0; a < camino.length; a += 2) {
                const Ec = camino[a], Nc = camino[a + 1];
                if (!campo(Ec, Nc, ze, s)) continue;
                pts.push(Ec, Nc, ze, 0, Math.hypot(s[0], s[1], s[2]), s[3], s[4]);
                const l = Math.hypot(Ec - p0, Nc - p1) || 1;
                recorrido += l;
                a0 = (Ec - p0) / l; a1 = (Nc - p1) / l;
                p0 = Ec; p1 = Nc; p2 = ze;
              }
              deslices = 0;
              continue;
            }
          }
          if (!ok && unir && bajo > 0.5) {
            const c = cerrar('colonia');
            if (c.fin === 'union') return c;
          }
          if (!ok && puedeSubir()) { q0 = p0; q1 = p1; q2 = zSube; ok = trepa = subida = true; }
          if (!ok || ++deslices > 80) return cerrar(ok ? 'deslices' : 'sin_salida');
        } else deslices = Math.max(0, deslices - 1);
      }
      if (subida && !trepa && pesoEn(q0, q1) < 0.5 && q2 > z) {
        const zb = Math.max(z, q2 - 0.7);
        if (zb > alturas.altura(q0, q1) + 0.8 && libre(q0, q1, zb)) q2 = zb;
        if (q2 <= z + 0.01) subida = false;
      }
      if (perfil === 'T' && !trepa && q2 > PEATON_T_M + 0.5) {
        const zb = Math.max(PEATON_T_M, q2 - DESCENSO_T_M);
        if (zb > alturas.altura(q0, q1) + 0.8 && libre(q0, q1, zb)) q2 = zb;
      }
      if (op.bifurcaciones && Math.abs(giroUsado) >= GIRO_BIFURCA && alturas.cercaCasa(p0, p1) > 0.5
        && recorrido - ultimaBifurcacion >= SEPARACION_BIFURCA_M) {
        op.bifurcaciones.push({ idx: pts.length / 7 - 1, giro: giroUsado });
        ultimaBifurcacion = recorrido;
      }
      campo(q0, q1, q2, s);
      pts.push(q0, q1, q2, 0, Math.hypot(s[0], s[1], s[2]), s[3], s[4]);
      const l = Math.hypot(q0 - p0, q1 - p1);
      if (l > 0.5) { a0 = (q0 - p0) / l; a1 = (q1 - p1) / l; }
      p0 = q0; p1 = q1; p2 = q2;
      recorrido += h;
      if (unir && recorrido > (op.sinUnionM ?? 4)) {
        const c = lineaCercana(q0, q1, q2, RADIO_UNION_M);
        if (c) {
          campo(c[0], c[1], c[2], s);
          pts.push(c[0], c[1], c[2], 0, Math.hypot(s[0], s[1], s[2]), s[3], s[4]);
          return { pts, fin: 'union' };
        }
        const key = claveCubeta(Math.floor((q0 - lim.E0) / CUBETA), Math.floor((q1 - lim.N0) / CUBETA), Math.floor(q2 / CUBETA));
        const viejo = propios.get(key);
        if (viejo !== undefined && recorrido - viejo[3] > 30 && Math.hypot(viejo[0] - q0, viejo[1] - q1, viejo[2] - q2) < RADIO_UNION_M * 1.5) {
          campo(viejo[0], viejo[1], viejo[2], s);
          pts.push(viejo[0], viejo[1], viejo[2], 0, Math.hypot(s[0], s[1], s[2]), s[3], s[4]);
          return { pts, fin: 'union', lazo: viejo[4] };
        }
        if (viejo === undefined) propios.set(key, [q0, q1, q2, recorrido, pts.length / 7 - 1]);
      }
    }
    return cerrar('largo');
  }

  const cE = [], cN = [], cZ = [];
  function suavizar(L) {
    const m = L.E.length;
    if (m < 4) return;
    for (let pasada = 0; pasada < SUAVIZADO_PASADAS; pasada++) {
      for (let a = 0; a < m; a++) { cE[a] = L.E[a]; cN[a] = L.N[a]; cZ[a] = L.z[a]; }
      for (let a = 1; a < m - 1; a++) {
        let e, n, z;
        if (a === 1 || a === m - 2) {
          e = (cE[a - 1] + 2 * cE[a] + cE[a + 1]) / 4; n = (cN[a - 1] + 2 * cN[a] + cN[a + 1]) / 4; z = (cZ[a - 1] + 2 * cZ[a] + cZ[a + 1]) / 4;
        } else {
          e = (cE[a - 2] + 4 * cE[a - 1] + 6 * cE[a] + 4 * cE[a + 1] + cE[a + 2]) / 16;
          n = (cN[a - 2] + 4 * cN[a - 1] + 6 * cN[a] + 4 * cN[a + 1] + cN[a + 2]) / 16;
          z = (cZ[a - 2] + 4 * cZ[a - 1] + 6 * cZ[a] + 4 * cZ[a + 1] + cZ[a + 2]) / 16;
        }
        z = Math.max(z, pisoEn(e, n));
        if ((e - cE[a]) ** 2 + (n - cN[a]) ** 2 + (z - cZ[a]) ** 2 < 0.01
          && (SIN_EDIFICIOS || z >= alturas.alturaEdificio(e, n) + HOLGURA_EDIFICIO_M)) { L.E[a] = e; L.N[a] = n; L.z[a] = z; continue; }
        for (const f of [1, 0.5]) {
          const ef = cE[a] + f * (e - cE[a]), nf = cN[a] + f * (n - cN[a]), zf = cZ[a] + f * (z - cZ[a]);
          if (enDominio(ef, nf) && libre(ef, nf, zf) && (SIN_EDIFICIOS
            || (libre((L.E[a - 1] + ef) / 2, (L.N[a - 1] + nf) / 2, (L.z[a - 1] + zf) / 2)
              && libre((ef + cE[a + 1]) / 2, (nf + cN[a + 1]) / 2, (zf + cZ[a + 1]) / 2)))) { L.E[a] = ef; L.N[a] = nf; L.z[a] = zf; break; }
        }
      }
    }
  }

  const lineas = [];
  function guardar(s0, atras, adelante, lazo) {
    const m = adelante.length / 7 + atras.length / 7 + 1;
    const L = { E: new Float64Array(m), N: new Float64Array(m), z: new Float32Array(m), t: new Float32Array(m),
      U: new Float32Array(m), T: new Float32Array(m), e: new Float32Array(m) };
    let q = 0;
    const poner = (a, o) => { L.E[q] = a[o]; L.N[q] = a[o + 1]; L.z[q] = a[o + 2]; L.U[q] = a[o + 4]; L.T[q] = a[o + 5]; L.e[q] = a[o + 6]; q++; };
    for (let o = atras.length - 7; o >= 0; o -= 7) poner(atras, o);
    poner(s0, 0);
    for (let o = 0; o < adelante.length; o += 7) poner(adelante, o);
    suavizar(L);
    if (lazo !== undefined) {
      const a = atras.length / 7 + 1 + lazo;
      L.E[m - 1] = L.E[a]; L.N[m - 1] = L.N[a]; L.z[m - 1] = L.z[a];
    }
    for (let a = 1; a < m; a++) L.t[a] = L.t[a - 1] + Math.hypot(L.E[a] - L.E[a - 1], L.N[a] - L.N[a - 1], L.z[a] - L.z[a - 1]) / Math.max(L.U[a], VIENTO_MIN);
    const vistas = new Set();
    for (let a = 0; a < m; a++) { const cc = celda(L.E[a], L.N[a], L.z[a]); if (cc >= 0) vistas.add(cc); }
    for (const cc of vistas) if (densidad[cc] < 255) densidad[cc]++;
    registrarPuntos(L);
    lineas.push(L);
    return L;
  }

  let bifurcadas = 0, msBifurcacion = 0;
  function ramificar(L, nAtras, delante, detras) {
    if (msBifurcacion > TIEMPO_BIFURCACION_MS) return;
    const t = performance.now();
    const lista = [...delante.map((b) => [b, 1]), ...detras.map((b) => [b, -1])].slice(0, BIFURCACIONES_POR_LINEA);
    for (const [b, sg] of lista) {
      const k = sg === 1 ? nAtras + 1 + b.idx : nAtras - 1 - b.idx;
      const E = L.E[k], N = L.N[k], z = L.z[k];
      if (!campo(E, N, z, s)) continue;
      const s0 = [E, N, z, 0, Math.hypot(s[0], s[1], s[2]), s[3], s[4]];
      const r = mitad(E, N, z, sg, true, { giro0: -b.giro, sinUnionM: SIN_UNION_RAMA_M });
      if (r.fin === 'libre' || (sg === -1 && r.lazo !== undefined) || (r.pts.length / 7) * h < 16) continue;
      guardar(s0, sg === 1 ? [] : r.pts, sg === 1 ? r.pts : [], sg === 1 ? r.lazo : undefined);
      bifurcadas++;
    }
    msBifurcacion += performance.now() - t;
  }

  const rnd = azar(semilla);
  let intentos = 0, saltadas = 0, descartadas = 0, unidas = 0;
  const motivos = {};
  const estadisticaRodeo = { n: 0, ok: 0, ms: 0 };
  function probar(E, N, z, densidadMax) {
    const cs = celda(E, N, z);
    if (cs < 0 || densidad[cs] >= densidadMax) { saltadas++; return false; }
    if (!direccion(E, N, z, k1)) return false;
    campo(E, N, z, s);
    const s0 = [E, N, z, 0, Math.hypot(s[0], s[1], s[2]), s[3], s[4]];
    const bD = [], bT = [];
    let adelante = mitad(E, N, z, 1, false, { bifurcaciones: bD }), atras = mitad(E, N, z, -1, false, { bifurcaciones: bT });
    if (adelante.fin !== 'borde' && atras.fin === 'borde' && lineas.length) { bD.length = 0; adelante = mitad(E, N, z, 1, true, { bifurcaciones: bD }); }
    if (atras.fin !== 'borde' && adelante.fin === 'borde' && lineas.length) { bT.length = 0; atras = mitad(E, N, z, -1, true, { bifurcaciones: bT }); }
    if (adelante.fin === 'libre' || atras.fin === 'libre' || atras.lazo !== undefined) { descartadas++; return false; }
    if (adelante.fin !== 'borde' || atras.fin !== 'borde') unidas++;
    const L = guardar(s0, atras.pts, adelante.pts, adelante.lazo);
    ramificar(L, atras.pts.length / 7, bD, bT);
    return true;
  }
  function sembrar(cuantas, dentro) {
    let hechas = 0, n = 0;
    const caja = cajaCon(dentro ? limMuestra : lim);
    if (caja.E1 <= caja.E0 || caja.N1 <= caja.N0) return 0;
    while (n++ < cuantas * (dentro ? 40 : 12) && hechas < cuantas) {
      intentos++;
      const E = caja.E0 + rnd() * (caja.E1 - caja.E0), N = caja.N0 + rnd() * (caja.N1 - caja.N0);
      const w = pesoEn(E, N);
      if (dentro ? w < 0.5 : w > 0) continue;
      if (!enDominio(E, N)) continue;
      const r = rnd();
      const z = campos.peso(E, N) > 0.5 ? 0.6 + 0.8 * rnd() : tec(E, N) < 0.5 ? 1.5 + 1.5 * rnd()
        : perfil === 'T' ? (r < 0.85 ? 1.5 + 2 * rnd() : r < 0.95 ? 3.5 + 5 * rnd() : 8.5 + 10 * rnd())
          : r < 0.6 ? 1.5 + 2.5 * rnd() : r < 0.9 ? 4 + 6 * rnd() : 10 + 10 * rnd();
      if (z > techoEn(E, N) || !libre(E, N, z)) continue;
      const cerca = [[8, 0], [-8, 0], [0, 8], [0, -8], [6, 6], [-6, -6], [6, -6], [-6, 6]]
        .some(([dx, dy]) => !libre(E + dx, N + dy, Math.max(z - 2, pisoEn(E, N))));
      if (!cerca && rnd() > LEJOS_ACEPTA) continue;
      if (probar(E, N, z, DENSIDAD_MAX)) hechas++;
    }
    return hechas;
  }
  function sembrarFoco(f) {
    let hechas = 0, n = 0;
    while (n++ < f.semillas * 30 && hechas < f.semillas) {
      intentos++;
      const ang = rnd() * 2 * Math.PI, rad = f.radio * Math.sqrt(rnd());
      const E = f.E + rad * Math.cos(ang), N = f.N + rad * Math.sin(ang);
      if (!enDominio(E, N)) continue;
      const r = rnd();
      const z = r < 0.55 ? 1.5 + 2 * rnd() : r < 0.85 ? 3.5 + 8 * rnd() : 11.5 + 12 * rnd();
      if (z > techoEn(E, N) || !libre(E, N, z)) continue;
      if (probar(E, N, z, f.densidad ?? 2)) hechas++;
    }
    return hechas;
  }
  const tiempos = {};
  let tt = performance.now();
  const enFoco = foco ? sembrarFoco(foco) : 0;
  tiempos.foco = Math.round(performance.now() - tt); tt = performance.now();
  const enMuestra = sembrar(SEMILLAS_MUESTRA, true);
  tiempos.muestra = Math.round(performance.now() - tt); tt = performance.now();
  const fuera = dic ? sembrar(SEMILLAS_FUERA, false) : 0;
  tiempos.fuera = Math.round(performance.now() - tt); tt = performance.now();

  const candidatos = [];
  const alturasRelleno = perfil === 'T' ? ALTURAS_RELLENO_T_M : ALTURAS_RELLENO_M;
  if (foco) {
    for (let N = foco.N - foco.radio; N <= foco.N + foco.radio; N += 4) {
      for (let E = foco.E - foco.radio; E <= foco.E + foco.radio; E += 4) {
        if (Math.hypot(E - foco.E, N - foco.N) > foco.radio) continue;
        for (const z of [...alturasRelleno, 12, 16, 20]) candidatos.push(E + (rnd() - 0.5) * 4, N + (rnd() - 0.5) * 4, z + rnd());
      }
    }
  }
  const nFoco = candidatos.length / 3;
  const cajaR = cajaCon(lim);
  for (let N = cajaR.N0 + 4; N < cajaR.N1 - 4; N += PASO_RELLENO_M) {
    for (let E = cajaR.E0 + 4; E < cajaR.E1 - 4; E += PASO_RELLENO_M) {
      for (const z of alturasRelleno) candidatos.push(E + (rnd() - 0.5) * PASO_RELLENO_M, N + (rnd() - 0.5) * PASO_RELLENO_M, z + rnd());
      if (campos.peso(E, N) > 0.5) {
        for (let r = 0; r < 2; r++) candidatos.push(E + (rnd() - 0.5) * PASO_RELLENO_M, N + (rnd() - 0.5) * PASO_RELLENO_M, 0.6 + 0.8 * rnd());
      }
    }
  }
  const orden = Array.from({ length: candidatos.length / 3 }, (_, q) => q);
  for (let q = orden.length - 1; q > nFoco; q--) { const r = nFoco + Math.floor(rnd() * (q - nFoco + 1)); [orden[q], orden[r]] = [orden[r], orden[q]]; }
  for (let q = nFoco - 1; q > 0; q--) { const r = Math.floor(rnd() * (q + 1)); [orden[q], orden[r]] = [orden[r], orden[q]]; }
  let ramas = 0, lazos = 0;
  const t0 = performance.now();
  for (const q of orden) {
    if (performance.now() - t0 > TIEMPO_RELLENO_MS) break;
    const E = candidatos[3 * q], N = candidatos[3 * q + 1], z = candidatos[3 * q + 2];
    if (!enDominio(E, N) || z > techoEn(E, N) || !libre(E, N, z)) continue;
    if (lineaCercana(E, N, z, RADIO_HUECO_M)) continue;
    if (!direccion(E, N, z, k1)) continue;
    campo(E, N, z, s);
    const s0 = [E, N, z, 0, Math.hypot(s[0], s[1], s[2]), s[3], s[4]];
    const bD = [], bT = [];
    const adelante = mitad(E, N, z, 1, true, { bifurcaciones: bD });
    const esLazo = adelante.lazo !== undefined;
    const atras = esLazo ? { pts: [], fin: 'union' } : mitad(E, N, z, -1, true, { bifurcaciones: bT });
    if (adelante.fin === 'libre' || atras.fin === 'libre') { descartadas++; continue; }
    if ((adelante.pts.length + atras.pts.length) / 7 * h < 16) continue;
    const L = guardar(s0, atras.pts, adelante.pts, adelante.lazo);
    ramificar(L, atras.pts.length / 7, bD, bT);
    ramas++;
    if (esLazo) lazos++;
  }
  tiempos.relleno = Math.round(performance.now() - tt);
  motivos.ms = tiempos;
  tiempos.bifurcacion = Math.round(msBifurcacion);
  tiempos.rodeos = { intentos: estadisticaRodeo.n, logrados: estadisticaRodeo.ok, ms: Math.round(estadisticaRodeo.ms) };
  return { lineas, intentos, saltadas, descartadas, enMuestra, fuera, enFoco, unidas, ramas, lazos, bifurcadas, motivos, campo };
}

function tipoCielo(corrida, dic) {
  const altura = (Math.asin(Math.max(-1, Math.min(1, dic.solArriba ?? 0))) * 180) / Math.PI;
  if (altura < SOL_NOCHE_DEG) return 'noche';
  const hora = Number(/(\d{8})_(\d{2})\d{2}/.exec(corrida)?.[2] ?? 12);
  return hora >= HORA_TARDE ? 'tarde' : 'dia';
}

async function iniciar() {
  const [visorBase, rejilla] = await Promise.all([
    listo,
    fetch(`rom/rejilla.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json()),
  ]);
  const visor = { ...visorBase, k: visorBase.georef.k };
  const { escena, georef, nivelSuelo, pedirRender, camara, lienzo } = visor;
  const k = georef.k;
  const { nx, ny } = rejilla;
  const tr = transformacion(rejilla);

  const [cx, cz] = tr.aThree((nx - 1) / 2, (ny - 1) / 2);
  const { controles } = window.climatec;
  controles.target.set(cx, nivelSuelo, cz);
  camara.position.set(cx - 230, nivelSuelo + 300, cz + 420);
  controles.update();
  const cielo = crearCielo(escena, nivelSuelo);
  if (CIELO_RELOJ) cieloEnTiempoReal(cielo, pedirRender);
  pedirRender();

  const { limites, piso } = await fetch(`modelo/escena.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json());
  const caja = new THREE.Box3();
  escena.traverse((o) => { if (o.isMesh && /^Piso/.test(o.material?.name ?? '')) caja.union(new THREE.Box3().setFromObject(o)); });
  if (caja.isEmpty()) caja.set(new THREE.Vector3(...limites.min), new THREE.Vector3(...limites.max));
  const margen = MARGEN_PISO_M * k;
  const dentroDelGemelo = (E, N) => {
    const [X, Z] = tr.aThree((E - rejilla.E0) / rejilla.celda, (N - rejilla.N0) / rejilla.celda);
    return X > caja.min.x + margen && X < caja.max.x - margen && Z > caja.min.z + margen && Z < caja.max.z - margen;
  };
  const tec = await cercaniaTec(piso, tr, rejilla);
  const t4 = performance.now();
  const esquinasPiso = [[caja.min.x, caja.min.z], [caja.max.x, caja.min.z], [caja.min.x, caja.max.z], [caja.max.x, caja.max.z]]
    .map(([X, Z]) => tr.aCelda(X, Z)).map(([i, j]) => [rejilla.E0 + i * rejilla.celda, rejilla.N0 + j * rejilla.celda]);
  const limPiso = {
    E0: Math.min(...esquinasPiso.map((p) => p[0])), E1: Math.max(...esquinasPiso.map((p) => p[0])),
    N0: Math.min(...esquinasPiso.map((p) => p[1])), N1: Math.max(...esquinasPiso.map((p) => p[1])),
  };
  const alturas = mapaAlturas(visor, tr, rejilla, limPiso);
  const msAlturas = Math.round(performance.now() - t4);
  const t3 = performance.now();
  const vegetacion = mapaVegetacion(visor, tr, rejilla, caja);
  vegetacion.resumen.ms = Math.round(performance.now() - t3);
  console.info('[rom] vegetación', vegetacion.resumen);
  const campos = camposYParques(visor, tr, rejilla, tec);
  console.info('[rom] campos y parques', { campos: campos.campos, parques: campos.parques, troncos: campos.troncos });

  const aEscena = (E, N, z, out, o) => {
    const [X, Z] = tr.aThree((E - rejilla.E0) / rejilla.celda, (N - rejilla.N0) / rejilla.celda);
    out[o] = X; out[o + 1] = nivelSuelo + z * k; out[o + 2] = Z;
  };

  let sensores = null;
  const valoresSensores = new Map();
  const aviso = document.createElement('div');
  Object.assign(aviso.style, {
    position: 'fixed', pointerEvents: 'none', display: 'none', zIndex: 30, background: 'rgba(255,255,255,0.97)', color: '#1d2433',
    border: '1px solid #c9d1de', borderRadius: '8px', boxShadow: '0 4px 14px rgba(0,0,0,0.18)', padding: '8px 10px',
    font: '12px/1.4 Poppins, system-ui, sans-serif', minWidth: '250px', maxWidth: '330px',
  });
  document.body.appendChild(aviso);

  function crearSensores(estaciones) {
    const todos = estaciones.filter((e) => e.proveedor === 'purpleair');
    const pa = todos.filter((e) => dentroDelGemelo(e.x, e.y));
    const H = ALTURA_POSTE_M;
    const lienzoPunto = document.createElement('canvas');
    lienzoPunto.width = lienzoPunto.height = 64;
    const cx = lienzoPunto.getContext('2d');
    cx.beginPath(); cx.arc(32, 32, 26, 0, 2 * Math.PI); cx.fillStyle = AZUL_TEC; cx.fill();
    cx.lineWidth = 8; cx.strokeStyle = '#ffffff'; cx.stroke();
    const textura = new THREE.CanvasTexture(lienzoPunto);
    textura.colorSpace = THREE.SRGBColorSpace;
    const grupo = new THREE.Group(), puntos = [], a = [0, 0, 0], b = [0, 0, 0];
    const materialPoste = new LineMaterial({ color: 0xffffff, linewidth: GROSOR_POSTE_PX, toneMapped: false });
    for (const e of pa) {
      aEscena(e.x, e.y, 0, a, 0);
      aEscena(e.x, e.y, H, b, 0);
      const poste = new LineSegments2(new LineSegmentsGeometry().setPositions([...a, ...b]), materialPoste);
      poste.renderOrder = 11;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, depthTest: false, sizeAttenuation: false, toneMapped: false }));
      sp.position.set(b[0], b[1], b[2]);
      sp.scale.setScalar(PUNTO_ESCALA);
      sp.renderOrder = 12;
      sp.userData = { id: e.id, E: e.x, N: e.y, poste };
      grupo.add(poste, sp);
      puntos.push(sp);
    }
    grupo.visible = false;
    escena.add(grupo);
    const fuera = todos.filter((e) => !dentroDelGemelo(e.x, e.y)).map((e) => e.id);
    console.info('[rom] sensores PurpleAir', { en_el_gemelo: pa.map((e) => e.id), fuera_del_gemelo: fuera, altura_poste_m: H });
    return { grupo, puntos, H, fuera };
  }

  function valoresDelGemelo() {
    const r = {}, out = [0, 0, 0, 0, 0], o = [0, 0, 0];
    for (const sp of sensores.puntos) {
      const { E, N, id } = sp.userData;
      let p = null;
      for (let rad = 0; rad <= 20 && !p; rad += 2) {
        const n = rad ? Math.max(8, Math.round(Math.PI * rad)) : 1;
        for (let q = 0; q < n && !p; q++) {
          const ang = (2 * Math.PI * q) / n, e = E + rad * Math.cos(ang), nn = N + rad * Math.sin(ang);
          if (lineas.campo(e, nn, Z_SENSOR_M, out)) p = { e, n: nn, z: Z_SENSOR_M, d: rad };
        }
      }
      if (!p) { r[id] = null; continue; }
      let U = Math.hypot(out[0], out[1], out[2]), T = out[3], ev = out[4];
      if (lineas.corregir) {
        const hz = Math.hypot(out[0], out[1]) || 1;
        o[0] = U; o[1] = T; o[2] = ev;
        if (lineas.corregir(p.e, p.n, p.z, out[0] / hz, out[1] / hz, o)) { U = o[0]; T = o[1]; ev = o[2]; }
      }
      r[id] = { T, HR: Math.min(100, (100 * ev) / presionSaturacion(T)), U: U * 3.6, d: p.d, z: p.z };
    }
    return r;
  }

  const fmt = (v, dec = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(dec));
  const conSigno = (v, dec = 1) => (Number.isFinite(v) ? `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dec)}` : '—');
  function textoSensor(id, dic) {
    const [num, lugar] = PURPLEAIR[id] ?? ['', ''];
    const est = dic.estaciones.find((e) => e.proveedor === 'purpleair' && e.id === id) ?? {};
    const dt = valoresSensores.get(estado.corrida)?.[id];
    const celda = 'padding:2px 6px;text-align:right;white-space:nowrap';
    const fila = (nombre, t, hr, estilo = '') => `<tr style="${estilo}"><td style="padding:2px 6px 2px 0">${nombre}</td><td style="${celda}">${t}</td><td style="${celda}">${hr}</td></tr>`;
    let filas = fila('', '<b>T<sub>air</sub></b>', '<b>H<sub>R</sub></b>', 'color:#5b6577');
    filas += fila('PurpleAir record', `${fmt(est.T_registro)} °C`, `${fmt(est.HR_registro, 0)} %`);
    filas += fila('<b>Digital twin (ROM, 1.5 m)</b>', `<b>${fmt(dt?.T)} °C</b>`, `<b>${fmt(dt?.HR, 0)} %</b>`, `color:${AZUL_TEC}`);
    if (dt) filas += fila('Twin − record', `${conSigno(dt.T - est.T_registro)} °C`, `${conSigno(dt.HR - est.HR_registro, 0)} %`, 'border-top:1px solid #e3e8f0');
    return `<div style="font-weight:600;margin-bottom:4px">PurpleAir ${id} · ${lugar} <span style="font-weight:400;color:#5b6577">· ID ${num}</span></div>`
      + `<table style="border-collapse:collapse;width:100%">${filas}</table>`;
  }

  const rayo = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let resaltado = null;
  const ocultarAviso = () => {
    aviso.style.display = 'none';
    if (resaltado) { resaltado.scale.setScalar(PUNTO_ESCALA); resaltado = null; pedirRender(); }
  };
  lienzo.addEventListener('pointermove', (ev) => {
    if (!sensores?.grupo.visible || !estado || !diccionarios.has(estado.corrida)) { ocultarAviso(); return; }
    const r = lienzo.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(ndc, camara);
    const sp = rayo.intersectObjects(sensores.puntos.filter((p) => p.visible), false)[0]?.object;
    if (!sp) { ocultarAviso(); return; }
    if (resaltado !== sp) {
      if (resaltado) resaltado.scale.setScalar(PUNTO_ESCALA);
      resaltado = sp;
      sp.scale.setScalar(PUNTO_ESCALA * 1.35);
      pedirRender();
    }
    aviso.innerHTML = textoSensor(sp.userData.id, diccionarios.get(estado.corrida));
    aviso.style.display = 'block';
    const w = aviso.offsetWidth, h = aviso.offsetHeight;
    aviso.style.left = `${Math.min(ev.clientX + 14, innerWidth - w - 6)}px`;
    aviso.style.top = `${Math.max(6, Math.min(ev.clientY - h - 12, innerHeight - h - 6))}px`;
  });
  lienzo.addEventListener('pointerleave', ocultarAviso);

  let estado = null;
  let lineas = null;
  let animando = false, ultimo = 0;
  let pesoROM = null;
  const pesos = new Map();
  let particulas = null, moviendo = false, ultimoP = 0;
  const diccionarios = new Map();

  async function cargarDiccionario(corrida) {
    if (!diccionarios.has(corrida)) {
      const ruta = `${carpetaPropia(corrida)}diccionario.json`;
      const d = await fetch(`${ruta}?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json());
      diccionarios.set(corrida, campoDiccionario(d));
    }
    return diccionarios.get(corrida);
  }

  function construirLineas(c, clave, corrida, dic, urbano, perfil) {
    const t1 = performance.now();
    const t15 = performance.now();
    let semilla = 0;
    for (const ch of corrida) semilla = (semilla * 31 + ch.charCodeAt(0)) >>> 0;
    const rc = estado.recorte ?? null;
    const dentro = rc ? (E, N) => E > rc.E0 && E < rc.E1 && N > rc.N0 && N < rc.N1 && dentroDelGemelo(E, N) : dentroDelGemelo;
    const { lineas: lista, intentos, saltadas, descartadas, enMuestra, fuera, enFoco, unidas, ramas, lazos, bifurcadas, motivos, campo } = trazarLineas({
      rom: c, dic: urbano ? dic : null, urbano, peso: pesoROM, rejilla, alturas, tec, campos, semilla, dentroDelGemelo: dentro, perfil,
      recorte: rc, foco: estado.foco ?? null });
    const t2 = performance.now();
    const corregir = urbano ? modeloVegetacion(vegetacion, { SR: dic.SR, Patm: dic.Patm }) : null;
    if (corregir) {
      const o = [0, 0, 0];
      for (const L of lista) {
        const m = L.E.length;
        L.Uv = L.U.slice(); L.Tv = L.T.slice(); L.ev = L.e.slice(); L.tv = new Float32Array(m);
        for (let a = 0; a < m; a++) {
          const a0 = Math.max(a - 1, 0), a1 = Math.min(a + 1, m - 1);
          const dE = L.E[a1] - L.E[a0], dN = L.N[a1] - L.N[a0], dh = Math.hypot(dE, dN) || 1;
          o[0] = L.U[a]; o[1] = L.T[a]; o[2] = L.e[a];
          if (corregir(L.E[a], L.N[a], L.z[a], dE / dh, dN / dh, o)) { L.Uv[a] = o[0]; L.Tv[a] = o[1]; L.ev[a] = o[2]; }
          if (a > 0) L.tv[a] = L.tv[a - 1] + Math.hypot(L.E[a] - L.E[a - 1], L.N[a] - L.N[a - 1], L.z[a] - L.z[a - 1]) / Math.max(L.Uv[a], VIENTO_MIN);
        }
      }
    }
    const t25 = performance.now();
    let nSeg = 0;
    for (const L of lista) nSeg += L.E.length - 1;
    const pos = new Float32Array(nSeg * 6), dist = new Float32Array(nSeg * 2);
    const U = new Float32Array(nSeg * 2), T = new Float32Array(nSeg * 2), e = new Float32Array(nSeg * 2);
    const veg = corregir ? { U: new Float32Array(nSeg * 2), T: new Float32Array(nSeg * 2), e: new Float32Array(nSeg * 2) } : null;
    let s = 0;
    for (const L of lista) {
      for (let q = 0; q < L.E.length - 1; q++, s++) {
        aEscena(L.E[q], L.N[q], L.z[q], pos, 6 * s);
        aEscena(L.E[q + 1], L.N[q + 1], L.z[q + 1], pos, 6 * s + 3);
        const tt = L.tv ?? L.t;
        dist[2 * s] = tt[q]; dist[2 * s + 1] = tt[q + 1];
        U[2 * s] = L.U[q]; U[2 * s + 1] = L.U[q + 1];
        T[2 * s] = L.T[q]; T[2 * s + 1] = L.T[q + 1];
        e[2 * s] = L.e[q]; e[2 * s + 1] = L.e[q + 1];
        if (veg) {
          veg.U[2 * s] = L.Uv[q]; veg.U[2 * s + 1] = L.Uv[q + 1];
          veg.T[2 * s] = L.Tv[q]; veg.T[2 * s + 1] = L.Tv[q + 1];
          veg.e[2 * s] = L.ev[q]; veg.e[2 * s + 1] = L.ev[q + 1];
        }
      }
    }
    const geometria = new LineSegmentsGeometry().setPositions(pos);
    geometria.setColors(new Float32Array(nSeg * 6));
    const ib = new THREE.InstancedInterleavedBuffer(dist, 2, 1);
    geometria.setAttribute('instanceDistanceStart', new THREE.InterleavedBufferAttribute(ib, 1, 0));
    geometria.setAttribute('instanceDistanceEnd', new THREE.InterleavedBufferAttribute(ib, 1, 1));
    const base = new LineSegments2(geometria, new LineMaterial({ vertexColors: true, linewidth: GROSOR_PX, toneMapped: false, transparent: true, opacity: 1 }));
    base.renderOrder = 3;
    const flechas = new LineSegments2(geometria, materialFlechas());
    flechas.renderOrder = 4;
    flechas.visible = false;
    escena.add(base, flechas);
    lineas = { clave, base, flechas, U, T, e, nSeg, veg, conVegetacion: false, lista, campo, corregir };
    const largo = lista.reduce((a, L) => a + L.E.length - 1, 0) * PASO_M;
    return {
      lineas: lista.length, en_muestra: enMuestra, fuera, en_foco: enFoco, segmentos: nSeg, largo_km: +(largo / 1000).toFixed(1), intentos,
      saltadas_por_densidad: saltadas, descartadas_incompletas: descartadas, principales_unidas_a_otra: unidas, ramas_de_relleno: ramas, ramas_alrededor_de_casas: bifurcadas, lazos, extremos_atorados: motivos,
      ms: { alturas_y_peso: Math.round(t15 - t1), trazado: Math.round(t2 - t15), vegetacion: Math.round(t25 - t2), geometria: Math.round(performance.now() - t25) },
    };
  }

  function colorear(variable) {
    const f = VARIABLES[variable];
    const n = lineas.nSeg * 2;
    const val = new Float32Array(n);
    const { U, T, e } = lineas.conVegetacion ? lineas.veg : lineas;
    for (let q = 0; q < n; q++) val[q] = f(U[q], T[q], e[q]);
    const muestraOrden = [];
    for (let q = 0; q < n; q += Math.max(1, Math.floor(n / 20000))) if (Number.isFinite(val[q])) muestraOrden.push(val[q]);
    muestraOrden.sort((a, b) => a - b);
    let lo = muestraOrden[Math.floor(muestraOrden.length * 0.02)], hi = muestraOrden[Math.floor(muestraOrden.length * 0.98)];
    if (!(hi - lo > 1e-6)) { lo -= 0.5; hi += 0.5; }
    const col = lineas.base.geometry.attributes.instanceColorStart.data.array;
    for (let q = 0; q < n; q++) {
      const c = TURBO[Math.round(Math.min(Math.max((val[q] - lo) / (hi - lo), 0), 1) * 255)] ?? TURBO[0];
      col[3 * q] = c[0]; col[3 * q + 1] = c[1]; col[3 * q + 2] = c[2];
    }
    lineas.base.geometry.attributes.instanceColorStart.data.needsUpdate = true;
    return { min: lo, max: hi };
  }

  function materialFlechas() {
    const m = new LineMaterial({ vertexColors: true, linewidth: FLECHAS.U.grosor, toneMapped: false, dashed: true, dashScale: 1,
      dashSize: FLECHAS.U.largo, gapSize: FLECHAS.U.periodo - FLECHAS.U.largo });
    m.userData.colita = { value: 0 };
    m.onBeforeCompile = (sh) => {
      const corte = 'if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX';
      if (!sh.fragmentShader.includes(corte)) throw new Error('LineMaterial cambió: no encuentro el corte de la línea punteada');
      sh.uniforms.colita = m.userData.colita;
      sh.fragmentShader = `uniform float colita;\n${sh.fragmentShader.replace(corte, `
        float periodoF = dashSize + gapSize;
        float pF = mod( vLineDistance + dashOffset, periodoF );
        float aF = abs( vUv.x );
        if ( pF < colita ) { if ( aF > ${GROSOR_COLITA.toFixed(2)} ) discard; }
        else if ( pF - colita > ( dashSize - colita ) * ( 1.0 - aF ) ) discard;`)}`;
    };
    m.customProgramCacheKey = () => 'climatec-flechas';
    return m;
  }

  function animar(t) {
    if (!animando || !lineas) return;
    const dt = ultimo ? Math.min((t - ultimo) / 1000, 0.1) : 0;
    ultimo = t;
    lineas.flechas.material.dashOffset -= dt * RAPIDEZ_ANIMACION;
    pedirRender();
    requestAnimationFrame(animar);
  }

  const sP = [0, 0, 0, 0, 0], sP2 = [0, 0];
  const texturaPunto = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.beginPath(); x.arc(32, 32, 25, 0, 2 * Math.PI);
    x.fillStyle = '#ffffff'; x.fill();
    x.lineWidth = 9; x.strokeStyle = '#1d2433'; x.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  const materialesArboles = [...new Set((visor.bosque?.especies ?? [])
    .flatMap((e) => e.lods.flatMap((l) => l.instancias.flatMap((im) => [].concat(im.material)))))];
  let arbolesClaros = false;
  function aclararArboles(si) {
    if (arbolesClaros === si) return;
    arbolesClaros = si;
    for (const m of materialesArboles) {
      m.transparent = si;
      m.opacity = si ? OPACIDAD_ARBOLES : 1;
      m.depthWrite = !si;
      m.needsUpdate = true;
    }
    pedirRender();
  }

  function quitarParticulas() {
    if (!particulas) return;
    escena.remove(particulas.obj, particulas.mapa);
    particulas.obj.geometry.dispose();
    particulas.obj.material.dispose();
    if (particulas.mapa) {
      particulas.mapa.geometry.dispose();
      particulas.mapa.material.map.dispose();
      particulas.mapa.material.dispose();
    }
    particulas = null;
  }

  function crearParticulas(acum, aq, Fm) {
    const cE = [], cN = [], cF = [];
    const { nx: ax, ny: ay, paso } = acum;
    const Uv = new Float32Array(ax * ay).fill(NaN), Vv = new Float32Array(ax * ay).fill(NaN);
    for (let j = 0; j < ay; j++) {
      for (let i = 0; i < ax; i++) {
        const Fl = acum.F[j * ax + i];
        if (!Number.isFinite(Fl)) continue;
        const E = acum.E0 + i * paso, N = acum.N0 + j * paso;
        if (!dentroDelGemelo(E, N) || !lineas.campo(E, N, Z_VIENTO_PUNTOS_M, sP)) continue;
        Uv[j * ax + i] = sP[0]; Vv[j * ax + i] = sP[1];
        const ii = Math.round((E - rejilla.E0) / rejilla.celda), jj = Math.round((N - rejilla.N0) / rejilla.celda);
        const q = ii >= 0 && jj >= 0 && ii < nx && jj < ny ? jj * nx + ii : -1;
        const w = q >= 0 ? pesoROM[q] : 0, Fr = q >= 0 && Fm ? Fm[q] : NaN;
        cE.push(E); cN.push(N); cF.push(w > 0 && Number.isFinite(Fr) ? w * Fr + (1 - w) * Fl : Fl);
      }
    }
    const nc = cE.length;
    const Fmax = Float32Array.from(cF).sort()[Math.floor(nc * 0.99)] ?? 1;
    const tipos = Object.keys(aq.colores).filter((x) => Number.isFinite(aq.base[x]));
    const cuantos = tipos.map(() => Math.round(PUNTOS_TOTAL / tipos.length));
    const n = cuantos.reduce((a, b) => a + b, 0);
    const P = { n, E: new Float32Array(n), N: new Float32Array(n), z: new Float32Array(n), edad: new Float32Array(n),
      vida: new Float32Array(n), uniforme: new Uint8Array(n), pos: new Float32Array(3 * n),
      viento(E, N, out) {
        const fi = (E - acum.E0) / paso, fj = (N - acum.N0) / paso;
        if (!(fi >= 0 && fj >= 0 && fi < ax - 1 && fj < ay - 1)) return false;
        const i = Math.floor(fi), j = Math.floor(fj), ti = fi - i, tj = fj - j;
        let su = 0, sv = 0, sw = 0;
        for (let c4 = 0; c4 < 4; c4++) {
          const di = c4 & 1, dj = c4 >> 1, q = (j + dj) * ax + i + di;
          if (Number.isNaN(Uv[q])) continue;
          const w = (di ? ti : 1 - ti) * (dj ? tj : 1 - tj);
          su += w * Uv[q]; sv += w * Vv[q]; sw += w;
        }
        if (sw < 0.5) return false;
        out[0] = su / sw; out[1] = sv / sw;
        return true;
      },
      resumen: { ...Object.fromEntries(tipos.map((x, t) => [x, cuantos[t]])), celdas: nc, F_p99: +Fmax.toFixed(2) } };
    const col = new Float32Array(3 * n), c3 = new THREE.Color();
    let q = 0;
    tipos.forEach((x, t) => {
      c3.set(aq.colores[x]);
      for (let a = 0; a < cuantos[t]; a++, q++) {
        col[3 * q] = c3.r; col[3 * q + 1] = c3.g; col[3 * q + 2] = c3.b;
        P.uniforme[q] = x === 'O3' ? 1 : 0;
      }
    });
    P.sembrar = (q, alInicio) => {
      for (let intento = 0; intento < 40; intento++) {
        const c = Math.floor(Math.random() * nc);
        if (!P.uniforme[q] && Math.random() * Fmax > Math.min(cF[c], Fmax)) continue;
        const E = cE[c] + (Math.random() - 0.5) * paso, N = cN[c] + (Math.random() - 0.5) * paso;
        const z = ALTURA_PUNTOS_M[0] + Math.random() * (ALTURA_PUNTOS_M[1] - ALTURA_PUNTOS_M[0]);
        if (!P.viento(E, N, sP)) continue;
        P.E[q] = E; P.N[q] = N; P.z[q] = z;
        P.vida[q] = VIDA_S[0] + Math.random() * (VIDA_S[1] - VIDA_S[0]);
        P.edad[q] = alInicio ? Math.random() * P.vida[q] : 0;
        return;
      }
    };
    for (let a = 0; a < n; a++) { P.sembrar(a, true); aEscena(P.E[a], P.N[a], P.z[a], P.pos, 3 * a); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    P.celdas = { E: cE, N: cN, F: cF };
    P.obj = new THREE.Points(geo, new THREE.PointsMaterial({ size: TAM_PUNTO_PX * Math.min(devicePixelRatio, 2), sizeAttenuation: false,
      vertexColors: true, map: texturaPunto, alphaTest: 0.45, transparent: true, depthWrite: false, toneMapped: false }));
    P.obj.renderOrder = 6;
    P.obj.frustumCulled = false;
    return P;
  }

  function moverParticulas(t) {
    if (!moviendo || !particulas) { moviendo = false; return; }
    const dt = ultimoP ? Math.min((t - ultimoP) / 1000, 0.1) : 0;
    ultimoP = t;
    const P = particulas, h = dt * ACELERACION, ruido = DIFUSION_M * Math.sqrt(h) * Math.sqrt(3);
    for (let q = 0; q < P.n; q++) {
      P.edad[q] += dt;
      if (P.edad[q] > P.vida[q] || !P.viento(P.E[q], P.N[q], sP)) P.sembrar(q, false);
      else {
        const E = P.E[q] + sP[0] * h + (Math.random() * 2 - 1) * ruido, N = P.N[q] + sP[1] * h + (Math.random() * 2 - 1) * ruido;
        if (P.viento(E, N, sP2)) { P.E[q] = E; P.N[q] = N; }
      }
      aEscena(P.E[q], P.N[q], P.z[q], P.pos, 3 * q);
    }
    P.obj.geometry.attributes.position.needsUpdate = true;
    pedirRender();
    requestAnimationFrame(moverParticulas);
  }

  function crearMapaF(acum, Fm) {
    const pm = PASO_MAPA_F_M, ax = acum.nx, ay = acum.ny;
    const nxm = Math.round(((ax - 1) * acum.paso) / pm) + 1, nym = Math.round(((ay - 1) * acum.paso) / pm) + 1;
    const local = (E, N) => {
      const fi = (E - acum.E0) / acum.paso, fj = (N - acum.N0) / acum.paso;
      const i = Math.min(Math.floor(fi), ax - 2), j = Math.min(Math.floor(fj), ay - 2), ti = fi - i, tj = fj - j;
      let s = 0, w = 0;
      for (let c4 = 0; c4 < 4; c4++) {
        const di = c4 & 1, dj = c4 >> 1, v = acum.F[(j + dj) * ax + i + di];
        if (Number.isNaN(v)) continue;
        const ww = (di ? ti : 1 - ti) * (dj ? tj : 1 - tj);
        s += ww * v; w += ww;
      }
      return w > 0.2 ? s / w : NaN;
    };
    const paradas = YLORRD.map((h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));
    const datos = new Uint8Array(4 * nxm * nym);
    for (let j = 0; j < nym; j++) {
      for (let i = 0; i < nxm; i++) {
        const o = 4 * (j * nxm + i), E = acum.E0 + i * pm, N = acum.N0 + j * pm;
        datos[o] = 255; datos[o + 1] = 255; datos[o + 2] = 204;
        if (!dentroDelGemelo(E, N) || alturas.alturaEdificio(E, N) > 1) continue;
        let F = local(E, N);
        const ii = Math.round((E - rejilla.E0) / rejilla.celda), jj = Math.round((N - rejilla.N0) / rejilla.celda);
        if (ii >= 0 && jj >= 0 && ii < nx && jj < ny && Fm) {
          const q = jj * nx + ii, w = pesoROM[q], fr = Fm[q];
          if (w > 0 && Number.isFinite(fr)) F = Number.isFinite(F) ? w * fr + (1 - w) * F : fr;
        }
        if (!Number.isFinite(F)) continue;
        const t = Math.min(Math.max((F - ESCALA_F[0]) / (ESCALA_F[1] - ESCALA_F[0]), 0), 1) * (paradas.length - 1);
        const k0 = Math.min(Math.floor(t), paradas.length - 2), f = t - k0;
        for (let c = 0; c < 3; c++) datos[o + c] = Math.round(paradas[k0][c] + f * (paradas[k0 + 1][c] - paradas[k0][c]));
        datos[o + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(datos, nxm, nym, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    const E0 = acum.E0 - pm / 2, N0 = acum.N0 - pm / 2, E1 = acum.E0 + (nxm - 0.5) * pm, N1 = acum.N0 + (nym - 0.5) * pm;
    const pos = new Float32Array(12);
    [[E0, N0], [E1, N0], [E0, N1], [E1, N1]].forEach(([E, N], c) => aEscena(E, N, Z_MAPA_F_M, pos, 3 * c));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
    geo.setIndex([0, 1, 2, 2, 1, 3]);
    const mapa = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: OPACIDAD_MAPA_F,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    mapa.renderOrder = -1;
    mapa.frustumCulled = false;
    return mapa;
  }

  async function prepararContaminantes() {
    const clave = `${estado.corrida}|${JSON.stringify(estado.aq.base)}`;
    if (!particulas || particulas.clave !== clave) {
      quitarParticulas();
      const acum = await cargarAcumulacion(estado.corrida), F = estado.F;
      if (!acum) throw new Error('no accumulation factor for this hour');
      particulas = crearParticulas(acum, estado.aq, F);
      particulas.clave = clave;
      particulas.mapa = crearMapaF(acum, F);
      escena.add(particulas.obj, particulas.mapa);
      console.info('[rom] contaminantes', estado.corrida, particulas.resumen);
    }
    particulas.obj.visible = true;
    particulas.mapa.visible = !estado.sinMapaF;
    aclararArboles(true);
    if (!moviendo) { moviendo = true; ultimoP = 0; requestAnimationFrame(moverParticulas); }
    pedirRender();
  }

  async function mostrarContaminantes() {
    lineas.base.visible = lineas.flechas.visible = false;
    animando = false;
    if (sensores) sensores.grupo.visible = false;
    ocultarAviso();
    await prepararContaminantes();
    parent.postMessage({ tipo: 'climatec-rom-lineas-listas', rango: null, resumen: { puntos: particulas.resumen } }, location.origin);
  }

  const juegos = new Map();
  const quitarJuego = (j) => {
    escena.remove(j.base, j.flechas);
    j.base.geometry.dispose();
    j.base.material.dispose();
    j.flechas.material.dispose();
  };

  async function pesoDeLaHora() {
    if (!pesos.has('muestra')) pesos.set('muestra', pesoMuestra(estado.poligono, nx, ny, rejilla.celda));
    return pesos.get('muestra');
  }

  async function aplicar() {
    if (!CIELO_RELOJ) cielo.poner(tipoCielo(estado.corrida, await cargarDiccionario(estado.corrida)));
    pedirRender();
    pesoROM = await pesoDeLaHora();
    const perfil = estado.variable === 'T' ? 'T' : 'U';
    const hora = `${estado.corrida}_${estado.fuente}`, clave = `${hora}_${perfil}`;
    let resumen = null;
    if (!lineas || lineas.clave !== clave) {
      if (lineas) lineas.base.visible = lineas.flechas.visible = false;
      for (const [k, j] of juegos) if (!k.startsWith(`${hora}_`)) { quitarJuego(j); juegos.delete(k); }
      if (juegos.has(clave)) lineas = juegos.get(clave);
      else {
        const [c, dic] = await Promise.all([cargarCampo3D(estado.corrida, estado.fuente), cargarDiccionario(estado.corrida)]);
        anomaliaMuestra(c, dic);
        const urbano = await cargarCampoGemelo(estado.corrida, dic);
        campoGemelo = { corrida: estado.corrida, urbano };
        resumen = construirLineas(c, clave, estado.corrida, dic, urbano, perfil);
        juegos.set(clave, lineas);
      }
    }
    if (estado.variable === 'AQ') { await mostrarContaminantes(); return; }
    if (particulas) { particulas.obj.visible = false; if (particulas.mapa) particulas.mapa.visible = false; moviendo = false; }
    aclararArboles(false);
    lineas.conVegetacion = estado.vegetacion !== false && !!lineas.veg;
    const rango = colorear(estado.variable);
    const dicHora = await cargarDiccionario(estado.corrida);
    sensores ??= crearSensores(dicHora.estaciones);
    if (!valoresSensores.has(estado.corrida)) valoresSensores.set(estado.corrida, valoresDelGemelo());
    for (const sp of sensores.puntos) {
      const est = dicHora.estaciones.find((e) => e.proveedor === 'purpleair' && e.id === sp.userData.id);
      sp.visible = sp.userData.poste.visible = Number.isFinite(est?.T_registro);
    }
    ocultarAviso();
    const anim = estado.vista === 'animado';
    lineas.base.material.opacity = anim ? 0.35 : 1;
    lineas.base.material.depthWrite = !anim;
    const fl = FLECHAS[estado.variable === 'T' ? 'T' : 'U'];
    Object.assign(lineas.flechas.material, { linewidth: fl.grosor, dashSize: fl.largo, gapSize: fl.periodo - fl.largo });
    lineas.flechas.material.userData.colita.value = fl.colita;
    mostrarVariable();
    pedirRender();
    if (resumen) console.info('[rom] líneas de corriente 3D', clave, resumen);
    parent.postMessage({ tipo: 'climatec-rom-lineas-listas', rango, resumen }, location.origin);
  }

  let verVariable = true;
  function mostrarVariable() {
    if (!lineas || !estado || estado.variable === 'AQ') return;
    const anim = estado.vista === 'animado';
    lineas.base.visible = verVariable && (!anim || estado.variable !== 'T');
    lineas.flechas.visible = verVariable && anim;
    if (sensores) sensores.grupo.visible = verVariable && estado.variable === 'T';
    if (!verVariable) ocultarAviso();
    if (verVariable && anim && !animando) { animando = true; ultimo = 0; requestAnimationFrame(animar); }
    if (!anim || !verVariable) animando = false;
    pedirRender();
  }

  const resumen = { vegetacion: vegetacion.resumen, msAlturas };
  let cola = Promise.resolve();
  addEventListener('message', (ev) => {
    if (ev.origin !== location.origin) return;
    if (ev.data?.tipo === 'climatec-rom-hola') {
      parent.postMessage({ tipo: 'climatec-rom-listo', resumen }, location.origin);
      return;
    }
    if (ev.data?.tipo === 'climatec-rom-ver-variable') { verVariable = ev.data.visible !== false; mostrarVariable(); return; }
    if (ev.data?.tipo !== 'climatec-rom-estado') return;
    cola = cola.then(() => new Promise((r) => setTimeout(r, 30))).then(async () => {
      estado = ev.data;
      try {
        await aplicar();
        dispatchEvent(new CustomEvent('climatec-rom-campo', { detail: { corrida: estado.corrida } }));
      } catch (err) {
        console.error('[rom]', err);
        parent.postMessage({ tipo: 'climatec-rom-lineas-listas', error: String(err.message ?? err) }, location.origin);
      }
    });
  });
  console.info('[rom] capa lista', resumen);
  Object.assign(window.climatec, { rom: { rejilla, resumen, vegetacion, get alturas() { return alturas; }, get lineas() { return lineas; }, get particulas() { return particulas; },
    get cielo() { return cielo.tipo; }, get variable() { return estado?.variable; },
    get diccionario() { return (estado && diccionarios.get(estado.corrida)) ?? null; },
    get campoGemelo() { return campoGemelo?.corrida === estado?.corrida ? campoGemelo?.urbano ?? null : null; },
    get corrida() { return estado?.corrida ?? null; },
    get sensores() { return sensores && { ...sensores, valores: Object.fromEntries(valoresSensores), texto: (id) => textoSensor(id, diccionarios.get(estado.corrida)) }; } } });
  parent.postMessage({ tipo: 'climatec-rom-listo', resumen }, location.origin);
}

if (ACTIVO) iniciar().catch((err) => console.error('[rom]', err));
