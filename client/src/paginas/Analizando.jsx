import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useSesion } from '../sesion.jsx';
import SelectorArchivo from '../componentes/SelectorArchivo.jsx';
import { analizarAudio, cargarFFmpeg } from '../lib/ffmpeg.js';
import { obtenerArchivo, obtenerChat } from '../lib/videos.js';
import { agruparPromedio, contarPorIntervalo, elegirIntervalo } from '../../../shared/deteccion.js';
import { leerChat } from '../../../shared/chat.js';
import { generarTransmisionEjemplo, simularChat } from '../../../shared/simulacion.js';
import { duracionLarga } from '../util.js';

const PASOS = [
  { id: 'motor', texto: 'Preparando el motor de video' },
  { id: 'audio', texto: 'Extrayendo el audio y midiendo el volumen de tu voz' },
  { id: 'chat', texto: 'Leyendo la actividad del chat' },
  { id: 'puntaje', texto: 'Calculando el puntaje de cada momento' },
  { id: 'clips', texto: 'Detectando los mejores momentos y creando los clips' },
];

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Analizando() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { refrescar } = useSesion();
  const [transmision, setTransmision] = useState(null);
  const [archivo, setArchivo] = useState(() => obtenerArchivo(id));
  const [paso, setPaso] = useState(0);
  const [progreso, setProgreso] = useState(0);
  const [notas, setNotas] = useState([]);
  const [error, setError] = useState('');
  const iniciado = useRef(false);

  useEffect(() => {
    api(`/transmisiones/${id}`).then(setTransmision).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!transmision || transmision.estado === 'listo' || iniciado.current) return;
    if (transmision.origen === 'archivo' && !archivo) return;
    iniciado.current = true;
    analizar(transmision).catch((e) => {
      console.error(e);
      setError(e.message || 'Ocurrió un error durante el análisis.');
      iniciado.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transmision, archivo]);

  async function analizar(t) {
    const comienzo = performance.now();
    const nota = (texto) => setNotas((n) => [...n, texto]);
    const duracion = t.duracion_seg;
    let audioPorSegundo;
    let serieChat;
    let chatOrigen = 'simulado';
    let intervalo;

    if (t.origen === 'ejemplo') {
      setPaso(0);
      await esperar(500);
      setPaso(1);
      const datos = generarTransmisionEjemplo(t.archivo_nombre || t.titulo, duracion);
      for (let p = 0; p <= 1; p += 0.1) {
        setProgreso(p);
        await esperar(90);
      }
      audioPorSegundo = datos.audioPorSegundo;
      setPaso(2);
      await esperar(500);
      intervalo = 60;
      serieChat = datos.chatPorMinuto;
      nota(`${serieChat.reduce((a, b) => a + b, 0).toLocaleString('es-PE')} mensajes de chat (datos de ejemplo).`);
    } else {
      setPaso(0);
      await cargarFFmpeg();
      setPaso(1);
      audioPorSegundo = await analizarAudio(archivo, duracion, setProgreso);
      if (!audioPorSegundo) {
        nota('El video no tiene audio: el puntaje se calculará solo con el chat.');
        audioPorSegundo = new Array(Math.ceil(duracion)).fill(0);
      }
      setPaso(2);
      intervalo = elegirIntervalo(duracion);
      const n = Math.ceil(duracion / intervalo);
      const textoChat = obtenerChat(t.id);
      const tiempos = textoChat ? leerChat(textoChat) : [];
      if (tiempos.length >= 5) {
        serieChat = contarPorIntervalo(tiempos, intervalo, n);
        chatOrigen = 'archivo';
        nota(`${tiempos.length.toLocaleString('es-PE')} mensajes de chat leídos del archivo.`);
      } else {
        serieChat = simularChat(agruparPromedio(audioPorSegundo, intervalo, n), t.id);
        nota('Sin archivo de chat: se usó un chat simulado a partir del volumen de tu voz.');
      }
      await esperar(300);
    }

    const n = serieChat.length;
    setPaso(3);
    const serieAudio = agruparPromedio(audioPorSegundo, intervalo, n);
    await esperar(400);

    setPaso(4);
    const respuesta = await api(`/transmisiones/${t.id}/analisis`, {
      metodo: 'POST',
      cuerpo: {
        intervalo_seg: intervalo,
        serie_chat: serieChat,
        serie_audio: serieAudio.map((v) => Math.round(v * 1000) / 1000),
        audio_por_segundo: audioPorSegundo.map((v) => Math.round(v * 1000) / 1000),
        chat_origen: chatOrigen,
        analisis_seg: Math.round((performance.now() - comienzo) / 100) / 10,
      },
    });
    await refrescar();
    setPaso(5);
    await esperar(600);
    navegar(`/transmisiones/${t.id}`, { replace: true, state: { recienAnalizada: true, maxClips: respuesta.maxClips } });
  }

  if (transmision?.estado === 'listo') return <Navigate to={`/transmisiones/${id}`} replace />;

  return (
    <div className="pagina pagina-angosta">
      <header className="pagina-cabecera">
        <div>
          <h1>Analizando…</h1>
          {transmision && (
            <p className="subtitulo">
              {transmision.titulo} · {duracionLarga(transmision.duracion_seg)}
            </p>
          )}
        </div>
      </header>

      {transmision && transmision.origen === 'archivo' && !archivo && (
        <SelectorArchivo transmision={transmision} onListo={setArchivo} />
      )}

      <div className="tarjeta pasos-analisis">
        {PASOS.map((p, i) => {
          const estado = i < paso ? 'hecho' : i === paso && transmision && (archivo || transmision.origen === 'ejemplo') ? 'activo' : 'espera';
          return (
            <div key={p.id} className={`paso-analisis paso-${estado}`}>
              <span className="paso-icono">{estado === 'hecho' ? '✓' : estado === 'activo' ? <span className="girando" /> : i + 1}</span>
              <div className="paso-texto">
                <span>{p.texto}</span>
                {p.id === 'audio' && estado === 'activo' && (
                  <div className="barra barra-fina">
                    <div className="barra-relleno" style={{ width: `${Math.round(progreso * 100)}%` }} />
                  </div>
                )}
                {p.id === 'motor' && estado === 'activo' && transmision?.origen === 'archivo' && (
                  <small>La primera vez se descarga el motor (unos 30 MB).</small>
                )}
                {p.id === 'audio' && estado === 'activo' && transmision?.origen === 'archivo' && (
                  <small>{Math.round(progreso * 100)} % · Una transmisión de 3 horas puede tardar algunos minutos.</small>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {notas.length > 0 && (
        <ul className="notas">
          {notas.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      {error && (
        <div className="aviso aviso-error">
          <p>{error}</p>
          <Link to="/inicio">Volver al inicio</Link>
        </div>
      )}
    </div>
  );
}
