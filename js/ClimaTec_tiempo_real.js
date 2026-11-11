import * as API from './tiempo_real_api.js?v=20261101a';
import { proyectarTiempoReal, precargar } from './ClimaTec_rom.js?v=20261111a';
import { ponerAireSalud } from './riesgo_humano.js?v=20261031c';

const $ = (id) => document.getElementById(id);
const dos = (n) => String(n).padStart(2, '0');
const fmt = (x, d) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const nb = (x, u) => (u === '°' ? `${x}°` : `${x} ${u}`);

const VAR = {
  T: ['T<sub>air</sub>', '°C', 1], HR: ['H<sub>R</sub>', '%', 0], Ws: ['W<sub>s</sub>', 'km·h⁻¹', 1], Wd: ['W<sub>d</sub>', '°', 0],
  SR: ['S<sub>R</sub>', 'W·m⁻²', 0], Patm: ['P<sub>atm</sub>', 'hPa', 1],
  PM10: ['PM<sub>10</sub>', 'µg·m⁻³', 0], PM25: ['PM<sub>2.5</sub>', 'µg·m⁻³', 0], O3: ['O<sub>3</sub>', 'ppm', 3],
  NO2: ['NO<sub>2</sub>', 'ppm', 3], SO2: ['SO<sub>2</sub>', 'ppm', 3], CO: ['CO', 'ppm', 2],
};
const METEO = ['T', 'HR', 'Ws', 'Wd', 'SR', 'Patm'];
const METEO_DIA = ['T', 'HR', 'Ws', 'SR'];
const COLOR_EST = { i: '#0039a6', iii: '#e27620', xii: '#1f9e89' };
const NOMBRE_EST = { i: 'Station I', iii: 'Station III', xii: 'Station XII' };

const NOMBRE_LARGO = { T: 'Air Temperature', HR: 'Relative Humidity', Ws: 'Wind Speed', SR: 'Solar Radiation',
  PM10: 'PM₁₀', PM25: 'PM₂.₅', O3: 'O₃', NO2: 'NO₂', SO2: 'SO₂', CO: 'CO' };

const BANDAS = {
  T: [[28, 30, 2], [30, 33, 3], [33, 36, 4], [36, 99, 5], [4, 6, 2], [1, 4, 3], [-2, 1, 4], [-99, -2, 5]],
  Ws: [[50, 60, 2], [60, 70, 3], [70, 80, 4], [80, 999, 5]],
};

const estado = { datos: null, est: 'i', proyectada: null, enCurso: null, varMeteo: 'T', varAire: 'PM10' };
const MUESTRA = new Date('2026-11-07T21:30:00Z');
const LOCAL = API.ahoraLocal(MUESTRA);
precargar('tiempo-real', LOCAL.fecha, LOCAL.hora);

function pintarEstaciones() {
  const cont = $('tr-estaciones');
  cont.replaceChildren();
  for (const [k, nombre] of Object.entries(NOMBRE_EST)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(k === estado.est));
    b.textContent = nombre;
    b.addEventListener('click', () => {
      estado.est = k;
      cont.querySelectorAll('button').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
      pintarBarra(false);
    });
    cont.append(b);
  }
}

function pintarBarra(nuevo) {
  const u = estado.datos.estaciones[estado.est].registros.at(-1);
  const valores = [...METEO, ...API.CONTAMINANTES].map((k) => {
    const [simb, unidad, d] = VAR[k];
    return `<span class="tr-v${nuevo ? ' llegando' : ''}">${simb} <b>${nb(fmt(u[k], d), unidad)}</b></span>`;
  }).join('');

  $('tr-valores').innerHTML = `<div class="tr-cinta"><span>${valores}</span><span aria-hidden="true">${valores}</span></div>`;
  const cinta = $('tr-valores').firstElementChild;
  cinta.style.animationDuration = `${Math.max(20, cinta.scrollWidth / 2 / 45)}s`;
}

