import { modeloVegetacion } from './vegetacion_rom.js?v=20261022n';

const RUTA = 'rom/';
const VERSION = '20261029c';
const $ = (id) => document.getElementById(id);
const estacionVisible = (s) => String(s ?? '').replaceAll('SIMA', 'Station');

const NIVELES = ['Acceptable', 'Low', 'Moderate', 'High', 'Extreme'];
const T_ALTA = [28, 30, 33, 36];
const T_BAJA = [6, 4, 1, -2];
const VIENTO = [50, 60, 70, 80];

const nivelAlta = (x, l) => 1 + (x >= l[0]) + (x > l[1]) + (x > l[2]) + (x > l[3]);
const nivelBaja = (x, l) => 1 + (x <= l[0]) + (x < l[1]) + (x < l[2]) + (x < l[3]);
const nivelViento = (x, l) => 1 + (x >= l[0]) + (x >= l[1]) + (x >= l[2]) + (x >= l[3]);

const presionSaturacion = (t) => 6.112 * Math.exp((17.62 * t) / (243.12 + t));

const VARIABLES = {
  U: { nombre: 'Wind Speed', simbolo: 'W<sub>s</sub>', unidad: 'km·h⁻¹', decimales: 1 },
  T: { nombre: 'Air Temperature', simbolo: 'T<sub>air</sub>', unidad: '°C', decimales: 1 },
  AQ: { nombre: 'Pollutants', simbolo: 'Pollutants', unidad: '', decimales: 0 },
};

let aireSalud = null;
const FONDO_REGIONAL = 0.5;

const COLOR_CONTAMINANTE = { PM10: '#ff901a', PM25: '#e8432a', O3: '#4980fb', NO2: '#c71585', SO2: '#ffd11a', CO: '#22c363' };
const NOMBRE_HTML = { PM10: 'PM<sub>10</sub>', PM25: 'PM<sub>2.5</sub>', O3: 'O<sub>3</sub>', NO2: 'NO<sub>2</sub>', SO2: 'SO<sub>2</sub>', CO: 'CO' };
const VENTANA_CORTA = { PM10: '12-h weighted', PM25: '12-h weighted', O3: '1-h', NO2: '1-h', SO2: '1-h', CO: '8-h' };
const UNIDAD_HTML = { 'µg·m⁻³': 'µg·m⁻³', ppm: 'ppm' };

function categoriaAQ(v, x) {
  const l = aireSalud.norma.limites[v];
  return x <= l[0] ? 1 : x <= l[1] ? 2 : x <= l[2] ? 3 : x <= l[3] ? 4 : 5;
}

const YLORRD = ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'];
const aqDeHora = (hora) => hora.aire_salud ?? null;
const fmt = (x, d = 1) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const nb = (x, unidad) => `${x} ${unidad}`;

function rangos(variable, frio) {
  if (variable === 'T' && frio) return ['> 6 °C', '4–6 °C', '1–4 °C', '−2–1 °C', '< −2 °C'];
  if (variable === 'T') return ['< 28 °C', '28–30 °C', '30–33 °C', '33–36 °C', '> 36 °C'];
  return ['< 50', '50–59', '60–69', '70–79', '≥ 80'].map((r) => nb(r, 'km·h⁻¹'));
}

function evaluarPunto(t, uMs, salida, p) {
  const uKmh = uMs * 3.6;
  salida.T.v[p] = t;
  salida.T.n[p] = Math.max(nivelAlta(t, T_ALTA), nivelBaja(t, T_BAJA));
  salida.U.v[p] = uKmh;
  salida.U.n[p] = nivelViento(uKmh, VIENTO);
}

const nuevaSalida = (n) => Object.fromEntries(Object.keys(VARIABLES).map((k) => [k, { v: new Float32Array(n), n: new Uint8Array(n) }]));

let rom = null;
let bloques = {};
let validos = null;
let poligono = null;

