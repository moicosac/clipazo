import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizar,
  suavizar,
  calcularPuntajes,
  detectarMomentos,
  elegirIntervalo,
  separacionEnIntervalos,
  ventanaDelClip,
  contarPorIntervalo,
  agruparPromedio,
} from '../shared/deteccion.js';
import { leerChat } from '../shared/chat.js';
import { generarTransmisionEjemplo, simularChat } from '../shared/simulacion.js';

test('normalizar lleva los valores a la escala 0–1', () => {
  assert.deepEqual(normalizar([2, 4, 6]), [0, 0.5, 1]);
  assert.deepEqual(normalizar([5, 5, 5]), [0, 0, 0]);
});

test('suavizar promedia con los vecinos', () => {
  assert.deepEqual(suavizar([0, 3, 0], 1), [1.5, 1, 1.5]);
});

test('el puntaje pesa 60 % el chat y 40 % el audio', () => {
  // Minuto 2: solo chat; minuto 6: solo audio; minuto 10: ambos.
  const chat = new Array(13).fill(0);
  const audio = new Array(13).fill(0);
  chat[2] = 1;
  audio[6] = 1;
  chat[10] = 1;
  audio[10] = 1;
  const p = calcularPuntajes(chat, audio);
  assert.ok(Math.abs(p[10] - 1) < 1e-9);
  assert.ok(Math.abs(p[2] - 0.6) < 1e-9);
  assert.ok(Math.abs(p[6] - 0.4) < 1e-9);
});

test('detecta los picos, respeta la separación y el límite del plan', () => {
  const chat = new Array(60).fill(1);
  const audio = new Array(60).fill(1);
  for (const pico of [10, 12, 30, 50]) {
    chat[pico] = 20;
    audio[pico] = 10;
  }
  chat[12] = 15; // pico cercano a 10: debe quedar un solo momento, en el más fuerte
  const { momentos } = detectarMomentos(chat, audio, 5, 6);
  const indices = momentos.map((m) => m.indice).sort((a, b) => a - b);
  assert.deepEqual(indices, [10, 30, 50]);

  const limitado = detectarMomentos(chat, audio, 2, 6);
  assert.equal(limitado.momentos.length, 2);
});

test('no inventa momentos si nada supera el umbral', () => {
  const { momentos } = detectarMomentos(new Array(30).fill(3), new Array(30).fill(3), 5, 6);
  assert.equal(momentos.length, 0);
});

test('intervalo por minuto en transmisiones largas y menor en videos cortos', () => {
  assert.equal(elegirIntervalo(3 * 3600), 60);
  assert.equal(elegirIntervalo(600), 7);
  assert.equal(separacionEnIntervalos(3 * 3600, 60), 6);
  assert.ok(separacionEnIntervalos(600, 7) >= 5);
});

test('la ventana del clip centra el grito dentro del intervalo', () => {
  const audio = new Array(600).fill(0.1);
  audio[130] = 1;
  const v = ventanaDelClip({ indice: 2, intervaloSeg: 60, audioPorSegundo: audio, duracionTotal: 600 });
  assert.equal(v.duracion, 30);
  assert.equal(v.inicio, 112);
  const alFinal = ventanaDelClip({ indice: 9, intervaloSeg: 60, audioPorSegundo: null, duracionTotal: 600 });
  assert.ok(alFinal.inicio + alFinal.duracion <= 600);
});

test('agrupa chat y audio por intervalo', () => {
  assert.deepEqual(contarPorIntervalo([1, 2, 61, 125, 999], 60, 3), [2, 1, 1]);
  assert.deepEqual(agruparPromedio([1, 3, 5, 7], 2, 2), [2, 6]);
});

test('lee chats de TwitchDownloader y de texto', () => {
  const json = JSON.stringify({ comments: [{ content_offset_seconds: 5 }, { content_offset_seconds: 65.2 }] });
  assert.deepEqual(leerChat(json), [5, 65.2]);
  const texto = '[0:00:05] ana: hola\n[0:01:05] beto: GOOOL\nlinea sin hora\n[1:00:00] caro: jaja';
  assert.deepEqual(leerChat(texto), [5, 65, 3600]);
  const reloj = '[21:00:00] a: hola\n[21:02:30] b: wtf';
  assert.deepEqual(leerChat(reloj), [0, 150]);
});

test('la transmisión de ejemplo produce momentos detectables', () => {
  const duracion = 3 * 3600;
  const { audioPorSegundo, chatPorMinuto } = generarTransmisionEjemplo('valorant-ranked', duracion);
  const audio = agruparPromedio(audioPorSegundo, 60, chatPorMinuto.length);
  const { momentos } = detectarMomentos(chatPorMinuto, audio, 5, 6);
  assert.equal(momentos.length, 5);
  assert.equal(simularChat(audio, 'x').length, audio.length);
});
