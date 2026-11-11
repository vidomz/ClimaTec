import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { listo } from './visor.js?v=20261110a';
import { materialPasto } from './materiales.js';
import { crearCielo } from './cielo.js?v=20261030a';

const PARAMETRO = new URLSearchParams(location.search).get('caso');
const VERDE = new URLSearchParams(location.search).has('verde');
const PASTO_M = 6, PASILLO_M = 6, VERDE_SEPARA_M = 0.25;
const ACTIVO = PARAMETRO !== null;

export const SITIO = { lat: 25.649435, lon: -100.289901 };
export const LADO = 36, NIVELES = 5, ENTREPISO = 3.6, ALTO = NIVELES * ENTREPISO;
const MODULO = 4.5, ANCHO_VANO = 3.0, SILLAR = 0.9, VENTANA_ALTO = 1.35, DINTEL = 0.45;
const TECHO_X = SILLAR + VENTANA_ALTO + DINTEL;
const RECTANGULO = [ANCHO_VANO, VENTANA_ALTO];
const FRANJAS_METAL = [0.6, 1.5, 0.9, 1.5, 0.6, 1.2, 1.5, 1.2];
const UNIDADES_COSTADO_FRENTE = [0, 1, 6, 7];
const CENTRO_FRENTE = [9, 27], PILASTRA_FRENTE = 1.5, ALETA = 0.3;
const VISION = 2.7, ANTEPECHO_Z = ENTREPISO - VISION, PARTELUZ = 1.5, COLUMNA_Z = 1.5;
const AZOTEA = ALTO - 0.3, NUCLEO = 8, COLUMNAS = [-13.5, -4.5, 4.5, 13.5];
export const VISTA = { camara: [-70.92, 15.26, 41.33], objetivo: [3.11, 8.12, -2.79] };

const VIDRIO = 'rgba(62,88,106,0.72)';
const COLOR_MATERIAL = {
  x: { Concrete: '#9e9b94', Metal: '#c8a46a', Glass: '#4f6b80', Paint: '#9b655c' },
  z: { Concrete: '#9e9b94', Metal: '#a3aab1', Glass: '#4f6b80' },
};
function textura(anchoM, altoM, ppm, dibujar, repetir = true) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(anchoM * ppm));
  c.height = Math.max(2, Math.round(altoM * ppm));
  const g = c.getContext('2d');
  const m = (v) => v * ppm;
  const y = (v) => c.height - v * ppm;
  dibujar(g, c.width, c.height, m, y);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function ruido(g, w, h, n, colores) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colores[i % colores.length];
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
  }
}
const TEXTURAS = {
  concreto: () => textura(1.8, 1.8, 64, (g, w, h, m, y) => {
    g.fillStyle = '#9e9b94'; g.fillRect(0, 0, w, h);
    ruido(g, w, h, 1800, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.06)']);
    g.fillStyle = 'rgba(0,0,0,0.06)';
    for (let v = 0; v < 1.8; v += 0.3) g.fillRect(0, y(v) - 1, w, 1);
    g.fillStyle = 'rgba(40,38,34,0.35)';
    for (const u of [0.45, 1.35]) for (const v of [0.15, 0.75, 1.35]) { g.beginPath(); g.arc(m(u), y(v), 1.6, 0, 2 * Math.PI); g.fill(); }
  }),
  pintura: () => textura(2, 2, 48, (g, w, h) => {
    g.fillStyle = COLOR_MATERIAL.x.Paint; g.fillRect(0, 0, w, h);
    ruido(g, w, h, 900, ['rgba(0,0,0,0.04)', 'rgba(255,255,255,0.03)']);
  }),
  metalX: () => textura(1, 1, 96, (g, w, h, m) => {
    g.fillStyle = COLOR_MATERIAL.x.Metal; g.fillRect(0, 0, w, h);
    for (const u of [0, 0.5]) { g.fillStyle = '#9a7b48'; g.fillRect(m(u), 0, 2, h); g.fillStyle = '#e0c48e'; g.fillRect(m(u) + 2, 0, 2, h); }
  }),
  ventanaX: () => textura(...RECTANGULO, 96, (g, w, h, m) => {
    g.fillStyle = VIDRIO; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3d444b';
    const f = m(0.06);
    g.fillRect(0, 0, w, f); g.fillRect(0, h - f, w, f); g.fillRect(0, 0, f, h); g.fillRect(w - f, 0, f, h);
    for (const x of [1, 2]) g.fillRect(m(x) - m(0.025), 0, m(0.05), h);
  }, false),
  vidrioZ: () => textura(PARTELUZ, VISION, 96, (g, w, h, m) => {
    g.fillStyle = VIDRIO; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a5157';
    g.fillRect(0, 0, m(0.06), h);
    g.fillRect(0, 0, w, m(0.05)); g.fillRect(0, h - m(0.05), w, m(0.05));
  }),
  supervidrio: () => textura(PARTELUZ, ENTREPISO, 96, (g, w, h, m) => {
    g.fillStyle = VIDRIO; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3d444b';
    g.fillRect(0, 0, m(0.07), h);
    g.fillRect(0, h - m(0.1), w, m(0.1));
  }),
  metalZ: () => textura(PARTELUZ, ANTEPECHO_Z, 96, (g, w, h, m) => {
    g.fillStyle = '#a3aab1'; g.fillRect(0, 0, w, h);
    ruido(g, w, h, 300, ['rgba(255,255,255,0.08)']);
    g.fillStyle = '#7e858c'; g.fillRect(0, 0, m(0.03), h); g.fillRect(0, h / 2, w, 1);
  }),
  piso: () => textura(0.6, 0.6, 96, (g, w, h) => {
    g.fillStyle = '#d6d2ca'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#bdb8ae'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h);
  }),
  plafon: () => textura(2.4, 2.4, 48, (g, w, h, m) => {
    g.fillStyle = '#e9e8e4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#cfcdc8';
    for (let v = 0; v < 2.4; v += 0.6) { g.fillRect(0, m(v), w, 1); g.fillRect(m(v), 0, 1, h); }
    g.fillStyle = '#fbfbf7'; g.fillRect(m(0.62), m(0.62), m(1.16), m(0.56));
  }),
};

