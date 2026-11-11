import * as THREE from 'three';

const GLSL_COMUN = `
varying vec3 vPosMundo;
vec3 aBlender(vec3 p) { return vec3(p.x, -p.z, p.y); }
`;

const GLSL_PISO = `
uniform vec3 uColor1, uColor2, uMortero, uColonia;
uniform float uEscala, uAncho, uAlto, uMorteroTam, uSesgo, uEmision;
uniform sampler2D uMascara;
uniform vec2 uMascaraOrigen, uMascaraTam;

float ruidoLadrillo(int n) {
  uint u = (uint(n) + 1013u) & 0x7fffffffu;
  u = (u >> 13u) ^ u;
  uint nn = (u * (u * u * 60493u + 19990303u) + 1376312589u) & 0x7fffffffu;
  return 0.5 * float(nn) / 1073741824.0;
}

float juntaFiltrada(vec2 q, vec2 w, vec2 n) {
  vec2 a = q + 0.5 * w;
  vec2 b = q - 0.5 * w;
  vec2 i = (floor(a) + min(fract(a) * n, 1.0) - floor(b) - min(fract(b) * n, 1.0)) / (n * w);
  return 1.0 - (1.0 - i.x) * (1.0 - i.y);
}

vec3 colorPiso(vec3 pb) {
  vec2 p = pb.xy * uEscala;
  vec2 tam = vec2(uAncho, uAlto);
  vec2 celda = floor(p / tam);
  int fila = int(celda.y);
  int num = int(celda.x);
  float tinte = clamp(ruidoLadrillo((fila << 16) + (num & 0xFFFF)) + uSesgo, 0.0, 1.0);

  vec2 q = (p + uMorteroTam) / tam;
  vec2 w = max(fwidth(q), vec2(1e-6));
  float junta = juntaFiltrada(q, w, tam / (2.0 * uMorteroTam));
  tinte = mix(tinte, clamp(0.5 + uSesgo, 0.0, 1.0), smoothstep(0.3, 1.0, max(w.x, w.y)));
  vec3 c = mix(mix(uColor1, uColor2, tinte), uMortero, junta);

  vec2 uvM = (pb.xy - uMascaraOrigen) / uMascaraTam;
  float dentro = step(0.0, uvM.x) * step(0.0, uvM.y) * step(uvM.x, 1.0) * step(uvM.y, 1.0);
  float campus = texture(uMascara, clamp(uvM, 0.0, 1.0)).r * dentro;
  return mix(uColonia, c, campus);
}
`;

const GLSL_PASTO = `
uniform vec3 uCalibracion;
uniform float uEscalaG, uRugosidadG, uEscalaF, uRugosidadF, uOverlay, uVoronoi;
uniform int uOctavasG, uOctavasF, uNumRampa;
uniform float uRampaPos[4];
uniform vec3 uRampaCol[4];
uniform int uEje;
uniform float uAncho, uValor;
#ifdef PASTO_LOCAL
varying vec2 vLocal;
#endif

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 gradiente(vec3 c) {
  uvec3 h = pcg3d(uvec3(ivec3(c) + 65536));
  return vec3(h & 0xffffu) / 32767.5 - 1.0;
}
float ruido(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(gradiente(i), f);
  float n100 = dot(gradiente(i + vec3(1, 0, 0)), f - vec3(1, 0, 0));
  float n010 = dot(gradiente(i + vec3(0, 1, 0)), f - vec3(0, 1, 0));
  float n110 = dot(gradiente(i + vec3(1, 1, 0)), f - vec3(1, 1, 0));
  float n001 = dot(gradiente(i + vec3(0, 0, 1)), f - vec3(0, 0, 1));
  float n101 = dot(gradiente(i + vec3(1, 0, 1)), f - vec3(1, 0, 1));
  float n011 = dot(gradiente(i + vec3(0, 1, 1)), f - vec3(0, 1, 1));
  float n111 = dot(gradiente(i + vec3(1, 1, 1)), f - vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float fbm(vec3 p, int detalle, float rug) {
  float s = 0.0, amp = 1.0, maxAmp = 0.0;
  for (int i = 0; i < 9; i++) {
    if (i > detalle) break;
    s += ruido(p) * amp;
    maxAmp += amp;
    amp *= rug;
    p *= 2.0;
  }
  return 0.5 + 0.5 * s / maxAmp;
}
vec3 rampa(float t) {
  vec3 c = uRampaCol[0];
  if (t <= uRampaPos[0]) return c;
  for (int i = 1; i < 4; i++) {
    if (i >= uNumRampa) break;
    if (t <= uRampaPos[i]) {
      return mix(uRampaCol[i - 1], uRampaCol[i], (t - uRampaPos[i - 1]) / max(uRampaPos[i] - uRampaPos[i - 1], 1e-5));
    }
    c = uRampaCol[i];
  }
  return c;
}
vec3 superponer(vec3 a, vec3 b, float fac) {
  vec3 bajo = a * ((1.0 - fac) + 2.0 * fac * b);
  vec3 alto = 1.0 - ((1.0 - fac) + 2.0 * fac * (1.0 - b)) * (1.0 - a);
  return mix(alto, bajo, step(a, vec3(0.5)));
}
vec3 colorPasto(vec3 p) {
  vec3 pg = p * uEscalaG;
  vec3 pf = p * uEscalaF;
  float huellaG = length(fwidth(pg));
  float huellaF = length(fwidth(pf));
  float t = mix(fbm(pg, uOctavasG, uRugosidadG), 0.5, smoothstep(0.35, 1.2, huellaG));
  vec3 c = rampa(t);
  float fino = 0.5;
  if (huellaF < 1.2) fino = mix(fbm(pf, uOctavasF, uRugosidadF), 0.5, smoothstep(0.35, 1.2, huellaF));
  c = superponer(c, vec3(fino), uOverlay);
  return c * (1.0 - 0.5 * uVoronoi) * uCalibracion;
}
`;

