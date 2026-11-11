import * as THREE from 'three';
import { listo } from './visor.js?v=20261110a';
import { CLASES, ajustar } from './materiales_tec.js?v=20261031a';

const MODO = new URLSearchParams(location.search).get('semantica');
const ACTIVO = MODO !== null;
const VERSION = '20261031a';
const MATERIALES = [
  ['concreto', 'Concrete', '#a9aeb5'],
  ['piedra', 'Stone Tile', '#c49a6c'],
  ['vidrio', 'Glass', '#4fa8e0'],
  ['metal', 'Metal', '#4b5563'],
];
const RESERVADO = {
  'tiempo-real': () => ({ arriba: 52, derecha: innerWidth <= 760 ? 252 : 316, abajo: 76, izquierda: 62 }),
}[MODO] ?? (() => ({ arriba: 0, derecha: 0, abajo: 0, izquierda: 0 }));

function enteros(p) {
  const base = MATERIALES.map(([k]) => Math.floor(p[k] ?? 0));
  let falta = 100 - base.reduce((a, b) => a + b, 0);
  const orden = MATERIALES.map(([k], q) => [(p[k] ?? 0) - base[q], q]).sort((a, b) => b[0] - a[0]);
  for (const [, q] of orden) { if (falta <= 0) break; base[q]++; falta--; }
  return base;
}

function llenar(tarjeta, e, comp) {
  const pct = enteros(comp.ajustado);
  const barra = MATERIALES.map(([, , color], q) => (pct[q] >= 1 ? `<i style="width:${pct[q]}%;background:${color}"></i>` : '')).join('');
  const filas = MATERIALES.map(([, etiqueta, color], q) => (pct[q] >= 1
    ? `<span><i style="background:${color}"></i>${etiqueta}</span><span>${pct[q]} %</span>` : '')).join('');
  const t = window.climatec?.techosT?.get(e.nombre);
  const techo = Number.isFinite(t?.T)
    ? `<span class="sem-filas sem-techo"><span>T<sub>roof</sub></span><span>${t.T.toFixed(1)} °C</span></span>` : '';
  tarjeta.innerHTML = `<p class="tarjeta-edificio-nombre"></p><span class="sem-barra">${barra}</span><span class="sem-filas">${filas}</span>${techo}`;
  tarjeta.firstElementChild.textContent = e.nombre;
}

let deseado = false, aplicar = null;
addEventListener('message', (ev) => {
  if (ev.origin !== location.origin || ev.data?.tipo !== 'climatec-semantica') return;
  deseado = !!ev.data.activo;
  aplicar?.(deseado);
});

async function iniciar() {
  const [visor, edificios, composicion] = await Promise.all([
    listo,
    fetch(`modelo/edificios.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json()).then((d) => d.edificios),
    fetch(`modelo/composicion.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json()).then((d) => d.edificios),
  ]);
  const { camara, lienzo } = visor;
  for (const c of composicion) {
    if (!c.muros) continue;
    const m = ajustar(c.corto ?? c.nombre, c.muros), Am = c.area_m2?.muros ?? 0, At = c.area_m2?.techos ?? 0;
    c.ajustado = Object.fromEntries(CLASES.map((k) => [k, (m[k] * Am + (k === 'concreto' ? 100 : 0) * At) / Math.max(Am + At, 1)]));
  }
  const porNombre = new Map(composicion.map((c) => [c.nombre, c]));

  const capa = document.createElement('div');
  capa.className = 'capa-edificios capa-semantica';
  capa.hidden = true;
  const tarjeta = document.createElement('div');
  tarjeta.className = 'tarjeta-edificio tarjeta-semantica';
  tarjeta.setAttribute('role', 'tooltip');
  tarjeta.hidden = true;
  const marcas = [];
  let activa = null;
  const mostrar = (m) => { activa = m; llenar(tarjeta, m.edificio, m.comp); tarjeta.hidden = false; colocar(); };
  const ocultar = (m) => { if (activa !== m) return; activa = null; tarjeta.hidden = true; };
  const colocar = () => {
    if (!activa) return;
    tarjeta.style.transform = `translate3d(${activa.x}px, ${activa.y}px, 0)`;
    const z = RESERVADO(), w = tarjeta.offsetWidth, h = tarjeta.offsetHeight, W = lienzo.clientWidth;
    const izq = activa.x - w / 2, dx = Math.min(Math.max(izq, z.izquierda + 6), W - z.derecha - 6 - w) - izq;
    tarjeta.style.translate = activa.y - h - 12 < z.arriba + 6 ? `calc(-50% + ${dx}px) 16px` : `calc(-50% + ${dx}px) calc(-100% - 12px)`;
  };
  addEventListener('climatec-techos', () => { if (activa) llenar(tarjeta, activa.edificio, activa.comp); });
  for (const e of edificios) {
    const comp = porNombre.get(e.nombre);
    if (!comp?.ajustado || !e.pos) continue;
    const pct = enteros(comp.ajustado);
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'marcador-edificio';
    boton.setAttribute('aria-label', `${e.nombre}: ${MATERIALES.map(([, et], q) => (pct[q] ? `${et} ${pct[q]} %` : '')).filter(Boolean).join(', ')} (estimated)`);
    const m = { edificio: e, comp, boton, pos: new THREE.Vector3(...e.pos), x: 0, y: 0 };
    boton.addEventListener('pointerenter', () => mostrar(m));
    boton.addEventListener('pointerleave', () => ocultar(m));
    boton.addEventListener('focus', () => mostrar(m));
    boton.addEventListener('blur', () => ocultar(m));
    boton.addEventListener('click', () => (activa === m ? ocultar(m) : mostrar(m)));
    capa.append(boton);
    marcas.push(m);
  }
  capa.append(tarjeta);
  document.querySelector('.visor').append(capa);

  const v = new THREE.Vector3();
  let activo = false;
  function acomodar() {
    if (!activo) return;
    const W = lienzo.clientWidth, H = lienzo.clientHeight, z = RESERVADO();
    for (const m of marcas) {
      const prof = -v.copy(m.pos).applyMatrix4(camara.matrixWorldInverse).z;
      v.copy(m.pos).project(camara);
      m.x = ((v.x + 1) / 2) * W;
      m.y = ((1 - v.y) / 2) * H;
      const visible = prof > camara.near && m.x > z.izquierda && m.x < W - z.derecha && m.y > z.arriba && m.y < H - z.abajo;
      m.boton.hidden = !visible;
      if (visible) m.boton.style.transform = `translate3d(${m.x}px, ${m.y}px, 0)`;
      else ocultar(m);
    }
    colocar();
    requestAnimationFrame(acomodar);
  }
  aplicar = (si) => {
    if (si === activo) return;
    activo = si;
    capa.hidden = !si;
    if (!si) { activa = null; tarjeta.hidden = true; }
    else requestAnimationFrame(acomodar);
  };
  aplicar(deseado);
  window.climatec.semantica = { get activo() { return activo; }, marcas, tarjeta, aplicar: (si) => aplicar(si) };
  console.info('[semantica] lista', { edificios: marcas.length });
}

if (ACTIVO) iniciar().catch((err) => console.error('[semantica]', err));