function caras(centro, K) {
  return [['S', 0, 1, 0], ['E', 1, 0, Math.PI / 2], ['N', 0, -1, Math.PI], ['W', -1, 0, -Math.PI / 2]].map(([id, nx, nz, giro]) => {
    const normal = new THREE.Vector3(nx, 0, nz), eje = new THREE.Vector3(Math.cos(giro), 0, -Math.sin(giro));
    const origen = centro.clone().addScaledVector(normal, LADO * K / 2).addScaledVector(eje, -LADO * K / 2);
    return { id, normal, eje, origen, K };
  });
}
function cuadro(cara, u0, u1, y0, y1, mosaico = [null, null]) {
  const pos = [], uv = [];
  for (const [u, y] of [[u0, y0], [u1, y0], [u1, y1], [u0, y1]]) {
    const p = cara.origen.clone().addScaledVector(cara.eje, u * cara.K);
    pos.push(p.x, p.y + y * cara.K, p.z);
    uv.push(mosaico[0] ? u / mosaico[0] : (u - u0) / (u1 - u0), mosaico[1] ? y / mosaico[1] : (y - y0) / (y1 - y0));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 4 }, () => cara.normal.toArray()).flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

const CATEGORIA = { concreto: 'Concrete', pintura: 'Paint', metalX: 'Metal', metalZ: 'Metal', ventanaX: 'Glass',
  vidrioZ: 'Glass', supervidrio: 'Glass' };
function poner(piezas, areas, mat, cara, u0, u1, y0, y1, mosaico) {
  if (u1 - u0 < 1e-6 || y1 - y0 < 1e-6) return;
  (piezas[mat] ??= []).push(cuadro(cara, u0, u1, y0, y1, mosaico));
  sumar(areas, cara.id, CATEGORIA[mat], (u1 - u0) * (y1 - y0));
}
function sumar(areas, cara, categoria, a) {
  const c = (areas[cara] ??= {});
  c[categoria] = (c[categoria] ?? 0) + a;
}
function conHuecos(piezas, areas, mat, cara, u0, u1, y0, y1, huecos, mosaico) {
  const cortes = (a, b, i) => [...new Set([a, b, ...huecos.flatMap((h) => [h[i], h[i + 1]])])]
    .filter((v) => v >= a && v <= b).sort((p, q) => p - q);
  const us = cortes(u0, u1, 0), ys = cortes(y0, y1, 2);
  for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    const uc = (us[i] + us[i + 1]) / 2, yc = (ys[j] + ys[j + 1]) / 2;
    if (huecos.some((h) => uc > h[0] && uc < h[1] && yc > h[2] && yc < h[3])) continue;
    poner(piezas, areas, mat, cara, us[i], us[i + 1], ys[j], ys[j + 1], mosaico);
  }
}

function fachadaX(cs, areas) {
  const piezas = {};
  for (const cara of cs) {
    if (cara.id === 'W') { caraOesteX(piezas, areas, cara); continue; }
    FRANJAS_METAL.forEach((_, j) => unidadAulas(piezas, areas, cara, j));
  }
  return piezas;
}

function unidadAulas(piezas, areas, cara, j) {
  const x0 = j * MODULO, junta = (MODULO - ANCHO_VANO - FRANJAS_METAL[j]) / 2;
  const r0 = x0 + junta, r1 = r0 + ANCHO_VANO;
  poner(piezas, areas, 'metalX', cara, r1 + junta, x0 + MODULO, 0, ALTO, [1, 1]);
  poner(piezas, areas, 'concreto', cara, x0, r0, 0, ALTO, [1.8, 1.8]);
  poner(piezas, areas, 'concreto', cara, r1, r1 + junta, 0, ALTO, [1.8, 1.8]);
  for (let n = 0; n < NIVELES; n++) {
    const yb = n * ENTREPISO, yv = yb + SILLAR, yd = yv + VENTANA_ALTO;
    poner(piezas, areas, 'pintura', cara, r0, r1, yb, yv, [2, 2]);
    poner(piezas, areas, 'ventanaX', cara, r0, r1, yv, yd);
    poner(piezas, areas, 'pintura', cara, r0, r1, yd, yb + TECHO_X, [2, 2]);
    poner(piezas, areas, 'concreto', cara, r0, r1, yb + TECHO_X, yb + ENTREPISO, [1.8, 1.8]);
  }
}

