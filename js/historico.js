import { figuraHumana } from "./figura_humana.js?v=20261019y";

const NS = "http://www.w3.org/2000/svg";
const TEC = { lat: 25.6516, lon: -100.2895 };
const ORDEN = ["PM10", "PM25", "O3", "NO2", "SO2", "CO", "Tmax", "Tmin", "Ws"];
const CONTAMINANTES = ["PM10", "PM25", "O3", "NO2", "SO2", "CO"];
const NOMBRE = { PM10: "PM₁₀", PM25: "PM₂.₅", O3: "O₃", NO2: "NO₂", SO2: "SO₂", CO: "CO",
                 Tmax: "Heat", Tmin: "Cold", Ws: "Wind" };
const DESCRIPCION = {
  PM10: "Coarse Particulate Matter", PM25: "Fine Particulate Matter", O3: "Ozone",
  NO2: "Nitrogen Dioxide", SO2: "Sulfur Dioxide", CO: "Carbon Monoxide",
  Tmax: "Daily Maximum Temperature", Tmin: "Daily Minimum Temperature", Ws: "Wind Speed",
};
const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CORTES_CALOR = [1, 5, 15, 40];
const ETIQUETA_CALOR = ["0 %", "≤ 1 %", "1–5 %", "5–15 %", "15–40 %", "> 40 %"];
const COBERTURA_MIN = 219;
const MAPA_ESTACIONES = "assets/mapa_estaciones.png?v=20261019b";

const estado = { datos: null, est: "i", var: "PM10", ancho: 0 };
const $ = (id) => document.getElementById(id);
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
let COLOR = {};
const NEGRO = "#000";

function svg(tag, attrs = {}, padre = null) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (padre) padre.appendChild(n);
  return n;
}

function html(tag, attrs = {}, texto = null, padre = null) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else n.setAttribute(k, v);
  }
  if (texto !== null) n.textContent = texto;
  if (padre) padre.appendChild(n);
  return n;
}

function fmt(v, dec = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (v < 0 ? "−" : "") + s;
}

const pct = (a, b) => (b ? (100 * a) / b : null);
const fmtPct = (p) => (p === null ? "–" : p > 0 && p < 1 ? "<\u00A01\u00A0%" : `${Math.round(p)}\u00A0%`);

function fecha(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
}

const diasAnio = (a) => ((a % 4 === 0 && a % 100 !== 0) || a % 400 === 0 ? 366 : 365);

function meta(v) { return estado.datos.variables[v]; }
function datosVar(v, est = estado.est) { return estado.datos.datos[est]?.[v] ?? null; }

function valorUnidad(v, valor) {
  const m = meta(v);
  return `${fmt(valor, m.decimales)} ${m.unidad}`;
}

function rangoNivel(v, k) {
  const m = meta(v);
  const [l1, l2, l3, l4] = m.limites.map((x) => fmt(x, x % 1 ? m.decimales : 0));
  if (m.sentido === "bajo") return [`> ${l1}`, `${l2} – ${l1}`, `${l3} – ${l2}`, `${l4} – ${l3}`, `< ${l4}`][k];
  if (m.sentido === "viento") return [`< ${l1}`, `${l1} – ${l2}`, `${l2} – ${l3}`, `${l3} – ${l4}`, `≥ ${l4}`][k];
  if (v === "Tmax") return [`< ${l1}`, `${l1} – ${l2}`, `${l2} – ${l3}`, `${l3} – ${l4}`, `> ${l4}`][k];
  return [`≤ ${l1}`, `${l1} – ${l2}`, `${l2} – ${l3}`, `${l3} – ${l4}`, `> ${l4}`][k];
}

function limiteTexto(v) {
  const m = meta(v);
  const l3 = fmt(m.limites[2], m.limites[2] % 1 ? m.decimales : 0);
  const signo = m.sentido === "bajo" ? "<" : m.sentido === "viento" ? "≥" : ">";
  return `${signo} ${l3} ${m.unidad}`;
}

function nivelCalor(p) {
  if (p === null) return -1;
  if (p === 0) return 0;
  let k = 1;
  for (const c of CORTES_CALOR) if (p > c) k++;
  return k;
}

function textoSobre(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32 ? "#1d2433" : "#ffffff";
}

function ticks(lo, hi, n = 5) {
  const paso0 = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((p) => p >= paso0) ?? 10 * mag;
  const t = [];
  for (let x = Math.ceil(lo / paso) * paso; x <= hi + 1e-9; x += paso) t.push(+x.toFixed(10));
  return t;
}

function rectSup(x, y, w, h, r = 4) {
  r = Math.max(0, Math.min(r, h, w / 2));
  return `M${x},${y + h}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h}Z`;
}

function etiquetaAnio(a, banda, i) {
  if (banda >= 34) return String(a);
  if (banda >= 20) return `’${String(a).slice(2)}`;
  return i % 2 === 0 ? `’${String(a).slice(2)}` : "";
}

function distanciaKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function rumbo(desde, hacia) {
  const rad = Math.PI / 180;
  const y = Math.sin((hacia.lon - desde.lon) * rad) * Math.cos(hacia.lat * rad);
  const x = Math.cos(desde.lat * rad) * Math.sin(hacia.lat * rad)
          - Math.sin(desde.lat * rad) * Math.cos(hacia.lat * rad) * Math.cos((hacia.lon - desde.lon) * rad);
  const ang = (Math.atan2(y, x) / rad + 360) % 360;
  return ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][Math.round(ang / 45) % 8];
}