async function leerModelo(archivo) {
  const [json, bin] = await Promise.all([
    fetch(`${RUTA}${archivo}.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json()),
    fetch(`${RUTA}${archivo}_datos.bin?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.arrayBuffer()),
  ]);
  const bl = {};
  for (const [nombre, b] of Object.entries(json.bloques)) {
    const crudo = b.tipo === 'int16' ? new Int16Array(bin, b.offset, b.n)
      : b.tipo === 'uint8' ? new Uint8Array(bin, b.offset, b.n) : new Float32Array(bin, b.offset, b.n);
    if (b.tipo === 'uint8' && b.escala === undefined) { bl[nombre] = crudo; continue; }
    const v = new Float32Array(b.n);
    for (let q = 0; q < b.n; q++) v[q] = crudo[q] * b.escala + (b.cero ?? 0);
    bl[nombre] = v;
  }
  return { rom: json, bloques: bl };
}

async function cargarModelo() {
  ({ rom, bloques } = await leerModelo('rom_final'));
  const { nx, ny } = rom.rejilla;
  const mapa = bloques.valido;
  validos = new Uint32Array(rom.rejilla.validos);
  let n = 0;
  for (let q = 0; q < mapa.length; q++) if (mapa[q]) validos[n++] = q;

  const afuera = new Uint8Array(nx * ny);
  const pila = [];
  for (let i = 0; i < nx; i++) for (const j of [0, ny - 1]) pila.push(j * nx + i);
  for (let j = 0; j < ny; j++) for (const i of [0, nx - 1]) pila.push(j * nx + i);
  while (pila.length) {
    const q = pila.pop();
    if (afuera[q] || mapa[q]) continue;
    afuera[q] = 1;
    const i = q % nx;
    if (i > 0) pila.push(q - 1);
    if (i < nx - 1) pila.push(q + 1);
    if (q >= nx) pila.push(q - nx);
    if (q < nx * (ny - 1)) pila.push(q + nx);
  }
  poligono = new Uint8Array(nx * ny);
  for (let q = 0; q < nx * ny; q++) poligono[q] = afuera[q] ? 0 : 1;
}

function matern(x, X, l, c) {
  const k = new Float64Array(X.length);
  for (let n = 0; n < X.length; n++) {
    let d2 = 0;
    for (let q = 0; q < x.length; q++) { const t = (x[q] - X[n][q]) / l[q]; d2 += t * t; }
    const d = Math.sqrt(5 * d2);
    k[n] = c * (1 + d + (d * d) / 3) * Math.exp(-d);
  }
  return k;
}

function coeficientes(r, entradas) {
  const x = r.entradas.map((e, q) => (entradas[e] - r.mu[q]) / r.sd[q]);
  return r.gpr.map((g) => {
    const k = matern(x, r.X, g.l, g.c);
    let s = 0;
    for (let n = 0; n < k.length; n++) s += k[n] * g.alfa[n];
    return g.ymu + g.ysd * s;
  });
}

const diccionarios = new Map();

function prepararDiccionario(d) {
  const xs = [...new Set(d.x)].sort((a, b) => a - b), ys = [...new Set(d.y)].sort((a, b) => a - b);
  const paso = xs[1] - xs[0];
  const nx = Math.round((xs.at(-1) - xs[0]) / paso) + 1;
  const indice = new Int32Array(nx * (Math.round((ys.at(-1) - ys[0]) / paso) + 1)).fill(-1);
  d.x.forEach((x, n) => { indice[Math.round((d.y[n] - ys[0]) / paso) * nx + Math.round((x - xs[0]) / paso)] = n; });
  const nv = validos.length;
  const vecinos = new Int32Array(4 * nv), pesos = new Float32Array(4 * nv);
  const { nx: nxR, E0, N0, celda } = rom.rejilla;
  for (let p = 0; p < nv; p++) {
    const q = validos[p], i = q % nxR, j = (q - i) / nxR;
    const fi = (E0 + celda * i - xs[0]) / paso, fj = (N0 + celda * j - ys[0]) / paso;
    const i0 = Math.floor(fi), j0 = Math.floor(fj), s = fi - i0, t = fj - j0;
    [[0, 0, (1 - s) * (1 - t)], [1, 0, s * (1 - t)], [0, 1, (1 - s) * t], [1, 1, s * t]].forEach(([di, dj, w], c) => {
      vecinos[4 * p + c] = indice[(j0 + dj) * nx + i0 + di];
      pesos[4 * p + c] = w;
    });
  }
  return { ...d, vecinos, pesos, n: d.x.length };
}

