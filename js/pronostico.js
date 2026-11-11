const DIA = 86400000;
const Z = { p05: -1.6448536269514722, p25: -0.6744897501960817, p50: 0, p75: 0.6744897501960817, p95: 1.6448536269514722 };
export const VARIABLES = ['T', 'HR', 'Patm', 'SR', 'Ws', 'Wd', 'PM10', 'PM25', 'O3', 'NO2', 'SO2', 'CO'];

let datos = null;
let C = null;

export function ms(iso) {
  const [d, t = '00:00'] = iso.split('T');
  const [y, m, dd] = d.split('-').map(Number);
  const [hh, mi] = t.split(':').map(Number);
  return Date.UTC(y, m - 1, dd, hh, mi);
}
export const iso = (t) => new Date(t).toISOString().slice(0, 16);

export async function cargar(version) {
  if (!datos) {
    datos = await fetch(`datos/pronostico.json?v=${version}`, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`datos/pronostico.json: HTTP ${r.status}`);
      return r.json();
    });
    const k = datos.constantes;
    C = { epoca: ms(k.epoca), tau0: ms(k.tau0), lunes: ms(k.lunes), anio: k.anio, kmax: k.k_max_sr,
      WA: (2 * Math.PI) / k.anio, WD: (2 * Math.PI) / 24, WW: (2 * Math.PI) / 7 };
  }
  return datos;
}

function tiempos(t) {
  const tc = t - 30 * 60000;
  const f = new Date(tc);
  return { d: (tc - C.epoca) / DIA, h: f.getUTCHours() + f.getUTCMinutes() / 60, tau: (tc - C.tau0) / DIA / C.anio,
    s: ((((tc - C.lunes) / DIA) % 7) + 7) % 7, dom: f.getUTCDay() === 0 ? 1 : 0 };
}

function factor(f, T) {
  switch (f[0]) {
    case 'tau': return T.tau;
    case 'dom': return T.dom;
    case 'a': { const x = f[1] * C.WA * T.d; return f[2] === 'c' ? Math.cos(x) : Math.sin(x); }
    case 'd': { const x = f[1] * C.WD * T.h; return f[2] === 'c' ? Math.cos(x) : Math.sin(x); }
    case 'w': { const x = f[1] * C.WW * T.s; return f[2] === 'c' ? Math.cos(x) : Math.sin(x); }
    default: throw new Error(`factor ${f[0]}`);
  }
}

function evaluar(terminos, T) {
  let z = 0;
  for (const [b, fs] of terminos) {
    let p = b;
    for (const f of fs) p *= factor(f, T);
    z += p;
  }
  return z;
}

function inversa(m, z) {
  switch (m.trans) {
    case 'identidad': return z;
    case 'claridad': return Math.min(Math.max(z, 0), C.kmax);
    case 'logit': return 100 / (1 + Math.exp(-z));
    case 'raiz': return Math.max(z, 0) ** 2;
    case 'log': return Math.max(Math.exp(z) - m.c, 0);
    default: throw new Error(`transformación ${m.trans}`);
  }
}

function cosZenit(t, lat, lon) {
  const u = new Date(t + 6 * 3600000);
  const dia = (Date.UTC(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()) - Date.UTC(u.getUTCFullYear(), 0, 1)) / DIA + 1;
  const hora = u.getUTCHours() + u.getUTCMinutes() / 60 + u.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (dia - 1 + (hora - 12) / 24);
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g)
    - 0.040849 * Math.sin(2 * g));
  const w = (((hora * 60 + eot + 4 * lon) / 4 - 180) * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  return Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(w);
}

export function cieloDespejado(t, lat, lon, sub = 12) {
  let ghi = 0;
  for (let i = 0; i < sub; i++) {
    const cz = cosZenit(t - (60 * (i + 0.5) / sub) * 60000, lat, lon);
    if (cz > 0) ghi += (1098 * cz * Math.exp(-0.057 / cz)) / sub;
  }
  return ghi;
}

function esperado(m, t, lat, lon) {
  const T = tiempos(t);
  const mu = evaluar(m.mu, T);
  const v = Math.exp(0.5 * evaluar(m.ln_s2, T)) * Math.sqrt(m.var_eps);
  const gh = datos.gauss_hermite;
  let media = 0;
  for (let i = 0; i < gh.x.length; i++) media += gh.w[i] * inversa(m, mu + Math.SQRT2 * v * gh.x[i]);
  media /= Math.sqrt(Math.PI);
  const r = { media };
  for (const [k, zq] of Object.entries(Z)) r[k] = inversa(m, mu + zq * v);
  if (m.trans === 'claridad') {
    const cs = cieloDespejado(t, lat, lon);
    for (const k of Object.keys(r)) r[k] *= cs;
  }
  return r;
}

export function distribucion(est, c, t) {
  const m = datos.estaciones[est].modelos[c], T = tiempos(t);
  return { mu: evaluar(m.mu, T), sigma: Math.exp(0.5 * evaluar(m.ln_s2, T)) * Math.sqrt(m.var_eps) };
}

export function valor(est, c, z, t) {
  const e = datos.estaciones[est], m = e.modelos[c];
  const y = inversa(m, z);
  return m.trans === 'claridad' ? y * cieloDespejado(t, e.lat, e.lon) : y;
}

export function predecir(est, instantes) {
  const e = datos.estaciones[est];
  const out = {};
  for (const [c, m] of Object.entries(e.modelos)) out[c] = instantes.map((t) => esperado(m, t, e.lat, e.lon));
  out.Wd = instantes.map((_, n) => {
    const u = out.U[n].media, w = out.V[n].media;
    return { media: (((Math.atan2(-u, -w) * 180) / Math.PI) + 360) % 360, intensidad: Math.hypot(u, w) };
  });
  return out;
}

export function revisar() {
  let peor = { dif: 0 };
  for (const [est, p] of Object.entries(datos.pruebas)) {
    const r = predecir(est, p.t.map((x) => ms(x.replace(' ', 'T'))));
    for (const c of Object.keys(datos.estaciones[est].modelos)) {
      for (const k of ['media', 'p05', 'p95']) {
        p[c][k].forEach((x, i) => {
          const y = r[c][i][k];
          const dif = Math.abs(y - x) / Math.max(Math.abs(x), 1e-6);
          if (dif > peor.dif) peor = { dif, est, c, k, i, python: x, js: y };
        });
      }
    }
  }
  return peor;
}

export const modelo = () => datos;