const tt = $("tooltip");

function tooltip(evento, { titulo, filas = [], pie = null, fijo = false }) {
  tt.replaceChildren();
  tt.classList.toggle("tt-fijo", fijo);
  html("div", { class: "tt-titulo" }, titulo, tt);
  for (const f of filas) {
    const fila = html("div", { class: "tt-fila" + (f.activa ? " activa" : "") }, null, tt);
    const clave = html("span", { class: "tt-clave" }, null, fila);
    clave.style.background = f.color;
    html("span", { class: "tt-valor" }, f.valor, fila);
    html("span", { class: "tt-etiqueta" }, f.etiqueta, fila);
  }
  if (pie) html("div", { class: "tt-pie" }, pie, tt);
  tt.hidden = false;
  let x, y;
  if (evento && "clientX" in evento && evento.type !== "focus") {
    x = evento.clientX + 14;
    y = evento.clientY + 14;
  } else {
    const r = evento.target.getBoundingClientRect();
    x = r.right + 8;
    y = r.top;
  }
  const w = tt.offsetWidth, h = tt.offsetHeight;
  if (x + w > innerWidth - 8) x = Math.max(8, x - w - 28);
  if (y + h > innerHeight - 8) y = Math.max(8, innerHeight - h - 8);
  tt.style.left = `${x}px`;
  tt.style.top = `${y}px`;
}

function ocultarTooltip() { tt.hidden = true; }

function interactivo(nodo, contenido) {
  const mostrar = (e) => tooltip(e, contenido(e));
  nodo.addEventListener("pointerenter", mostrar);
  nodo.addEventListener("pointermove", mostrar);
  nodo.addEventListener("pointerleave", ocultarTooltip);
  nodo.addEventListener("focus", mostrar);
  nodo.addEventListener("blur", ocultarTooltip);
}

function barraNiveles(cont, nombres, umbrales, rangos) {
  cont.replaceChildren();
  const segs = html("div", { class: "hi-segmentos" }, null, cont);
  nombres.forEach((n, k) => {
    const sg = html("div", { class: "hi-segmento" }, null, segs);
    sg.style.background = COLOR.nivel[k];
    html("span", {}, n, sg);
  });
  const marcas = html("div", { class: "hi-marcas", "aria-hidden": "true" }, null, cont);
  umbrales.forEach((u, k) => {
    const m = html("span", {}, sinCorte(u), marcas);
    m.style.left = `${((k + 1) / nombres.length) * 100}%`;
  });
  const lista = html("ul", { class: "solo-lector" }, null, cont);
  rangos.forEach((r, k) => html("li", {}, `${nombres[k]}: ${r}`, lista));
}

function barraVertical(cont, nombres, umbrales, rangos) {
  cont.replaceChildren();
  const segs = html("div", { class: "barra-v-segmentos", "aria-hidden": "true" }, null, cont);
  nombres.forEach((n, k) => {
    const sg = html("div", { class: "barra-v-segmento", title: `${n}: ${rangos[k]}` }, null, segs);
    sg.style.background = COLOR.nivel[k];
  });
  const marcas = html("div", { class: "barra-v-marcas", "aria-hidden": "true" }, null, cont);
  umbrales.forEach((u, k) => {
    const m = html("span", {}, sinCorte(u), marcas);
    m.style.bottom = `${((k + 1) / nombres.length) * 100}%`;
  });
  const lista = html("ul", { class: "solo-lector" }, null, cont);
  rangos.forEach((r, k) => html("li", {}, `${nombres[k]}: ${r}`, lista));
}

function etiquetaEstacion(e) {
  return estado.datos.estaciones[e].nombre;
}

function sinCorte(texto) {
  return texto.replace(/(\d) (?=[µ°%kpW])/g, "$1\u00A0");
}

const dias = (n) => (n === 1 ? "day" : "days");

function delAnio(n, anio) {
  return `${Math.round((100 * n) / diasAnio(anio))} % of ${anio}`;
}

