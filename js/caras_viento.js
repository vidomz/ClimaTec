import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { listo } from './visor.js?v=20261110a';

const ACTIVO = new URLSearchParams(location.search).get('semantica') !== null;
const VERSION = '20261029d';
const FLECHA_M = { largo: 4.05, cabeza: 1.49, radio: 0.2, radioCabeza: 0.65, separa: 0.25 };
export const ESCALA_CP = [[-1, '#0d0887'], [-0.8, '#41049d'], [-0.6, '#6a00a8'], [-0.4, '#8f0da4'], [-0.2, '#b12a90'],
  [0, '#cc4778'], [0.2, '#e16462'], [0.4, '#f2844b'], [0.6, '#fca636'], [0.8, '#fcce25'], [1, '#f0f921']];
const SIN_DATO = '#9aa3ad';
const Z_REF = 10;

function cpDeTabla(tabla, paso, wd) {
  const n = tabla.length, x = (((wd % 360) + 360) % 360) / paso, i = Math.floor(x) % n, f = x - Math.floor(x);
  return tabla[i] * (1 - f) + tabla[(i + 1) % n] * f;
}

let deseado = false, aplicar = null, sinContaminantes = true;
addEventListener('message', (ev) => {
  if (ev.origin !== location.origin) return;
  if (ev.data?.tipo === 'climatec-semantica') deseado = !!ev.data.activo;
  else if (ev.data?.tipo === 'climatec-rom-estado') sinContaminantes = ev.data.variable !== 'AQ';
  else return;
  aplicar?.(deseado);
});

const PARADAS = ESCALA_CP.map(([v, c]) => [v, new THREE.Color(c)]);
function colorCp(cp, out) {
  const v = THREE.MathUtils.clamp(cp, -1, 1);
  for (let i = 1; i < PARADAS.length; i++) {
    const [v1, c1] = PARADAS[i];
    if (v <= v1) { const [v0, c0] = PARADAS[i - 1]; return out.copy(c0).lerp(c1, (v - v0) / (v1 - v0)); }
  }
  return out.copy(PARADAS.at(-1)[1]);
}

function geometriaFlecha(k) {
  const L = FLECHA_M.largo * k, C = FLECHA_M.cabeza * k;
  const asta = new THREE.CylinderGeometry(FLECHA_M.radio * k, FLECHA_M.radio * k, L - C, 8).translate(0, (L - C) / 2, 0);
  const punta = new THREE.ConeGeometry(FLECHA_M.radioCabeza * k, C, 14).translate(0, L - C / 2, 0);
  return mergeGeometries([asta, punta]);
}

async function iniciar() {
  const [visor, datos, cfd] = await Promise.all([
    listo,
    fetch(`modelo/caras_tec.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json()),
    fetch(`modelo/cp_caras.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json()),
  ]);
  const { escena, georef, pedirRender } = visor;
  const k = georef.k;

  const caras = [];
  for (const e of datos.edificios) {
    if (!e.caras.length) continue;
    const c0 = e.caras.reduce((s, c) => s.add(new THREE.Vector3(...c.centro)), new THREE.Vector3()).divideScalar(e.caras.length);
    const [lon, lat] = georef.aLonLat(c0);
    const [E, N] = georef.aUTM(lon, lat);
    for (const c of e.caras) {
      caras.push({ ...c, edificio: e.corto, E, N, n: new THREE.Vector3(...c.normal).normalize(), tipo: null, cfd: cfd.caras[c.id] ?? null });
    }
  }
  const total = caras.reduce((s, c) => s + c.puntos.length, 0);
  const malla = new THREE.InstancedMesh(geometriaFlecha(k), new THREE.MeshBasicMaterial({ toneMapped: false }), total);
  malla.name = 'Flechas_Caras';
  malla.renderOrder = 10;
  malla.visible = false;
  let q = 0;
  for (const c of caras) { c.inicio = q; q += c.puntos.length; }

  const m = new THREE.Matrix4(), pos = new THREE.Vector3(), rot = new THREE.Quaternion(), esc = new THREE.Vector3(1, 1, 1);
  const arriba = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), color = new THREE.Color();
  function colocar(i) {
    const c = caras[i], presion = c.tipo !== 'succion';
    const L = FLECHA_M.largo * k, s = FLECHA_M.separa * k;
    dir.copy(c.n).multiplyScalar(presion ? -1 : 1);
    rot.setFromUnitVectors(arriba, dir);
    if (c.tipo) colorCp(c.cp, color); else color.set(SIN_DATO);
    c.puntos.forEach((p, j) => {
      pos.set(...p).addScaledVector(c.n, presion ? s + L : s);
      malla.setMatrixAt(c.inicio + j, m.compose(pos, rot, esc));
      malla.setColorAt(c.inicio + j, color);
    });
  }

  const out = [0, 0, 0, 0, 0];
  function conViento() {
    const dic = window.climatec.rom?.diccionario;
    if (!dic) return false;
    for (const c of caras) {
      if (!dic.muestra(c.E, c.N, Z_REF, out)) continue;
      const u = out[0], v = out[1], w = Math.hypot(u, v);
      if (!(w > 0)) continue;
      if (!c.cfd) continue;
      c.wd = (THREE.MathUtils.radToDeg(Math.atan2(-u, -v)) + 360) % 360;
      c.cp = cpDeTabla(c.cfd.cp, cfd.paso_grados, c.wd);
      c.tipo = c.cp >= 0 ? 'presion' : 'succion';
    }
    caras.forEach((_, i) => colocar(i));
    malla.instanceMatrix.needsUpdate = true;
    malla.instanceColor.needsUpdate = true;
    malla.computeBoundingSphere();
    pedirRender();
    return true;
  }
  caras.forEach((_, i) => colocar(i));
  malla.computeBoundingSphere();
  escena.add(malla);
  addEventListener('climatec-rom-campo', () => conViento());
  conViento();

  aplicar = (si) => {
    si = si && sinContaminantes;
    malla.visible = si;
    pedirRender();
  };
  if (window.climatec.rom?.variable) sinContaminantes = window.climatec.rom.variable !== 'AQ';
  aplicar(deseado);
  window.climatec.caras = { malla, caras, conViento, get activo() { return malla.visible; } };
  console.info('[caras] listas', { caras: caras.length, flechas: total });
}

if (ACTIVO) iniciar().catch((err) => console.error('[caras]', err));
