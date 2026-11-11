import { pintar as pintarDegradacion, marcar as marcarDegradacion } from './caso_degradacion.js?v=20261105c';
import { pintar as pintarEnergia } from './caso_energia.js?v=20261105d';
import { pintar as pintarVegetacion } from './caso_vegetacion.js?v=20261105a';
import { pintar as pintarCostos } from './caso_costos.js?v=20261105d';

const ORDEN = ['Concrete', 'Metal', 'Glass', 'Paint'];
const COLORES = {
  x: { Concrete: '#9e9b94', Metal: '#c8a46a', Glass: '#4f6b80', Paint: '#9b655c' },
  z: { Concrete: '#9e9b94', Metal: '#a3aab1', Glass: '#4f6b80' },
};
const VERSION = '20261104a';
const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RUMBOS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const $ = (id) => document.getElementById(id);
const fmt = (x, d) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

function redondear(p) {
  const claves = ORDEN.filter((k) => p[k] > 0);
  const base = Object.fromEntries(claves.map((k) => [k, Math.floor(p[k])]));
  let falta = 100 - claves.reduce((s, k) => s + base[k], 0);
  for (const k of [...claves].sort((a, b) => (p[b] - base[b]) - (p[a] - base[a]))) if (falta-- > 0) base[k]++;
  return base;
}

function pintarComposicion(cont, cual, total) {
  const valores = redondear(total), colores = COLORES[cual], mats = ORDEN.filter((k) => valores[k] !== undefined);
  const barra = document.createElement('div');
  barra.className = 'caso-barra';
  barra.setAttribute('aria-hidden', 'true');
  barra.innerHTML = mats.map((k) => `<span style="flex:${valores[k]};background:${colores[k]}"></span>`).join('');
  const lista = document.createElement('ul');
  lista.className = 'caso-materiales';
  lista.innerHTML = mats.map((k) => `<li><i style="background:${colores[k]}"></i>${k}<b>${valores[k]}&nbsp;%</b></li>`).join('');
  cont.replaceChildren(barra, lista);
}

const composicion = fetch(`datos/caso_estudio.json?v=${VERSION}`, { cache: 'no-cache' })
  .then((r) => { if (!r.ok) throw new Error(`datos/caso_estudio.json: HTTP ${r.status}`); return r.json(); })
  .then((d) => {
    for (const cont of document.querySelectorAll('.caso-composicion')) {
      const e = d.edificios[cont.dataset.edificio];
      if (e) pintarComposicion(cont, cont.dataset.edificio, e.total);
    }
    return Object.fromEntries(Object.entries(d.edificios).map(([k, e]) => [k, redondear(e.total)]));
  });
composicion.catch(console.error);

const gemelos = Object.fromEntries([...document.querySelectorAll('.pred-caso iframe[data-edificio]')]
  .map((f) => [f.dataset.edificio, f]));
const avisos = Object.fromEntries([...document.querySelectorAll('.pred-caso .rom-cargando[data-edificio]')]
  .map((p) => [p.dataset.edificio, p]));
const cualDe = (ventana) => Object.keys(gemelos).find((k) => gemelos[k].contentWindow === ventana);

let fechas = [], indice = 0, vista = 'lineas', muestra = null, lineasCaso = {};
const listos = new Set();

const CORTES_T = { calor: ['28', '30', '33', '36'], frio: ['6', '4', '1', '−2'] };
const enviarSuperficie = (cual) => gemelos[cual]?.contentWindow?.postMessage({ tipo: 'climatec-semantica', activo: true }, location.origin);

function enviar(cual) {
  const f = fechas[indice];
  if (!f || !muestra || !listos.has(cual)) return;
  avisos[cual].hidden = false;
  avisos[cual].textContent = 'Loading…';
  gemelos[cual].contentWindow.postMessage({ tipo: 'climatec-rom-estado', vista, corrida: f.corrida, fuente: 'ROM',
    variable: 'T', poligono: muestra, vegetacion: true, recorte: lineasCaso.recorte, foco: lineasCaso.foco }, location.origin);
}
const enviarATodos = () => Object.keys(gemelos).forEach(enviar);