function inyectarVertice(src, local) {
  return src
    .replace('#include <common>', `#include <common>
varying vec3 vPosMundo;
${local ? 'attribute vec2 uvLocal;\nvarying vec2 vLocal;' : ''}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
vPosMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;
${local ? 'vLocal = uvLocal;' : ''}`);
}

const color = (c) => new THREE.Color(c[0], c[1], c[2]);

const especular = (nivel) => Math.min(1, nivel * 2);

const CALIBRACION_PASTO = [0.65, 0.70, 0.45];

export function materialPiso(p, mascara) {
  const m = new THREE.MeshPhysicalMaterial({
    name: 'Piso (shader)', roughness: p.rugosidad, metalness: 0, specularIntensity: especular(p.especular),
  });
  const uniformes = {
    uColor1: { value: color(p.color1) },
    uColor2: { value: color(p.color2) },
    uMortero: { value: color(p.color_mortero) },
    uColonia: { value: color(p.color_colonia) },
    uEscala: { value: p.escala },
    uAncho: { value: p.ancho },
    uAlto: { value: p.alto },
    uMorteroTam: { value: p.mortero_tam },
    uSesgo: { value: p.sesgo },
    uEmision: { value: p.emision },
    uMascara: { value: mascara },
    uMascaraOrigen: { value: new THREE.Vector2(...p.mascara_origen) },
    uMascaraTam: { value: new THREE.Vector2(...p.mascara_tam) },
  };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniformes);
    s.vertexShader = inyectarVertice(s.vertexShader, false);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMUN}\n${GLSL_PISO}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = colorPiso(aBlender(vPosMundo));')
      .replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  totalEmissiveRadiance = diffuseColor.rgb * uEmision;');
  };
  m.customProgramCacheKey = () => 'climatec-piso';
  return m;
}

export function materialPasto(p, cancha = null) {
  const m = new THREE.MeshPhysicalMaterial({
    name: cancha ? 'Cancha (shader)' : 'Pasto (shader)',
    roughness: p.rugosidad, metalness: 0, specularIntensity: 0,
  });
  if (cancha) m.defines.PASTO_LOCAL = '';
  const pos = [0, 0, 0, 0];
  const cols = [color([0, 0, 0]), color([0, 0, 0]), color([0, 0, 0]), color([0, 0, 0])];
  p.rampa.slice(0, 4).forEach(([t, c], i) => { pos[i] = t; cols[i] = color(c); });
  const uniformes = {
    uCalibracion: { value: new THREE.Vector3(...CALIBRACION_PASTO) },
    uEscalaG: { value: p.ruido_grande.escala },
    uOctavasG: { value: Math.round(p.ruido_grande.detalle) },
    uRugosidadG: { value: p.ruido_grande.rugosidad },
    uEscalaF: { value: p.ruido_fino.escala },
    uOctavasF: { value: Math.min(4, Math.round(p.ruido_fino.detalle)) },
    uRugosidadF: { value: p.ruido_fino.rugosidad },
    uOverlay: { value: p.overlay },
    uVoronoi: { value: p.multiplica_voronoi },
    uNumRampa: { value: Math.min(4, p.rampa.length) },
    uRampaPos: { value: pos },
    uRampaCol: { value: cols },
    uEje: { value: cancha ? cancha.eje : 0 },
    uAncho: { value: cancha ? cancha.ancho : 1 },
    uValor: { value: cancha ? cancha.valor : 1 },
  };
  const coordenadas = cancha
    ? 'vec3(vLocal.x, 1.0 - vLocal.y, 0.0)'
    : 'aBlender(vPosMundo)';
  const franjas = cancha
    ? `  float franja = mod(floor((uEje == 0 ? pB.x : pB.y) / uAncho), 2.0);
  diffuseColor.rgb *= mix(1.0, uValor, franja);`
    : '';
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniformes);
    s.vertexShader = inyectarVertice(s.vertexShader, !!cancha);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMUN}\n${GLSL_PASTO}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec3 pB = ${coordenadas};
  diffuseColor.rgb = colorPasto(pB);
${franjas}`);
  };
  m.customProgramCacheKey = () => (cancha ? 'climatec-cancha' : 'climatec-pasto');
  return m;
}
