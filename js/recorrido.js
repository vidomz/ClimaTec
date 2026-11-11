import * as THREE from 'three';

const ADELANTE = ['KeyW', 'ArrowUp'];
const ATRAS = ['KeyS', 'ArrowDown'];
const IZQUIERDA = ['KeyA', 'ArrowLeft'];
const DERECHA = ['KeyD', 'ArrowRight'];
const _adelante = new THREE.Vector3();
const _derecha = new THREE.Vector3();
const _paso = new THREE.Vector3();

export class Recorrido {
  constructor(camara, elemento, { nivelSuelo, k }) {
    this.camara = camara;
    this.elemento = elemento;
    this.sueloY = nivelSuelo;
    this.k = k;
    this.alturaOjos = 1.7 * k;
    this.velocidad = 7 * k;
    this.activo = false;
    this.yaw = 0;
    this.pitch = 0;
    this.altura = this.alturaOjos;
    this.teclas = new Set();
    this.arrastre = null;
    this.miroDistinto = false;

    this._abajo = (e) => {
      if (e.button !== 0) return;
      this.arrastre = { x: e.clientX, y: e.clientY };
      this.elemento.setPointerCapture(e.pointerId);
    };
    this._mover = (e) => {
      if (!this.arrastre) return;
      const dx = e.clientX - this.arrastre.x;
      const dy = e.clientY - this.arrastre.y;
      this.arrastre = { x: e.clientX, y: e.clientY };
      this.yaw -= dx * 0.0035;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0035, -1.45, 1.45);
      this.miroDistinto = true;
    };
    this._arriba = (e) => {
      this.arrastre = null;
      if (this.elemento.hasPointerCapture(e.pointerId)) this.elemento.releasePointerCapture(e.pointerId);
    };
    this._rueda = (e) => {
      e.preventDefault();
      this.#avanzar(-Math.sign(e.deltaY) * 4 * this.k, 0);
      this.miroDistinto = true;
    };
  }

  activar(posicion, direccion) {
    this.activo = true;
    this.altura = this.alturaOjos;
    this.yaw = Math.atan2(-direccion.x, -direccion.z);
    this.pitch = 0;
    this.camara.position.set(posicion.x, this.sueloY + this.altura, posicion.z);
    this.#orientar();
    this.elemento.addEventListener('pointerdown', this._abajo);
    this.elemento.addEventListener('pointermove', this._mover);
    this.elemento.addEventListener('pointerup', this._arriba);
    this.elemento.addEventListener('pointercancel', this._arriba);
    this.elemento.addEventListener('wheel', this._rueda, { passive: false });
  }

  desactivar() {
    this.activo = false;
    this.arrastre = null;
    this.elemento.removeEventListener('pointerdown', this._abajo);
    this.elemento.removeEventListener('pointermove', this._mover);
    this.elemento.removeEventListener('pointerup', this._arriba);
    this.elemento.removeEventListener('pointercancel', this._arriba);
    this.elemento.removeEventListener('wheel', this._rueda);
  }

  adelante(destino = new THREE.Vector3()) {
    return destino.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  actualizar(dt, teclas) {
    if (!this.activo) return false;
    const hay = (lista) => lista.some((t) => teclas.has(t));
    const avance = (hay(ADELANTE) ? 1 : 0) - (hay(ATRAS) ? 1 : 0);
    const lado = (hay(DERECHA) ? 1 : 0) - (hay(IZQUIERDA) ? 1 : 0);
    const vertical = (teclas.has('KeyE') ? 1 : 0) - (teclas.has('KeyQ') ? 1 : 0);
    const correr = teclas.has('ShiftLeft') || teclas.has('ShiftRight') ? 3.5 : 1;
    let cambio = this.miroDistinto;
    this.miroDistinto = false;
    if (avance || lado) {
      const largo = Math.hypot(avance, lado);
      this.#avanzar((avance / largo) * this.velocidad * correr * dt, (lado / largo) * this.velocidad * correr * dt);
      cambio = true;
    }
    if (vertical) {
      this.altura = THREE.MathUtils.clamp(this.altura + vertical * this.velocidad * correr * dt, this.alturaOjos, 400 * this.k);
      this.camara.position.y = this.sueloY + this.altura;
      cambio = true;
    }
    if (cambio) this.#orientar();
    return cambio;
  }

  #avanzar(adelante, lado) {
    this.adelante(_adelante);
    _derecha.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    _paso.copy(_adelante).multiplyScalar(adelante).addScaledVector(_derecha, lado);
    this.camara.position.add(_paso);
  }

  #orientar() {
    this.camara.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camara.updateMatrixWorld();
  }
}
