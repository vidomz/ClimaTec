import * as THREE from 'three';

const A = 6378137.0;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const LON0 = THREE.MathUtils.degToRad(-99.0);
const FE = 500000.0;
const N = F / (2 - F);
const AA = A / (1 + N) * (1 + N ** 2 / 4 + N ** 4 / 64 + N ** 6 / 256);
const ALFA = [
  N / 2 - 2 * N ** 2 / 3 + 5 * N ** 3 / 16 + 41 * N ** 4 / 180 - 127 * N ** 5 / 288 + 7891 * N ** 6 / 37800,
  13 * N ** 2 / 48 - 3 * N ** 3 / 5 + 557 * N ** 4 / 1440 + 281 * N ** 5 / 630 - 1983433 * N ** 6 / 1935360,
  61 * N ** 3 / 240 - 103 * N ** 4 / 140 + 15061 * N ** 5 / 26880 + 167603 * N ** 6 / 181440,
  49561 * N ** 4 / 161280 - 179 * N ** 5 / 168 + 6601661 * N ** 6 / 7257600,
  34729 * N ** 5 / 80640 - 3418889 * N ** 6 / 1995840,
  212378941 * N ** 6 / 319334400,
];
const E = Math.sqrt(F * (2 - F));
const grados = THREE.MathUtils.radToDeg;
const radianes = THREE.MathUtils.degToRad;

export class Georreferencia {
  constructor(g) {
    this.origenX = g.origen_3857[0];
    this.origenY = g.origen_3857[1];
    this.zSuelo = g.z_suelo;
    this.k = g.k_mercator;
    this.crsUTM = g.utm?.crs ?? 'EPSG:32614';
  }

  a3857(p) {
    return [p.x + this.origenX, -p.z + this.origenY];
  }

  aLonLat(p) {
    const [x, y] = this.a3857(p);
    return [grados(x / A), grados(Math.atan(Math.sinh(y / A)))];
  }

  aUTM(lon, lat) {
    const phi = radianes(lat);
    const lam = radianes(lon) - LON0;
    const t = Math.sinh(Math.atanh(Math.sin(phi)) - E * Math.atanh(E * Math.sin(phi)));
    const xiP = Math.atan2(t, Math.cos(lam));
    const etaP = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t));
    let xi = xiP;
    let eta = etaP;
    ALFA.forEach((a, j) => {
      const k = 2 * (j + 1);
      xi += a * Math.sin(k * xiP) * Math.cosh(k * etaP);
      eta += a * Math.cos(k * xiP) * Math.sinh(k * etaP);
    });
    return [FE + K0 * AA * eta, K0 * AA * xi];
  }

  altura(p) {
    return (p.y - this.zSuelo) / this.k;
  }

  desdeLonLat(lon, lat, y = this.zSuelo) {
    const X = radianes(lon) * A;
    const Y = A * Math.log(Math.tan(Math.PI / 4 + radianes(lat) / 2));
    return new THREE.Vector3(X - this.origenX, y, -(Y - this.origenY));
  }

  describir(p, conAltura = false) {
    const [lon, lat] = this.aLonLat(p);
    const [e, n] = this.aUTM(lon, lat);
    const latTxt = `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}`;
    const lonTxt = `${Math.abs(lon).toFixed(6)}° ${lon >= 0 ? 'E' : 'W'}`;
    const fmt = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    let texto = `${latTxt}, ${lonTxt} · UTM 14N ${fmt(e)} E, ${fmt(n)} N`;
    if (conAltura) texto += ` · height ${this.altura(p).toFixed(1)} m`;
    return { texto, lat, lon, e, n };
  }
}
