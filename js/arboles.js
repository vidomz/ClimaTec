import * as THREE from 'three';

const UMBRALES = [12, 40, 130];

const _pv = new THREE.Matrix4();
const _frustum = new THREE.Frustum();

export class Bosque {
  constructor(gltf, matrices, info) {
    this.grupo = new THREE.Group();
    this.grupo.name = 'Arboles';
    this.matrices = matrices;
    this.total = matrices.length / 16;
    this.centros = new Float32Array(this.total * 3);
    this.radios = new Float32Array(this.total);
    this.especies = info.especies.map((e) => this.#prepararEspecie(gltf, e));
    this.triangulosVisibles = 0;
  }

  #prepararEspecie(gltf, e) {
    const lods = e.lods.map((nombre) => {
      const nodo = gltf.scene.getObjectByName(nombre);
      if (!nodo) throw new Error(`No encuentro la malla ${nombre} en arboles.glb`);
      const mallas = [];
      nodo.traverse((o) => o.isMesh && mallas.push(o));
      const atributo = new THREE.InstancedBufferAttribute(new Float32Array(e.cantidad * 16), 16);
      atributo.setUsage(THREE.DynamicDrawUsage);
      const instancias = mallas.map((m) => {
        const im = new THREE.InstancedMesh(m.geometry, m.material, e.cantidad);
        im.instanceMatrix = atributo;
        im.count = 0;
        im.frustumCulled = false;
        im.matrixAutoUpdate = false;
        im.name = `${nombre}_instancias`;
        this.grupo.add(im);
        return im;
      });
      const tris = mallas.reduce((s, m) => s + (m.geometry.index ?? m.geometry.attributes.position).count / 3, 0);
      return { instancias, atributo, tris };
    });

    const geo = lods[0].instancias[0].geometry;
    geo.computeBoundingSphere();
    const esfera = geo.boundingSphere;
    const m = new THREE.Matrix4();
    const c = new THREE.Vector3();
    for (let i = e.inicio; i < e.inicio + e.cantidad; i++) {
      m.fromArray(this.matrices, i * 16);
      c.copy(esfera.center).applyMatrix4(m);
      this.centros[i * 3] = c.x;
      this.centros[i * 3 + 1] = c.y;
      this.centros[i * 3 + 2] = c.z;
      this.radios[i] = esfera.radius * m.getMaxScaleOnAxis();
    }
    return { ...e, lods };
  }

  actualizar(camara, calidad = 1) {
    _pv.multiplyMatrices(camara.projectionMatrix, camara.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pv);
    const planos = _frustum.planes;
    const cx = camara.position.x, cy = camara.position.y, cz = camara.position.z;
    const u0 = UMBRALES[0] * calidad, u1 = UMBRALES[1] * calidad, u2 = UMBRALES[2] * calidad;
    const M = this.matrices, C = this.centros, R = this.radios;
    let tris = 0;

    for (const e of this.especies) {
      const cuenta = [0, 0, 0, 0];
      const destinos = e.lods.map((l) => l.atributo.array);
      for (let i = e.inicio, fin = e.inicio + e.cantidad; i < fin; i++) {
        const x = C[i * 3], y = C[i * 3 + 1], z = C[i * 3 + 2], r = R[i];
        let fuera = false;
        for (let k = 0; k < 6; k++) {
          const p = planos[k];
          if (p.normal.x * x + p.normal.y * y + p.normal.z * z + p.constant < -r) { fuera = true; break; }
        }
        if (fuera) continue;
        const d = Math.hypot(x - cx, y - cy, z - cz) / r;
        const nivel = d < u0 ? 0 : d < u1 ? 1 : d < u2 ? 2 : 3;
        const dst = destinos[nivel];
        const o = cuenta[nivel] * 16;
        const s = i * 16;
        for (let j = 0; j < 16; j++) dst[o + j] = M[s + j];
        cuenta[nivel]++;
      }
      e.lods.forEach((l, nivel) => {
        const n = cuenta[nivel];
        for (const im of l.instancias) im.count = n;
        l.atributo.clearUpdateRanges();
        l.atributo.addUpdateRange(0, n * 16);
        l.atributo.needsUpdate = true;
        tris += n * l.tris;
      });
    }
    this.triangulosVisibles = tris;
  }
}