const rutaDiccionario = (corrida) => `${RUTA}tiempo_real/${corrida}/diccionario.json`;

async function diccionario(corrida) {
  if (!diccionarios.has(corrida)) {
    const d = await fetch(`${rutaDiccionario(corrida)}?v=${VERSION}`, { cache: 'no-cache' }).then((r) => r.json());
    diccionarios.set(corrida, prepararDiccionario(d));
  }
  return diccionarios.get(corrida);
}

function enPunto(dic, A, p) {
  let s = 0, w = 0;
  for (let c = 4 * p; c < 4 * p + 4; c++) {
    const n = dic.vecinos[c];
    if (n < 0 || dic.pesos[c] <= 0) continue;
    const v = A[n];
    if (v === null || !Number.isFinite(v)) continue;
    s += dic.pesos[c] * v;
    w += dic.pesos[c];
  }
  return w > 0 ? s / w : NaN;
}

function campoROMDiccionario(nombre, dic) {
  const r = rom.roms[nombre];
  const m = r.gpr.length;
  const A = new Float32Array(dic.n * m);
  for (let n = 0; n < dic.n; n++) {
    const ent = Object.fromEntries(r.entradas.map((e) => [e, dic.entradas[e][n]]));
    A.set(coeficientes(r, ent), n * m);
  }
  const nv = validos.length;
  const campo = Float32Array.from(bloques[r.media]);
  const modos = r.modos.map((b) => bloques[b]);
  const vector = campo.length === 2 * nv;
  const a = new Float32Array(m);
  for (let p = 0; p < nv; p++) {
    a.fill(0);
    let w = 0;
    for (let c = 4 * p; c < 4 * p + 4; c++) {
      const n = dic.vecinos[c], wc = dic.pesos[c];
      if (n < 0 || wc <= 0) continue;
      for (let q = 0; q < m; q++) a[q] += wc * A[n * m + q];
      w += wc;
    }
    for (let q = 0; q < m; q++) {
      const aq = a[q] / w;
      campo[p] += aq * modos[q][p];
      if (vector) campo[nv + p] += aq * modos[q][nv + p];
    }
  }
  return campo;
}

function fisicos(hora, fuente, dic, vegetacion = null) {
  const nv = validos.length;
  const salida = nuevaSalida(nv);
  const u = new Float32Array(nv), v = new Float32Array(nv);
  let efecto = null, F = null;
  if (fuente === 'ROM') {
    const dT = campoROMDiccionario('dT', dic), w = campoROMDiccionario('viento', dic);
    F = campoROMDiccionario('lnF', dic).map(Math.exp);

    const media = (A) => { const x = A.filter((a) => a !== null); return x.reduce((a, b) => a + b, 0) / x.length; };
    const corregir = vegetacion ? modeloVegetacion(vegetacion, { SR: media(dic.valores.SR), Patm: media(dic.valores.Patm) }) : null;
    const { nx, E0, N0, celda } = rom.rejilla;
    const o = [0, 0, 0];
    if (corregir) efecto = { n: 0, dT: 0, dTmin: 0, fU: 0, de: 0 };
    for (let p = 0; p < nv; p++) {
      const tLoc = enPunto(dic, dic.valores.T, p);
      let t = tLoc + dT[p];
      let e = (enPunto(dic, dic.valores.HR, p) / 100) * presionSaturacion(tLoc);
      const ws = enPunto(dic, dic.entradas.Ws, p);
      u[p] = ws * w[p];
      v[p] = ws * w[nv + p];
      let U = Math.hypot(u[p], v[p]);
      if (corregir) {
        const q = validos[p], i = q % nx, j = (q - i) / nx;
        o[0] = U; o[1] = t; o[2] = e;
        if (corregir(E0 + celda * i, N0 + celda * j, 1.5, u[p] / (U || 1), v[p] / (U || 1), o)) {
          const f = U > 0 ? o[0] / U : 1;
          u[p] *= f; v[p] *= f;
          efecto.n++; efecto.dT += o[1] - t; efecto.dTmin = Math.min(efecto.dTmin, o[1] - t); efecto.fU += f; efecto.de += o[2] - e;
          U = o[0]; t = o[1]; e = o[2];
        }
      }
      evaluarPunto(t, U, salida, p);
    }
  }
  return { ...salida, u, v, efecto, F };
}

