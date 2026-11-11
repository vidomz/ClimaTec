import asyncio
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

import aiohttp

sys.stdout.reconfigure(encoding="utf-8")
SITIO = Path(__file__).resolve().parent
PROYECTO = SITIO.parent / "ClimaTec-cfd"
WEB = PROYECTO / "Web"
PYTHON = PROYECTO / ".venv" / "Scripts" / "python.exe"
SERVIDOR = PROYECTO / "ROM" / "servidor_rom.py"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PUERTO, PUERTO_CDP = 8790, 9361
BASE = f"http://127.0.0.1:{PUERTO}"
ESTATICO = SITIO / "rom" / "estatico"

MUESTRA = "2026-11-07T21:30:00Z"
FECHAS = ["2026-12-15", "2027-01-15", "2027-02-15", "2027-03-15", "2027-04-15", "2027-05-15",
          "2027-06-15", "2027-07-15", "2027-08-15", "2027-09-15", "2027-10-15", "2027-11-15"]
HORAS = [15, 9, 21, 3]

CARPETAS = ["css", "assets", "datos", "modelo"]
EXCLUIR_ROM = {"manual", "tiempo_real", "estatico"}

JS_TIEMPO_REAL = """(async () => {
  const API = await import('./js/tiempo_real_api.js?v=20261101a');
  const D = await API.registrosDelDia(new Date('%s'));
  const estaciones = {}, previas = {};
  for (const s of Object.values(D.estaciones)) {
    const u = s.registros.at(-1);
    estaciones[s.nombre] = Object.fromEntries(API.VARIABLES.map((k) => [k, u[k]]));
    previas[s.nombre] = Object.fromEntries(API.CONTAMINANTES.map((k) => [k, s.previas.map((x) => x[k])]));
  }
  const r = await fetch('/api/rom/tiempo-real', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fecha: D.fecha, hora: D.hora, estaciones, previas }) });
  return JSON.stringify({ ok: r.ok, estado: r.status, fecha: D.fecha, hora: D.hora, j: await r.json() });
})()"""

JS_PREDICCION = """(async () => {
  const P = await import('./js/pronostico.js?v=20261101a');
  await P.cargar('20261101a');
  const HORA = 3600000, fecha = '%s', hora = %d;
  const dos = (n) => String(n).padStart(2, '0');
  const t = P.ms(`${fecha}T${dos(hora)}:00`);
  const r = P.predecir('i', [t]);
  const prev = P.predecir('i', Array.from({ length: 23 }, (_, i) => t - (23 - i) * HORA));
  const v = (k) => r[k][0].media;
  const aq = (k, x) => (['O3', 'NO2', 'SO2'].includes(k) ? x * 1000 : x);
  const redondo = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
  const datos = {
    fecha, hora, estacion: P.modelo().estaciones.i.nombre,
    T: redondo(v('T'), 2), HR: redondo(v('HR'), 1), Patm: redondo(v('Patm') / 1.333224, 2), SR: redondo(v('SR') / 1000, 4),
    Ws: redondo(v('Ws'), 2), Wd: redondo(r.Wd[0].media, 0), RF: 0,
    PM10: redondo(v('PM10'), 1), PM25: redondo(v('PM25'), 1), O3: redondo(aq('O3', v('O3')), 2),
    NO2: redondo(aq('NO2', v('NO2')), 2), SO2: redondo(aq('SO2', v('SO2')), 2), CO: redondo(v('CO'), 3),
    previas: Object.fromEntries(['PM10', 'PM25', 'O3', 'NO2', 'SO2', 'CO']
      .map((k) => [k, prev[k].map((x) => redondo(aq(k, x.media), 4))])),
    prediccion: true,
  };
  const res = await fetch('/api/rom/manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
  return JSON.stringify({ ok: res.ok, estado: res.status, j: await res.json() });
})()"""


class CDP:
    def __init__(self, ws):
        self.ws, self.n = ws, 0

    async def __call__(self, metodo, **params):
        self.n += 1
        n = self.n
        await self.ws.send_json({"id": n, "method": metodo, "params": params})
        async for m in self.ws:
            d = json.loads(m.data)
            if d.get("id") == n:
                if "error" in d:
                    raise RuntimeError(d["error"])
                return d.get("result", {})

    async def js(self, codigo):
        r = await self("Runtime.evaluate", expression=codigo, awaitPromise=True, returnByValue=True)
        if r.get("exceptionDetails"):
            raise RuntimeError(r["exceptionDetails"].get("exception", {}).get("description", r["exceptionDetails"]))
        return json.loads(r["result"]["value"])


def responde(url):
    try:
        urllib.request.urlopen(url, timeout=3)
        return True
    except Exception:
        return False