function caraOesteX(piezas, areas, cara) {
  for (const j of UNIDADES_COSTADO_FRENTE) unidadAulas(piezas, areas, cara, j);
  const [a, b] = CENTRO_FRENTE, g0 = a + PILASTRA_FRENTE, g1 = b - PILASTRA_FRENTE;
  poner(piezas, areas, 'pintura', cara, a, g0, 0, ALTO, [2, 2]);
  poner(piezas, areas, 'pintura', cara, g1, b, 0, ALTO, [2, 2]);
  const aletas = [];
  for (let u = g0 + PARTELUZ; u < g1 - 1e-6; u += PARTELUZ) aletas.push([u - ALETA / 2, u + ALETA / 2, ENTREPISO, ALTO]);
  poner(piezas, areas, 'supervidrio', cara, g0, g1, 0, TECHO_X, [PARTELUZ, ENTREPISO]);
  poner(piezas, areas, 'concreto', cara, g0, g1, TECHO_X, ENTREPISO, [1.8, 1.8]);
  for (let n = 1; n < NIVELES; n++) {
    const yb = n * ENTREPISO;
    conHuecos(piezas, areas, 'supervidrio', cara, g0, g1, yb, yb + TECHO_X, aletas, [PARTELUZ, ENTREPISO]);
    conHuecos(piezas, areas, 'concreto', cara, g0, g1, yb + TECHO_X, yb + ENTREPISO, aletas, [1.8, 1.8]);
  }
  for (const [u0, u1, y0, y1] of aletas) poner(piezas, areas, 'metalX', cara, u0, u1, y0, y1, [1, 1]);
}

function fachadaZ(cs, areas) {
  const piezas = {};
  for (const cara of cs) {
    for (let n = 0; n < NIVELES; n++) {
      const yb = n * ENTREPISO;
      poner(piezas, areas, 'vidrioZ', cara, COLUMNA_Z, LADO - COLUMNA_Z, yb, yb + VISION, [PARTELUZ, null]);
      poner(piezas, areas, 'metalZ', cara, COLUMNA_Z, LADO - COLUMNA_Z, yb + VISION, yb + ENTREPISO, [PARTELUZ, null]);
    }
    sumar(areas, cara.id, 'Concrete', 2 * COLUMNA_Z * ALTO);
  }
  return piezas;
}

function columnasZ(grupo, M, centro, K) {
  const d = (LADO - COLUMNA_Z) / 2;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(COLUMNA_Z * K, ALTO * K, COLUMNA_Z * K), M.concretoColumna);
    c.position.set(centro.x + sx * d * K, centro.y + (ALTO / 2) * K, centro.z + sz * d * K);
    c.name = 'Building_Z_columna';
    grupo.add(c);
  }
}

const COLOR_AZOTEA = '#cfcdc7';
const SATURACION = 0.35;
const A_GRISES = `gl_FragColor.rgb = mix(vec3(dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722))), gl_FragColor.rgb, ${SATURACION.toFixed(2)});
#include <dithering_fragment>`;
function enGrises(escena) {
  const hechos = new Set();
  escena.traverse((o) => {
    for (const m of [].concat(o.material ?? [])) {
      if (hechos.has(m) || m.isShaderMaterial) continue;
      hechos.add(m);
      const previo = m.onBeforeCompile, clave = m.customProgramCacheKey;
      m.onBeforeCompile = (s, r) => {
        previo?.call(m, s, r);
        s.fragmentShader = s.fragmentShader.replace('#include <dithering_fragment>', A_GRISES);
      };
      m.customProgramCacheKey = () => `${clave.call(m)}|grises`;
      m.needsUpdate = true;
    }
  });
}

