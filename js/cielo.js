import * as THREE from 'three';

export const CIELOS = {
  dia:   { cenit: '#3d9bf5', horizonte: '#bfe0ff', estrellas: 0, nubes: 0 },
  tarde: { cenit: '#6691ff', horizonte: '#9ecaff', estrellas: 0, nubes: 1 },
  noche: { cenit: '#010206', horizonte: '#0a1124', estrellas: 1, nubes: 0 },
};
const NIEBLA_M = [1800, 8000];
const COLOR_SUELO_EXTERIOR = '#c3cbd2';
const HORAS = { dia: [7, 12], tarde: [13, 18] };

export function tipoPorHora(h) {
  if (h >= HORAS.dia[0] && h <= HORAS.dia[1]) return 'dia';
  if (h >= HORAS.tarde[0] && h <= HORAS.tarde[1]) return 'tarde';
  return 'noche';
}

export function crearCielo(escena, nivelSuelo) {
  const material = new THREE.ShaderMaterial({
    uniforms: { cenit: { value: new THREE.Color() }, horizonte: { value: new THREE.Color() }, estrellas: { value: 0 },
      nubes: { value: 0 } },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 cenit, horizonte;
      uniform float estrellas, nubes;
      varying vec3 vDir;
      float azar(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float azar2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float ruido(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(azar2(i), azar2(i + vec2(1.0, 0.0)), f.x), mix(azar2(i + vec2(0.0, 1.0)), azar2(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float s = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { s += a * ruido(p); p = p * 2.03 + 17.0; a *= 0.5; }
        return s;
      }
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = mix(horizonte, cenit, pow(smoothstep(0.0, 0.75, max(d.y, 0.0)), 0.7));
        if (nubes > 0.0 && d.y > 0.0) {
          float h = d.y;
          float n = fbm(d.xz / (h + 0.18) * 1.4);
          float nube = smoothstep(0.5, 0.75, n) * smoothstep(0.0, 0.15, h) * nubes;
          vec3 blanco = mix(vec3(0.80, 0.86, 0.95), vec3(1.0), smoothstep(0.55, 0.8, n));
          c = mix(c, blanco, nube);
        }
        if (estrellas > 0.0 && d.y > 0.0) {
          vec3 p = d * 75.0;
          vec3 id = floor(p);
          if (azar(id) > 0.86) {
            vec3 centro = normalize(id + 0.5 + (vec3(azar(id + 3.1), azar(id + 7.7), azar(id + 1.9)) - 0.5) * 0.7) * 75.0;
            float r = 0.05 + 0.06 * azar(id + 11.3);
            float s = smoothstep(r, r * 0.2, length(p - centro));
            s *= smoothstep(0.02, 0.12, d.y);
            c = mix(c, vec3(1.0, 0.98, 0.92), s * (0.55 + 0.45 * azar(id + 5.0)) * estrellas);
          }
        }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
  });
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), material);
  esfera.renderOrder = -10;
  esfera.frustumCulled = false;
  esfera.onBeforeRender = (_r, _s, cam) => { esfera.position.copy(cam.position); esfera.updateMatrixWorld(); };
  escena.add(esfera);
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: COLOR_SUELO_EXTERIOR, roughness: 1, specularIntensity: 0 }),
  );
  suelo.position.y = nivelSuelo - 0.25;
  suelo.updateMatrix();
  suelo.matrixAutoUpdate = false;
  escena.add(suelo);
  escena.fog = new THREE.Fog(CIELOS.dia.horizonte, ...NIEBLA_M);
  return {
    tipo: null,
    poner(tipo) {
      const c = CIELOS[tipo];
      material.uniforms.cenit.value.set(c.cenit);
      material.uniforms.horizonte.value.set(c.horizonte);
      escena.fog.color.set(c.horizonte);
      material.uniforms.estrellas.value = c.estrellas;
      material.uniforms.nubes.value = c.nubes;
      this.tipo = tipo;
    },
  };
}

const HORA_MONTERREY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Monterrey', hour: 'numeric', hourCycle: 'h23' });
export function cieloEnTiempoReal(cielo, pedirRender) {
  const revisar = () => {
    const tipo = tipoPorHora(+HORA_MONTERREY.format(new Date()) % 24);
    if (tipo !== cielo.tipo) { cielo.poner(tipo); pedirRender(); }
  };
  revisar();
  setInterval(revisar, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) revisar(); });
}
