export const PARAMETROS = {
  CD: 0.2,
  LAD: 1.0,
  TRONCOS: 0.4,
  ALCANCE_M: 30,
  PASO_M: 2,
  L_RECUPERACION_M: 15,
  A_ARBOL: 2.0, A_PASTO: 0.8,
  B_ARBOL: 0.3, B_PASTO: 0.6,
  ET_ARBOL: 0.5, ET_PASTO: 1.0,
  U_MIN: 0.15,
};

const acotar = (x, a, b) => Math.min(Math.max(x, a), b);

export function modeloVegetacion(raster, { SR, Patm }) {
  const P = PARAMETROS;
  const { E0, N0, celda, nx, ny, copa, base, tope, pasto } = raster;
  const dia = acotar(SR / 1000, 0, 1), noche = 1 - acotar(SR / 50, 0, 1);
  const gamma = (0.665 * Patm) / 1013.25;
  const K = Math.round(P.ALCANCE_M / P.PASO_M);
  const pesos = Array.from({ length: K + 1 }, (_, k) => Math.exp((-k * P.PASO_M) / P.L_RECUPERACION_M));
  const sumaPesos = pesos.reduce((a, w) => a + w, 0);
  return function corregir(E, N, z, dx, dy, out) {
    let s = 0, C = 0, G = 0;
    for (let k = 0; k <= K; k++) {
      const i = Math.round((E - k * P.PASO_M * dx - E0) / celda), j = Math.round((N - k * P.PASO_M * dy - N0) / celda);
      if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
      const q = j * nx + i, w = pesos[k];
      const c = copa[q];
      if (c > 0) {
        const b = base[q], t = tope[q];
        s += P.PASO_M * c * w * (z < b ? P.TRONCOS : z <= t ? 1 : Math.exp(-(z - t) / 2));
        C += w * c * (z <= t + 2 ? 1 : Math.exp(-(z - t - 2) / 8));
      }
      G += w * pasto[q];
    }
    C /= sumaPesos;
    G = (G / sumaPesos) * (z <= 2 ? 1 : Math.exp(-(z - 2) / 8));
    if (s <= 0 && C <= 0 && G <= 0) return false;
    out[0] *= Math.max(Math.exp(-P.CD * P.LAD * s), P.U_MIN);
    out[1] -= C * (P.A_ARBOL * dia + P.B_ARBOL * noche) + G * (P.A_PASTO * dia + P.B_PASTO * noche);
    out[2] += gamma * dia * (P.ET_ARBOL * C * P.A_ARBOL + P.ET_PASTO * G * P.A_PASTO);
    return true;
  };
}