const NOMBRE_CARA = { N: 'North', E: 'East', S: 'South', W: 'West' }, ORDEN = ['Concrete', 'Metal', 'Glass', 'Paint'];
const PUNTO_PX = 12, SOBRE_PX = 14, SEPARA_M = 2;
function texturaPunto() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.beginPath(); g.arc(32, 32, 26, 0, 2 * Math.PI);
  g.fillStyle = '#ffffff'; g.fill();
  g.lineWidth = 9; g.strokeStyle = 'rgba(40, 48, 62, 0.9)'; g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function redondear(p) {
  const claves = ORDEN.filter((k) => p[k] > 0);
  const base = Object.fromEntries(claves.map((k) => [k, Math.floor(p[k])]));
  let falta = 100 - claves.reduce((s, k) => s + base[k], 0);
  for (const k of [...claves].sort((a, b) => (p[b] - base[b]) - (p[a] - base[a]))) if (falta-- > 0) base[k]++;
  return base;
}
function puntosCaras(grupo, cual, cs, centro, K, porCara) {
  const lista = cs.map((cara) => ({
    cual, cara: cara.id, n: cara.normal, pct: porCara[cara.id],
    punto: centro.clone().addScaledVector(cara.normal, (LADO / 2 + SEPARA_M) * K).add(new THREE.Vector3(0, (ALTO / 2) * K, 0)),
    muestras: Array.from({ length: 24 }, (_, q) => cara.origen.clone()
      .addScaledVector(cara.eje, (((q % 6) + 0.5) / 6) * LADO * K).add(new THREE.Vector3(0, ((Math.floor(q / 6) + 0.5) / 4) * ALTO * K, 0))),
  }));
  const techo = { cual, cara: 'R', techo: true, alto: ALTO, n: new THREE.Vector3(0, 1, 0), pct: { Concrete: 100 },
    punto: centro.clone().add(new THREE.Vector3(0, (AZOTEA + 2.6 + SEPARA_M) * K, 0)) };
  const material = new THREE.PointsMaterial({ size: PUNTO_PX, sizeAttenuation: false, map: texturaPunto(), transparent: true,
    alphaTest: 0.4, toneMapped: false });
  const nube = (ps, nombre) => {
    const p = new THREE.Points(new THREE.BufferGeometry()
      .setAttribute('position', new THREE.Float32BufferAttribute(ps.flatMap((x) => x.punto.toArray()), 3)), material);
    p.name = nombre;
    p.renderOrder = 11;
    grupo.add(p);
    return p;
  };
  nube(lista, `${grupo.name}_puntos`);
  techo.nube = nube([techo], `${grupo.name}_punto_techo`);
  techo.nube.visible = false;
  return [...lista, techo];
}
function tarjetaCaras(lienzo, camara, controles, lista, visible, conT) {
  const t = document.createElement('div');
  t.className = 'tarjeta-edificio tarjeta-semantica';
  Object.assign(t.style, { position: 'fixed', zIndex: 31, display: 'none' });
  document.body.append(t);
  const ocultar = () => { t.style.display = 'none'; };
  const v = new THREE.Vector3(), aCam = new THREE.Vector3();
  let abierta = null;
  const llenar = (p) => {
    const valores = redondear(p.pctTarjeta ?? p.pct), colores = COLOR_MATERIAL[p.cual];
    const mats = ORDEN.filter((k) => valores[k] !== undefined);
    const T = conT() && p.T ? mats.filter((k) => Number.isFinite(p.T[k])) : [];
    const sub = (k) => (p.techo ? 'roof' : k.toLowerCase());
    const filas = T.length
      ? `<div class="sem-filas sem-filas-t">${T.map((k) => `<span><i style="background:${colores[k]}"></i><em>T<sub>${sub(k)}</sub></em></span>`
        + `<span>${p.T[k].toFixed(1)} °C</span><span>${valores[k]}&nbsp;%</span>`).join('')}</div>`
      : `<div class="sem-filas">${mats.map((k) => `<span><i style="background:${colores[k]}"></i>${k}</span><span>${valores[k]}&nbsp;%</span>`).join('')}</div>`;
    t.innerHTML = `<p class="tarjeta-edificio-nombre">Building ${p.cual.toUpperCase()} · ${p.techo ? 'Roof' : `${NOMBRE_CARA[p.cara]} Face`}</p>`
      + `<div class="sem-barra">${mats.map((k) => `<i style="width:${valores[k]}%;background:${colores[k]}"></i>`).join('')}</div>`
      + filas;
  };
  lienzo.addEventListener('pointermove', (ev) => {
    const r = lienzo.getBoundingClientRect();
    let mejor = null, d2min = SOBRE_PX * SOBRE_PX;
    for (const p of lista) {
      if (!visible(p.cual) || (p.techo && !p.nube.visible)) continue;
      if (!p.techo && aCam.subVectors(camara.position, p.punto).dot(p.n) <= 0) continue;
      v.copy(p.punto).project(camara);
      if (v.z > 1 || v.z < -1) continue;
      const x = r.left + ((v.x + 1) / 2) * r.width, y = r.top + ((1 - v.y) / 2) * r.height;
      const d2 = (x - ev.clientX) ** 2 + (y - ev.clientY) ** 2;
      if (d2 <= d2min) { d2min = d2; mejor = { p, x, y }; }
    }
    abierta = mejor?.p ?? null;
    if (!mejor) { ocultar(); return; }
    ev.tarjetaCara = true;
    window.climatec.suelo?.ocultarTarjeta?.();
    llenar(mejor.p);
    t.style.display = 'block';
    const w = t.offsetWidth, h = t.offsetHeight;
    let y = mejor.y - h - 12;
    if (y < 6) y = Math.min(mejor.y + 14, innerHeight - h - 6);
    t.style.translate = '0 0';
    t.style.left = `${Math.max(6, Math.min(mejor.x - w / 2, innerWidth - w - 6))}px`;
    t.style.top = `${Math.max(6, y)}px`;
  });
  const cerrar = () => { abierta = null; ocultar(); };
  lienzo.addEventListener('pointerleave', cerrar);
  controles.addEventListener('change', cerrar);
  return () => { if (abierta && t.style.display !== 'none') llenar(abierta); };
}

function sincronizarCamara(camara, controles, cual) {
  if (parent === window) return;
  const estado = () => [...camara.position.toArray(), ...camara.quaternion.toArray(), ...controles.target.toArray()];
  const clave = (e) => e.map((v) => v.toFixed(4)).join(',');
  let ultimo = clave(estado());
  addEventListener('message', (ev) => {
    if (ev.origin !== location.origin || ev.data?.tipo !== 'climatec-caso-camara') return;
    const e = ev.data.estado;
    camara.position.fromArray(e, 0);
    camara.quaternion.fromArray(e, 3);
    controles.target.fromArray(e, 7);
    camara.updateMatrixWorld();
    ultimo = clave(estado());
    controles.dispatchEvent({ type: 'change' });
  });
  const vigilar = () => {
    const e = estado(), k = clave(e);
    if (k !== ultimo) {
      ultimo = k;
      parent.postMessage({ tipo: 'climatec-caso-camara', edificio: cual, estado: e }, location.origin);
    }
    requestAnimationFrame(vigilar);
  };
  requestAnimationFrame(vigilar);
}

function sincronizarCursor(lienzo, cual) {
  if (parent === window) return;
  let aqui = false;
  const avisar = (ev, fuera) => {
    if (!ev.isTrusted) return;
    aqui = !fuera;
    const r = lienzo.getBoundingClientRect();
    parent.postMessage({ tipo: 'climatec-caso-cursor', edificio: cual, fuera,
      x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height }, location.origin);
  };
  lienzo.addEventListener('pointermove', (ev) => avisar(ev, false));
  lienzo.addEventListener('pointerleave', (ev) => avisar(ev, true));
  addEventListener('message', (ev) => {
    if (ev.origin !== location.origin || ev.data?.tipo !== 'climatec-caso-cursor' || aqui) return;
    const r = lienzo.getBoundingClientRect();
    lienzo.dispatchEvent(new PointerEvent(ev.data.fuera ? 'pointerleave' : 'pointermove',
      { clientX: r.left + ev.data.x * r.width, clientY: r.top + ev.data.y * r.height, pointerType: 'mouse' }));
  });
}

