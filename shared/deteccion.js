// Algoritmo de detección de momentos (sección 5.1.5 del informe).
// puntaje = 0,6 × chat + 0,4 × audio, suavizado, picos sobre el umbral,
// separados por un mínimo de tiempo y limitados por el plan del usuario.

export const PESO_CHAT = 0.6; // peso del chat en el puntaje
export const PESO_AUDIO = 0.4; // peso del audio en el puntaje
export const UMBRAL = 0.38; // puntaje mínimo de un momento
export const SEPARACION_MIN_SEG = 6 * 60; // minutos mínimos entre clips en transmisiones largas
export const DURACION_CLIP = 30; // duración inicial de cada clip (el usuario la ajusta entre 15 y 60 s)

export function normalizar(valores) {
  if (valores.length === 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const v of valores) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return valores.map((v) => (v - min) / (max - min || 1));
}

// Promedio móvil centrado para reducir el ruido.
export function suavizar(valores, radio = 1) {
  return valores.map((_, i) => {
    let suma = 0;
    let n = 0;
    for (let j = i - radio; j <= i + radio; j++) {
      if (j >= 0 && j < valores.length) {
        suma += valores[j];
        n++;
      }
    }
    return suma / n;
  });
}

// Ajuste respecto al informe: el puntaje suavizado se vuelve a escalar a 0–1.
// Sin este paso, un pico de un solo minuto queda en 1/3 de su valor al suavizar
// y nunca supera el umbral de 0,38, aunque sea el mejor momento de la transmisión.
function puntajeSinSuavizar(chat, audio) {
  const c = normalizar(chat);
  const a = normalizar(audio);
  return c.map((v, i) => PESO_CHAT * v + PESO_AUDIO * (a[i] ?? 0));
}

export function calcularPuntajes(chat, audio) {
  return normalizar(suavizar(puntajeSinSuavizar(chat, audio), 1));
}

// Las transmisiones largas se analizan por minuto, como en el informe.
// Los videos cortos usan intervalos menores para que también tengan varios momentos.
export function elegirIntervalo(duracionSeg) {
  if (duracionSeg >= 30 * 60) return 60;
  return Math.max(5, Math.ceil(duracionSeg / 90));
}

// Separación mínima entre momentos, expresada en intervalos.
export function separacionEnIntervalos(duracionSeg, intervaloSeg) {
  const separacionSeg = duracionSeg >= 30 * 60 ? SEPARACION_MIN_SEG : Math.max(DURACION_CLIP, duracionSeg / 12);
  return Math.max(1, Math.ceil(separacionSeg / intervaloSeg));
}

export function detectarMomentos(chat, audio, maxClips, separacion = 6) {
  const puntaje = calcularPuntajes(chat, audio);
  const crudo = puntajeSinSuavizar(chat, audio);
  const candidatos = [];
  for (let i = 0; i < puntaje.length; i++) {
    const izquierda = i > 0 ? puntaje[i - 1] : -Infinity;
    const derecha = i < puntaje.length - 1 ? puntaje[i + 1] : -Infinity;
    const esPico = puntaje[i] >= izquierda && puntaje[i] >= derecha;
    if (esPico && puntaje[i] >= UMBRAL) {
      // El suavizado aplana los picos aislados; se ubica el momento en el
      // intervalo vecino con mayor puntaje real.
      let indice = i;
      for (const j of [i - 1, i + 1]) {
        if (j >= 0 && j < crudo.length && crudo[j] > crudo[indice]) indice = j;
      }
      if (!candidatos.some((c) => c.indice === indice)) candidatos.push({ indice, puntaje: puntaje[i] });
    }
  }
  candidatos.sort((x, y) => y.puntaje - x.puntaje);

  const elegidos = [];
  for (const c of candidatos) {
    if (elegidos.length >= maxClips) break;
    const cerca = elegidos.some((e) => Math.abs(e.indice - c.indice) < separacion);
    if (!cerca) elegidos.push(c);
  }
  return { puntaje, momentos: elegidos };
}

// Dentro del intervalo elegido, busca el segundo con la voz más fuerte
// y arma el clip para que ese instante quede hacia el 60 % del clip.
export function ventanaDelClip({ indice, intervaloSeg, audioPorSegundo, duracionTotal, duracionClip = DURACION_CLIP }) {
  const desde = indice * intervaloSeg;
  const hasta = Math.min(duracionTotal, desde + intervaloSeg);
  let mejor = desde + (hasta - desde) / 2;
  if (audioPorSegundo && audioPorSegundo.length) {
    let maximo = -Infinity;
    for (let s = Math.floor(desde); s < Math.ceil(hasta) && s < audioPorSegundo.length; s++) {
      if (audioPorSegundo[s] > maximo) {
        maximo = audioPorSegundo[s];
        mejor = s;
      }
    }
  }
  const duracion = Math.min(duracionClip, duracionTotal);
  const inicio = Math.min(Math.max(0, mejor - duracion * 0.6), Math.max(0, duracionTotal - duracion));
  return { inicio: Math.round(inicio * 10) / 10, duracion };
}

// Agrupa valores por segundo en intervalos (promedio).
export function agruparPromedio(valoresPorSegundo, intervaloSeg, cantidad) {
  const grupos = new Array(cantidad).fill(0);
  const cuentas = new Array(cantidad).fill(0);
  valoresPorSegundo.forEach((v, s) => {
    const i = Math.min(cantidad - 1, Math.floor(s / intervaloSeg));
    grupos[i] += v;
    cuentas[i]++;
  });
  return grupos.map((g, i) => (cuentas[i] ? g / cuentas[i] : 0));
}

// Cuenta mensajes de chat por intervalo a partir de sus tiempos en segundos.
export function contarPorIntervalo(tiemposSeg, intervaloSeg, cantidad) {
  const conteo = new Array(cantidad).fill(0);
  for (const t of tiemposSeg) {
    const i = Math.floor(t / intervaloSeg);
    if (i >= 0 && i < cantidad) conteo[i]++;
  }
  return conteo;
}
