import { figuraHumana } from './figura_humana.js?v=20261019y';

const VERSION = '20261031c';
const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);

const TRAMOS = [[20, '#ffd11a'], [40, '#ff901a'], [60, '#e8432a'], [80, '#c71585']];
const colorProb = (p) => TRAMOS.reduce((c, [l, col]) => (p >= l ? col : c), '#ffd11a');
const COLOR_NIVEL = ['#22c363', '#ffd11a', '#ff901a', '#e8432a', '#c71585'];
const T_ALTA = [28, 30, 33, 36];
const nivelT = (t) => 1 + (t >= T_ALTA[0]) + (t > T_ALTA[1]) + (t > T_ALTA[2]) + (t > T_ALTA[3]);

const NOMBRE_HTML = { PM10: 'PM<sub>10</sub>', PM25: 'PM<sub>2.5</sub>', O3: 'O<sub>3</sub>', NO2: 'NO<sub>2</sub>', SO2: 'SO<sub>2</sub>', CO: 'CO' };
const CALIDAD = ['Good', 'Acceptable', 'Poor', 'Very Poor', 'Extremely Poor'];
const RIESGO = ['Low', 'Moderate', 'High', 'Very High', 'Extremely High'];

const ORGANOS = {
  cerebro: { d: ['M41.6,18.4C41,13 45,10.2 50,10.7C55,10.2 59,13 58.4,18.4C58.8,22 55.4,23.4 50,23.1C44.6,23.4 41.2,22 41.6,18.4Z',
    'M50,11.2V22.6', 'M44.2,14.6q2.2,1.6 0,3.4', 'M55.8,14.6q-2.2,1.6 0,3.4'], puntos: [[45, 16.5], [55, 16.5], [50, 13], [47, 20.5], [53, 20.5]] },
  ojos: { d: ['M42.6,25.4Q45.2,23.6 47.8,25.4Q45.2,27.2 42.6,25.4Z', 'M52.2,25.4Q54.8,23.6 57.4,25.4Q54.8,27.2 52.2,25.4Z'],
    puntos: [[45.2, 25.4], [54.8, 25.4]], lados: true },
  nariz: { d: ['M50,25.8L48.3,30.4Q50,31.4 51.7,30.4Z'], puntos: [[50, 29.4], [50.6, 28.4]] },
  garganta: { d: ['M48,34.2h4v11.6q0,1.4 -2,1.4q-2,0 -2,-1.4Z', 'M48.4,38h3.2', 'M48.4,41.6h3.2'], puntos: [[50, 39.5], [50, 43.5]] },
  pulmones: { d: ['M47.4,54.6C41.4,53.4 36.8,60.4 36.7,70.2C36.6,78.4 38.4,84.4 43.4,84.8C46.8,85.1 47.8,80.4 47.8,74.2Z',
    'M52.6,54.6C58.6,53.4 63.2,60.4 63.3,70.2C63.4,78.4 61.6,84.4 56.6,84.8C53.2,85.1 52.2,80.4 52.2,74.2Z'],
    puntos: [[41.6, 69], [58.4, 69]], lados: true },
  corazon: { d: ['M54.6,77.2C50.2,74 48.8,70.9 49.8,68.7C50.8,66.5 53.5,66.4 54.6,68.9C55.7,66.4 58.4,66.5 59.4,68.7C60.4,70.9 59,74 54.6,77.2Z'],
    puntos: [[54.6, 71.4], [55.4, 73.6]] },
  estomago: { d: ['M50.4,88.4C53.4,85.4 60.4,86.2 61.2,90.8C62,95.4 58.2,98.8 53.6,97.9C50.2,97.2 48.6,94.6 50.8,93.2C52.8,92 50.8,90.2 50.4,88.4Z'],
    puntos: [[56, 92.4]] },
  rinones: { d: ['M42.2,96.4C39.6,96.4 38.7,99.4 38.9,101.9C39.1,104.9 40.9,106.9 43.1,106.4C44.7,106 44.3,103.4 43.5,102C44.5,100.4 44.7,96.6 42.2,96.4Z',
    'M57.8,96.4C60.4,96.4 61.3,99.4 61.1,101.9C60.9,104.9 59.1,106.9 56.9,106.4C55.3,106 55.7,103.4 56.5,102C55.5,100.4 55.3,96.6 57.8,96.4Z'],
    puntos: [[41.4, 101.5], [58.6, 101.5]], lados: true },
  musculos: { d: ['M36.6,144C33.6,152 33.8,170 37.8,176C40.6,180 44.8,179 46.4,174C48.2,166 47.8,150 45.8,144Z',
    'M63.4,144C66.4,152 66.2,170 62.2,176C59.4,180 55.2,179 53.6,174C51.8,166 52.2,150 54.2,144Z',
    'M24.6,72C22.4,78 22.8,90 25.2,95C26.8,98 29.4,97 29.8,93C30.4,86 29.4,76 28.4,71.6Z',
    'M75.4,72C77.6,78 77.2,90 74.8,95C73.2,98 70.6,97 70.2,93C69.6,86 70.6,76 71.6,71.6Z'],
    puntos: [[41.2, 160], [58.8, 160], [26.6, 84], [73.4, 84]], lados: true },
  piel: { piel: true, puntos: [[20.6, 118], [79.4, 118], [35, 120], [65, 120]], lados: true },
};
const ORGANO = {
  Headache: 'cerebro', Dizziness: 'cerebro', Irritability: 'cerebro', Fainting: 'cerebro', 'Heat stroke': 'cerebro',
  'Reduced concentration': 'cerebro', 'Eye irritation': 'ojos', 'Nasal irritation': 'nariz', 'Nasal congestion': 'nariz',
  Thirst: 'garganta', 'Throat irritation': 'garganta', Cough: 'garganta', 'Shortness of breath': 'pulmones',
  'Asthma exacerbation': 'pulmones', 'Cardiovascular stress': 'corazon', 'Chest pain': 'corazon', Nausea: 'estomago',
  Dehydration: 'rinones', 'Muscle cramps': 'musculos', Fatigue: 'musculos', 'Reduced physical performance': 'musculos',
  Fever: 'piel', 'Heat exhaustion': 'piel',
};

