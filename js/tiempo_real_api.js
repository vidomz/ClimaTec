import * as P from './pronostico.js?v=20261101a';

export const API_REGISTROS = null;
const VERSION = '20261101a';
let DZ = null;
const HORA = 3600000;
export const ESTACIONES = { i: 'SIMA I', iii: 'SIMA III', xii: 'SIMA XII' };
export const VARIABLES = ['T', 'HR', 'Patm', 'SR', 'Ws', 'Wd', 'PM10', 'PM25', 'O3', 'NO2', 'SO2', 'CO'];
export const CONTAMINANTES = ['PM10', 'PM25', 'O3', 'NO2', 'SO2', 'CO'];
const COMPONENTES = ['T', 'HR', 'Patm', 'SR', 'Ws', 'U', 'V', 'PM10', 'PM25', 'O3', 'NO2', 'SO2', 'CO'];
const PHI = { T: 0.92, HR: 0.9, Patm: 0.97, SR: 0.7, Ws: 0.75, U: 0.8, V: 0.8, PM10: 0.85, PM25: 0.9, O3: 0.85, NO2: 0.8, SO2: 0.8, CO: 0.88 };
const COMUN = { T: 0.8, HR: 0.75, Patm: 0.9, SR: 0.7, Ws: 0.6, U: 0.7, V: 0.7, PM10: 0.6, PM25: 0.6, O3: 0.7, NO2: 0.5, SO2: 0.4, CO: 0.5 };
const CRUCE = { HR: ['T', -0.5], PM25: ['PM10', 0.7] };
const EPS_MAX = 2.3;
const DECIMALES = { T: 2, HR: 0, Patm: 1, SR: 0, Ws: 1, Wd: 0, PM10: 0, PM25: 0, O3: 3, NO2: 3, SO2: 3, CO: 2 };

const dos = (n) => String(n).padStart(2, '0');
const redondo = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

function azar(texto) {
  let a = 0;
  for (const ch of texto) a = (Math.imul(a, 31) + ch.charCodeAt(0)) >>> 0;
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u());
}

export const ZONA = 'America/Monterrey';
const PARTES = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export function ahoraLocal(d = new Date()) {
  const p = Object.fromEntries(PARTES.formatToParts(d).map((x) => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: +p.hour % 24, minuto: +p.minute };
}

export function hastaElProximo(d = new Date()) {
  return (60 - d.getMinutes()) * 60000 - d.getSeconds() * 1000 - d.getMilliseconds() + 2000;
}

function generar(fecha, hora) {
  const t0 = P.ms(`${fecha}T01:00`) - 24 * HORA;
  const fin = P.ms(`${fecha}T${dos(hora)}:00`);
  const n = Math.round((fin - t0) / HORA) + 1;
  const normal = azar(`climatec-tiempo-real|${fecha}`);
  const ests = Object.keys(ESTACIONES);
  const comun = Object.fromEntries(COMPONENTES.map((c) => [c, normal()]));
  const propio = Object.fromEntries(ests.map((e) => [e, Object.fromEntries(COMPONENTES.map((c) => [c, normal()]))]));
  const filas = Object.fromEntries(ests.map((e) => [e, []]));
  for (let q = 0; q < n; q++) {
    const t = t0 + q * HORA;
    const inn = { comun: {}, propio: Object.fromEntries(ests.map((e) => [e, {}])) };
    for (const c of COMPONENTES) {
      const [otra, r] = CRUCE[c] ?? [null, 0];
      const mezcla = (a, b) => (otra ? r * a + Math.sqrt(1 - r * r) * b : b);
      inn.comun[c] = mezcla(inn.comun[otra], normal());
      for (const e of ests) inn.propio[e][c] = mezcla(inn.propio[e][otra], normal());
    }
    for (const c of COMPONENTES) {
      const f = Math.sqrt(1 - PHI[c] ** 2);
      if (q) comun[c] = PHI[c] * comun[c] + f * inn.comun[c];
      for (const e of ests) if (q) propio[e][c] = PHI[c] * propio[e][c] + f * inn.propio[e][c];
    }
    for (const e of ests) {
      const z = {}, y = {};
      for (const c of COMPONENTES) {
        const eps = Math.max(-EPS_MAX, Math.min(EPS_MAX, Math.sqrt(COMUN[c]) * comun[c] + Math.sqrt(1 - COMUN[c]) * propio[e][c]));
        const d = P.distribucion('i', c, t);
        z[c] = d.mu + (e === 'i' ? 0 : DZ.estaciones[e].dz[c]) + d.sigma * eps;
        y[c] = P.valor('i', c, z[c], t);
      }
      y.Wd = (((Math.atan2(-y.U, -y.V) * 180) / Math.PI) + 360) % 360;
      const td = Math.min(y.T - 0.5, 26), hrMax = 100 * Math.exp((17.62 * td) / (243.12 + td) - (17.62 * y.T) / (243.12 + y.T));
      y.HR = Math.max(5, Math.min(y.HR, hrMax));
      y.PM25 = Math.min(y.PM25, 0.95 * y.PM10);
      const fila = { t, etiqueta: P.iso(t) };
      for (const k of VARIABLES) fila[k] = redondo(y[k], DECIMALES[k]);
      filas[e].push(fila);
    }
  }
  return filas;
}

export async function registrosDelDia(d = new Date()) {
  const { fecha, hora } = ahoraLocal(d);
  if (API_REGISTROS) {
    const r = await fetch(`${API_REGISTROS}?fecha=${fecha}&hora=${hora}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`API: HTTP ${r.status}`);
    return r.json();
  }
  await P.cargar(VERSION);
  DZ ??= await fetch(`datos/api_desfases.json?v=${VERSION}`, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(`datos/api_desfases.json: HTTP ${r.status}`);
    return r.json();
  });
  const todas = generar(fecha, hora);
  const inicio = P.ms(`${fecha}T${hora ? '01' : '00'}:00`);
  const salida = { fecha, hora, unidades: { T: '°C', HR: '%', Patm: 'hPa', SR: 'W·m⁻²', Ws: 'km·h⁻¹', Wd: '°', PM10: 'µg·m⁻³', PM25: 'µg·m⁻³', O3: 'ppm', NO2: 'ppm', SO2: 'ppm', CO: 'ppm' },
    estaciones: {} };
  for (const [e, nombre] of Object.entries(ESTACIONES)) {
    const f = todas[e];
    const lugar = e === 'i' ? P.modelo().estaciones.i : DZ.estaciones[e];
    salida.estaciones[e] = { nombre, lat: lugar.lat, lon: lugar.lon,
      registros: f.filter((x) => x.t >= inicio), previas: f.filter((x) => x.t < P.ms(`${fecha}T${dos(hora)}:00`)).slice(-23) };
  }
  return salida;
}
