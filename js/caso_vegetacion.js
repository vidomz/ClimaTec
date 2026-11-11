const NS = 'http://www.w3.org/2000/svg';
const SIN = '#1d2433', CON = '#1baf7a';
const ALTO = 230, MARGEN = { t: 10, r: 10, b: 22, l: 34 };
const NOMBRES = { Floor: 'Floor Around the Building', W: 'West Green Wall', S: 'South Green Wall' };
const fmt = (x, d = 1) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

function svg(tag, attrs, padre) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  padre?.append(e);
  return e;
}

const tip = document.createElement('div');
tip.className = 'caso-tip';
tip.hidden = true;
document.body.append(tip);

function dibujar(t, y0, y1) {
  const { caja, s: serie } = t, W = caja.clientWidth;
  if (W < 40) return;
  caja.replaceChildren();
  const x = (h) => MARGEN.l + ((W - MARGEN.l - MARGEN.r) * (h - 1)) / 23;
  const y = (v) => MARGEN.t + (ALTO - MARGEN.t - MARGEN.b) * (1 - (v - y0) / (y1 - y0));
  const s = svg('svg', { viewBox: `0 0 ${W} ${ALTO}`, width: W, height: ALTO, role: 'img',
    'aria-label': `Surface temperature over the day without and with vegetation: up to ${fmt(serie.max)} °C lower` }, caja);
  for (let v = y0 + 2; v < y1; v += 2) {
    if ((v - y0) % 10) svg('line', { x1: MARGEN.l, x2: W - MARGEN.r, y1: y(v), y2: y(v), class: 'caso-rejilla-menor' }, s);
  }
  for (let h = 2; h <= 24; h++) {
    svg('line', { x1: x(h), x2: x(h), y1: MARGEN.t, y2: ALTO - MARGEN.b, class: h % 6 ? 'caso-rejilla-menor' : 'linea-rejilla' }, s);
  }
  for (let v = y0; v <= y1 + 1e-6; v += 10) {
    svg('line', { x1: MARGEN.l, x2: W - MARGEN.r, y1: y(v), y2: y(v), class: v > y0 ? 'linea-rejilla' : 'linea-eje' }, s);
    svg('text', { x: MARGEN.l - 6, y: y(v) + 3.5, 'text-anchor': 'end', class: 'eje-texto' }, s).textContent = v;
  }
  for (const h of [1, 6, 12, 18, 24]) {
    svg('text', { x: x(h), y: ALTO - 6, 'text-anchor': h === 24 ? 'end' : 'middle', class: 'eje-texto' }, s).textContent = `${String(h).padStart(2, '0')}:00`;
  }
  const ruta = (v) => v.map((q, i) => `${i ? 'L' : 'M'}${x(i + 1).toFixed(1)},${y(q).toFixed(1)}`).join('');
  svg('path', { d: ruta(serie.sin), class: 'caso-linea caso-linea-edificio', stroke: SIN }, s);
  svg('path', { d: ruta(serie.con), class: 'caso-linea caso-linea-edificio', stroke: CON }, s);
  const cruz = svg('line', { y1: MARGEN.t, y2: ALTO - MARGEN.b, class: 'caso-cruz', visibility: 'hidden' }, s);
  s.addEventListener('pointermove', (ev) => {
    const r = s.getBoundingClientRect(), h = Math.min(Math.max(Math.round(1 + (((ev.clientX - r.left) * (W / r.width) - MARGEN.l) / (W - MARGEN.l - MARGEN.r)) * 23), 1), 24);
    cruz.setAttribute('x1', x(h)); cruz.setAttribute('x2', x(h)); cruz.setAttribute('visibility', 'visible');
    tip.innerHTML = `<p>${String(h).padStart(2, '0')}:00</p><ul><li><i style="background:${SIN}"></i>Without<b>${fmt(serie.sin[h - 1])}&nbsp;°C</b></li>`
      + `<li><i style="background:${CON}"></i>With<b>${fmt(serie.con[h - 1])}&nbsp;°C</b></li></ul>`;
    tip.hidden = false;
    const w = tip.offsetWidth, hh = tip.offsetHeight;
    tip.style.left = `${Math.max(6, Math.min(ev.clientX + 14, innerWidth - w - 6))}px`;
    tip.style.top = `${Math.max(6, ev.clientY - hh - 12)}px`;
  });
  s.addEventListener('pointerleave', () => { cruz.setAttribute('visibility', 'hidden'); tip.hidden = true; });
}

function grafica(cont, cual, e, y0, y1) {
  cont.innerHTML = `<header class="caso-grafica-enc"><div><p class="rom-etiqueta">Building ${cual.toUpperCase()}</p><p class="caso-grafica-sub"></p></div>`
    + '<p class="caso-grafica-dato"></p>'
    + `<select class="rom-select caso-select" aria-label="Surface of Building ${cual.toUpperCase()}">${Object.keys(NOMBRES).map((k) => `<option value="${k}">${NOMBRES[k]}</option>`).join('')}</select></header>`
    + '<div class="caso-grafica-caja"></div>';
  const t = { caja: cont.querySelector('.caso-grafica-caja') };
  const elegir = (k) => {
    t.s = e[k];
    cont.querySelector('.caso-grafica-sub').innerHTML = `T<sub>surface</sub> (°C), Largest Drop at ${String(t.s.hora_max).padStart(2, '0')}:00`;
    cont.querySelector('.caso-grafica-dato').innerHTML = `−${fmt(t.s.max)}<small>°C</small>`;
    dibujar(t, y0, y1);
  };
  cont.querySelector('select').addEventListener('change', (ev) => elegir(ev.target.value));
  elegir('Floor');
  new ResizeObserver(() => { if (t.caja.clientWidth !== Number(t.caja.firstElementChild?.getAttribute('width'))) dibujar(t, y0, y1); }).observe(t.caja);
}

export function pintar(d) {
  const todos = Object.values(d.edificios).flatMap((e) => Object.values(e).flatMap((s) => [...s.sin, ...s.con]));
  const y0 = Math.floor(Math.min(...todos) / 10) * 10, y1 = Math.ceil(Math.max(...todos) / 10) * 10;
  for (const cont of document.querySelectorAll('.caso-verde-grafica')) grafica(cont, cont.dataset.edificio, d.edificios[cont.dataset.edificio], y0, y1);
  for (const c of document.querySelectorAll('.caso-verde-tarjeta')) {
    const e = d.edificios[c.dataset.edificio];
    const filas = [['New Grass', `${fmt(d.pasto_m2, 0)} m²`], ['Green Wall', `${fmt(d.pared_m2, 0)} m²`], ['Floor, Largest Drop', `−${fmt(e.Floor.max)} °C`],
      ['West Wall, Largest Drop', `−${fmt(e.W.max)} °C`], ['South Wall, Largest Drop', `−${fmt(e.S.max)} °C`]];
    c.innerHTML = `<p class="caso-tarjeta-nombre">Building ${c.dataset.edificio.toUpperCase()}</p><ul>${filas.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('')}</ul>`;
  }
}