function el(tag, attrs, padre) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (padre) padre.appendChild(n);
  return n;
}

const W = 700, H = 480, ESC = 440 / 255, X0 = (W - 100 * ESC) / 2, Y0 = 14;
const aLienzo = ([x, y]) => [X0 + x * ESC, Y0 + y * ESC];
const BORDE_IZQ = X0 - 26, BORDE_DER = X0 + 100 * ESC + 26, PASO_ETIQUETA = 34;

function figura(activos, titulo) {
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'hr-figura', role: 'img', 'aria-label': titulo });
  const defs = el('defs', {}, svg);
  for (const [, col] of TRAMOS) {
    const m = el('marker', { id: `hr-flecha-${col.slice(1)}`, viewBox: '0 0 10 10', refX: 8.5, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0,1 L9,5 L0,9 Z', fill: col }, m);
  }
  const brillo = el('filter', { id: 'hr-brillo', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  el('feGaussianBlur', { stdDeviation: 1.1, result: 'b' }, brillo);
  const mezcla = el('feMerge', {}, brillo);
  el('feMergeNode', { in: 'b' }, mezcla); el('feMergeNode', { in: 'SourceGraphic' }, mezcla);

  const fig = figuraHumana('#d3dbe8');
  const contornos = [...fig.querySelectorAll('path')].filter((p) => p.getAttribute('fill') === '#d3dbe8').map((p) => p.getAttribute('d'));
  const gFig = el('g', { transform: `translate(${X0},${Y0}) scale(${ESC})` }, svg);
  for (const n of [...fig.childNodes]) if (n.nodeName !== 'title') gFig.appendChild(n);

  const porOrgano = {};
  for (const a of activos) (porOrgano[ORGANO[a.nombre]] ??= []).push(a);
  const g = el('g', { transform: `translate(${X0},${Y0}) scale(${ESC})` }, svg);
  for (const [clave, o] of Object.entries(ORGANOS)) {
    const lista = porOrgano[clave], col = lista ? colorProb(Math.max(...lista.map((a) => a.p))) : null;
    if (o.piel) {
      if (!col) continue;
      for (const d of contornos) {
        el('path', { d, fill: col, 'fill-opacity': 0.16, stroke: col, 'stroke-width': 1.6, 'stroke-opacity': 0.9, filter: 'url(#hr-brillo)', class: 'hr-piel' }, g);
      }
      continue;
    }
    const sub = el('g', { class: `hr-organo${col ? ' activo' : ''}` }, g);
    o.d.forEach((d, i) => {
      const relleno = i === 0 || clave === 'ojos' || clave === 'pulmones' || clave === 'rinones' || clave === 'musculos';
      el('path', col ? { d, fill: relleno ? col : 'none', 'fill-opacity': relleno ? 0.88 : 0, stroke: relleno ? '#2a3550' : '#fff',
        'stroke-opacity': relleno ? 0.45 : 0.75, 'stroke-width': relleno ? 0.45 : 0.6, filter: relleno ? 'url(#hr-brillo)' : '' }
        : { d, fill: relleno ? '#ffffff' : 'none', 'fill-opacity': relleno ? 0.4 : 0, stroke: '#8f9bb3', 'stroke-opacity': 0.5, 'stroke-width': 0.45 }, sub);
    });
  }

  const usados = {}, lados = { izq: [], der: [] };
  const ordenados = [...activos].sort((a, b) => ORGANOS[ORGANO[a.nombre]].puntos[0][1] - ORGANOS[ORGANO[b.nombre]].puntos[0][1]);
  for (const a of ordenados) {
    const o = ORGANOS[ORGANO[a.nombre]], n = (usados[ORGANO[a.nombre]] = (usados[ORGANO[a.nombre]] ?? -1) + 1);
    let lado = lados.izq.length <= lados.der.length ? 'izq' : 'der';
    let punto = o.puntos[n % o.puntos.length];
    if (o.lados) {
      const delLado = o.puntos.filter(([x]) => (lado === 'izq' ? x < 50 : x > 50));
      punto = delLado[Math.floor(n / 2) % delLado.length] ?? punto;
    } else if (ORGANO[a.nombre] === 'corazon' && lados.der.length <= lados.izq.length + 1) {
      lado = 'der';
    }
    lados[lado].push({ ...a, punto: aLienzo(punto) });
  }
  for (const [lado, lista] of Object.entries(lados)) {
    lista.sort((a, b) => a.punto[1] - b.punto[1]);
    let y = 18;
    for (const e of lista) { e.y = Math.max(e.punto[1], y); y = e.y + PASO_ETIQUETA; }
    let tope = H - 16;
    for (let i = lista.length - 1; i >= 0; i--) { lista[i].y = Math.min(lista[i].y, tope); tope = lista[i].y - PASO_ETIQUETA; }
    for (const e of lista) {
      const col = colorProb(e.p), izq = lado === 'izq', xb = izq ? BORDE_IZQ : BORDE_DER;
      el('line', { x1: xb, y1: e.y, x2: e.punto[0], y2: e.punto[1], class: 'hr-linea', stroke: col,
        'marker-end': `url(#hr-flecha-${col.slice(1)})` }, svg);
      el('circle', { cx: xb, cy: e.y, r: 4.2, fill: col, stroke: '#fff', 'stroke-width': 1.5 }, svg);
      const tx = izq ? xb - 9 : xb + 9, ancla = izq ? 'end' : 'start';
      el('text', { x: tx, y: e.y - 2, 'text-anchor': ancla, class: 'hr-nombre' }, svg).textContent = e.nombre;
      const t2 = el('text', { x: tx, y: e.y + 13, 'text-anchor': ancla, class: 'hr-prob' }, svg);
      el('tspan', { class: 'hr-prob-n', fill: col === '#ffd11a' ? '#a37f00' : col }, t2).textContent = `${e.p.toFixed(1)} %`;
      el('tspan', {}, t2).textContent = ' probability';
    }
  }
  return svg;
}

function acciones(tabla, q, umbral) {
  const lista = Object.entries(tabla).map(([n, v]) => [n, v[q]]).filter(([, p]) => p >= umbral).sort((a, b) => b[1] - a[1]);
  if (!lista.length) return '';
  return `<p class="hr-acciones-titulo">Recommended Actions</p><ul class="hr-acciones">${lista.map(([n, p]) =>
    `<li>${n}<b style="background:${colorProb(p)};color:${p >= 60 ? '#fff' : '#1d2433'}">${p.toFixed(1)} %</b></li>`).join('')}</ul>`;
}

function tarjeta(cont, { condicion, sintomas, tablaAcciones, q, umbrales, titulo, vacio }) {
  const activos = Object.entries(sintomas).map(([nombre, v]) => ({ nombre, p: v[q] })).filter((a) => a.p >= umbrales.sintoma);
  cont.innerHTML = `<div class="hr-condicion">${condicion}</div>`;
  if (!activos.length) {
    cont.insertAdjacentHTML('beforeend', `<p class="hr-sin-riesgo">${vacio}</p>`);
    return;
  }
  cont.appendChild(figura(activos, titulo));
  cont.insertAdjacentHTML('beforeend', acciones(tablaAcciones, q, umbrales.accion));
}

const chip = (texto, color) => {
  const claro = ['#e8432a', '#c71585'].includes(color);
  return `<span class="hr-chip" style="background:${color};color:${claro ? '#fff' : '#1d2433'}">${texto}</span>`;
};
const fmt = (x, d) => (Number.isFinite(x) ? x.toFixed(d) : '—');

const momento = { tablas: null, personas: null, aq: null, hh: null };
addEventListener('message', (ev) => {
  if (ev.origin !== location.origin || ev.data?.tipo !== 'climatec-hi') return;
  momento.personas = ev.data.personas;
  pintar().catch((err) => console.error('[riesgo humano]', err));
});
export function ponerAireSalud(aireSalud, hh) {
  momento.aq = aireSalud;
  momento.hh = hh;
  pintar().catch((err) => console.error('[riesgo humano]', err));
}

async function pintar() {
  momento.tablas ??= await fetch(`datos/riesgo_humano.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json());
  {
    const act = $('rom-gemelo')?.contentWindow?.climatec?.actores, hi = act?.hi;
    if (hi && Object.keys(hi).length) {
      momento.personas = (act.personas ?? []).filter((x) => hi[x.id]).map((x) => ({ id: x.id, nombre: x.nombre, contexto: x.contexto, ...hi[x.id] }));
    }
  }
  const { tablas, personas, aq, hh } = momento;
  const umbrales = { sintoma: tablas.umbral_sintoma, accion: tablas.umbral_accion };
  $('tr-riesgo-sub').innerHTML = `${hh ? `Last Record: ${hh}<br>` : ''}`
    + 'Symptoms and actions reported for the conditions at the moment in Distrito Tec.<br>'
    + 'HI: highest heat index of people included; AQ based on the Índice AIRE y SALUD.';
  $('tr-riesgo-leyenda').innerHTML = TRAMOS.map(([l, col], i) =>
    `<li><span class="hr-punto" style="background:${col}"></span>${i < TRAMOS.length - 1 ? `${l}–${TRAMOS[i + 1][0]} %` : `≥ ${l} %`}</li>`).join('');

  const p = (personas ?? []).filter((x) => Number.isFinite(x.HI)).sort((a, b) => b.HI - a.HI)[0];
  if (!p) {
    $('hr-calor').innerHTML = '<p class="hr-vacio">Waiting for the twin to project the heat index of its people…</p>';
  } else {
    const T = tablas.temperatura, qT = T.cortes.filter((c) => p.HI >= c).length;
    tarjeta($('hr-calor'), {
      condicion: `${chip(`HI ${fmt(p.HI, 1)} °C`, COLOR_NIVEL[nivelT(p.HI) - 1])}<span>Range <b>${T.rangos[qT]}</b></span>`,
      sintomas: T.sintomas, tablaAcciones: T.acciones, q: qT, umbrales,
      titulo: `Heat-related symptoms for a heat index of ${fmt(p.HI, 1)} °C`,
      vacio: 'No heat risk identified at this moment',
    });
  }

  const k = aq?.indice?.categoria ?? 0;
  if (!k) {
    $('hr-aire').innerHTML = `<p class="hr-vacio">${aq ? 'No pollutant records this hour.' : 'Waiting for the twin to project the latest records…'}</p>`;
    return;
  }
  const A = tablas.aire, qA = A.de_categoria[k];
  tarjeta($('hr-aire'), {
    condicion: `${chip(CALIDAD[k - 1], COLOR_NIVEL[k - 1])}<span><b>${RIESGO[k - 1]} Risk</b></span>`,
    sintomas: A.sintomas, tablaAcciones: A.acciones, q: qA, umbrales,
    titulo: `Air-quality-related symptoms for ${A.niveles[qA].toLowerCase()}`,
    vacio: 'No air quality risk identified at this moment',
  });
}

pintar().catch((err) => console.error('[riesgo humano]', err));