function proporciones(areas) {
  return Object.fromEntries(Object.entries(areas).map(([cara, a]) => {
    const total = Object.values(a).reduce((s, v) => s + v, 0);
    return [cara, Object.fromEntries(Object.entries(a).map(([m, v]) => [m, (100 * v) / total]))];
  }));
}

function materiales() {
  const t = Object.fromEntries(Object.entries(TEXTURAS).map(([k, f]) => [k, f()]));
  const opaco = (map, extra) => new THREE.MeshPhysicalMaterial({ map, side: THREE.DoubleSide, ...extra });
  const vidrio = (map) => new THREE.MeshPhysicalMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    roughness: 0.04, metalness: 0.1, envMapIntensity: 1.6 });
  t.piso.repeat.set(LADO / 0.6, LADO / 0.6);
  t.plafon.repeat.set(LADO / 2.4, LADO / 2.4);
  return {
    concreto: opaco(t.concreto, { roughness: 0.92 }),
    pintura: opaco(t.pintura, { roughness: 0.78 }),
    metalX: opaco(t.metalX, { roughness: 0.32, metalness: 0.7 }),
    ventanaX: vidrio(t.ventanaX),
    vidrioZ: vidrio(t.vidrioZ),
    supervidrio: vidrio(t.supervidrio),
    concretoColumna: opaco((() => { const c = TEXTURAS.concreto(); c.repeat.set(COLUMNA_Z / 1.8, ALTO / 1.8); return c; })(),
      { roughness: 0.92 }),
    metalZ: opaco(t.metalZ, { roughness: 0.3, metalness: 0.75 }),
    piso: new THREE.MeshPhysicalMaterial({ map: t.piso, roughness: 0.7 }),
    plafon: new THREE.MeshPhysicalMaterial({ map: t.plafon, roughness: 0.9 }),
    losa: new THREE.MeshPhysicalMaterial({ color: '#b5b2ab', roughness: 0.95 }),
    azotea: new THREE.MeshPhysicalMaterial({ color: COLOR_AZOTEA, roughness: 0.95 }),
    columna: new THREE.MeshPhysicalMaterial({ color: '#dedcd7', roughness: 0.85 }),
    nucleo: new THREE.MeshPhysicalMaterial({ color: '#a8a59f', roughness: 0.92 }),
    equipo: new THREE.MeshPhysicalMaterial({ color: '#e1e1dd', roughness: 0.6, metalness: 0.2 }),
  };
}

function interior(grupo, M, centro, K, techo) {
  const Li = (LADO - 0.1) * K;
  const caja = (ancho, alto, largo, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ancho * K, alto * K, largo * K), mat);
    m.position.set(centro.x + x * K, centro.y + y * K, centro.z + z * K);
    grupo.add(m);
    return m;
  };
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(Li, Li).rotateX(-Math.PI / 2), M.piso);
  suelo.position.set(centro.x, centro.y + 0.03 * K, centro.z);
  grupo.add(suelo);
  for (let n = 0; n < NIVELES; n++) {
    const y0 = n * ENTREPISO + techo, y1 = n < NIVELES - 1 ? (n + 1) * ENTREPISO : AZOTEA;
    const lados = M.losa;
    const losa = new THREE.Mesh(new THREE.BoxGeometry(Li, (y1 - y0) * K, Li),
      [lados, lados, n < NIVELES - 1 ? M.piso : M.azotea, M.plafon, lados, lados]);
    losa.position.set(centro.x, centro.y + ((y0 + y1) / 2) * K, centro.z);
    if (n === NIVELES - 1) losa.name = `${grupo.name}_azotea`;
    grupo.add(losa);
  }
  for (const x of COLUMNAS) for (const z of COLUMNAS) caja(0.5, AZOTEA, 0.5, x, AZOTEA / 2, z, M.columna);
  caja(NUCLEO, AZOTEA + 2.6, NUCLEO, 0, (AZOTEA + 2.6) / 2, 0, M.nucleo);
  const e = 0.3, p = ALTO - AZOTEA, d = LADO / 2 - 0.05 - e / 2;
  for (const [nx, nz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    caja(nx ? e : LADO - 0.1, p, nz ? e : LADO - 0.1, nx * d, AZOTEA + p / 2, nz * d, M.azotea);
  }
  for (const [x, z, a, l, h] of [[10, -9, 4, 3, 1.6], [10, -2, 4, 3, 1.6], [-10, 9, 3, 2, 1.2], [-11, -10, 5, 3, 1.4]]) {
    caja(a, h, l, x, AZOTEA + h / 2, z, M.equipo);
  }
}