addEventListener('message', (ev) => {
  if (ev.origin !== location.origin) return;
  const tipo = ev.data?.tipo;
  if (tipo === 'climatec-caso-camara' || tipo === 'climatec-caso-cursor') {
    const otro = gemelos[ev.data.edificio === 'x' ? 'z' : 'x'];
    otro?.contentWindow?.postMessage(ev.data, location.origin);
    return;
  }
  const cual = cualDe(ev.source);
  if (!cual) return;
  if (tipo === 'climatec-rom-listo') {
    listos.add(cual);
    enviar(cual);
    enviarSuperficie(cual);
  } else if (tipo === 'climatec-suelo-niveles') {
    const c = CORTES_T[ev.data.frio ? 'frio' : 'calor'];
    [...$('caso-ts-cortes').children].forEach((x, i) => { x.textContent = c[i]; });
  } else if (tipo === 'climatec-rom-lineas-listas') {
    avisos[cual].hidden = !ev.data.error;
    if (ev.data.error) avisos[cual].textContent = `The streamlines could not be computed: ${ev.data.error}`;
    if (ev.data.rango) {
      $('caso-t-min').textContent = fmt(ev.data.rango.min, 1);
      $('caso-t-max').textContent = fmt(ev.data.rango.max, 1);
    }
  }
});
for (const [cual, f] of Object.entries(gemelos)) {
  f.addEventListener('load', () => {
    f.contentWindow.postMessage({ tipo: 'climatec-rom-hola' }, location.origin);
    enviarSuperficie(cual);
  });
}

