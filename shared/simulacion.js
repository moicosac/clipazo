// Datos simulados para el PMV:
//  - chat simulado cuando el usuario no sube su registro de chat;
//  - transmisiones de ejemplo de "tu canal" (la conexión real con Kick/Twitch/YouTube queda fuera del PMV).

// Generador pseudoaleatorio con semilla, para que los datos de ejemplo sean siempre iguales.
export function aleatorio(semilla) {
  let s = 0;
  for (const ch of String(semilla)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// El chat suele reaccionar unos segundos después de lo que pasa en la transmisión,
// así que se simula siguiendo al volumen con un pequeño retraso y algo de ruido.
export function simularChat(audioPorIntervalo, semilla = 'chat') {
  const azar = aleatorio(semilla);
  const max = Math.max(...audioPorIntervalo, 1e-9);
  const min = Math.min(...audioPorIntervalo);
  return audioPorIntervalo.map((_, i) => {
    const previo = audioPorIntervalo[Math.max(0, i - 1)];
    const actual = audioPorIntervalo[i];
    const energia = ((0.4 * previo + 0.6 * actual) - min) / (max - min || 1);
    const base = 4 + azar() * 4;
    const pico = energia > 0.6 ? Math.pow(energia, 3) * 60 : energia * 10;
    return Math.round(base + pico + azar() * 3);
  });
}

export const TRANSMISIONES_EJEMPLO = [
  { clave: 'valorant-ranked', titulo: 'Ranked de Valorant hasta Inmortal 🔥', juego: 'Valorant', duracionSeg: 3 * 3600 + 12 * 60, haceDias: 1 },
  { clave: 'lol-clash', titulo: 'Clash con la comunidad – LoL', juego: 'League of Legends', duracionSeg: 2 * 3600 + 41 * 60, haceDias: 3 },
  { clave: 'fortnite-noche', titulo: 'Noche de Fortnite con subs', juego: 'Fortnite', duracionSeg: 3 * 3600 + 2 * 60, haceDias: 5 },
];

// Genera el volumen por segundo (escala 0–1) y el chat por minuto de una transmisión de ejemplo.
export function generarTransmisionEjemplo(clave, duracionSeg) {
  const azar = aleatorio(clave);
  const segundos = Math.floor(duracionSeg);
  const audio = new Array(segundos);
  const eventos = [];
  const cantidad = 9 + Math.floor(azar() * 5);
  for (let k = 0; k < cantidad; k++) {
    eventos.push({ t: 300 + azar() * (segundos - 600), fuerza: 0.4 + azar() * 0.6, ancho: 6 + azar() * 20 });
  }
  let deriva = 0.3;
  for (let s = 0; s < segundos; s++) {
    deriva += (azar() - 0.5) * 0.02;
    deriva = Math.min(0.45, Math.max(0.2, deriva));
    let v = deriva + (azar() - 0.5) * 0.12;
    for (const e of eventos) {
      const d = (s - e.t) / e.ancho;
      v += e.fuerza * Math.exp(-d * d);
    }
    audio[s] = Math.max(0, Math.min(1, v));
  }
  const minutos = Math.ceil(segundos / 60);
  const chat = new Array(minutos).fill(0).map(() => 3 + Math.round(azar() * 6));
  for (const e of eventos) {
    const m = Math.floor((e.t + 20) / 60);
    if (m < minutos) chat[m] += Math.round(e.fuerza * (40 + azar() * 50));
    if (m + 1 < minutos) chat[m + 1] += Math.round(e.fuerza * (10 + azar() * 20));
  }
  return { audioPorSegundo: audio, chatPorMinuto: chat };
}
