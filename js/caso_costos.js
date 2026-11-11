const COLORES = {
  x: { Concrete: '#9e9b94', Metal: '#c8a46a', Glass: '#4f6b80', Paint: '#9b655c' },
  z: { Concrete: '#9e9b94', Metal: '#a3aab1', Glass: '#4f6b80' },
};
const fmt = (x, d = 0) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const dinero = (v) => (v >= 1e6 ? `$${fmt(v / 1e6, 2)}&nbsp;M` : v >= 1e4 ? `$${fmt(v / 1e3)}&nbsp;k` : `$${fmt(v / 1e3, 1)}&nbsp;k`);
const RECOMENDACION = { Monitor: 'Monitor', Maintenance: 'Maintain', Critical: 'Replace' };
const chip = (estado, texto) => `<span class="caso-estado" data-estado="${estado}"><i></i>${texto}</span>`;
const punto = (estado) => `<span class="caso-estado" data-estado="${estado}" role="img" aria-label="${RECOMENDACION[estado]}" title="${RECOMENDACION[estado]}"><i></i></span>`;

function fila(f, cual, pct) {
  const detalle = `${f.accion} · ${fmt(f.area)} m² · ${fmt(f.precio, 2)}&nbsp;MXN·m⁻²`;
  return `<tr><th scope="row"><span class="caso-costo-material"><i style="background:${COLORES[cual][f.material]}"></i>${f.material}`
    + `<b>${pct}&nbsp;%</b></span><small>${detalle}</small></th><td>${dinero(f.total)}</td>`
    + `${f.anios.map((v, n) => `<td>${dinero(v)}${punto(f.estados[n])}</td>`).join('')}</tr>`;
}

export function pintar(d, contenedores, composicion) {
  for (const cont of contenedores) {
    const cual = cont.dataset.edificio, e = d.edificios[cual];
    const aviso = e.criticos.length ? chip('Critical', `Critical: ${e.criticos.join(', ')}`) : '';
    cont.innerHTML = `<div class="caso-costo-enc"><p class="rom-etiqueta">Building ${cual.toUpperCase()}</p>${aviso}</div>`
      + '<table class="caso-costo-tabla"><thead><tr><th scope="col">Material</th><th scope="col">Full</th>'
      + `${[1, 2, 3, 4, 5].map((n) => `<th scope="col">Year ${n}</th>`).join('')}</tr></thead>`
      + `<tbody>${e.filas.map((f) => fila(f, cual, composicion[cual][f.material])).join('')}</tbody>`
      + `<tfoot><tr><th scope="row">Total</th>${[e.total, ...e.anios].map((v) => `<td>${dinero(v)}<small>MXN</small></td>`).join('')}</tr></tfoot></table>`;
  }
}