function destacados() {
  const D = estado.datos;
  const ests = Object.keys(D.estaciones);
  const lista = [];
  const elegibles = (r) => r.anios.map((a, i) => i).filter((i) => r.validos[i] >= COBERTURA_MIN);
  const anios = (v) => ests.flatMap((e) => {
    const r = D.datos[e][v];
    return r ? elegibles(r).map((i) => ({ e, r, i, anio: r.anios[i], n: r.excedidos[i], validos: r.validos[i],
      p: (100 * r.excedidos[i]) / r.validos[i] })) : [];
  });
  const mejor = (xs, clave, mayor = true) =>
    xs.reduce((a, b) => (a === null || (mayor ? clave(b) > clave(a) : clave(b) < clave(a)) ? b : a), null);
  const lim = (v) => `${meta(v).limites[2]} ${meta(v).unidad}`;

  for (const v of ["PM10", "PM25"]) {
    const w = mejor(anios(v), (x) => x.p);
    if (w && w.n > 0) {
      lista.push({ tema: NOMBRE[v], estacion: w.e, nivel: 4, cifra: String(w.anio), titulo: `Most Polluted Year for ${NOMBRE[v]}`,
        lineas: [`${fmt(w.n)} ${dias(w.n)} above ${lim(v)}`, `(${delAnio(w.n, w.anio)})`] });
    }
  }

  const calor = mejor(anios("Tmax"), (x) => x.p);
  if (calor && calor.n > 0) {
    lista.push({ tema: "Heat", estacion: calor.e, nivel: 4, cifra: String(calor.anio), titulo: "Hottest Year",
      lineas: [`${fmt(calor.n)} ${dias(calor.n)} above ${meta("Tmax").limites[2]} °C`, `(${delAnio(calor.n, calor.anio)})`] });
  }

  const extremo = mejor(ests.flatMap((e) => {
    const r = D.datos[e].Tmax;
    return r ? r.anios.map((a, i) => ({ e, anio: a, n: r.niveles[i][4] })) : [];
  }), (x) => x.n);
  if (extremo && extremo.n > 0) {
    lista.push({ tema: "Heat", estacion: extremo.e, nivel: 5, cifra: String(extremo.anio), titulo: "Most Extreme Heat Days", resalta: { texto: "Extreme", nivel: 5 },
      lineas: [`${extremo.n} ${dias(extremo.n)} above ${meta("Tmax").limites[3]} °C`, `(${delAnio(extremo.n, extremo.anio)})`] });
  }

  const record = (v, mayor) => {
    const t = mejor(ests.filter((e) => D.datos[e][v]?.top.length).map((e) => ({ e, ...D.datos[e][v].top[0] })),
      (x) => x.valor, mayor);
    if (!t) return null;
    const mismoDia = ests.filter((e) => e !== t.e).map((e) => ({ e, d: D.datos[e][v]?.top.find((x) => x.fecha === t.fecha) }))
      .filter((x) => x.d);
    const extra = mismoDia.map((x) => `${D.estaciones[x.e].nombre}: ${fmt(x.d.valor, 1)} °C that day`).join(" ");
    return { t, lineas: [fecha(t.fecha), ...(extra ? [extra] : [])] };
  };
  const caliente = record("Tmax", true);
  if (caliente) {
    lista.push({ tema: "Heat", estacion: caliente.t.e, nivel: caliente.t.nivel, cifra: `${fmt(caliente.t.valor, 1)} °C`,
      titulo: "Hottest Hour on Record", lineas: caliente.lineas });
  }
  const fria = record("Tmin", false);
  if (fria) {
    lista.push({ tema: "Cold", estacion: fria.t.e, nivel: fria.t.nivel, cifra: `${fmt(fria.t.valor, 1)} °C`,
      titulo: "Coldest Hour on Record", lineas: fria.lineas });
  }

  const tendencias = ests.flatMap((e) => {
    const r = D.datos[e].PM10;
    const idx = r ? elegibles(r) : [];
    if (idx.length < 10) return [];
    const media = (ii) => ii.reduce((s, i) => s + r.excedidos[i] / r.validos[i], 0) / ii.length * 100;
    const a = idx.slice(0, 5), b = idx.slice(-5);
    const rango = (ii) => `${r.anios[ii[0]]}–${r.anios[ii.at(-1)]}`;
    return [{ e, pa: media(a), pb: media(b), rango: `${rango(a)} vs. ${rango(b)}` }];
  });
  const tend = mejor(tendencias, (x) => Math.abs(x.pb - x.pa));
  if (tend) {
    const otras = tendencias.filter((x) => x !== tend)
      .map((x) => `${D.estaciones[x.e].nombre}: ${Math.round(x.pa)} % → ${Math.round(x.pb)} %`).join(" · ");
    lista.push({ tema: NOMBRE.PM10, estacion: tend.e, nivel: tend.pb < tend.pa ? 1 : 4,
      cifra: `${Math.round(tend.pa)} % → ${Math.round(tend.pb)} %`,
      titulo: tend.pb < tend.pa ? `Fewer High ${NOMBRE.PM10} Days` : `More High ${NOMBRE.PM10} Days`,
      resalta: { texto: "High", nivel: 4 },
      lineas: [`% of days above ${lim("PM10")}`, tend.rango, ...(otras ? [otras] : [])] });
  }

  const anoNuevo = mejor(ests.flatMap((e) => ["PM25", "PM10"].map((v) => {
    const r = D.datos[e][v];
    const n = r ? r.top.filter((t) => t.fecha.endsWith("-12-31") || t.fecha.endsWith("-01-01")).length : 0;
    return { e, v, n, total: r?.top.length ?? 0 };
  })), (x) => x.n);
  if (anoNuevo && anoNuevo.n >= 2) {
    lista.push({ tema: NOMBRE[anoNuevo.v], estacion: anoNuevo.e, nivel: 5, cifra: `${anoNuevo.n} out of ${anoNuevo.total}`,
      titulo: "Worst Days at New Year",
      lineas: [`${anoNuevo.n} of the ${anoNuevo.total} highest ${NOMBRE[anoNuevo.v]} days`, "fell on 31 Dec or 1 Jan", "(fireworks)"] });
  }

  const limpio = mejor(anios("PM10"), (x) => x.p, false);
  if (limpio) {
    lista.push({ tema: NOMBRE.PM10, estacion: limpio.e, nivel: 1, cifra: String(limpio.anio), titulo: `Cleanest Year for ${NOMBRE.PM10}`,
      lineas: [`${fmt(limpio.n)} ${dias(limpio.n)} above ${lim("PM10")}`, `(${delAnio(limpio.n, limpio.anio)})`] });
  }

  const nunca = CONTAMINANTES.filter((v) => {
    const rs = ests.map((e) => D.datos[e][v]).filter(Boolean);
    return rs.some((r) => r.validos.some(Boolean)) && rs.every((r) => r.excedidos.every((x) => x === 0));
  });
  if (nunca.length) {
    const nombres = nunca.map((v) => NOMBRE[v]);
    const texto = nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} and ${nombres.at(-1)}` : nombres[0];
    lista.push({ tema: "Air quality", estacion: null, nivel: 1, cifra: texto, titulo: "Never Above Moderate",
      lineas: ["No day reached the High level", "at any of the three stations"] });
  }
  return lista.slice(0, 10);
}

function pintarDestacados() {
  const cont = $("destacados");
  cont.replaceChildren();
  for (const d of destacados()) {
    const c = html("article", { class: "destacado" }, null, cont);
    const tema = html("div", { class: "destacado-tema" }, null, c);
    const punto = html("span", { class: "punto-nivel", "aria-hidden": "true" }, null, tema);
    punto.style.background = COLOR.nivel[d.nivel - 1];
    html("span", {}, d.tema, tema);
    html("span", { class: "destacado-estacion" }, d.estacion ? etiquetaEstacion(d.estacion) : "All stations", tema);
    html("p", { class: "destacado-cifra" }, d.cifra, c);
    const titulo = html("h3", { class: "destacado-titulo" }, null, c);
    if (d.resalta) {
      const [antes, despues] = d.titulo.split(d.resalta.texto);
      titulo.append(antes);
      html("span", {}, d.resalta.texto, titulo).style.color = COLOR.nivel[d.resalta.nivel - 1];
      titulo.append(despues);
    } else {
      titulo.textContent = d.titulo;
    }
    const texto = html("p", { class: "destacado-texto" }, null, c);
    for (const l of d.lineas) html("span", {}, sinCorte(l), texto);
  }
}

function pintarHeatIndex() {
  const D = estado.datos, hi = D.heat_index;
  if (!hi) return;

  const lim = hi.limites.map((x) => `${fmt(x, 2)} °C`);
  barraNiveles($("hi-barra"), hi.niveles, lim,
    [`below ${lim[0]}`, `${lim[0]} to ${lim[1]}`, `${lim[1]} to ${lim[2]}`, `${lim[2]} to ${lim[3]}`, `${lim[3]} or more`]);

  const escribir = (padre, partes) => {
    for (const p of partes) {
      if (Array.isArray(p)) { padre.append(p[0]); html("sub", {}, p[1], padre); }
      else padre.append(sinCorte(p));
    }
  };
  const columna = (padre, color, titulo, lineas) => {
    const c = html("figure", { class: "hi-figura" }, null, padre);
    c.appendChild(figuraHumana(color, titulo));
    const pie = html("figcaption", {}, null, c);
    for (const [clase, partes, punto] of lineas) {
      const l = html("span", { class: clase }, null, pie);
      if (punto) {
        const pt = html("span", { class: "punto-nivel", "aria-hidden": "true" }, null, l);
        pt.style.background = punto;
      }
      escribir(l, partes);
    }
  };

  const peores = $("hi-peores");
  peores.replaceChildren();
  for (const d of hi.peores) {
    const color = COLOR.nivel[d.nivel - 1];
    columna(peores, color, `${fecha(d.fecha)}: heat index ${fmt(d.hi, 1)} °C`, [
      ["hi-valor", [`${fmt(d.hi, 1)} °C`]],
      ["hi-nivel", [hi.niveles[d.nivel - 1]], color],
      ["hi-dato", [fecha(d.fecha)]],
      ["hi-dato", [`${d.hora} · ${D.estaciones[d.est].nombre}`]],
      ["hi-dato", [["T", "air"], ` ${fmt(d.t, 1)} °C`]],
      ["hi-dato", [["H", "R"], ` ${d.hr} %`]],
    ]);
  }

  const mejores = $("hi-mejores");
  mejores.replaceChildren();
  for (const a of hi.mejores_anios) {
    const color = COLOR.nivel[a.nivel - 1];
    columna(mejores, color, `${a.anio}: typical summer heat index ${fmt(a.tipico, 1)} °C`, [
      ["hi-valor", [String(a.anio)]],
      ["hi-nivel", [hi.niveles[a.nivel - 1]], color],
      ["hi-dato", [`Summer ${fmt(a.tipico, 1)} °C`]],
      ["hi-dato", [`${a.dias_peligro} ${a.dias_peligro === 1 ? "day" : "days"} in Danger`]],
      ["hi-dato", [`Peak ${fmt(a.pico, 1)} °C`]],
      ["hi-dato", [D.estaciones[a.est_pico].nombre]],
    ]);
  }
}

function pintarMapa() {
  const cont = $("mapa");
  cont.replaceChildren();
  const vars = ORDEN.filter((v) => datosVar(v));
  const anios = datosVar(vars[0]).anios;
  const W = cont.clientWidth;
  const etiquetaW = W < 560 ? 64 : 150;
  const celdaH = 28, gap = 2, abajo = 22;
  const banda = (W - etiquetaW) / anios.length;
  const H = vars.length * (celdaH + gap) + abajo;
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
    "aria-label": "Percentage of each year's days above the Moderate limit, per variable" }, cont);

  vars.forEach((v, fi) => {
    const r = datosVar(v);
    const y = fi * (celdaH + gap);
    const fila = svg("g", { class: "fila", style: "cursor:pointer" }, s);
    const nombre = svg("text", { x: 0, y: y + celdaH / 2 + 4, class: "fila-texto" }, fila);
    nombre.textContent = W < 560 ? NOMBRE[v] : `${NOMBRE[v]}  ${limiteTexto(v)}`;
    fila.addEventListener("click", () => elegirVariable(v));
    anios.forEach((a, i) => {
      const x = etiquetaW + i * banda + gap / 2;
      const w = banda - gap;
      const p = r.validos[i] ? pct(r.excedidos[i], diasAnio(a)) : null;
      const k = nivelCalor(p);
      const fill = k < 0 ? "#ffffff" : COLOR.calor[k];
      const celda = svg("rect", { x, y, width: w, height: celdaH, rx: 4, fill, class: "celda marca" }, fila);
      if (k < 0) celda.setAttribute("stroke", COLOR.rejilla);
      if (w >= 24 && p > 0) {
        const t = svg("text", { x: x + w / 2, y: y + celdaH / 2 + 4, "text-anchor": "middle", class: "celda-texto",
          fill: textoSobre(fill) }, fila);
        t.textContent = p < 1 ? "<1\u202F%" : `${Math.round(p)}\u202F%`;
      }
      interactivo(celda, () => ({
        titulo: `${NOMBRE[v]} · ${a}`,
        filas: p === null ? [] : [{ color: fill === "#ffffff" ? COLOR.rejilla : fill, valor: fmtPct(p),
          etiqueta: `of the year above ${limiteTexto(v)}` }],
        pie: p === null ? "No valid data this year" : `${fmt(r.excedidos[i])} days`,
      }));
    });
  });
  const yEje = vars.length * (celdaH + gap) + 14;
  anios.forEach((a, i) => {
    const t = svg("text", { x: etiquetaW + (i + 0.5) * banda, y: yEje, "text-anchor": "middle", class: "eje-texto" }, s);
    t.textContent = etiquetaAnio(a, banda, i);
  });

  const esc = $("escala-mapa");
  esc.replaceChildren();
  const item = (color, texto, sin = false) => {
    const it = html("span", { class: "escala-item" }, null, esc);
    const c = html("span", { class: "escala-color" + (sin ? " sin" : "") }, null, it);
    if (!sin) c.style.background = color;
    html("span", {}, texto, it);
  };
  item(null, "No data", true);
  COLOR.calor.forEach((c, k) => item(c, ETIQUETA_CALOR[k]));
}

function pintarVariables() {
  const cont = $("variables");
  cont.replaceChildren();
  for (const v of ORDEN) {
    const r = datosVar(v);
    if (!r) continue;
    const total = r.excedidos.reduce((a, b) => a + b, 0);
    const b = html("button", { type: "button", class: "variable", role: "radio",
      "aria-checked": String(v === estado.var) }, null, cont);
    const cab = html("span", { class: "variable-cab" }, null, b);
    html("span", { class: "variable-nombre" }, NOMBRE[v], cab);
    html("span", { class: "variable-nota" }, limiteTexto(v), cab);
    const val = html("span", { class: "variable-valor" }, fmt(total), b);
    html("small", {}, " days", val);
    b.addEventListener("click", () => elegirVariable(v));
  }
}

function pintarEncabezadoDetalle() {
  const v = estado.var, m = meta(v);
  $("t-detalle").textContent = `${NOMBRE[v]}, ${DESCRIPCION[v]}`;
  $("detalle-sub").textContent = `Indicator: ${m.indicador}. A day is valid with at least ${estado.datos.dias_minimos} hours of indicator values.`;
  barraVertical($("niveles"), estado.datos.niveles,
    m.limites.map((x) => `${fmt(x, x % 1 ? m.decimales : 0)} ${m.unidad}`),
    estado.datos.niveles.map((n, k) => `${rangoNivel(v, k)} ${m.unidad}`));
  $("t-extremos").textContent = m.sentido === "bajo" ? "Lowest Daily Value of Each Year" : "Highest Daily Value of Each Year";
}

function peorMejorAnio(r) {
  const xs = r.anios.map((a, i) => i).filter((i) => r.validos[i] >= COBERTURA_MIN).map((i) => {
    const dias = r.niveles[i].reduce((s, c) => s + c, 0) || 1;
    return { anio: r.anios[i], n: r.excedidos[i], p: r.excedidos[i] / dias,
             medio: r.niveles[i].reduce((s, c, k) => s + c * k, 0) / dias };
  });
  if (!xs.length) return null;
  xs.sort((a, b) => b.p - a.p || b.medio - a.medio);
  return { peor: xs[0], mejor: xs.at(-1) };
}

function pintarPeorMejor(r) {
  const sub = $("barras-sub");
  sub.replaceChildren();
  const pm = peorMejorAnio(r);
  if (!pm) return;
  const parte = (etiqueta, x, primero) => {
    const s = html("span", { class: "anio-clave" }, `${etiqueta}: `, sub);
    html("b", {}, String(x.anio), s);
    if (pm.peor.n > 0) {
      const junto = (texto) => texto.replaceAll(" ", "\u00A0");
      const dias = `${fmt(x.n)} ${x.n === 1 ? "day" : "days"}${primero ? " at High or Extreme" : ""}`;
      s.append(x.n ? ` ${junto(`(${dias},`)} ${junto(`${Math.round((100 * x.n) / diasAnio(x.anio))} % of the year)`)}`
                   : ` ${junto("(no day at High or Extreme)")}`);
    }
  };
  parte("Worst year", pm.peor, true);
  html("br", {}, null, sub);
  parte("Best year", pm.mejor, false);
  if (pm.peor.n === 0) sub.append(" (no day reached High in any year; ranked by the average daily level)");
}

function pintarBarras() {
  const v = estado.var, r = datosVar(v), cont = $("barras");
  cont.replaceChildren();
  pintarPeorMejor(r);
  const niveles = estado.datos.niveles;
  const W = cont.clientWidth, H = 300;
  const m = { t: 20, r: 6, b: 24, l: 40 };
  const n = r.anios.length;
  const banda = (W - m.l - m.r) / n;
  const bw = Math.min(24, banda * 0.66);
  const y = (d) => m.t + (H - m.t - m.b) * (1 - d / 366);
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
    "aria-label": `Days per risk level and year, ${NOMBRE[v]}` }, cont);
  for (const t of [0, 100, 200, 300]) {
    svg("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t ? "linea-rejilla" : "linea-eje" }, s);
    const tx = svg("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end", class: "eje-texto" }, s);
    tx.textContent = t;
  }
  const unidad = svg("text", { x: 0, y: 10, class: "eje-titulo" }, s);
  unidad.textContent = "days";
  const clave = svg("text", { x: W - m.r, y: 10, "text-anchor": "end", class: "eje-texto" }, s);
  clave.textContent = "No valid data";
  const cw = clave.getComputedTextLength();
  svg("rect", { x: W - m.r - cw - 20, y: 1.5, width: 14, height: 9, rx: 3, fill: COLOR.sinDatos }, s);

  r.anios.forEach((a, i) => {
    const x = m.l + banda * i + (banda - bw) / 2;
    const total = diasAnio(a);
    const valid = r.validos[i];
    const g = svg("g", { class: "grupo-anio", tabindex: 0,
      "aria-label": `${a}: ${niveles.map((nn, k) => `${nn} ${r.niveles[i][k]}`).join(", ")}, valid days ${valid}` }, s);
    const topeValido = y(valid);
    if (valid < total) {
      const yTop = y(total);
      const alto = valid ? topeValido - yTop - 2 : y(0) - yTop;
      if (alto > 0.5) svg("path", { d: rectSup(x, yTop, bw, alto), fill: COLOR.sinDatos, class: "pista" }, g);
    }
    const segs = r.niveles[i].map((c, k) => ({ c, k })).filter((o) => o.c > 0);
    let acum = 0;
    segs.forEach((o, j) => {
      const y0 = y(acum), y1 = y(acum + o.c);
      acum += o.c;
      const ultimo = j === segs.length - 1;
      const top = ultimo ? y1 : y1 + 2;
      const alto = y0 - top;
      if (alto <= 0) return;
      const d = ultimo ? rectSup(x, top, bw, alto) : `M${x},${top}H${x + bw}V${y0}H${x}Z`;
      svg("path", { d, fill: COLOR.nivel[o.k], class: "marca", "data-nivel": o.k }, g);
    });
    svg("rect", { x: m.l + banda * i, y: m.t, width: banda, height: H - m.t - m.b, fill: "transparent" }, g);
    interactivo(g, (e) => {
      const activo = e?.target?.dataset?.nivel !== undefined ? Number(e.target.dataset.nivel) : -1;
      return {
        titulo: `${a}`,
        filas: [4, 3, 2, 1, 0].map((k) => ({ color: COLOR.nivel[k], valor: `${r.niveles[i][k]} d`,
          etiqueta: `${niveles[k]}  ${rangoNivel(v, k)}`, activa: k === activo })),
        pie: valid ? `Above limit: ${r.excedidos[i]} of ${valid} valid days (${fmtPct(pct(r.excedidos[i], valid))})`
                   : "No valid data this year",
        fijo: true,
      };
    });
  });
  r.anios.forEach((a, i) => {
    const t = svg("text", { x: m.l + banda * (i + 0.5), y: H - 6, "text-anchor": "middle", class: "eje-texto" }, s);
    t.textContent = etiquetaAnio(a, banda, i);
  });
}

function pintarExtremos() {
  const v = estado.var, r = datosVar(v), mt = meta(v), cont = $("extremos");
  cont.replaceChildren();
  const niveles = estado.datos.niveles;
  const nivelDe = (val) => {
    const [l1, l2, l3, l4] = mt.limites;
    if (mt.sentido === "bajo") return val > l1 ? 0 : val >= l2 ? 1 : val >= l3 ? 2 : val >= l4 ? 3 : 4;
    if (mt.sentido === "viento") return val < l1 ? 0 : val < l2 ? 1 : val < l3 ? 2 : val < l4 ? 3 : 4;
    if (v === "Tmax") return val < l1 ? 0 : val <= l2 ? 1 : val <= l3 ? 2 : val <= l4 ? 3 : 4;
    return val <= l1 ? 0 : val <= l2 ? 1 : val <= l3 ? 2 : val <= l4 ? 3 : 4;
  };
  const vals = r.extremo.filter((x) => x !== null);
  if (!vals.length) { html("p", { class: "tarjeta-enc" }, "No valid data at this station.", cont); return; }
  const [l1, , , l4] = mt.limites;
  let lo, hi;
  if (mt.sentido === "bajo") { lo = Math.min(...vals, l4 - 2) - 1; hi = Math.max(...vals, l1 + 2) + 1; }
  else if (v === "Tmax") { lo = Math.min(...vals, l1 - 2) - 1; hi = Math.max(...vals, l4 + 2) + 1; }
  else { lo = 0; hi = Math.max(...vals, l4) * 1.1; }
  const W = cont.clientWidth, H = 300;
  const m = { t: 20, r: W < 560 ? 8 : 70, b: 24, l: 48 };
  const n = r.anios.length;
  const banda = (W - m.l - m.r) / n;
  const x = (i) => m.l + banda * (i + 0.5);
  const y = (val) => m.t + (H - m.t - m.b) * (1 - (val - lo) / (hi - lo));
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
    "aria-label": `${mt.sentido === "bajo" ? "Lowest" : "Highest"} daily value per year, ${NOMBRE[v]}` }, cont);

  const lim = mt.limites;
  const bordes = mt.sentido === "bajo"
    ? [[lim[0], Infinity], [lim[1], lim[0]], [lim[2], lim[1]], [lim[3], lim[2]], [-Infinity, lim[3]]]
    : [[-Infinity, lim[0]], [lim[0], lim[1]], [lim[1], lim[2]], [lim[2], lim[3]], [lim[3], Infinity]];
  bordes.forEach(([a, b], k) => {
    const ya = y(Math.max(a, lo)), yb = y(Math.min(b, hi));
    if (ya - yb <= 0) return;
    svg("rect", { x: m.l, y: yb, width: W - m.l - m.r, height: ya - yb, fill: COLOR.nivel[k], "fill-opacity": 0.14 }, s);
    if (ya - yb >= 13 && m.r > 20) {
      const t = svg("text", { x: W - m.r + 8, y: (ya + yb) / 2 + 4, class: "eje-texto" }, s);
      t.textContent = niveles[k];
    }
  });
  for (const t of ticks(lo, hi, 5)) {
    svg("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: "linea-rejilla", "stroke-opacity": 0.7 }, s);
    const tx = svg("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end", class: "eje-texto" }, s);
    tx.textContent = fmt(t, t % 1 ? Math.min(3, mt.decimales) : 0);
  }
  const tu = svg("text", { x: 0, y: m.t - 2, class: "eje-titulo" }, s);
  tu.textContent = mt.unidad;

  let d = "", abierto = false;
  r.extremo.forEach((val, i) => {
    if (val === null) { abierto = false; return; }
    d += `${abierto ? "L" : "M"}${x(i).toFixed(1)},${y(val).toFixed(1)}`;
    abierto = true;
  });
  svg("path", { d, fill: "none", stroke: NEGRO, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, s);

  const iRec = r.extremo.reduce((a, val, i) => (val !== null && (a < 0 || (mt.sentido === "bajo" ? val < r.extremo[a] : val > r.extremo[a])) ? i : a), -1);
  const cruz = svg("line", { y1: m.t, y2: H - m.b, stroke: COLOR.eje, "stroke-width": 1, visibility: "hidden" }, s);
  r.extremo.forEach((val, i) => {
    if (val === null) return;
    const g = svg("g", { class: "punto", tabindex: 0, "aria-label": `${r.anios[i]}: ${valorUnidad(v, val)} on ${fecha(r.fecha_extremo[i])}` }, s);
    svg("circle", { cx: x(i), cy: y(val), r: Math.max(12, banda / 2), fill: "transparent" }, g);
    svg("circle", { cx: x(i), cy: y(val), r: 4, fill: NEGRO, stroke: "#fff", "stroke-width": 2 }, g);
    interactivo(g, () => {
      cruz.setAttribute("x1", x(i)); cruz.setAttribute("x2", x(i)); cruz.setAttribute("visibility", "visible");
      const k = nivelDe(val);
      return { titulo: fecha(r.fecha_extremo[i]),
        filas: [{ color: COLOR.nivel[k], valor: valorUnidad(v, val), etiqueta: niveles[k], activa: true }] };
    });
    g.addEventListener("pointerleave", () => cruz.setAttribute("visibility", "hidden"));
    g.addEventListener("blur", () => cruz.setAttribute("visibility", "hidden"));
  });
  if (iRec >= 0) {
    const val = r.extremo[iRec];
    const derecha = x(iRec) > W - m.r - 120;
    const t = svg("text", { x: x(iRec) + (derecha ? -10 : 10), y: y(val) + (mt.sentido === "bajo" ? 16 : -8),
      "text-anchor": derecha ? "end" : "start", class: "etiqueta-dato" }, s);
    t.textContent = `Record ${valorUnidad(v, val)} · ${fecha(r.fecha_extremo[iRec])}`;
  }
  r.anios.forEach((a, i) => {
    const t = svg("text", { x: x(i), y: H - 6, "text-anchor": "middle", class: "eje-texto" }, s);
    t.textContent = etiquetaAnio(a, banda, i);
  });
}

function pintarMapaEstaciones() {
  if (MAPA_ESTACIONES) {
    const img = $("mapa-estaciones");
    img.addEventListener("load", () => {
      img.hidden = false;
      $("mapa-pendiente").hidden = true;
    }, { once: true });
    img.src = MAPA_ESTACIONES;
  }
  const ul = $("lista-estaciones");
  ul.replaceChildren();
  for (const e of Object.values(estado.datos.estaciones)) {
    const li = html("li", {}, null, ul);
    html("span", { class: "marcador", "aria-hidden": "true" }, e.nombre.replace("SIMA ", ""), li);
    html("span", {}, e.nombre, li);
  }
  for (const [clase, texto] of [["ley-distrito", "Distrito Tec"], ["ley-muestra", "Digital Twin Area"]]) {
    const li = html("li", {}, null, ul);
    html("i", { class: clase, "aria-hidden": "true" }, null, li);
    html("span", {}, texto, li);
  }
}

function nombreUmbral(v, padre) {
  const sub = { Tmax: "high", Tmin: "low" }[v];
  if (!sub) { padre.append(NOMBRE[v]); return; }
  padre.append("T");
  html("sub", {}, sub, padre);
}

function pintarUmbrales() {
  const D = estado.datos, t = $("umbrales");
  t.replaceChildren();
  const tr = html("tr", {}, null, html("thead", {}, null, t));
  html("th", { scope: "col" }, "Variable", tr);
  D.niveles.forEach((n, k) => {
    const th = html("th", { scope: "col", class: "nivel" }, n, tr);
    th.style.background = COLOR.nivel[k];
  });
  const tb = html("tbody", {}, null, t);
  for (const v of ORDEN) {
    const m = D.variables[v];
    const fila = html("tr", {}, null, tb);
    const th = html("th", { scope: "row" }, null, fila);
    nombreUmbral(v, th);
    html("small", {}, m.unidad, th);
    for (let k = 0; k < 5; k++) {
      const r = rangoNivel(v, k);
      html("td", {}, r.includes("−") ? r : r.replace(" – ", "–"), fila);
    }
  }
}

function pintarEstaciones() {
  const cont = $("estaciones");
  cont.replaceChildren();
  for (const [id, e] of Object.entries(estado.datos.estaciones)) {
    const b = html("button", { type: "button", role: "radio", "aria-checked": String(id === estado.est) }, e.nombre, cont);
    b.addEventListener("click", () => { estado.est = id; render(); });
  }
  const e = estado.datos.estaciones[estado.est];
  const km = distanciaKm(TEC, e);
  $("estacion-info").textContent =
    `${e.nombre} · ${e.lat.toFixed(3)}° N, ${Math.abs(e.lon).toFixed(3)}° W · ${km.toFixed(1)} km ${rumbo(TEC, e)} of Distrito Tec`;
}

function elegirVariable(v) {
  estado.var = v;
  guardarURL();
  pintarVariables();
  pintarDetalle();
}

function pintarDetalle() {
  pintarEncabezadoDetalle();
  pintarBarras();
  pintarExtremos();
}

function guardarURL() {
  const u = new URL(location.href);
  u.searchParams.set("estacion", estado.est);
  u.searchParams.set("variable", estado.var);
  history.replaceState(null, "", u);
}

function render() {
  if (!datosVar(estado.var)) estado.var = ORDEN.find((v) => datosVar(v));
  guardarURL();
  ocultarTooltip();
  pintarEstaciones();
  pintarMapa();
  pintarVariables();
  pintarDetalle();
  estado.ancho = $("tablero").clientWidth;
}

function recortarAnios() {
  const anuales = ["anios", "niveles", "validos", "excedidos", "horas_excedidas", "extremo", "fecha_extremo", "media_anual"];
  for (const vars of Object.values(estado.datos.datos)) {
    const series = Object.values(vars);
    const i0 = Math.min(...series.map((r) => {
      const i = r.validos.findIndex(Boolean);
      return i < 0 ? Infinity : i;
    }));
    if (!Number.isFinite(i0) || i0 === 0) continue;
    for (const r of series) for (const k of anuales) if (Array.isArray(r[k])) r[k] = r[k].slice(i0);
  }
}

function graficos() {
  pintarMapa();
  pintarBarras();
  pintarExtremos();
}

async function iniciar() {
  COLOR = {
    nivel: [1, 2, 3, 4, 5].map((k) => css(`--nivel-${k}`)),
    calor: [0, 1, 2, 3, 4, 5].map((k) => css(`--calor-${k}`)),
    sinDatos: css("--sin-datos"),
    serie: css("--azul-tec"),
    rejilla: css("--rejilla"),
    eje: css("--eje"),
  };
  try {
    const resp = await fetch("datos/historico.json", { cache: "no-cache" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    estado.datos = await resp.json();
  } catch (err) {
    const caja = html("div", { class: "error-carga" }, null);
    caja.append("No se pudieron leer los datos (", html("code", {}, "datos/historico.json"),
      `): ${err.message}. Genera el archivo con `, html("code", {}, "python Web/scripts/historico.py"),
      " y sirve la carpeta con un servidor local.");
    $("tablero").prepend(caja);
    return;
  }
  recortarAnios();
  const q = new URLSearchParams(location.search);
  if (estado.datos.estaciones[q.get("estacion")]) estado.est = q.get("estacion");
  if (ORDEN.includes(q.get("variable"))) estado.var = q.get("variable");

  pintarMapaEstaciones();
  pintarUmbrales();
  pintarDestacados();
  pintarHeatIndex();
  render();
  $("tablero").setAttribute("aria-busy", "false");

  let pendiente = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(pendiente);
    pendiente = requestAnimationFrame(() => {
      const w = $("tablero").clientWidth;
      if (w !== estado.ancho) { estado.ancho = w; graficos(); }
    });
  }).observe($("tablero"));
  addEventListener("scroll", ocultarTooltip, { passive: true });
}

iniciar();