const estado = { hora: null, variable: 'U', fuente: 'ROM', vista: 'lineas', vegetacion: true };
const cache = new Map();
let gemeloListo = false;
const gemelo = $('rom-gemelo');

const mapaVegetacion = () => gemelo.contentWindow?.climatec?.rom?.vegetacion ?? null;

async function campos(hora, fuente, conVegetacion = false) {
  const veg = conVegetacion && fuente === 'ROM' ? mapaVegetacion() : null;
  const clave = `${hora.corrida}|${fuente}|${veg ? 'veg' : ''}`;
  if (!cache.has(clave)) {
    const dic = await diccionario(hora.corrida);
    cache.set(clave, fisicos(hora, fuente, dic, veg));
  }
  return cache.get(clave);
}

function filtros(contenedor, opciones, actual, alElegir) {
  contenedor.replaceChildren();
  for (const [valor, texto] of opciones) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(valor === actual));
    b.innerHTML = texto;
    b.addEventListener('click', () => {
      contenedor.querySelectorAll('button').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
      alElegir(valor);
    });
    contenedor.append(b);
  }
}

function pintarVariables() {
  filtros($('rom-variables'), Object.entries(VARIABLES).map(([k, v]) => [k, v.nombre]), estado.variable, (v) => { estado.variable = v; actualizar(); });
}