def copiar_sitio():
    for c in CARPETAS:
        shutil.copytree(WEB / c, SITIO / c, dirs_exist_ok=True)
    (SITIO / "rom").mkdir(exist_ok=True)
    for p in (WEB / "rom").iterdir():
        if p.name in EXCLUIR_ROM:
            continue
        if p.is_dir():
            shutil.copytree(p, SITIO / "rom" / p.name, dirs_exist_ok=True)
        else:
            shutil.copy2(p, SITIO / "rom" / p.name)
    shutil.copy2(WEB / "gemelo.html", SITIO / "gemelo.html")
    (SITIO / "js").mkdir(exist_ok=True)
    pendientes = [SITIO / "gemelo.html", *SITIO.glob("ClimaTec_*.html"), *(SITIO / "js").glob("ClimaTec_*.js")]
    vistos = set()
    while pendientes:
        f = pendientes.pop()
        if f in vistos:
            continue
        vistos.add(f)
        texto = f.read_text(encoding="utf-8")
        if f.suffix == ".html":
            nombres = re.findall(r"""src=["']js/([A-Za-z0-9_]+\.js)""", texto)
        else:
            nombres = re.findall(r"""(?:from|import)\s*\(?\s*["'`]\./([A-Za-z0-9_]+\.js)""", texto)
        for nombre in nombres:
            destino = SITIO / "js" / nombre
            if not nombre.startswith("ClimaTec_"):
                shutil.copy2(WEB / "js" / nombre, destino)
            pendientes.append(destino)
    return len([v for v in vistos if v.suffix == ".js"])


def guardar(ruta, fecha, hora, j):
    carpeta = ESTATICO / ruta
    carpeta.mkdir(parents=True, exist_ok=True)
    (carpeta / f"{fecha}T{hora:02d}.json").write_text(json.dumps(j, ensure_ascii=False), encoding="utf-8")
    origen = WEB / "rom" / ("tiempo_real" if ruta == "tiempo-real" else "manual") / j["id"]
    shutil.copytree(origen, SITIO / "rom" / origen.parent.name / j["id"], dirs_exist_ok=True)


def escribir_catalogo(rt, manual):
    orden = sorted(manual, key=lambda c: (c["fecha"], c["hora"]))
    (ESTATICO / "catalogo.json").write_text(json.dumps({"tiempo_real": rt, "manual": orden}, ensure_ascii=False, indent=1), encoding="utf-8")


async def proyectar_todo():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as perfil:
        edge = subprocess.Popen([EDGE, "--headless=new", f"--remote-debugging-port={PUERTO_CDP}", f"--user-data-dir={perfil}",
                                 "--no-first-run", "--no-default-browser-check", "--disable-gpu", f"{BASE}/Web/ClimaTec_exportar"])
        try:
            for _ in range(60):
                try:
                    paginas = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{PUERTO_CDP}/json/list", timeout=2).read())
                    destino = next(p for p in paginas if p["type"] == "page")
                    break
                except Exception:
                    time.sleep(0.5)
            async with aiohttp.ClientSession() as s, s.ws_connect(destino["webSocketDebuggerUrl"], max_msg_size=0) as ws:
                c = CDP(ws)
                await c("Runtime.enable")
                await asyncio.sleep(2)
                t0 = time.time()
                r = await asyncio.wait_for(c.js(JS_TIEMPO_REAL % MUESTRA), 900)
                if not r["ok"]:
                    raise RuntimeError(f"tiempo real: {r}")
                guardar("tiempo-real", r["fecha"], r["hora"], r["j"])
                rt = {"fecha": r["fecha"], "hora": r["hora"]}
                manual = []
                escribir_catalogo(rt, manual)
                print(f"tiempo real {r['fecha']} {r['hora']:02d}:00 listo en {time.time() - t0:.0f} s", flush=True)
                orden = [(f, h) for h in HORAS for f in FECHAS[:1]] + [(f, h) for f in FECHAS[1:] for h in HORAS]
                for k, (fecha, hora) in enumerate(orden, 1):
                    if (ESTATICO / "manual" / f"{fecha}T{hora:02d}.json").exists():
                        manual.append({"fecha": fecha, "hora": hora})
                        escribir_catalogo(rt, manual)
                        print(f"{k}/{len(orden)} {fecha} {hora:02d}:00 ya estaba", flush=True)
                        continue
                    t1 = time.time()
                    r = await asyncio.wait_for(c.js(JS_PREDICCION % (fecha, hora)), 900)
                    if not r["ok"]:
                        print(f"{k}/{len(orden)} {fecha} {hora:02d}:00 ERROR {r}", flush=True)
                        continue
                    guardar("manual", fecha, hora, r["j"])
                    manual.append({"fecha": fecha, "hora": hora})
                    escribir_catalogo(rt, manual)
                    print(f"{k}/{len(orden)} {fecha} {hora:02d}:00 listo en {time.time() - t1:.0f} s", flush=True)
                try:
                    await asyncio.wait_for(c("Browser.close"), 5)
                except (asyncio.TimeoutError, RuntimeError):
                    pass
        finally:
            try:
                edge.wait(10)
            except subprocess.TimeoutExpired:
                edge.kill()


def main():
    print("archivos del sitio:", copiar_sitio(), "módulos JS", flush=True)
    servidor = None
    if not responde(f"{BASE}/Web/README.md"):
        servidor = subprocess.Popen([str(PYTHON), "-u", str(SERVIDOR), "--puerto", str(PUERTO)], cwd=PROYECTO)
        for _ in range(240):
            if responde(f"{BASE}/Web/README.md"):
                break
            time.sleep(1)
    print("servidor listo", flush=True)
    try:
        asyncio.run(proyectar_todo())
    finally:
        if servidor:
            servidor.terminate()
            try:
                servidor.wait(20)
            except subprocess.TimeoutExpired:
                servidor.kill()
    total = sum(f.stat().st_size for f in SITIO.rglob("*") if f.is_file()) / 1e6
    print(f"FIN: sitio de {total:.0f} MB", flush=True)


if __name__ == "__main__":
    main()
