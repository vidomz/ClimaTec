const NS = "http://www.w3.org/2000/svg";
let contador = 0;

const MITAD = [
  [55.5, 33.5], [56.5, 42.5], [63, 46], [71, 48.5], [76.5, 52.5], [79.5, 59.5], [80.6, 69],
  [81.6, 82], [83.2, 96], [85.4, 110], [87.2, 122], [89.2, 131], [89, 139.5], [85.6, 141.6],
  [83.4, 133], [81.6, 122], [79, 109], [75.8, 95], [73.6, 80], [71.6, 68.5],
  [70.6, 80], [69.4, 92], [67.4, 106], [68.8, 120], [69.4, 132],
  [68.6, 150], [66.4, 172], [66.8, 190], [64.2, 212], [62, 230],
  [64.6, 239.5], [63.4, 245.2], [54.6, 245.6], [53.8, 237],
  [53.6, 212], [53.2, 190], [53.2, 172], [52.2, 150], [51.2, 139], [50, 136.5],
];
const CONTORNO = [...MITAD, ...MITAD.slice(0, -1).reverse().map(([x, y]) => [100 - x, y])];

function curvaCerrada(p) {
  const n = p.length;
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0]},${p2[1]}`;
  }
  return d + "Z";
}

const CUERPO = curvaCerrada(CONTORNO);
const CABEZA = "M50,8 C57.2,8 61.2,13.8 61.2,21.6 C61.2,29.4 56.4,36.8 50,36.8 C43.6,36.8 38.8,29.4 38.8,21.6 C38.8,13.8 42.8,8 50,8Z";
const DETALLES = [
  ["M54.4,47.4 Q61.5,46.2 69,49.4", "claro"], ["M45.6,47.4 Q38.5,46.2 31,49.4", "claro"],
  ["M71.8,68.5 Q72.8,60 77.2,53.6", "oscuro"], ["M28.2,68.5 Q27.2,60 22.8,53.6", "oscuro"],
  ["M57.2,171.8 Q60.4,175.2 64,171.8", "oscuro"], ["M42.8,171.8 Q39.6,175.2 36,171.8", "oscuro"],
];

function el(tag, attrs, padre) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (padre) padre.appendChild(n);
  return n;
}

function mezclar(hex, otro, f) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(otro.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f));
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function figuraHumana(color, titulo = "") {
  const id = `fh${++contador}`;
  const svg = el("svg", { viewBox: "0 0 100 255", role: "img", class: "figura-humana" });
  if (titulo) el("title", {}, svg).textContent = titulo;
  const defs = el("defs", {}, svg);

  const lado = el("linearGradient", { id: `${id}l`, x1: "0", x2: "1", y1: "0", y2: "0" }, defs);
  [[0, "#000", 0.26], [0.2, "#000", 0.06], [0.42, "#fff", 0.16], [0.5, "#fff", 0.22],
   [0.58, "#fff", 0.16], [0.8, "#000", 0.06], [1, "#000", 0.26]]
    .forEach(([o, c, a]) => el("stop", { offset: o, "stop-color": c, "stop-opacity": a }, lado));
  const alto = el("linearGradient", { id: `${id}a`, x1: "0", x2: "0", y1: "0", y2: "1" }, defs);
  [[0, "#fff", 0.1], [0.55, "#fff", 0], [1, "#000", 0.16]]
    .forEach(([o, c, a]) => el("stop", { offset: o, "stop-color": c, "stop-opacity": a }, alto));
  const brillo = el("radialGradient", { id: `${id}b`, cx: "0.38", cy: "0.3", r: "0.7" }, defs);
  [[0, "#fff", 0.42], [0.55, "#fff", 0.06], [1, "#000", 0.2]]
    .forEach(([o, c, a]) => el("stop", { offset: o, "stop-color": c, "stop-opacity": a }, brillo));

  el("ellipse", { cx: 50, cy: 247.5, rx: 26, ry: 3.8, fill: "#10203f", "fill-opacity": 0.14 }, svg);

  const borde = mezclar(color, "#000000", 0.32);
  el("path", { d: CUERPO, fill: color }, svg);
  el("path", { d: CUERPO, fill: `url(#${id}l)` }, svg);
  el("path", { d: CUERPO, fill: `url(#${id}a)` }, svg);
  for (const [d, tono] of DETALLES) {
    el("path", { d, fill: "none", stroke: tono === "claro" ? "#fff" : "#000", "stroke-opacity": tono === "claro" ? 0.28 : 0.14,
      "stroke-width": 0.9, "stroke-linecap": "round" }, svg);
  }
  el("path", { d: CUERPO, fill: "none", stroke: borde, "stroke-opacity": 0.55, "stroke-width": 0.9, "stroke-linejoin": "round" }, svg);

  el("ellipse", { cx: 50, cy: 38.6, rx: 6.4, ry: 2.4, fill: "#000", "fill-opacity": 0.14 }, svg);
  el("path", { d: CABEZA, fill: color }, svg);
  el("path", { d: CABEZA, fill: `url(#${id}b)` }, svg);
  el("path", { d: CABEZA, fill: "none", stroke: borde, "stroke-opacity": 0.55, "stroke-width": 0.9 }, svg);
  return svg;
}