async function proyectarUltimo() {
  const D = estado.datos, clave = `${D.fecha}T${D.hora}`;
  if (estado.proyectada === clave || estado.enCurso === clave) return;
  estado.enCurso = clave;
  const estaciones = {}, previas = {};
  for (const s of Object.values(D.estaciones)) {
    const u = s.registros.at(-1);
    estaciones[s.nombre] = Object.fromEntries(API.VARIABLES.map((k) => [k, u[k]]));
    previas[s.nombre] = Object.fromEntries(API.CONTAMINANTES.map((k) => [k, s.previas.map((x) => x[k])]));
  }
  const hh = D.estaciones.i.registros.at(-1).etiqueta.slice(11);
  const aviso = $('rom-cargando'), t0 = performance.now();
  const pintar = () => {
    aviso.hidden = false;
    aviso.textContent = `Loading… ${Math.round((performance.now() - t0) / 1000)} s`;
  };
  pintar();
  const reloj = setInterval(pintar, 1000);
  try {
    const j = await proyectarTiempoReal({ fecha: D.fecha, hora: D.hora, estaciones, previas });
    clearInterval(reloj);
    ponerAireSalud(j.aire_salud ?? null, hh);
    estado.proyectada = clave;
    $('tr-panel-sub').textContent = `Last Record: ${hh} · Stations I, III and XII`;
  } catch (err) {
    clearInterval(reloj);
    aviso.hidden = false;
    aviso.textContent = `The latest records could not be projected on the twin: ${err.message ?? err}`;
  } finally {
    estado.enCurso = null;
  }
}

let limitesAQ = null;
const bandas = (k) => BANDAS[k] ?? (limitesAQ?.[k] ? limitesAQ[k].map((l, q, L) => [l, L[q + 1] ?? l * 50, q + 2]) : []);

