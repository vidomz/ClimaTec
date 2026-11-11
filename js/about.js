const INTERVALO_MS = 4000;

const portada = document.getElementById("portada");
const imagenes = [...portada.querySelectorAll(".portada-imagenes img")];
const puntos = document.getElementById("portada-puntos");

let actual = 0;
let temporizador = null;

const botones = imagenes.map((_, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("aria-label", `View ${i + 1} of ${imagenes.length}`);
  b.addEventListener("click", () => { mostrar(i); reiniciar(); });
  puntos.append(b);
  return b;
});

function mostrar(i) {
  actual = (i + imagenes.length) % imagenes.length;
  imagenes.forEach((img, k) => img.classList.toggle("activa", k === actual));
  botones.forEach((b, k) => b.setAttribute("aria-current", String(k === actual)));
}

function reiniciar() {
  clearInterval(temporizador);
  temporizador = setInterval(() => mostrar(actual + 1), INTERVALO_MS);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearInterval(temporizador);
  else reiniciar();
});

mostrar(0);
reiniciar();