const fechaLarga = (iso, hora) => {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${a}${hora === undefined ? '' : `, ${String(hora).padStart(2, '0')}:00`}`;
};

function pintarFecha() {
  const f = fechas[indice];
  $('caso-fecha-titulo').textContent = `${fechaLarga(f.fecha, f.hora)} · ${f.etiqueta}`;
  const v = f.fila;
  const filas = [
    ['T<sub>air</sub>', `${fmt(v.T, 1)} °C`], ['H<sub>R</sub>', `${fmt(v.HR, 0)} %`],
    ['W<sub>s</sub>', `${fmt(v.Ws, 1)} km·h⁻¹`], ['W<sub>d</sub>', `${fmt(v.Wd, 0)}° ${RUMBOS[Math.round(v.Wd / 22.5) % 16]}`],
    ['S<sub>R</sub>', `${fmt(v.SR, 0)} W·m⁻²`], ['P<sub>atm</sub>', `${fmt(v.Patm, 1)} hPa`],
  ];
  $('caso-meteo').innerHTML = filas.map(([s, x]) => `<li><span>${s}</span><b>${x}</b></li>`).join('');
}

function prepararControles() {
  const deslizable = $('caso-fecha');
  deslizable.max = String(fechas.length - 1);
  deslizable.disabled = fechas.length < 2;
  $('caso-fecha-marcas').innerHTML = [...new Set([fechas[0], fechas.at(-1)])]
    .map((f) => `<span>${fechaLarga(f.fecha)}<br>${f.etiqueta}</span>`).join('');
  let espera = null;
  deslizable.addEventListener('input', () => {
    indice = Number(deslizable.value);
    pintarFecha();
    marcarDegradacion(indice);
    clearTimeout(espera);
    espera = setTimeout(enviarATodos, 300);
  });
  const cont = $('caso-vista');
  for (const [valor, texto] of [['lineas', 'Streamlines'], ['animado', 'Animated']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(valor === vista));
    b.textContent = texto;
    b.addEventListener('click', () => {
      cont.querySelectorAll('button').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
      vista = valor;
      enviarATodos();
    });
    cont.append(b);
  }
  pintarFecha();
}

function degradadoTurbo() {
  const paradas = [];
  for (let n = 0; n <= 10; n++) {
    const x = 0.1 + (0.9 * n) / 10;
    const c = [
      0.13572138 + x * (4.6153926 + x * (-42.66032258 + x * (132.13108234 + x * (-152.94239396 + x * 59.28637943)))),
      0.09140261 + x * (2.19418839 + x * (4.84296658 + x * (-14.18503333 + x * (4.27729857 + x * 2.82956604)))),
      0.1066733 + x * (12.64194608 + x * (-60.58204836 + x * (110.36276771 + x * (-89.90310912 + x * 27.34824973)))),
    ].map((v) => Math.round(255 * Math.min(Math.max(v, 0), 1)));
    paradas.push(`rgb(${c.join(',')}) ${n * 10}%`);
  }
  return `linear-gradient(90deg, ${paradas.join(', ')})`;
}
$('caso-barra-t').style.background = degradadoTurbo();

function cargarEnergia() {
  fetch(`datos/caso_energia.json?v=${VERSION}`, { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(`datos/caso_energia.json: HTTP ${r.status}`); return r.json(); })
    .then(pintarEnergia).catch(console.error);
}

function cargarVegetacion() {
  fetch(`datos/caso_vegetacion.json?v=${VERSION}`, { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(`datos/caso_vegetacion.json: HTTP ${r.status}`); return r.json(); })
    .then(pintarVegetacion).catch(console.error);
}

function cargarCostos() {
  Promise.all([
    fetch(`datos/caso_costos.json?v=${VERSION}`, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(`datos/caso_costos.json: HTTP ${r.status}`); return r.json(); }),
    composicion,
  ]).then(([d, pct]) => pintarCostos(d, document.querySelectorAll('.caso-costos[data-edificio]'), pct)).catch(console.error);
}

function cargarDegradacion() {
  Promise.all([
    fetch(`datos/caso_degradacion.json?v=${VERSION}`, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(`datos/caso_degradacion.json: HTTP ${r.status}`); return r.json(); }),
    composicion,
  ])
    .then(([d, pct]) => {
      pintarDegradacion(d, document.querySelectorAll('.caso-grafica-edificio:not(.caso-verde-grafica)'), pct, (i) => {
        const deslizable = $('caso-fecha');
        deslizable.value = String(i);
        deslizable.dispatchEvent(new Event('input'));
      });
      marcarDegradacion(indice);
    })
    .catch(console.error);
}

Promise.all([
  fetch(`datos/caso_fechas.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(`datos/caso_fechas.json: HTTP ${r.status}`);
    return r.json();
  }),
  fetch(`rom/caso/muestra.bin?v=${VERSION}`, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(`rom/caso/muestra.bin: HTTP ${r.status}`);
    return r.arrayBuffer();
  }),
]).then(([d, bin]) => {
  fechas = d.fechas;
  lineasCaso = d.lineas ?? {};
  muestra = new Uint8Array(bin);
  prepararControles();
  enviarATodos();
  cargarDegradacion();
  cargarCostos();
  cargarEnergia();
  cargarVegetacion();
}).catch((err) => {
  console.error(err);
  for (const p of Object.values(avisos)) { p.hidden = false; p.textContent = `The conditions could not be loaded: ${err.message ?? err}`; }
});

const pendientes = [...document.querySelectorAll('.pred-caso iframe[data-src]')];
const cargarSiguiente = () => {
  const marco = pendientes.shift();
  if (marco && !marco.getAttribute('src')) marco.setAttribute('src', marco.dataset.src);
};
addEventListener('message', (ev) => {
  if (ev.origin === location.origin && ev.data?.tipo === 'climatec-rom-lineas-listas') cargarSiguiente();
});
setTimeout(() => { while (pendientes.length) cargarSiguiente(); }, 60000);
cargarSiguiente();
