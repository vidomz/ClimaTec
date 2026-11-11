const NS = 'http://www.w3.org/2000/svg';
const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COLOR_CARA = { N: '#2a78d6', E: '#eb6834', S: '#1baf7a', W: '#eda100' };
const NOMBRE_CARA = { N: 'North', E: 'East', S: 'South', W: 'West' };
const ORDEN = ['Concrete', 'Metal', 'Glass', 'Paint'];
const TINTA = '#1d2433';
const ALTO = 230, MARGEN = { t: 10, r: 37, b: 22, l: 37 };
const fmt = (x, d) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

function svg(tag, attrs, padre) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  padre?.append(e);
  return e;
}

function escala(max) {
  const paso0 = max / 4, p = 10 ** Math.floor(Math.log10(paso0)), r = paso0 / p;
  const paso = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 3 ? 3 : r <= 4 ? 4 : r <= 5 ? 5 : 10) * p;
  const tope = Math.ceil(max / paso - 1e-9) * paso;
  return { tope, marcas: Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso) };
}
const decimalesEje = (marcas) => (marcas.some((m) => Math.abs(m - Math.round(m)) > 1e-9) ? 1 : 0);

const fechaLarga = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
};

const fechaEje = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d}/${MESES[m - 1]}/${a}`;
};

const graficas = [];
let seleccion = 0, datos = null, alElegir = null;

const tip = document.createElement('div');
tip.className = 'caso-tip';
tip.hidden = true;
document.body.append(tip);

function mostrarTip(t, i, ev) {
  const { m, serie } = t, v = (x) => `${fmt(x, m.decimales)}${m.unidad ? `&nbsp;${m.unidad}` : ''}`;
  const filas = m.sin_caras ? '' : datos.caras.map((c) => `<li><i style="background:${COLOR_CARA[c]}"></i>${NOMBRE_CARA[c]}<b>${v(serie.caras[c][i])}</b></li>`).join('');
  tip.innerHTML = `<p>${fechaLarga(datos.fechas[i])} · ${datos.etiquetas[i]}</p><ul>${filas}`
    + `<li class="caso-tip-edificio"><i style="background:${TINTA}"></i>Building<b>${v(serie.edificio[i])}</b></li></ul>`;
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = `${Math.max(6, Math.min(ev.clientX + 14, innerWidth - w - 6))}px`;
  tip.style.top = `${Math.max(6, ev.clientY - h - 12 < 6 ? ev.clientY + 14 : ev.clientY - h - 12)}px`;
}

function dibujar(t) {
  const { caja, m, serie } = t, { tope, marcas } = t.escala;
  const W = caja.clientWidth;
  if (W < 40) return;
  caja.replaceChildren();
  const dias = datos.dias, x1 = dias.at(-1);
  const x = (d) => MARGEN.l + ((W - MARGEN.l - MARGEN.r) * d) / x1;
  const y = (v) => MARGEN.t + (ALTO - MARGEN.t - MARGEN.b) * (1 - v / tope);
  const s = svg('svg', { viewBox: `0 0 ${W} ${ALTO}`, width: W, height: ALTO, role: 'img',
    'aria-label': `${m.titulo} from Day 1: ${fmt(serie.edificio.at(-1), m.decimales)} ${m.unidad} after ${datos.fechas.length - 1} months` }, caja);
  const dEje = decimalesEje(marcas);
  const y0 = MARGEN.t, y1 = ALTO - MARGEN.b, menor = (marcas[1] - marcas[0]) / 5;
  for (let k = 1; k < (marcas.length - 1) * 5; k++) {
    if (k % 5) svg('line', { x1: MARGEN.l, x2: W - MARGEN.r, y1: y(k * menor), y2: y(k * menor), class: 'caso-rejilla-menor' }, s);
  }
  datos.fechas.forEach((f, i) => {
    if (i && i % 3 === 0) svg('line', { x1: x(dias[i]), x2: x(dias[i]), y1: y0, y2: y1, class: i % 12 ? 'caso-rejilla-menor' : 'linea-rejilla' }, s);
  });
  for (const v of marcas) {
    svg('line', { x1: MARGEN.l, x2: W - MARGEN.r, y1: y(v), y2: y(v), class: v ? 'linea-rejilla' : 'linea-eje' }, s);
    svg('text', { x: MARGEN.l - 6, y: y(v) + 3.5, 'text-anchor': 'end', class: 'eje-texto' }, s).textContent = fmt(v, dEje);
  }
  const cada = (W - MARGEN.l - MARGEN.r) / ((datos.fechas.length - 1) / 12) < 76 ? 24 : 12;
  datos.fechas.forEach((f, i) => {
    if (i % cada) return;
    svg('text', { x: x(dias[i]), y: ALTO - 6, 'text-anchor': 'middle', class: 'eje-texto' }, s).textContent = fechaEje(f);
  });
  if (m.umbral && m.umbral < tope) {
    svg('line', { x1: MARGEN.l, x2: W - MARGEN.r, y1: y(m.umbral), y2: y(m.umbral), class: 'caso-umbral' }, s);
    svg('text', { x: W - MARGEN.r, y: y(m.umbral) - 4, 'text-anchor': 'end', class: 'eje-texto' }, s).textContent = m.umbral_texto;
  }
  const ruta = (v) => v.map((q, i) => `${i ? 'L' : 'M'}${x(dias[i]).toFixed(1)},${y(q).toFixed(1)}`).join('');
  if (!m.sin_caras) for (const c of datos.caras) svg('path', { d: ruta(serie.caras[c]), class: 'caso-linea', stroke: COLOR_CARA[c] }, s);
  svg('path', { d: ruta(serie.edificio), class: 'caso-linea caso-linea-edificio', stroke: TINTA }, s);
  svg('text', { x: W - MARGEN.r, y: Math.max(y(serie.edificio.at(-1)) - 8, 11), 'text-anchor': 'end', class: 'caso-fin' }, s).textContent
    = `${fmt(serie.edificio.at(-1), m.decimales)}${m.unidad ? ` ${m.unidad}` : ''}`;
  const marca = svg('line', { y1: MARGEN.t, y2: ALTO - MARGEN.b, class: 'caso-marca' }, s);
  const punto = svg('circle', { r: 4, fill: TINTA, stroke: '#fff', 'stroke-width': 2 }, s);
  const cruz = svg('line', { y1: MARGEN.t, y2: ALTO - MARGEN.b, class: 'caso-cruz', visibility: 'hidden' }, s);
  t.poner = (i) => {
    marca.setAttribute('x1', x(dias[i])); marca.setAttribute('x2', x(dias[i]));
    punto.setAttribute('cx', x(dias[i])); punto.setAttribute('cy', y(serie.edificio[i]));
    t.dato.innerHTML = `${fmt(serie.edificio[i], m.decimales)}${m.unidad ? `<small>${m.unidad}</small>` : ''}`;
  };
  t.poner(seleccion);
  const registro = (ev) => {
    const r = s.getBoundingClientRect(), d = (((ev.clientX - r.left) * (W / r.width) - MARGEN.l) / (W - MARGEN.l - MARGEN.r)) * x1;
    let i = 0;
    dias.forEach((q, n) => { if (Math.abs(q - d) < Math.abs(dias[i] - d)) i = n; });
    return i;
  };
  s.addEventListener('pointermove', (ev) => {
    const i = registro(ev);
    cruz.setAttribute('x1', x(dias[i])); cruz.setAttribute('x2', x(dias[i]));
    cruz.setAttribute('visibility', 'visible');
    mostrarTip(t, i, ev);
  });
  s.addEventListener('pointerleave', () => { cruz.setAttribute('visibility', 'hidden'); tip.hidden = true; });
  s.addEventListener('click', (ev) => alElegir?.(registro(ev)));
}

function escalaDe(material) {
  const todos = Object.values(datos.edificios).flatMap((e) => (e[material] ? [...e[material].edificio, ...Object.values(e[material].caras).flat()] : []));
  return escala(Math.max(...todos));
}

function grafica(cont, cual, pct) {
  const e = datos.edificios[cual], lista = ORDEN.filter((k) => e[k]);
  cont.insertAdjacentHTML('beforeend', `<header class="caso-grafica-enc"><div><p class="rom-etiqueta">Building ${cual.toUpperCase()}</p>`
    + '<p class="caso-grafica-sub"></p></div><p class="caso-grafica-dato"></p>'
    + `<select class="rom-select caso-select" aria-label="Material of Building ${cual.toUpperCase()}">`
    + `${lista.map((k) => `<option value="${k}">${k} · ${pct[k]} %</option>`).join('')}</select></header><div class="caso-grafica-caja"></div>`);
  const t = { caja: cont.querySelector('.caso-grafica-caja'), dato: cont.querySelector('.caso-grafica-dato') };
  const elegir = (k) => {
    Object.assign(t, { m: datos.materiales[k], serie: e[k], escala: escalaDe(k) });
    cont.querySelector('.caso-grafica-sub').innerHTML = `${t.m.titulo}, ${t.m.simbolo}${t.m.unidad ? ` (${t.m.unidad})` : ''}`;
    dibujar(t);
  };
  cont.querySelector('select').addEventListener('change', (ev) => elegir(ev.target.value));
  elegir(lista[0]);
  graficas.push(t);
  new ResizeObserver(() => { if (t.caja.clientWidth !== Number(t.caja.firstElementChild?.getAttribute('width'))) dibujar(t); }).observe(t.caja);
}

export function pintar(d, contenedores, composicion, elegir) {
  datos = d;
  alElegir = elegir;
  for (const cont of contenedores) grafica(cont, cont.dataset.edificio, composicion[cont.dataset.edificio]);
}

export function marcar(i) {
  seleccion = i;
  for (const t of graficas) t.poner?.(i);
}
