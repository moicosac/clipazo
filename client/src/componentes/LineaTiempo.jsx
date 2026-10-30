import { UMBRAL, normalizar } from '../../../shared/deteccion.js';
import { hms } from '../util.js';

const ANCHO = 1000;
const ALTO = 240;
const M = { izq: 36, der: 12, arr: 18, abj: 28 };

function trazo(valores) {
  const n = valores.length;
  return valores
    .map((v, i) => {
      const x = M.izq + (n > 1 ? (i / (n - 1)) * (ANCHO - M.izq - M.der) : 0);
      const y = M.arr + (1 - v) * (ALTO - M.arr - M.abj);
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export default function LineaTiempo({ transmision, onElegir }) {
  const { puntajes = [], serie_chat = [], serie_audio = [], intervalo_seg, duracion_seg, momentos = [] } = transmision;
  if (!puntajes.length) return null;
  const n = puntajes.length;
  const xDe = (i) => M.izq + (n > 1 ? (i / (n - 1)) * (ANCHO - M.izq - M.der) : 0);
  const yDe = (v) => M.arr + (1 - v) * (ALTO - M.arr - M.abj);
  const marcas = 6;
  const area = `${trazo(puntajes)} L${xDe(n - 1)},${yDe(0)} L${xDe(0)},${yDe(0)} Z`;

  return (
    <figure className="linea-tiempo">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Puntaje de cada intervalo de la transmisión">
        <defs>
          <linearGradient id="relleno-puntaje" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--acento)" stopOpacity="0.45" />
            <stop offset="1" stopColor="var(--acento)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={M.izq} x2={ANCHO - M.der} y1={yDe(v)} y2={yDe(v)} className="lt-rejilla" />
            <text x={M.izq - 8} y={yDe(v) + 4} textAnchor="end" className="lt-eje">
              {v.toString().replace('.', ',')}
            </text>
          </g>
        ))}
        {Array.from({ length: marcas + 1 }, (_, k) => {
          const i = Math.round((k / marcas) * (n - 1));
          return (
            <text key={k} x={xDe(i)} y={ALTO - 8} textAnchor={k === 0 ? 'start' : k === marcas ? 'end' : 'middle'} className="lt-eje">
              {hms(Math.min(duracion_seg, i * intervalo_seg))}
            </text>
          );
        })}
        <path d={trazo(normalizar(serie_chat))} className="lt-chat" />
        <path d={trazo(normalizar(serie_audio))} className="lt-audio" />
        <path d={area} fill="url(#relleno-puntaje)" />
        <path d={trazo(puntajes)} className="lt-puntaje" />
        <line x1={M.izq} x2={ANCHO - M.der} y1={yDe(UMBRAL)} y2={yDe(UMBRAL)} className="lt-umbral" />
        <text x={ANCHO - M.der} y={yDe(UMBRAL) - 6} textAnchor="end" className="lt-umbral-texto">
          umbral 0,38
        </text>
        {momentos.map((m) => (
          <g key={m.id} className="lt-momento" onClick={() => onElegir?.(m)} role="button" tabIndex={0}>
            <title>{`Momento ${m.posicion} · ${hms(m.inicio_seg)} · puntaje ${m.puntaje.toFixed(2)}`}</title>
            <circle cx={xDe(m.indice)} cy={yDe(puntajes[m.indice])} r="13" />
            <text x={xDe(m.indice)} y={yDe(puntajes[m.indice]) + 5} textAnchor="middle">
              {m.posicion}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="lt-leyenda">
        <span><i className="ley-puntaje" /> Puntaje (0,6 × chat + 0,4 × voz)</span>
        <span><i className="ley-chat" /> Chat</span>
        <span><i className="ley-audio" /> Volumen de la voz</span>
      </figcaption>
    </figure>
  );
}