function grafica(k) {
  const [simb, unidad, d] = VAR[k], D = estado.datos;
  const W = 560, H = 230, m = { i: 40, d: 10, s: 10, b: 22 };
  const series = Object.entries(D.estaciones).map(([e, s]) => [e, s.registros.map((r) => [Number(r.etiqueta.slice(11, 13)) || (D.hora ? 24 : 0), r[k]])]);
  const vals = series.flatMap(([, s]) => s.map((p) => p[1])).filter(Number.isFinite);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.12 || Math.max(Math.abs(hi) * 0.1, 1);
  lo = k === 'SR' || API.CONTAMINANTES.includes(k) || k === 'Ws' ? Math.max(0, lo - pad) : lo - pad;
  hi += pad;
  const crudo = (hi - lo) / 3 || 1, p10 = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * p10).find((s) => s >= crudo);
  const y0 = Math.floor(lo / paso) * paso, y1 = Math.ceil(hi / paso) * paso;
  const X = (h) => m.i + (h / 24) * (W - m.i - m.d);
  const Y = (v) => m.s + (1 - (v - y0) / (y1 - y0)) * (H - m.s - m.b);
  const ticks = Array.from({ length: Math.round((y1 - y0) / paso) + 1 }, (_, n) => y0 + n * paso);
  const dy = (String(Number(paso.toPrecision(6))).split('.')[1] ?? '').length;
  const ahora = API.ahoraLocal(MUESTRA), xa = X(Math.min(24, ahora.hora + ahora.minuto / 60));

  const fondo = bandas(k).map(([a, b, nivel]) => {
    const ya = Y(Math.min(Math.max(a, y0), y1)), yb = Y(Math.min(Math.max(b, y0), y1));
    return Math.abs(ya - yb) < 0.5 ? '' : `<rect x="${m.i}" width="${W - m.i - m.d}" y="${Math.min(ya, yb)}" height="${Math.abs(ya - yb)}" style="fill:var(--nivel-${nivel});opacity:0.16"/>`;
  }).join('');
  const trazos = series.map(([e, s]) =>
    `<path class="serie" style="stroke:${COLOR_EST[e]}" d="${s.map(([h, v], q) => `${q ? 'L' : 'M'}${X(h).toFixed(1)},${Y(v).toFixed(1)}`).join('')}"/>`
    + (s.length ? `<circle cx="${X(s.at(-1)[0])}" cy="${Y(s.at(-1)[1])}" r="3.8" style="fill:${COLOR_EST[e]};stroke:#fff;stroke-width:1.4"/>` : '')).join('');
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${k} records today">
    ${fondo}
    ${ticks.map((v) => `<line class="rejilla" x1="${m.i}" x2="${W - m.d}" y1="${Y(v)}" y2="${Y(v)}"/>
      <text class="eje" x="${m.i - 4}" y="${Y(v) + 3}" text-anchor="end">${fmt(v, dy)}</text>`).join('')}
    ${[0, 6, 12, 18, 24].map((h) => `<text class="eje" x="${X(h)}" y="${H - 6}" text-anchor="middle">${dos(h)}</text>`).join('')}
    <line class="ahora" x1="${xa}" x2="${xa}" y1="${m.s}" y2="${H - m.b}"/>
    <text class="ahora-txt" x="${xa + 4}" y="${m.s + 9}">Now</text>
    ${trazos}
    <line class="cursor" x1="0" x2="0" y1="${m.s}" y2="${H - m.b}" hidden/>
    <rect class="zona" x="${m.i}" y="${m.s}" width="${W - m.i - m.d}" height="${H - m.s - m.b}"/>
  </svg>`;

  let resumen = '';
  const todos = series.flatMap(([e, s]) => s.map(([h, v]) => ({ e, h, v }))).filter((p) => Number.isFinite(p.v));
  if (todos.length) {
    const minimo = k === 'HR';
    const p = todos.reduce((a, b) => ((minimo ? b.v < a.v : b.v > a.v) ? b : a));
    resumen = `${minimo ? 'Min.' : 'Max.'} ${nb(fmt(p.v, d), unidad)} at ${dos(p.h)}:00 · ${NOMBRE_EST[p.e]}`;
  }
  const caja = document.createElement('figure');
  caja.className = 'tr-grafica';
  caja.innerHTML = `<figcaption><span><b>${simb}</b> <span>(${unidad})</span></span><small>${resumen}</small></figcaption>${svg}`;
  const zona = caja.querySelector('.zona'), cursor = caja.querySelector('.cursor'), tip = $('tr-tooltip');
  zona.addEventListener('pointermove', (ev) => {
    const r = zona.getBoundingClientRect();
    const h = Math.max(0, Math.min(24, Math.round(((ev.clientX - r.left) / r.width) * 24)));
    const filas = series.map(([e, s]) => [e, s.find((p) => p[0] === h)]).filter(([, p]) => p);
    if (!filas.length) { cursor.hidden = true; tip.hidden = true; return; }
    cursor.setAttribute('x1', X(h)); cursor.setAttribute('x2', X(h)); cursor.hidden = false;
    tip.innerHTML = `<b>${dos(h)}:00</b> · ${simb}<br>${filas.map(([e, p]) => `<span class="punto" style="background:${COLOR_EST[e]}"></span>${NOMBRE_EST[e]} <b>${nb(fmt(p[1], d), unidad)}</b>`).join('<br>')}`;
    tip.hidden = false;
    tip.style.left = `${Math.min(ev.clientX + 14, innerWidth - 200)}px`;
    tip.style.top = `${ev.clientY + 14}px`;
  });
  zona.addEventListener('pointerleave', () => { cursor.hidden = true; tip.hidden = true; });
  return caja;
}

function pintarDia() {
  const D = estado.datos, r = D.estaciones.i.registros, n = r.length, ultima = r.at(-1).etiqueta.slice(11);
  $('tr-dia-sub').textContent = `${n} hourly record${n === 1 ? '' : 's'} per station since 00:00. Last Record: ${ultima}`;
  $('tr-leyenda').innerHTML = Object.entries(NOMBRE_EST).map(([e, nombre]) =>
    `<li><span class="linea" style="background:${COLOR_EST[e]}"></span>${nombre}</li>`).join('');
  $('tr-meteo').replaceChildren(grafica(estado.varMeteo));
  $('tr-aire').replaceChildren(grafica(estado.varAire));
}

function prepararDesplegables() {
  for (const [id, lista, clave, cont] of [['tr-sel-meteo', METEO_DIA, 'varMeteo', 'tr-meteo'], ['tr-sel-aire', API.CONTAMINANTES, 'varAire', 'tr-aire']]) {
    const sel = $(id);
    sel.innerHTML = lista.map((k) => `<option value="${k}">${NOMBRE_LARGO[k]}</option>`).join('');
    sel.value = estado[clave];
    sel.addEventListener('change', () => { estado[clave] = sel.value; $(cont).replaceChildren(grafica(sel.value)); });
  }
}

async function refrescar() {
  const nuevos = await API.registrosDelDia(MUESTRA);
  const cambio = !estado.datos || nuevos.fecha !== estado.datos.fecha || nuevos.hora !== estado.datos.hora;
  const primera = !estado.datos;
  estado.datos = nuevos;
  if (!cambio) return;
  pintarBarra(!primera);
  pintarDia();
  proyectarUltimo();
}

async function iniciar() {
  pintarEstaciones();
  prepararDesplegables();
  limitesAQ = await fetch('rom/aire_salud.json?v=20261028a', { cache: 'no-cache' }).then((r) => r.json()).then((j) => j.norma.limites).catch(() => null);
  await refrescar();

  const semantica = $('tr-semantica');
  const enviarSemantica = () => {
    $('tr-cp-bloque').hidden = !semantica.checked;
    $('rom-gemelo').contentWindow?.postMessage({ tipo: 'climatec-semantica', activo: semantica.checked }, location.origin);
  };
  semantica.addEventListener('change', enviarSemantica);
  $('rom-gemelo').addEventListener('load', enviarSemantica);

  const ver = $('tr-ver-variable');
  const esAQ = () => $('rom-variables').querySelector('[aria-checked="true"]')?.textContent.trim() === 'Pollutants';
  const enviarVariable = () => {
    const aq = esAQ();
    ver.disabled = aq;
    $('tr-cp-barra').hidden = aq;
    document.querySelector('.tr-panel').classList.toggle('sin-variable', !ver.checked && !aq);
    $('rom-gemelo').contentWindow?.postMessage({ tipo: 'climatec-rom-ver-variable', visible: ver.checked }, location.origin);
  };
  ver.addEventListener('change', enviarVariable);

  const CORTES_T = { calor: ['28', '30', '33', '36'], frio: ['6', '4', '1', '−2'] };
  addEventListener('message', (ev) => {
    if (ev.origin !== location.origin || ev.data?.tipo !== 'climatec-suelo-niveles') return;
    const c = CORTES_T[ev.data.frio ? 'frio' : 'calor'];
    [...$('tr-ts-cortes').children].forEach((s, i) => { s.textContent = c[i]; });
  });
  $('rom-gemelo').addEventListener('load', enviarVariable);
  new MutationObserver(enviarVariable).observe($('rom-variables'), { subtree: true, attributes: true, attributeFilter: ['aria-checked'], childList: true });
  enviarVariable();
  $('tr-bajar').addEventListener('click', () => $('tr-riesgo').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  $('tr-subir').addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
}

const pestana = $('tr-pestana');
pestana.addEventListener('click', () => {
  const oculto = document.querySelector('.tr-gemelo').classList.toggle('panel-oculto');
  pestana.setAttribute('aria-expanded', String(!oculto));
  pestana.title = oculto ? 'Show panel' : 'Hide panel';
});

iniciar().catch((err) => {
  console.error('[tiempo real]', err);
  $('rom-cargando').hidden = false;
  $('rom-cargando').textContent = `The station records could not be received: ${err.message ?? err}`;
});