function vegetacion(cs, centro, K, pasto) {
  const g = new THREE.Group();
  g.name = 'Vegetacion_Caso';
  const verde = materialPasto(pasto);
  const pared = materialPasto(pasto);
  const previo = pared.onBeforeCompile;
  pared.side = THREE.DoubleSide;
  pared.onBeforeCompile = (sh, r) => {
    previo.call(pared, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('diffuseColor.rgb = colorPasto(pB);',
      `vec3 base = colorPasto(pB), lum = vec3(0.3, 0.6, 0.1);
  diffuseColor.rgb = base * clamp(pow(dot(colorPasto(pB * 14.0), lum) / max(dot(base, lum), 0.02), 1.8), 0.45, 1.6);`);
  };
  pared.customProgramCacheKey = () => 'climatec-pared-verde';
  const h = LADO / 2, a = h + PASTO_M, p = PASILLO_M / 2;
  const tiras = [[-a, a, -a, -h], [-a, a, h, a], [h, a, -h, h], [-a, -h, -h, -p], [-a, -h, p, h]].map(([x0, x1, z0, z1]) => {
    const q = new THREE.PlaneGeometry((x1 - x0) * K, (z1 - z0) * K).rotateX(-Math.PI / 2);
    return q.translate(centro.x + ((x0 + x1) / 2) * K, centro.y + 0.1 * K, centro.z + ((z0 + z1) / 2) * K);
  });
  g.add(new THREE.Mesh(mergeGeometries(tiras), verde));
  const bandas = [];
  for (const cara of cs.filter((c) => c.id === 'W' || c.id === 'S')) {
    const fuera = { ...cara, origen: cara.origen.clone().addScaledVector(cara.normal, VERDE_SEPARA_M * K) };
    for (let n = 0; n < NIVELES; n++) bandas.push(cuadro(fuera, 0, LADO, n * ENTREPISO + TECHO_X, (n + 1) * ENTREPISO, [4, 4]));
  }
  g.add(new THREE.Mesh(mergeGeometries(bandas), pared));
  return g;
}

function construir(georef, y0, pasto) {
  const K = georef.k;
  const centro = georef.desdeLonLat(SITIO.lon, SITIO.lat, y0);
  const cs = caras(centro, K);
  const M = materiales();
  const edificio = (nombre, piezas, techo) => {
    const g = new THREE.Group();
    g.name = nombre;
    for (const [mat, geos] of Object.entries(piezas)) {
      const malla = new THREE.Mesh(mergeGeometries(geos), M[mat]);
      malla.name = `${nombre}_${mat}`;
      malla.renderOrder = M[mat].transparent ? 2 : 0;
      g.add(malla);
    }
    interior(g, M, centro, K, techo);
    g.updateMatrixWorld(true);
    return g;
  };
  const areasX = {}, areasZ = {};
  const x = edificio('Building_X', fachadaX(cs, areasX), TECHO_X);
  const z = edificio('Building_Z', fachadaZ(cs, areasZ), VISION);
  columnasZ(z, M, centro, K);
  if (VERDE) for (const g of [x, z]) g.add(vegetacion(cs, centro, K, pasto));
  const prop = { x: proporciones(areasX), z: proporciones(areasZ) };
  const puntos = [...puntosCaras(x, 'x', cs, centro, K, prop.x), ...puntosCaras(z, 'z', cs, centro, K, prop.z)];
  const sumaX = {};
  for (const a of Object.values(areasX)) for (const [m, v] of Object.entries(a)) sumaX[m] = (sumaX[m] ?? 0) + v;
  const totalAreaX = Object.values(sumaX).reduce((s, v) => s + v, 0);
  const totalX = Object.fromEntries(Object.entries(sumaX).map(([m, v]) => [m, (100 * v) / totalAreaX]));
  for (const p of puntos) if (p.cual === 'x' && !p.techo) p.pctTarjeta = totalX;
  return { centro, L: LADO * K, H: ALTO * K, x, z, proporciones: prop, puntos };
}

function quitarArboles(bosque, centro, L, margen) {
  const m = new THREE.Matrix4();
  let quitados = 0;
  for (const e of bosque.especies) {
    const geo = e.lods[0].instancias[0].geometry;
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    const radio = ((b.max.x - b.min.x) + (b.max.z - b.min.z)) / 4;
    for (let i = e.inicio; i < e.inicio + e.cantidad; i++) {
      m.fromArray(bosque.matrices, i * 16);
      const x = bosque.centros[i * 3], z = bosque.centros[i * 3 + 2];
      const dx = Math.max(Math.abs(x - centro.x) - L / 2, 0), dz = Math.max(Math.abs(z - centro.z) - L / 2, 0);
      if (Math.hypot(dx, dz) < radio * m.getMaxScaleOnAxis() + margen) {
        bosque.centros[i * 3 + 1] = -1e7;
        bosque.radios[i] = 0;
        quitados++;
      }
    }
  }
  return quitados;
}

const RECORTE = { E0: 370442.1, E1: 370662.1, N0: 2837422.9, N1: 2837622.9 };
const MATERIAL_FUERA = /^(CASAS_|OXXO_)/;
const FONDO_CASO = '#c6c9ce';

const NO_TAPAR = /Reja|Luminaria|Poste|Tubular|Semaforo|Senal|Letrero|Arbol|Calle|Piso|Pasto|Banqueta/i;

function tapas(mallas, esquinas, k, base) {
  const paso = 0.5 * k, minimo = base + 0.5 * k, pos = [], v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], cruce = [];
  const medio = esquinas.reduce((s, e) => s.add(e), new THREE.Vector3()).multiplyScalar(0.25);
  const cajas = mallas.map((o) => new THREE.Box3().setFromObject(o));
  for (let i = 0; i < 4; i++) {
    const p = esquinas[i], dir = esquinas[(i + 1) % 4].clone().sub(p), largo = dir.length();
    dir.divideScalar(largo);
    const n = new THREE.Vector3(-dir.z, 0, dir.x), nb = Math.ceil(largo / paso);
    const adentro = n.clone().multiplyScalar(n.dot(medio.clone().sub(p)) < 0 ? -0.02 * k : 0.02 * k);
    const arriba = new Float32Array(nb).fill(-Infinity);
    const lado = (q) => (q.x - p.x) * n.x + (q.z - p.z) * n.z, u = (q) => (q.x - p.x) * dir.x + (q.z - p.z) * dir.z;
    mallas.forEach((o, m) => {
      const { min, max } = cajas[m];
      const s = [[min.x, min.z], [max.x, min.z], [min.x, max.z], [max.x, max.z]].map(([x, z]) => (x - p.x) * n.x + (z - p.z) * n.z < 0);
      if (s.every(Boolean) || !s.some(Boolean)) return;
      const atr = o.geometry.attributes.position, idx = o.geometry.index, total = idx ? idx.count : atr.count;
      for (let t = 0; t < total; t += 3) {
        for (let j = 0; j < 3; j++) v[j].fromBufferAttribute(atr, idx ? idx.getX(t + j) : t + j).applyMatrix4(o.matrixWorld);
        const d = v.map(lado);
        cruce.length = 0;
        for (let j = 0; j < 3; j++) {
          const j2 = (j + 1) % 3;
          if ((d[j] < 0) === (d[j2] < 0)) continue;
          const f = d[j] / (d[j] - d[j2]);
          cruce.push([u(v[j]) + (u(v[j2]) - u(v[j])) * f, v[j].y + (v[j2].y - v[j].y) * f]);
        }
        if (cruce.length < 2) continue;
        const [[u0, y0], [u1, y1]] = cruce[0][0] <= cruce[1][0] ? cruce : [cruce[1], cruce[0]];
        if (u1 < 0 || u0 > largo) continue;
        for (let b = Math.max(0, Math.floor(u0 / paso)); b <= Math.min(nb - 1, Math.floor(u1 / paso)); b++) {
          if (u1 > u0) {
            for (const uu of [Math.max(u0, b * paso), Math.min(u1, (b + 1) * paso)]) arriba[b] = Math.max(arriba[b], y0 + ((y1 - y0) * (uu - u0)) / (u1 - u0));
          } else arriba[b] = Math.max(arriba[b], y0, y1);
        }
      }
    });
    for (let b = 0; b < nb; b++) {
      if (!(arriba[b] > minimo)) continue;
      const a = p.clone().addScaledVector(dir, b * paso).add(adentro), c = p.clone().addScaledVector(dir, Math.min((b + 1) * paso, largo)).add(adentro);
      pos.push(a.x, base, a.z, c.x, base, c.z, c.x, arriba[b], c.z, a.x, base, a.z, c.x, arriba[b], c.z, a.x, arriba[b], a.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#b9bec6', roughness: 1, metalness: 0, side: THREE.DoubleSide }));
}

function losa(esquinas, k, base) {
  const medio = esquinas.reduce((s, e) => s.add(e), new THREE.Vector3()).multiplyScalar(0.25);
  const e = esquinas.map((q) => q.clone().add(medio.clone().sub(q).setLength(0.03 * k)));
  const y0 = base - 2.5 * k, y1 = base - 0.02 * k, pos = [];
  for (let i = 0; i < 4; i++) {
    const a = e[i], b = e[(i + 1) % 4];
    pos.push(a.x, y0, a.z, b.x, y0, b.z, b.x, y1, b.z, a.x, y0, a.z, b.x, y1, b.z, a.x, y1, a.z);
  }
  pos.push(e[0].x, y0, e[0].z, e[1].x, y0, e[1].z, e[2].x, y0, e[2].z, e[0].x, y0, e[0].z, e[2].x, y0, e[2].z, e[3].x, y0, e[3].z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#b5bbc3', roughness: 1, metalness: 0, side: THREE.DoubleSide }));
}

function recortarEscena(escena, georef, centro, bosque, nivelSuelo) {
  const utm = (x, z) => { const d = georef.describir(new THREE.Vector3(x, 0, z)); return [d.e, d.n]; };
  const [e0, n0] = utm(centro.x, centro.z), [e1, n1] = utm(centro.x + 100, centro.z), [e2, n2] = utm(centro.x, centro.z + 100);
  const a = (e1 - e0) / 100, b = (e2 - e0) / 100, c = (n1 - n0) / 100, d = (n2 - n0) / 100, det = a * d - b * c;
  const aEscena = (E, N) => new THREE.Vector3(centro.x + (d * (E - e0) - b * (N - n0)) / det, 0, centro.z + (a * (N - n0) - c * (E - e0)) / det);
  const R = RECORTE;
  const esquinas = [aEscena(R.E0, R.N0), aEscena(R.E1, R.N0), aEscena(R.E1, R.N1), aEscena(R.E0, R.N1)];
  const medio = esquinas.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(0.25);
  const planos = esquinas.map((p, i) => {
    const q = esquinas[(i + 1) % 4];
    const n = new THREE.Vector3(q.z - p.z, 0, p.x - q.x).normalize();
    if (n.dot(medio.clone().sub(p)) < 0) n.negate();
    return new THREE.Plane().setFromNormalAndCoplanarPoint(n, p);
  });
  const caja = new THREE.Box3().setFromPoints(esquinas);
  caja.min.y = -Infinity;
  caja.max.y = Infinity;
  const v = new THREE.Vector3(), b3 = new THREE.Box3();
  const fuera = (x, z, margen = 0) => planos.some((pl) => pl.distanceToPoint(v.set(x, 0, z)) < -margen);
  const materiales = (o) => (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean);
  window.climatec.renderer.clippingPlanes = planos;
  const cortados = [], ocultos = new Set();
  let raiz = escena.getObjectByName('Calles_Asfalto');
  while (raiz && raiz.parent !== escena) raiz = raiz.parent;
  if (raiz) {
    raiz.updateMatrixWorld(true);
    raiz.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh) return;
      b3.setFromObject(o);
      if (!b3.intersectsBox(caja) || materiales(o).some((m) => MATERIAL_FUERA.test(m.name ?? ''))) {
        o.visible = false;
        o.geometry?.dispose();
        ocultos.add(o);
        return;
      }
      const { min, max } = b3;
      if (fuera(min.x, min.z) || fuera(max.x, min.z) || fuera(min.x, max.z) || fuera(max.x, max.z)) {
        for (const m of materiales(o)) m.clippingPlanes = planos;
        if (!NO_TAPAR.test(o.name)) cortados.push(o);
      }
    });
  }
  const detalles = window.climatec.detalles ?? [];
  for (let i = detalles.length - 1; i >= 0; i--) if (ocultos.has(detalles[i].malla)) detalles.splice(i, 1);
  if (cortados.length) escena.add(tapas(cortados, esquinas, georef.k, nivelSuelo));
  escena.add(losa(esquinas, georef.k, nivelSuelo));
  if (bosque) for (const e of bosque.especies) for (const l of e.lods) for (const ins of l.instancias) for (const m of materiales(ins)) m.clippingPlanes = planos;
  return () => {
    escena.traverse((o) => { if (o.isMesh && (o.material?.uniforms?.cenit || o.geometry?.parameters?.width === 60000)) o.visible = false; });
    if (!bosque) return;
    for (let i = 0; i < bosque.radios.length; i++) {
      if (bosque.radios[i] > 0 && fuera(bosque.centros[i * 3], bosque.centros[i * 3 + 2], -bosque.radios[i])) {
        bosque.centros[i * 3 + 1] = -1e7;
        bosque.radios[i] = 0;
      }
    }
    window.climatec.calidad = window.climatec.calidad;
  };
}

function irAlEdificio(vista, camara, controles, pedirRender, ms = 900) {
  if (ms <= 0) {
    camara.position.copy(vista.posicion); controles.target.copy(vista.objetivo); controles.update(); pedirRender();
    return;
  }
  const p0 = camara.position.clone(), t0 = controles.target.clone(), inicio = performance.now();
  const paso = (ahora) => {
    const s = Math.min((ahora - inicio) / ms, 1), e = s * s * (3 - 2 * s);
    camara.position.lerpVectors(p0, vista.posicion, e);
    controles.target.lerpVectors(t0, vista.objetivo, e);
    controles.update();
    pedirRender();
    if (s < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

const deseado = PARAMETRO === 'z' ? 'z' : 'x';
let mostrar = null;

async function iniciar() {
  const { escena, camara, lienzo, georef, bosque, nivelSuelo, pedirRender } = await listo;
  if (!new URLSearchParams(location.search).has('rom')) crearCielo(escena, nivelSuelo).poner('tarde');
  enGrises(escena);
  const pasto = VERDE ? (await fetch('modelo/escena.json').then((r) => r.json())).pasto : null;
  const ed = construir(georef, nivelSuelo, pasto);
  escena.add(ed.x, ed.z);
  const quitados = bosque ? quitarArboles(bosque, ed.centro, ed.L, 0.5 * georef.k) : 0;
  const recortarDespues = recortarEscena(escena, georef, ed.centro, bosque, nivelSuelo);
  window.climatec.renderer.localClippingEnabled = true;
  window.climatec.renderer.setClearColor(FONDO_CASO, 1);
  let intentos = 0;
  const sinCielo = () => {
    let hallados = 0;
    escena.traverse((o) => {
      if (!o.isMesh || !(o.material?.uniforms?.cenit || o.geometry?.parameters?.width === 60000)) return;
      hallados++;
      if (o.visible) { o.visible = false; pedirRender(); }
    });
    if (hallados < 2 && ++intentos < 1500) setTimeout(sinCielo, 200);
  };
  sinCielo();
  if (new URLSearchParams(location.search).has('rom')) {
    (async () => {
      while (!window.climatec.rom) await new Promise((r) => setTimeout(r, 300));
      recortarDespues();
      pedirRender();
    })();
  } else recortarDespues();
  pedirRender();
  mostrar = (cual) => { ed.x.visible = cual === 'x'; ed.z.visible = cual === 'z'; pedirRender(); };
  mostrar(deseado);
  const K = georef.k, en = (v) => ed.centro.clone().add(new THREE.Vector3(...v).multiplyScalar(K));
  const vista = { objetivo: en(VISTA.objetivo), posicion: en(VISTA.camara) };
  const { controles } = window.climatec;
  const ir = (ms) => irAlEdificio(vista, camara, controles, pedirRender, ms);
  ir(0);
  if (new URLSearchParams(location.search).has('rom')) addEventListener('climatec-rom-campo', () => ir(0), { once: true });
  document.querySelector('[data-accion="inicio"]')?.addEventListener('click', (ev) => { ev.stopImmediatePropagation(); ir(); }, true);
  addEventListener('keydown', (ev) => {
    if (!['KeyH', 'KeyP'].includes(ev.code) || ev.target.closest?.('input, textarea, select')) return;
    ev.stopImmediatePropagation();
    if (ev.code === 'KeyH') ir();
  }, true);
  document.querySelector('[data-accion="recorrido"]')?.remove();
  let conT = false;
  const rehacer = tarjetaCaras(lienzo, camara, controles, ed.puntos, (cual) => ed[cual].visible, () => conT);
  addEventListener('message', (ev) => {
    if (ev.origin !== location.origin || ev.data?.tipo !== 'climatec-semantica') return;
    conT = !!ev.data.activo;
    for (const p of ed.puntos) if (p.techo) p.nube.visible = conT;
    rehacer();
    pedirRender();
  });
  addEventListener('climatec-caras-calculadas', rehacer);
  sincronizarCamara(camara, controles, deseado);
  sincronizarCursor(lienzo, deseado);
  window.climatec.casoEstudio = { x: ed.x, z: ed.z, centro: ed.centro, arbolesQuitados: quitados, mostrar, irAlEdificio: ir,
    proporciones: ed.proporciones, puntos: ed.puntos, colores: COLOR_MATERIAL, colorAzotea: COLOR_AZOTEA };
}

if (ACTIVO) iniciar().catch(console.error);