const fecha = (iso) => {
  const d = new Date(iso);
  const mes = d.toLocaleString('en-US', { month: 'short' });
  return `${d.getDate()} ${mes} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

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

let envio = 0;
async function actualizar() {
  const hora = estado.hora;
  if (!hora) return;
  const v = estado.variable;
  const yo = ++envio;
  const c = await campos(hora, estado.fuente, estado.vegetacion);
  if (yo !== envio) return;

  const aq = v === 'AQ';
  $('rom-aq-bloque').hidden = !aq;
  $('rom-escala-bloque').hidden = aq;

  $('rom-barra').style.background = aq ? `linear-gradient(90deg, ${YLORRD.join(', ')})` : degradadoTurbo();
  $('rom-vista-titulo').hidden = $('rom-vista').hidden = aq;
  if (gemeloListo) {
    $('rom-cargando').hidden = false;
    $('rom-cargando').textContent = 'Loading…';
    const mensaje = { tipo: 'climatec-rom-estado', vista: estado.vista, corrida: hora.corrida, fuente: estado.fuente,
      variable: v, poligono, vegetacion: estado.vegetacion, sinMapaF: true };
    if (aq) {

      const Fr = new Float32Array(rom.rejilla.nx * rom.rejilla.ny).fill(NaN);
      validos.forEach((q, p) => { Fr[q] = c.F[p]; });
      const a = aqDeHora(hora);
      Object.assign(mensaje, { F: Fr, aq: { base: a?.base ?? {}, colores: COLOR_CONTAMINANTE,
        bueno: Object.fromEntries(Object.entries(aireSalud.norma.limites).map(([k, l]) => [k, l[0]])), fondo: FONDO_REGIONAL } });
    }
    gemelo.contentWindow.postMessage(mensaje, location.origin);
  }
  if (aq) {
    $('rom-escala-titulo').textContent = 'Accumulation Factor at 1.5 m (Map on the Twin)';
    $('rom-escala-min').textContent = '0 · ventilated';
    $('rom-escala-max').textContent = '≥ 2.25 · accumulates';
    pintarAQ(hora, c);
    return;
  }

  $('rom-escala-titulo').innerHTML = `${VARIABLES[v].simbolo} Along the Streamlines`;

  const enteros = c[v].n;
  const conteo = [0, 0, 0, 0, 0];
  for (let p = 0; p < enteros.length; p++) conteo[enteros[p] - 1]++;
  const frio = v === 'T' && c[v].n.some((n, p) => n > 1 && c[v].v[p] <= 6);
  const r = rangos(v, frio);
  $('rom-leyenda-titulo').innerHTML = `${VARIABLES[v].simbolo} Risk Levels at Pedestrian Level${frio ? ' (Cold)' : ''}`;
  $('rom-leyenda').innerHTML = NIVELES.map((n, q) => `
    <li><span class="color" style="background:var(--nivel-${q + 1})"></span>
      <span>${n} <span class="rango">${r[q]}</span></span>
      <span class="area">${fmt((100 * conteo[q]) / enteros.length, 0)} %</span></li>`).join('');
}

function pintarAQ(hora, c) {
  const N = aireSalud.norma, a = aqDeHora(hora);
  const chip = (k, texto) => `<span class="rom-aq-chip${k >= 4 ? ' claro' : ''}" style="background:var(--nivel-${k})">${texto}</span>`;
  const base = a?.base ?? {};
  const hay = N.contaminantes.filter((x) => Number.isFinite(base[x]));
  if (!hay.length) {
    $('rom-aq-indice').innerHTML = 'No pollutant records at the station this hour.';
    $('rom-aq-tabla').innerHTML = '';
  } else {
    const k = a.indice.categoria;
    $('rom-aq-indice').innerHTML = `${chip(k, N.calidad[k - 1])}<span>${N.riesgo[k - 1]} risk · ${a.indice.contaminantes.map((x) => NOMBRE_HTML[x]).join(', ')}</span>`;
    $('rom-aq-tabla').innerHTML = N.contaminantes.map((x) => {
      const val = base[x], cat = a.categorias[x];
      const valor = Number.isFinite(val) ? `${fmt(val, N.decimales[x])} ${UNIDAD_HTML[N.unidades[x]]}` : '—';
      return `<tr><td><span class="rom-aq-punto" style="background:${COLOR_CONTAMINANTE[x]}"></span>${NOMBRE_HTML[x]} <b>${valor}</b></td>`
        + `<td>${VENTANA_CORTA[x]}</td><td>${cat ? `<span class="rom-aq-nivel" style="background:var(--nivel-${cat})" `
          + `title="${N.calidad[cat - 1]}" aria-label="${N.calidad[cat - 1]}"></span>` : '—'}</td></tr>`;
    }).join('');
  }

  $('rom-aq-nota').innerHTML = (a?.notas ?? []).join(' ');

  const conteo = [0, 0, 0, 0, 0], f = FONDO_REGIONAL;
  for (let p = 0; p < validos.length && hay.length; p++) {
    let peor = 1;
    for (const x of hay) peor = Math.max(peor, categoriaAQ(x, x === 'O3' ? base[x] : base[x] * (f + (1 - f) * c.F[p])));
    conteo[peor - 1]++;
  }
  $('rom-leyenda-titulo').textContent = 'Índice Aire y Salud at Pedestrian Level';
  $('rom-leyenda').innerHTML = N.calidad.map((n, q) => `
    <li><span class="color" style="background:var(--nivel-${q + 1})"></span>
      <span>${n} <span class="rango">${N.riesgo[q]} risk</span></span>
      <span class="area">${hay.length ? `${fmt((100 * conteo[q]) / validos.length, 0)} %` : '—'}</span></li>`).join('');
}

const ESTATICO = 'rom/estatico/';
const VERSION_CAPA = '20261030b';
const respuestas = new Map();
const claveEstatica = (ruta, fecha, hora) => `${ruta}/${fecha}T${String(hora).padStart(2, '0')}`;

function respuestaEstatica(ruta, fecha, hora) {
  const clave = claveEstatica(ruta, fecha, hora);
  if (!respuestas.has(clave)) {
    respuestas.set(clave, fetch(`${ESTATICO}${clave}.json?v=${VERSION}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }));
  }
  return respuestas.get(clave);
}

