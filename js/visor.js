import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { materialPiso, materialPasto } from './materiales.js';
import { Bosque } from './arboles.js';
import { Recorrido } from './recorrido.js';
import { Georreferencia } from './georef.js?v=20261031a';

const RUTA_MODELO = 'modelo/';
const DECODIFICADOR_DRACO = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const CON_NUBES = document.body.dataset.cielo === 'nubes';
const SIN_CIELO = document.body.dataset.cielo === 'ninguno';
const COLOR_HORIZONTE = new THREE.Color(CON_NUBES ? '#e1eefa' : '#e4ebf2');
const COLOR_CENIT = new THREE.Color(CON_NUBES ? '#8fc3ef' : '#87b4e0');
const CON_CALLES = document.body.dataset.calles === 'tec';
const CON_EDIFICIOS = document.body.dataset.edificios === 'tec';

const DETALLES = [
  [/^Reja_Metal/, 450],
  [/^Tubular_/, 300],
  [/^(Senal_|Poste_Galvanizado)/, 450],
  [/^Semaforo_/, 600],
  [/^(Luminaria_|OXXO_Letrero)/, 900],
  [/^Reja_Murete/, 1600],
];

const $ = (id) => document.getElementById(id);
const visor = $('visor');
const lienzo = $('lienzo');

const etiquetasCalles = new THREE.Group();
const ETIQUETA_ALTO_PX = 19;
const ETIQUETA_RESOLUCION = 4;
const ETIQUETA_DIST_RECORRIDO = 250;
const ESCALA_CALLES = 0.6;

const marcadoresEdificios = [];
const MARCADOR_DIST_RECORRIDO = 150;
let tarjetaEdificio = null;
let marcadorActivo = null;

const carga = {
  caja: $('carga'),
  tamanos: {},
  cargado: {},
  estado(texto, detalle = '') {
    $('carga-texto').textContent = texto;
    $('carga-detalle').textContent = detalle;
  },
  progreso(archivo, bytes) {
    this.cargado[archivo] = Math.min(bytes, this.tamanos[archivo] ?? bytes);
    const total = Object.values(this.tamanos).reduce((a, b) => a + b, 0) || 1;
    const hecho = Object.values(this.cargado).reduce((a, b) => a + b, 0);
    const pct = Math.min(100, (100 * hecho) / total);
    $('carga-progreso').style.width = `${pct.toFixed(1)}%`;
    $('carga-detalle').textContent = `${(hecho / 1e6).toFixed(1)} of ${(total / 1e6).toFixed(1)} MB`;
  },
  ocultar() { this.caja.classList.add('oculta'); },
  error(titulo, detalle) {
    this.caja.classList.remove('oculta');
    this.caja.classList.add('error');
    $('carga-texto').textContent = titulo;
    $('carga-detalle').innerHTML = detalle;
    $('carga-progreso').style.width = '0%';
  },
};

