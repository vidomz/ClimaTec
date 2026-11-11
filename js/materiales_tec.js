export const CLASES = ['concreto', 'piedra', 'vidrio', 'metal'];
export const POCO = 0.15;
const LOSETAS = 0.8;
export const AJUSTES = {
  CEDES: { solo: ['vidrio', 'metal'], poco: ['metal'] },
  'Estacionamiento E2': { solo: ['concreto', 'metal'] },
  'Hub de Innovación': { intercambia: ['concreto', 'metal'] },
  'Expedition FEMSA': { solo: ['vidrio', 'metal', 'concreto'] },
  'Residencias I': { solo: ['concreto', 'vidrio'] },
  'Residencias III': { solo: ['concreto', 'vidrio'] },
  'Deportivo Escamilla': { sinCaras: true },
  'Deportivo Borregos II': { sinCaras: true },
  CIAP: { losetas: LOSETAS },
  'Aulas I': { losetas: LOSETAS },
  'Aulas II': { losetas: LOSETAS },
  'Aulas III': { losetas: LOSETAS },
  'Aulas IV': { losetas: LOSETAS },
  'Aulas VII': { losetas: LOSETAS },
  'Biotecnología FEMSA': { pasa: ['piedra', 'metal'] },
  'Espacio de Reflexión': { solo: ['concreto'] },
  'Rectoría': { solo: ['piedra', 'concreto', 'vidrio'], poco: ['concreto', 'vidrio'] },
  'La Carreta': { solo: ['vidrio', 'metal'] },
  CETEC: { solo: ['vidrio', 'concreto'] },
  BiblioTEC: { solo: ['vidrio', 'metal'] },
  'Estadio Borregos': { solo: ['concreto', 'metal'] },
  'Estacionamiento E1': { solo: ['concreto'] },
  Centrales: { solo: ['concreto', 'vidrio'], poco: ['vidrio'] },
  'Centro de Congresos': { solo: ['concreto', 'vidrio'], poco: ['vidrio'] },
  'Arena Borregos': { solo: ['concreto', 'vidrio'] },
};

export function ajustar(corto, medido) {
  const a = AJUSTES[corto] ?? {};
  const f = Object.fromEntries(CLASES.map((k) => [k, Math.max(Number(medido?.[k]) || 0, 0)]));
  const normalizar = () => {
    const s = CLASES.reduce((x, k) => x + f[k], 0);
    if (s > 0) for (const k of CLASES) f[k] /= s;
    return s;
  };
  if (!normalizar()) f[a.solo?.[0] ?? 'concreto'] = 1;
  if (a.intercambia) { const [x, y] = a.intercambia; [f[x], f[y]] = [f[y], f[x]]; }
  if (a.pasa) { const [x, y] = a.pasa; f[y] += f[x]; f[x] = 0; }
  if (a.losetas) { const op = f.concreto + f.piedra; f.piedra = a.losetas * op; f.concreto = op - f.piedra; }
  if (a.solo) {
    for (const k of CLASES) if (!a.solo.includes(k)) f[k] = 0;
    if (!normalizar()) f[a.solo[0]] = 1;
  }
  if (a.poco) {
    const resto = (a.solo ?? CLASES).filter((k) => !a.poco.includes(k));
    let sobra = 0;
    for (const k of a.poco) if (f[k] > POCO) { sobra += f[k] - POCO; f[k] = POCO; }
    if (sobra > 0) {
      const base = resto.reduce((x, k) => x + f[k], 0);
      if (base > 0) for (const k of resto) f[k] += (sobra * f[k]) / base;
      else f[resto[0]] += sobra;
    }
  }
  normalizar();
  return Object.fromEntries(CLASES.map((k) => [k, 100 * f[k]]));
}
