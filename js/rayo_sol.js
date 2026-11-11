import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { listo } from './visor.js?v=20261110a';

const ACTIVO = new URLSearchParams(location.search).has('sol');
const CASO = new URLSearchParams(location.search).has('caso');
const LARGO_CASO_M = 14, SOBRE_TECHO_M = 5;
const PUNTO = { x: -110.64, y: 4.07, z: 297.95 };
const ALTURA_M = 75, LARGO_MAX_M = 450;
const GROSOR_PX = CASO ? 3 : 6, COLOR = '#ffc400';
const FLECHA_M = CASO ? { radio: 0.9, alto: 2.6 } : { radio: 2.2, alto: 6 };
const RESERVADO = new URLSearchParams(location.search).get('herramientas') === 'izquierda'
  ? () => ({ arriba: 52, derecha: innerWidth <= 760 ? 252 : 316, izquierda: 62 })
  : () => ({ arriba: 0, derecha: 0, izquierda: 0 });

let semantica = false, variable = null, aplicar = null;
addEventListener('message', (ev) => {
  if (ev.origin !== location.origin) return;
  if (ev.data?.tipo === 'climatec-semantica') semantica = !!ev.data.activo;
  else if (ev.data?.tipo === 'climatec-rom-estado') variable = ev.data.variable;
  else return;
  aplicar?.();
});

const rad = Math.PI / 180;
export function posicionSolar(fecha, lat, lon) {
  const inicio = Date.UTC(fecha.getUTCFullYear(), 0, 1);
  const dia = Math.floor((fecha.getTime() - inicio) / 86400000) + 1;
  const horaUTC = fecha.getUTCHours() + fecha.getUTCMinutes() / 60 + fecha.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (dia - 1 + (horaUTC - 12) / 24);
  const ecuacion = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const solar = horaUTC * 60 + ecuacion + 4 * lon;
  const H = (solar / 4 - 180) * rad, phi = lat * rad;
  const elev = Math.asin(Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H));
  const azim = Math.atan2(-Math.sin(H), Math.tan(decl) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
  return { elevacion: elev / rad, azimut: ((azim / rad) + 360) % 360 };
}

async function radiacionEnPunto(corrida, E, N) {
  const carpeta = corrida?.startsWith('tiemporeal_') ? 'rom/tiempo_real' : corrida?.startsWith('caso_') ? 'rom/caso' : null;
  if (!carpeta) return null;
  const d = await fetch(`${carpeta}/${corrida}/diccionario.json`, { cache: 'no-cache' }).then((r) => r.json());
  const xs = [...new Set(d.x)].sort((a, b) => a - b), ys = [...new Set(d.y)].sort((a, b) => a - b), paso = xs[1] - xs[0];
  const valor = new Map(d.x.map((x, n) => [`${x},${d.y[n]}`, d.valores.SR[n]]));
  const fi = (E - xs[0]) / paso, fj = (N - ys[0]) / paso, i = Math.floor(fi), j = Math.floor(fj), s = fi - i, t = fj - j;
  let suma = 0, peso = 0;
  for (const [di, dj, w] of [[0, 0, (1 - s) * (1 - t)], [1, 0, s * (1 - t)], [0, 1, (1 - s) * t], [1, 1, s * t]]) {
    const v = valor.get(`${xs[0] + (i + di) * paso},${ys[0] + (j + dj) * paso}`);
    if (v !== null && v !== undefined && w > 0) { suma += w * v; peso += w; }
  }
  return peso > 0 ? suma / peso : null;
}