export function precargar(ruta, fecha, hora) {
  const p = respuestaEstatica(ruta, fecha, hora);
  p.then((j) => {
    const carpeta = `${RUTA}tiempo_real/${j.id}/`;
    const traer = (url) => fetch(url, { cache: 'no-cache' }).then((r) => r.arrayBuffer()).catch(() => {});
    traer(`${carpeta}diccionario.json?v=${VERSION}`);
    for (const a of ['indice.json', 'gemelo.bin.gz', 'acumulacion.bin.gz', 'campo3d_ROM.bin']) traer(`${carpeta}${a}?v=${VERSION_CAPA}`);
  }).catch(() => {});
  return p;
}

async function proyectar(datos) {
  const j = await precargar('tiempo-real', datos.fecha, datos.hora);
  return { ...j, reutilizada: true };
}

function agregarHora(sel, h) {
  let grupo = sel.querySelector('optgroup[data-tiemporeal]');
  if (!grupo) {
    grupo = document.createElement('optgroup');
    grupo.label = 'Real-time records';
    grupo.dataset.tiemporeal = '';
    sel.prepend(grupo);
  }
  grupo.querySelector(`option[value="${h.corrida}"]`)?.remove();
  grupo.prepend(new Option(`${fecha(h.fecha)} · ${estacionVisible(h.estacion)} (live)`, h.corrida));
}

export async function proyectarTiempoReal(datos) {
  await arrancar();
  const j = await proyectar(datos);
  const h = { corrida: j.id, fecha: j.fecha, estacion: j.estacion, est: j.est, x: j.x, z_L: j.z_L, sol: j.sol,
    purpleair: [], tiempoReal: true, aire_salud: j.aire_salud ?? null };
  horasProyectadas.set(h.corrida, h);
  agregarHora(selectorHoras, h);
  estado.hora = h;
  selectorHoras.value = h.corrida;
  $('rom-cargando').hidden = true;
  await actualizar();
  return j;
}

addEventListener('message', (ev) => {
  if (ev.origin !== location.origin) return;
  if (ev.data?.tipo === 'climatec-rom-listo') {
    if (gemeloListo) return;
    gemeloListo = true;
    if (rom && estado.hora) actualizar();
  } else if (ev.data?.tipo === 'climatec-rom-lineas-listas') {
    $('rom-cargando').hidden = !ev.data.error;
    if (ev.data.error) $('rom-cargando').textContent = `The streamlines could not be computed: ${ev.data.error}`;
    if (ev.data.rango) {
      const { unidad, decimales } = VARIABLES[estado.variable];
      $('rom-escala-min').textContent = `${fmt(ev.data.rango.min, decimales)} ${unidad}`;
      $('rom-escala-max').textContent = `${fmt(ev.data.rango.max, decimales)} ${unidad}`;
    }
  }
});

let horasProyectadas = new Map();
let selectorHoras = null;

async function iniciar() {
  [aireSalud] = await Promise.all([
    fetch(`${RUTA}aire_salud.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)),
    cargarModelo(),
  ]);
  gemelo.contentWindow?.postMessage({ tipo: 'climatec-rom-hola' }, location.origin);
  $('rom-barra').style.background = degradadoTurbo();
  const sel = $('rom-hora');
  selectorHoras = sel;
  sel.innerHTML = '';
  sel.addEventListener('change', () => { estado.hora = horasProyectadas.get(sel.value); actualizar(); });
  filtros($('rom-vista'), [['lineas', 'Streamlines'], ['animado', 'Animated']], estado.vista,
    (v) => { estado.vista = v; actualizar(); });
  pintarVariables();
  if (!estado.hora) {
    $('rom-cargando').hidden = false;
    $('rom-cargando').textContent = 'Loading…';
  }
}

let inicio = null;
const arrancar = () => (inicio ??= iniciar().catch((err) => {
  console.error('[rom]', err);
  $('rom-cargando').hidden = false;
  $('rom-cargando').textContent = `The ROM could not be loaded: ${err.message ?? err}`;
  throw err;
}));
arrancar().catch(() => {});