if (location.protocol === 'file:') {
  carga.error('Abre la página desde un servidor local',
    'Los navegadores bloquean la lectura de archivos con doble clic.\n' +
    'En la terminal de VS Code, dentro de la carpeta del repo:\n' +
    '<code>python -m http.server 8000 -d Web</code>\n' +
    'y abre <code>http://localhost:8000</code>');
  throw new Error('file:// no soportado');
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: lienzo,
    antialias: true,
    logarithmicDepthBuffer: true,
    powerPreference: 'high-performance',
  });
} catch (e) {
  carga.error('Tu navegador no pudo iniciar WebGL 2', 'Prueba con Chrome, Edge o Firefox actualizados.');
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.0;

const escena = new THREE.Scene();
escena.fog = SIN_CIELO ? null
  : CON_NUBES ? new THREE.Fog(COLOR_HORIZONTE, 1800, 8000) : new THREE.Fog(COLOR_HORIZONTE, 2500, 14000);
if (SIN_CIELO) renderer.setClearColor(0xeef1f5, 1);
const camara = new THREE.PerspectiveCamera(45, 1, 0.5, 30000);
camara.position.set(0, 900, 900);

const controles = new OrbitControls(camara, lienzo);
controles.enableDamping = true;
controles.dampingFactor = 0.08;
controles.zoomToCursor = true;
controles.screenSpacePanning = false;
controles.maxPolarAngle = THREE.MathUtils.degToRad(87);
controles.minDistance = 6;
controles.maxDistance = 6000;
controles.rotateSpeed = 0.6;
controles.zoomSpeed = 1.2;

const CIELO_LISO = `
  uniform vec3 cenit, horizonte;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y, 0.0, 1.0);
    gl_FragColor = vec4(mix(horizonte, cenit, pow(smoothstep(0.0, 0.75, h), 0.7)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const CIELO_NUBES = `
  uniform vec3 cenit, horizonte;
  varying vec3 vDir;
  float azar(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float ruido(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(azar(i), azar(i + vec2(1.0, 0.0)), f.x),
               mix(azar(i + vec2(0.0, 1.0)), azar(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * ruido(p); p = p * 2.03 + 17.0; a *= 0.5; }
    return s;
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = max(d.y, 0.0);
    vec3 c = mix(horizonte, cenit, smoothstep(0.0, 0.3, h));
    float n = fbm(d.xz / (h + 0.18) * 1.4);
    float nube = smoothstep(0.5, 0.75, n) * smoothstep(0.0, 0.15, h);
    vec3 blanco = mix(vec3(0.82, 0.86, 0.92), vec3(1.0), smoothstep(0.55, 0.8, n));
    gl_FragColor = vec4(mix(c, blanco, nube), 1.0);
    #include <colorspace_fragment>
  }`;

const cielo = new THREE.Mesh(
  new THREE.SphereGeometry(1000, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: {
      cenit: { value: COLOR_CENIT },
      horizonte: { value: COLOR_HORIZONTE },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: CON_NUBES ? CIELO_NUBES : CIELO_LISO,
    toneMapped: !CON_NUBES,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
  }),
);
cielo.renderOrder = -10;
cielo.frustumCulled = false;
cielo.onBeforeRender = (_r, _s, cam) => {
  cielo.position.copy(cam.position);
  cielo.updateMatrixWorld();
};
if (!SIN_CIELO) escena.add(cielo);

let datos = null;
let georef = null;
let modelo = null;
let bosque = null;
let recorrido = null;
let sueloExterior = null;
let necesitaRender = true;
let arbolesPendientes = true;
let animacion = null;
const teclas = new Set();
const detalles = [];
const pedirRender = () => { necesitaRender = true; };
controles.addEventListener('change', () => { necesitaRender = true; arbolesPendientes = true; });

async function iniciar() {
  carga.estado('Loading…');
  const respuesta = await fetch(`${RUTA_MODELO}escena.json`);
  if (!respuesta.ok) throw new Error(`No encontré ${RUTA_MODELO}escena.json (¿ya corriste exportar_modelo.py?)`);
  datos = await respuesta.json();
  carga.tamanos = { ...datos.archivos };

  const draco = new DRACOLoader().setDecoderPath(DECODIFICADOR_DRACO);
  const cargadorGLTF = new GLTFLoader().setDRACOLoader(draco);
  const avance = (archivo) => (e) => carga.progreso(archivo, e.loaded);
  carga.estado('Loading…');

  const [hdri, mascara, gltf, gltfArboles, matrices] = await Promise.all([
    new EXRLoader().loadAsync(RUTA_MODELO + 'forest.exr', avance('forest.exr')),
    new THREE.TextureLoader().loadAsync(RUTA_MODELO + 'mascara_campus.png')
      .then((t) => { carga.progreso('mascara_campus.png', Infinity); return t; }),
    cargadorGLTF.loadAsync(RUTA_MODELO + 'distrito_tec.glb', avance('distrito_tec.glb')),
    cargadorGLTF.loadAsync(RUTA_MODELO + datos.arboles.glb, avance(datos.arboles.glb)),
    new THREE.FileLoader().setResponseType('arraybuffer')
      .loadAsync(RUTA_MODELO + datos.arboles.matrices, avance(datos.arboles.matrices)),
  ]);
  carga.estado('Loading…');

  georef = new Georreferencia(gltf.asset?.extras?.georreferencia ?? datos.georreferencia);

  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromEquirectangular(hdri).texture;
  escena.environmentRotation.set(0, Math.PI, 0);
  hdri.dispose();
  pmrem.dispose();

  modelo = prepararModelo(gltf.scene, mascara);
  escena.add(modelo);

  bosque = new Bosque(gltfArboles, new Float32Array(matrices), datos.arboles);
  escena.add(bosque.grupo);

  sueloExterior = new THREE.Mesh(
    new THREE.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: '#c3cbd2', roughness: 1, specularIntensity: 0 }),
  );
  sueloExterior.position.y = datos.nivel_suelo - 0.25;
  sueloExterior.updateMatrix();
  sueloExterior.matrixAutoUpdate = false;
  if (!SIN_CIELO) escena.add(sueloExterior);

  if (CON_CALLES || CON_EDIFICIOS) {
    await Promise.all(['400 20px Poppins', '600 20px Poppins'].map((f) => document.fonts.load(f).catch(() => null)));
  }
  if (CON_CALLES) await crearEtiquetasCalles();
  if (CON_EDIFICIOS) await crearMarcadoresEdificios();

  recorrido = new Recorrido(camara, lienzo, { nivelSuelo: datos.nivel_suelo, k: georef.k });
  irAVista(datos.camara_inicial, 0);
  ajustarTamano();


  carga.estado('Loading…');
  await renderer.compileAsync(escena, camara);
  pedirRender();
  carga.ocultar();
  return { escena, camara, renderer, lienzo, georef, bosque, nivelSuelo: datos.nivel_suelo, pedirRender };
}

function texturaEtiqueta(texto) {
  const k = ETIQUETA_RESOLUCION;
  const fuente = `600 ${10 * k}px Poppins, "Segoe UI", system-ui, sans-serif`;
  const lienzoTexto = document.createElement('canvas');
  const g = lienzoTexto.getContext('2d');
  g.font = fuente;
  const borde = k;
  const alto = ETIQUETA_ALTO_PX * k;
  const ancho = Math.ceil(g.measureText(texto).width + 16 * k + 2 * borde);
  lienzoTexto.width = ancho;
  lienzoTexto.height = alto;
  g.font = fuente;
  g.beginPath();
  g.roundRect(borde / 2, borde / 2, ancho - borde, alto - borde, (alto - borde) / 2);
  g.fillStyle = 'rgba(255, 255, 255, 0.93)';
  g.fill();
  g.lineWidth = borde;
  g.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  g.stroke();
  g.fillStyle = '#000';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(texto, ancho / 2, alto / 2 + k / 2);
  const textura = new THREE.CanvasTexture(lienzoTexto);
  textura.colorSpace = THREE.SRGBColorSpace;
  return { textura, aspecto: ancho / alto };
}

async function crearEtiquetasCalles() {
  const respuesta = await fetch(`${RUTA_MODELO}calles.json`).catch(() => null);
  if (!respuesta?.ok) {
    console.warn('No encontré modelo/calles.json (corre Web/scripts/calles_tec.py)');
    return;
  }
  const { calles } = await respuesta.json();
  for (const calle of calles) {
    const { textura, aspecto } = texturaEtiqueta(calle.nombre);
    const material = new THREE.SpriteMaterial({
      map: textura, transparent: true, depthWrite: false, toneMapped: false, fog: false,
    });
    for (const [x, z] of calle.etiquetas) {
      const etiqueta = new THREE.Sprite(material);
      etiqueta.center.set(0.5, 0);
      etiqueta.position.set(x, datos.nivel_suelo + 1.2, z);
      etiqueta.renderOrder = 5;
      etiqueta.userData = { avenida: calle.nombre.startsWith('Av.') ? 1 : 0, aspecto, rect: null };
      etiquetasCalles.add(etiqueta);
    }
  }
  escena.add(etiquetasCalles);
}

const _v = new THREE.Vector3();
function acomodarEtiquetas() {
  const anchoPx = lienzo.clientWidth;
  const altoPx = lienzo.clientHeight;
  const tanMedia = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
  const p = camara.position;
  const aPie = !!recorrido?.activo;
  const candidatas = [];
  for (const e of etiquetasCalles.children) {
    e.material.depthTest = aPie;
    const distancia = p.distanceTo(e.position);
    const profundidad = -_v.copy(e.position).applyMatrix4(camara.matrixWorldInverse).z;
    e.visible = profundidad > camara.near && !(aPie && distancia > ETIQUETA_DIST_RECORRIDO);
    if (!e.visible) continue;
    const alto = ETIQUETA_ALTO_PX * ESCALA_CALLES * THREE.MathUtils.clamp(350 / distancia, 1, 1.6);
    const ancho = alto * e.userData.aspecto;
    const metrosPorPx = (2 * tanMedia * profundidad) / altoPx;
    e.scale.set(ancho * metrosPorPx, alto * metrosPorPx, 1);
    _v.copy(e.position).project(camara);
    const x = ((_v.x + 1) / 2) * anchoPx;
    const y = ((1 - _v.y) / 2) * altoPx;
    e.userData.rect = { left: x - ancho / 2, right: x + ancho / 2, top: y - alto, bottom: y };
    candidatas.push(e);
  }
  candidatas.sort((a, b) => (b.userData.avenida - a.userData.avenida)
    || (a.position.distanceToSquared(p) - b.position.distanceToSquared(p)));
  const ocupadas = [];
  for (const e of candidatas) {
    const r = e.userData.rect;
    const choca = ocupadas.some((o) => r.left < o.right + 4 && r.right > o.left - 4
      && r.top < o.bottom + 2 && r.bottom > o.top - 2);
    e.visible = !choca;
    if (!choca) ocupadas.push(r);
  }
}

function llenarTarjeta(e) {
  tarjetaEdificio.replaceChildren();
  const nombre = document.createElement('p');
  nombre.className = 'tarjeta-edificio-nombre';
  nombre.textContent = e.nombre;
  const datos = document.createElement('dl');
  for (const [etq, val] of [['Year', e.anio], ['Levels', String(e.niveles)], ['Height', e.altura]]) {
    const celda = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = etq;
    dd.textContent = val;
    celda.append(dt, dd);
    datos.append(celda);
  }
  tarjetaEdificio.append(nombre, datos);
}

function mostrarTarjeta(m) {
  marcadorActivo = m;
  llenarTarjeta(m.edificio);
  tarjetaEdificio.hidden = false;
  colocarTarjeta();
}

function ocultarTarjeta(m) {
  if (marcadorActivo !== m) return;
  marcadorActivo = null;
  tarjetaEdificio.hidden = true;
}

function colocarTarjeta() {
  if (!marcadorActivo) return;
  const { x, y } = marcadorActivo;
  tarjetaEdificio.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

async function crearMarcadoresEdificios() {
  const respuesta = await fetch(`${RUTA_MODELO}edificios.json`, { cache: 'no-cache' }).catch(() => null);
  if (!respuesta?.ok) {
    console.warn('No encontré modelo/edificios.json (corre Web/scripts/edificios_tec.py en Blender)');
    return;
  }
  const { edificios } = await respuesta.json();
  const capa = document.createElement('div');
  capa.className = 'capa-edificios';
  tarjetaEdificio = document.createElement('div');
  tarjetaEdificio.className = 'tarjeta-edificio';
  tarjetaEdificio.setAttribute('role', 'tooltip');
  tarjetaEdificio.hidden = true;
  for (const e of edificios) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'marcador-edificio';
    boton.setAttribute('aria-label', `${e.nombre}: ${e.anio}, ${e.niveles} levels, ${e.altura}`);
    const m = { edificio: e, boton, posicion: new THREE.Vector3(...e.pos), x: 0, y: 0 };
    boton.addEventListener('pointerenter', () => mostrarTarjeta(m));
    boton.addEventListener('pointerleave', () => ocultarTarjeta(m));
    boton.addEventListener('focus', () => mostrarTarjeta(m));
    boton.addEventListener('blur', () => ocultarTarjeta(m));
    boton.addEventListener('click', () => (marcadorActivo === m ? ocultarTarjeta(m) : mostrarTarjeta(m)));
    capa.append(boton);
    marcadoresEdificios.push(m);
  }
  capa.append(tarjetaEdificio);
  visor.append(capa);
}

function acomodarMarcadores() {
  const anchoPx = lienzo.clientWidth;
  const altoPx = lienzo.clientHeight;
  const p = camara.position;
  const aPie = !!recorrido?.activo;
  for (const m of marcadoresEdificios) {
    const profundidad = -_v.copy(m.posicion).applyMatrix4(camara.matrixWorldInverse).z;
    _v.copy(m.posicion).project(camara);
    m.x = ((_v.x + 1) / 2) * anchoPx;
    m.y = ((1 - _v.y) / 2) * altoPx;
    const visible = profundidad > camara.near
      && m.x > -20 && m.x < anchoPx + 20 && m.y > -20 && m.y < altoPx + 20
      && !(aPie && p.distanceTo(m.posicion) > MARCADOR_DIST_RECORRIDO);
    m.boton.hidden = !visible;
    if (visible) m.boton.style.transform = `translate3d(${m.x}px, ${m.y}px, 0)`;
    else if (marcadorActivo === m) ocultarTarjeta(m);
  }
  colocarTarjeta();
}

function prepararModelo(raiz, mascara) {
  const piso = materialPiso(datos.piso, mascara);
  const pasto = materialPasto(datos.pasto);
  const canchas = Object.fromEntries(
    Object.entries(datos.canchas).map(([nombre, c]) => [nombre, materialPasto(datos.pasto, c)]));
  const anisotropia = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  raiz.traverse((o) => {
    o.matrixAutoUpdate = false;
    if (!o.isMesh) return;
    const nombre = o.material.name;
    if (nombre === 'Piso') {
      o.material = piso;
    } else if (canchas[nombre]) {
      o.geometry.setAttribute('uvLocal', o.geometry.getAttribute('uv'));
      o.material = canchas[nombre];
    } else if (nombre.startsWith('Cesped')) {
      o.material = pasto;
    } else {
      for (const clave of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
        if (o.material[clave]) o.material[clave].anisotropy = anisotropia;
      }
      const regla = DETALLES.find(([patron]) => patron.test(nombre));
      if (regla) detalles.push({ malla: o, distancia: regla[1], esfera: new THREE.Sphere() });
    }
  });
  raiz.updateMatrixWorld(true);
  for (const d of detalles) {
    d.malla.geometry.computeBoundingSphere();
    d.esfera.copy(d.malla.geometry.boundingSphere).applyMatrix4(d.malla.matrixWorld);
  }
  return raiz;
}

function actualizarDetalles() {
  const p = camara.position;
  for (const d of detalles) {
    d.malla.visible = p.distanceTo(d.esfera.center) - d.esfera.radius < d.distancia * calidad;
  }
}

let calidad = 1;
let ultimoCuadro = 0;
const tiempos = [];
function medirRendimiento(ahora) {
  const dt = ahora - ultimoCuadro;
  ultimoCuadro = ahora;
  if (dt > 250) return;
  tiempos.push(dt);
  if (tiempos.length < 30) return;
  const medio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
  tiempos.length = 0;
  const antes = calidad;
  if (medio > 40) calidad = Math.max(0.5, calidad * 0.85);
  else if (medio < 22) calidad = Math.min(1.6, calidad * 1.1);
  if (calidad !== antes) arbolesPendientes = true;
}

function irAVista({ posicion, objetivo }, ms = 900) {
  animarCamara(new THREE.Vector3(...posicion), new THREE.Vector3(...objetivo), ms);
}

function animarCamara(posFinal, objetivoFinal, ms = 900) {
  if (recorrido?.activo) salirDeRecorrido(false);
  if (ms <= 0) {
    camara.position.copy(posFinal);
    controles.target.copy(objetivoFinal);
    controles.update();
    animacion = null;
    pedirRender();
    return;
  }
  animacion = {
    p0: camara.position.clone(), t0: controles.target.clone(),
    p1: posFinal.clone(), t1: objetivoFinal.clone(),
    inicio: performance.now(), ms,
  };
}

function avanzarAnimacion(ahora) {
  if (!animacion) return false;
  const u = Math.min(1, (ahora - animacion.inicio) / animacion.ms);
  const s = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
  camara.position.lerpVectors(animacion.p0, animacion.p1, s);
  controles.target.lerpVectors(animacion.t0, animacion.t1, s);
  if (u >= 1) animacion = null;
  return true;
}

function acercar(factor) {
  const offset = camara.position.clone().sub(controles.target);
  const d = THREE.MathUtils.clamp(offset.length() * factor, controles.minDistance, controles.maxDistance);
  animarCamara(controles.target.clone().add(offset.setLength(d)), controles.target.clone(), 350);
}

function vistaSuperior() {
  const d = Math.max(camara.position.distanceTo(controles.target), 300);
  const t = controles.target.clone();
  animarCamara(new THREE.Vector3(t.x, t.y + d, t.z + d * 0.002), t);
}

function orientarAlNorte() {
  const offset = camara.position.clone().sub(controles.target);
  const horizontal = Math.hypot(offset.x, offset.z);
  animarCamara(controles.target.clone().add(new THREE.Vector3(0, offset.y, horizontal)), controles.target.clone(), 600);
}

const _min = new THREE.Vector3();
const _max = new THREE.Vector3();
const _delta = new THREE.Vector3();
function limitarObjetivo() {
  if (!datos) return;
  const margen = 400;
  _min.fromArray(datos.limites.min).subScalar(margen);
  _max.fromArray(datos.limites.max).addScalar(margen);
  _delta.copy(controles.target);
  controles.target.clamp(_min, _max);
  _delta.sub(controles.target);
  if (_delta.lengthSq() > 0) camara.position.sub(_delta);
}

const _frente = new THREE.Vector3();
const _derecha = new THREE.Vector3();
const _mov = new THREE.Vector3();
function moverConTeclado(dt) {
  const hay = (...cs) => cs.some((c) => teclas.has(c));
  const avance = (hay('KeyW', 'ArrowUp') ? 1 : 0) - (hay('KeyS', 'ArrowDown') ? 1 : 0);
  const lado = (hay('KeyD', 'ArrowRight') ? 1 : 0) - (hay('KeyA', 'ArrowLeft') ? 1 : 0);
  const giro = (hay('KeyE') ? 1 : 0) - (hay('KeyQ') ? 1 : 0);
  const zoom = (hay('Minus', 'NumpadSubtract') ? 1 : 0) - (hay('Equal', 'NumpadAdd', 'BracketRight') ? 1 : 0);
  if (!avance && !lado && !giro && !zoom) return false;

  const offset = camara.position.clone().sub(controles.target);
  const dist = offset.length();
  if (avance || lado) {
    camara.getWorldDirection(_frente);
    if (Math.hypot(_frente.x, _frente.z) < 0.1) _frente.set(0, 1, 0).applyQuaternion(camara.quaternion);
    _frente.y = 0;
    _frente.normalize();
    _derecha.set(-_frente.z, 0, _frente.x);
    const vel = Math.max(25, dist * 0.7) * dt;
    _mov.copy(_frente).multiplyScalar(avance * vel).addScaledVector(_derecha, lado * vel);
    camara.position.add(_mov);
    controles.target.add(_mov);
  }
  if (giro) {
    offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, -giro * 1.3 * dt);
    camara.position.copy(controles.target).add(offset);
  }
  if (zoom) {
    const d = THREE.MathUtils.clamp(dist * (1 + zoom * 1.6 * dt), controles.minDistance, controles.maxDistance);
    camara.position.copy(controles.target).add(offset.setLength(d));
  }
  return true;
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
  const atajos = {
    KeyH: () => irAVista(datos.camara_inicial),
    KeyT: vistaSuperior,
    KeyP: () => alternarRecorrido(),
    KeyN: orientarAlNorte,
    Escape: () => recorrido?.activo && salirDeRecorrido(true),
  };
  if (datos && atajos[e.code] && !e.repeat) {
    atajos[e.code]();
    e.preventDefault();
    return;
  }
  if (/^(Key[WASDQE]|Arrow|Shift|Minus|Equal|Numpad(Add|Subtract)|BracketRight)/.test(e.code)) {
    teclas.add(e.code);
    if (e.code.startsWith('Arrow')) e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => teclas.delete(e.code));
window.addEventListener('blur', () => teclas.clear());

function alternarRecorrido() {
  if (!recorrido) return;
  if (recorrido.activo) salirDeRecorrido(true);
  else entrarARecorrido();
}

function entrarARecorrido() {
  animacion = null;
  const direccion = controles.target.clone().sub(camara.position);
  direccion.y = 0;
  if (direccion.lengthSq() < 1e-6) direccion.set(0, 0, -1);
  controles.enabled = false;
  recorrido.activar(controles.target, direccion.normalize());
  camara.near = 0.2;
  camara.updateProjectionMatrix();
  visor.classList.add('modo-recorrido');
  marcarBoton('recorrido', true);
  arbolesPendientes = true;
  pedirRender();
}

function salirDeRecorrido(animar) {
  const frente = recorrido.adelante();
  recorrido.desactivar();
  controles.enabled = true;
  camara.near = 0.5;
  camara.updateProjectionMatrix();
  visor.classList.remove('modo-recorrido');
  marcarBoton('recorrido', false);
  const objetivo = camara.position.clone().addScaledVector(frente, 40);
  objetivo.y = datos.nivel_suelo;
  const desde = objetivo.clone().addScaledVector(frente, -170).setY(datos.nivel_suelo + 120);
  controles.target.copy(objetivo);
  if (animar) animarCamara(desde, objetivo, 900);
  else camara.lookAt(objetivo);
  pedirRender();
}

const rayo = new THREE.Raycaster();
const puntero = new THREE.Vector2();
const planoSuelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _p = new THREE.Vector3();
let punteroPendiente = null;
let punteroFuera = true;
let ultimoPunto = null;
const TEXTO_CURSOR = window.matchMedia('(hover: none)').matches
  ? 'Tap the model to see its coordinates'
  : 'Move the cursor over the model';
$('coord-cursor-valor').textContent = TEXTO_CURSOR;

const marcador = new THREE.Group();
{
  const mat = new THREE.MeshBasicMaterial({ color: '#e27620', depthTest: false, fog: false, toneMapped: false });
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), mat);
  cabeza.position.y = 3.2;
  const punta = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.4, 20).rotateX(Math.PI), mat);
  punta.position.y = 1.2;
  marcador.add(cabeza, punta);
  marcador.renderOrder = 10;
  marcador.traverse((o) => { o.renderOrder = 10; });
  marcador.visible = false;
  escena.add(marcador);
}

function rayoDesde(evento) {
  const r = lienzo.getBoundingClientRect();
  puntero.set(((evento.clientX - r.left) / r.width) * 2 - 1, -((evento.clientY - r.top) / r.height) * 2 + 1);
  rayo.setFromCamera(puntero, camara);
}

function actualizarCoordenadasCursor() {
  if (!georef || !punteroPendiente) return;
  rayoDesde(punteroPendiente);
  punteroPendiente = null;
  planoSuelo.constant = -datos.nivel_suelo;
  const texto = !punteroFuera && rayo.ray.intersectPlane(planoSuelo, _p)
    ? georef.describir(_p).texto
    : TEXTO_CURSOR;
  $('coord-cursor-valor').textContent = texto;
}

function puntoBajo(evento) {
  if (!modelo) return null;
  rayoDesde(evento);
  const hit = rayo.intersectObject(modelo, true).find((h) => h.object.visible);
  return hit ? hit.point : null;
}

function seleccionar(evento) {
  const p = puntoBajo(evento);
  if (!p) return;
  ultimoPunto = georef.describir(p, true);
  marcador.position.copy(p);
  marcador.updateMatrixWorld(true);
  marcador.visible = true;
  $('coord-punto').hidden = false;
  $('coord-punto-valor').textContent = ultimoPunto.texto;
  pedirRender();
}

function escalarMarcador() {
  if (!marcador.visible) return;
  const s = camara.position.distanceTo(marcador.position) * 0.011;
  marcador.scale.setScalar(Math.max(s, 0.08));
  marcador.updateMatrixWorld(true);
}

let inicioClic = null;
lienzo.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch') {
    punteroPendiente = e;
    punteroFuera = false;
  }
  if (inicioClic && Math.hypot(e.clientX - inicioClic.x, e.clientY - inicioClic.y) > 5) {
    inicioClic.movido = true;
    lienzo.classList.add('arrastrando');
  }
});
lienzo.addEventListener('pointerleave', (e) => { punteroFuera = true; punteroPendiente = e; });
lienzo.addEventListener('pointerdown', (e) => {
  inicioClic = { x: e.clientX, y: e.clientY, boton: e.button, movido: false };
});
lienzo.addEventListener('pointerup', (e) => {
  lienzo.classList.remove('arrastrando');
  const clic = inicioClic;
  inicioClic = null;
  if (!clic || clic.movido || clic.boton !== 0 || recorrido?.activo || !georef) return;
  seleccionar(e);
});
lienzo.addEventListener('dblclick', (e) => {
  if (recorrido?.activo || !modelo) return;
  const p = puntoBajo(e);
  if (!p) return;
  const offset = camara.position.clone().sub(controles.target).multiplyScalar(0.55);
  if (offset.length() < 40) offset.setLength(40);
  animarCamara(p.clone().add(offset), p, 800);
});
lienzo.addEventListener('contextmenu', (e) => e.preventDefault());

$('coord-copiar').addEventListener('click', async () => {
  if (!ultimoPunto) return;
  const { lat, lon, e, n } = ultimoPunto;
  const texto = `${lat.toFixed(7)}, ${lon.toFixed(7)}\nUTM 14N (EPSG:32614): ${e.toFixed(2)} E, ${n.toFixed(2)} N`;
  try {
    await navigator.clipboard.writeText(texto);
    $('coord-copiar').textContent = 'Copied!';
  } catch {
    $('coord-copiar').textContent = 'Failed';
  }
  setTimeout(() => { $('coord-copiar').textContent = 'Copy'; }, 1500);
});

function marcarBoton(accion, activo) {
  document.querySelector(`[data-accion="${accion}"]`)?.setAttribute('aria-pressed', String(activo));
}

const acciones = {
  acercar: () => acercar(0.6),
  alejar: () => acercar(1 / 0.6),
  inicio: () => irAVista(datos.camara_inicial),
  superior: vistaSuperior,
  recorrido: alternarRecorrido,
};
document.querySelectorAll('[data-accion]').forEach((boton) => {
  boton.addEventListener('click', () => {
    if (!datos) return;
    acciones[boton.dataset.accion]?.();
  });
});
$('brujula').addEventListener('click', () => datos && orientarAlNorte());

const aguja = $('aguja');
function actualizarBrujula() {
  const rumbo = recorrido?.activo ? recorrido.yaw : controles.getAzimuthalAngle();
  aguja.style.transform = `rotate(${THREE.MathUtils.radToDeg(rumbo)}deg)`;
}

function ajustarTamano() {
  const w = visor.clientWidth;
  const h = visor.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camara.aspect = w / h;
  camara.updateProjectionMatrix();
  arbolesPendientes = true;
  pedirRender();
}
new ResizeObserver(ajustarTamano).observe(visor);

const reloj = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(reloj.getDelta(), 0.1);
  let cambio = avanzarAnimacion(performance.now());
  if (recorrido?.activo) {
    cambio = recorrido.actualizar(dt, teclas) || cambio;
  } else {
    cambio = moverConTeclado(dt) || cambio;
    if (cambio) limitarObjetivo();
    cambio = controles.update(dt) || cambio;
  }
  if (cambio) {
    necesitaRender = true;
    arbolesPendientes = true;
  }
  actualizarCoordenadasCursor();
  if (!necesitaRender || !modelo) return;
  necesitaRender = false;
  limitarObjetivo();
  actualizarBrujula();
  camara.updateMatrixWorld();
  if (arbolesPendientes && bosque) {
    bosque.actualizar(camara, calidad);
    actualizarDetalles();
    arbolesPendientes = false;
  }
  escalarMarcador();
  if (etiquetasCalles.children.length) acomodarEtiquetas();
  if (marcadoresEdificios.length) acomodarMarcadores();
  renderer.render(escena, camara);
  medirRendimiento(performance.now());
});

export const listo = iniciar();
listo.catch((err) => {
  console.error(err);
  carga.error('No se pudo cargar el modelo', String(err.message ?? err));
});

window.climatec = {
  escena, camara, controles, renderer, detalles,
  get bosque() { return bosque; },
  get georef() { return georef; },
  get calidad() { return calidad; },
  set calidad(v) { calidad = v; arbolesPendientes = true; pedirRender(); },
};