async function iniciar() {
  const { escena, georef, pedirRender, camara, lienzo } = await listo;
  const k = georef.k;
  while (CASO && !window.climatec.casoEstudio) await new Promise((r) => setTimeout(r, 300));
  const base = CASO ? window.climatec.casoEstudio.puntos.find((p) => p.techo).punto.clone().add(new THREE.Vector3(0, SOBRE_TECHO_M * k, 0))
    : new THREE.Vector3(PUNTO.x, PUNTO.y, PUNTO.z);
  const [lon, lat] = georef.aLonLat(base);
  const [E, N] = georef.aUTM(lon, lat);
  const grupo = new THREE.Group();
  grupo.name = 'RayoSol';

  const linea = new LineSegments2(new LineSegmentsGeometry().setPositions([0, 0, 0, 0, 1, 0]),
    new LineMaterial({ color: COLOR, linewidth: GROSOR_PX, toneMapped: false }));
  linea.renderOrder = 11;
  const flecha = new THREE.Mesh(new THREE.ConeGeometry(FLECHA_M.radio * k, FLECHA_M.alto * k, 20),
    new THREE.MeshBasicMaterial({ color: COLOR, toneMapped: false }));
  grupo.add(linea, flecha);
  escena.add(grupo);

  const estado = { elevacion: null, azimut: null, SR: null, corrida: null };
  const dir = new THREE.Vector3(), arriba = new THREE.Vector3(0, 1, 0);
  function actualizar(fecha = new Date()) {
    const s = posicionSolar(fecha, lat, lon);
    Object.assign(estado, s);
    estado.raya = s;
    estado.noche = s.elevacion <= 0;
    aplicar?.();
    if (estado.noche) return;
    const e = s.elevacion * rad, a = s.azimut * rad;
    dir.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
    const largo = CASO ? LARGO_CASO_M * k : Math.min(ALTURA_M / Math.sin(e), LARGO_MAX_M) * k;
    const tope = base.clone().addScaledVector(dir, largo);
    linea.geometry.setPositions([base.x, base.y, base.z, tope.x, tope.y, tope.z]);
    flecha.quaternion.setFromUnitVectors(arriba, dir.clone().negate());
    flecha.position.copy(base).addScaledVector(dir, (FLECHA_M.alto * k) / 2);
    pedirRender();
  }
  const instante = () => (estado.instante ? new Date(estado.instante) : new Date());
  actualizar();
  setInterval(() => actualizar(instante()), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) actualizar(instante()); });
  aplicar = () => {
    grupo.visible = semantica && variable !== 'AQ' && !estado.noche;
    if (!grupo.visible) aviso.style.display = 'none';
    pedirRender();
  };
  addEventListener('climatec-rom-campo', async (ev) => {
    const corrida = ev.detail?.corrida;
    if (!corrida || corrida === estado.corrida) return;
    estado.corrida = corrida;
    const m = /^(?:tiemporeal|caso)_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/.exec(corrida);
    if (m) {
      estado.instante = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + 6, +m[5]);
      actualizar(instante());
    }
    try {
      const sr = await radiacionEnPunto(corrida, E, N);
      if (estado.corrida === corrida) estado.SR = sr;
    } catch (err) { console.warn('[sol] S_R', err); }
  });

  const aviso = document.createElement('div');
  Object.assign(aviso.style, {
    position: 'fixed', pointerEvents: 'none', display: 'none', zIndex: 30, background: 'rgba(255,255,255,0.97)', color: '#1d2433',
    border: '1px solid #c9d1de', borderRadius: '8px', boxShadow: '0 4px 14px rgba(0,0,0,0.18)', padding: '8px 10px',
    font: '12px/1.4 Poppins, system-ui, sans-serif', width: 'max-content', whiteSpace: 'nowrap',
  });
  document.body.appendChild(aviso);
  const texto = () => `S<sub>R</sub> = <b>${estado.SR === null ? '—' : `${Math.round(estado.SR)} W·m⁻²`}</b>`;
  const rayo = new THREE.Raycaster(), ndc = new THREE.Vector2();
  lienzo.addEventListener('pointermove', (ev) => {
    const r = lienzo.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(ndc, camara);
    if (!grupo.visible || !rayo.intersectObjects([linea, flecha], false).length) { aviso.style.display = 'none'; return; }
    aviso.innerHTML = texto();
    aviso.style.display = 'block';
    const w = aviso.offsetWidth, h = aviso.offsetHeight, z = RESERVADO();
    let x = ev.clientX + 14, y = ev.clientY - h - 12;
    if (x + w > innerWidth - z.derecha - 6) x = ev.clientX - w - 14;
    if (y < z.arriba + 6) y = ev.clientY + 16;
    aviso.style.left = `${Math.max(z.izquierda + 6, Math.min(x, innerWidth - w - 6))}px`;
    aviso.style.top = `${Math.max(6, Math.min(y, innerHeight - h - 6))}px`;
  });
  lienzo.addEventListener('pointerleave', () => { aviso.style.display = 'none'; });
  window.climatec.controles?.addEventListener('change', () => { aviso.style.display = 'none'; });
  variable ??= window.climatec?.rom?.variable ?? null;
  aplicar();
  window.climatec.sol = { grupo, get estado() { return { ...estado }; }, actualizar };
  console.info('[sol] rayo listo', estado);
}

if (ACTIVO) iniciar().catch((err) => console.error('[sol]', err));
