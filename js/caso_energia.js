const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (x, d = 0) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const mwh = (v) => fmt(v / 1000, 1);
const dia = (iso, conAnio) => {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]}${conAnio ? ` ${a}` : ''}`;
};
const rango = (p) => `${dia(p.inicio, p.inicio.slice(0, 4) !== p.fin.slice(0, 4))} – ${dia(p.fin, true)}`;
const nombre = (p) => (p.id === 'canicula' ? `Canícula · ${rango(p)}` : rango(p));
const hora = (iso) => `${dia(iso.slice(0, 10))}, ${iso.slice(11, 16)}`;
const columna = (titulo, tiempo) => `<th scope="col">${titulo}<small>${tiempo}</small></th>`;

function tarjeta(cont, cual, p) {
  const e = p.edificios[cual];
  const filas = [
    ['Cooling Electricity', `${mwh(e.enfriamiento_kwh)} MWh`],
    ['Total Electricity', `${mwh(e.total_kwh)} MWh`],
    ['Mean Power', `${fmt(e.w_m2, 1)} W·m⁻²`],
    ['Peak Cooling Load', `${fmt(e.pico_kw)} kW`],
    ['Solar Through Glass', `${mwh(e.desglose.solar)} MWh`],
  ];
  cont.innerHTML = `<p class="caso-tarjeta-nombre">Building ${cual.toUpperCase()}</p>`
    + `<ul>${filas.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('')}</ul>`;
}

function tabla(cont, d) {
  const [a, b] = d.periodos, par = (p, f) => ['x', 'z'].map((k) => f(p.edificios[k]));
  const sube = (p, f) => { const [x, z] = par(p, f); return `+${fmt(100 * (z / x - 1))}&nbsp;%`; };
  const fila = (titulo, cual) => `<tr><th scope="row">${titulo}</th>${[a, b].map((p) => {
    const e = p.edificios[cual];
    return `<td>${mwh(e.enfriamiento_kwh)}</td><td>${mwh(e.total_kwh)}</td><td>${fmt(e.w_m2, 1)}</td><td>${fmt(e.pico_kw)}<small>${hora(e.pico_hora)}</small></td>`;
  }).join('')}</tr>`;
  const diferencia = `<tr class="caso-energia-dif"><th scope="row">Z Over X</th>${[a, b].map((p) => `<td>${sube(p, (e) => e.enfriamiento_kwh)}</td>`
    + `<td>${sube(p, (e) => e.total_kwh)}</td><td>${sube(p, (e) => e.w_m2)}</td><td>${sube(p, (e) => e.pico_kw)}</td>`).join('')}</tr>`;
  const cols = columna('Cooling (MWh)', 'Full Period') + columna('Total (MWh)', 'Full Period') + columna('Mean (W·m⁻²)', 'Hourly Mean') + columna('Peak (kW)', 'Worst Hour');
  cont.innerHTML = `<table class="caso-costo-tabla"><thead><tr><th></th><th colspan="4" scope="colgroup">${nombre(a)}</th><th colspan="4" scope="colgroup">${nombre(b)}</th></tr>`
    + `<tr><th scope="col">Building</th>${cols}${cols}</tr></thead><tbody>${fila('Building X', 'x')}${fila('Building Z', 'z')}</tbody>`
    + `<tfoot>${diferencia}</tfoot></table>`;
}

function costos(cont, d) {
  const [a, b] = d.periodos, dinero = (v) => `$${fmt(v / 1000)}&nbsp;k`;
  const fila = (titulo, cual) => `<tr><th scope="row">${titulo}</th>${[a, b].map((p) => {
    const c = p.edificios[cual].costo;
    return `<td>${dinero(c.enfriamiento)}</td><td>${dinero(c.total)}</td><td>$${fmt(c.mxn_m2, 1)}</td><td>$${fmt(c.mxn_kwh, 2)}</td>`;
  }).join('')}</tr>`;
  const sube = (p, k) => `+${fmt(100 * (p.edificios.z.costo[k] / p.edificios.x.costo[k] - 1))}&nbsp;%`;
  const dif = `<tr><th scope="row">Z Over X</th>${[a, b].map((p) => `<td>${sube(p, 'enfriamiento')}</td><td>${sube(p, 'total')}</td>`
    + `<td>${sube(p, 'mxn_m2')}</td><td>—</td>`).join('')}</tr>`;
  const cols = columna('Cooling (MXN)', 'Full Period') + columna('Total (MXN)', 'Full Period') + columna('MXN·m⁻²', 'Full Period') + columna('MXN·kWh⁻¹', 'Period Mean');
  cont.innerHTML = `<table class="caso-costo-tabla"><thead><tr><th></th><th colspan="4" scope="colgroup">${nombre(a)}</th><th colspan="4" scope="colgroup">${nombre(b)}</th></tr>`
    + `<tr><th scope="col">Cost per Period</th>${cols}${cols}</tr></thead><tbody>${fila('Building X', 'x')}${fila('Building Z', 'z')}</tbody>`
    + `<tfoot>${dif}</tfoot></table>`;
}

export function pintar(d) {
  const botones = document.getElementById('caso-energia-periodo');
  const poner = (p) => { for (const c of document.querySelectorAll('.caso-energia-tarjeta')) tarjeta(c, c.dataset.edificio, p); };
  d.periodos.forEach((p, n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(n === d.periodos.length - 1));
    b.textContent = nombre(p);
    b.addEventListener('click', () => {
      botones.querySelectorAll('button').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
      poner(p);
    });
    botones.append(b);
  });
  poner(d.periodos.at(-1));
  tabla(document.getElementById('caso-energia-tabla'), d);
  costos(document.getElementById('caso-energia-costo'), d);
}
