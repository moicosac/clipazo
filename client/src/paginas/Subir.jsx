import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useSesion } from '../sesion.jsx';
import { guardarArchivo, guardarChat, leerMetadatos } from '../lib/videos.js';
import { leerChat } from '../../../shared/chat.js';
import { bytes, duracionLarga } from '../util.js';

export default function Subir() {
  const { plan, uso } = useSesion();
  const navegar = useNavigate();
  const [video, setVideo] = useState(null); // { archivo, meta }
  const [titulo, setTitulo] = useState('');
  const [chat, setChat] = useState(null); // { nombre, texto, mensajes }
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const sinCupo = plan.transmisionesMes !== null && uso.transmisiones >= plan.transmisionesMes;

  async function elegirVideo(archivo) {
    if (!archivo) return;
    setError('');
    if (!archivo.type.startsWith('video/') && !/\.(mp4|mov|mkv|webm|m4v)$/i.test(archivo.name)) {
      setError('Ese archivo no parece un video. Elige un MP4, MOV, MKV o WEBM.');
      return;
    }
    try {
      const meta = await leerMetadatos(archivo);
      setVideo({ archivo, meta });
      setTitulo(archivo.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 120));
    } catch (e) {
      setError(e.message);
    }
  }

  async function elegirChat(archivo) {
    if (!archivo) return;
    const texto = await archivo.text();
    const mensajes = leerChat(texto).length;
    setChat({ nombre: archivo.name, texto, mensajes });
  }

  async function analizar() {
    setEnviando(true);
    setError('');
    try {
      const t = await api('/transmisiones', {
        metodo: 'POST',
        cuerpo: {
          titulo: titulo.trim() || video.archivo.name,
          origen: 'archivo',
          archivo_nombre: video.archivo.name,
          archivo_tamano: video.archivo.size,
          duracion_seg: video.meta.duracion,
        },
      });
      guardarArchivo(t.id, video.archivo);
      if (chat?.mensajes) guardarChat(t.id, chat.texto);
      navegar(`/transmisiones/${t.id}/analizando`);
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  }

  return (
    <div className="pagina pagina-angosta">
      <header className="pagina-cabecera">
        <div>
          <h1>Subir transmisión</h1>
          <p className="subtitulo">El video se analiza en tu navegador: no se sube a ningún servidor.</p>
        </div>
      </header>

      {sinCupo && (
        <p className="aviso aviso-error">
          Ya usaste las {plan.transmisionesMes} transmisiones de tu plan {plan.nombre} este mes. <Link to="/planes">Mejora tu plan</Link> para
          seguir creando clips.
        </p>
      )}

      <label
        className={`zona-carga ${arrastrando ? 'zona-activa' : ''} ${video ? 'zona-lista' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          elegirVideo(e.dataTransfer.files?.[0]);
        }}
      >
        <input type="file" accept="video/*,.mkv" hidden onChange={(e) => elegirVideo(e.target.files?.[0])} />
        {video ? (
          <>
            <span className="zona-icono">🎬</span>
            <strong>{video.archivo.name}</strong>
            <span>
              {duracionLarga(video.meta.duracion)} · {video.meta.ancho}×{video.meta.alto} · {bytes(video.archivo.size)}
            </span>
            <span className="boton-texto">Cambiar video</span>
          </>
        ) : (
          <>
            <span className="zona-icono">⇪</span>
            <strong>Arrastra aquí el video de tu transmisión</strong>
            <span>o haz clic para elegirlo (MP4, MOV, WEBM)</span>
          </>
        )}
      </label>

      {video && (
        <div className="tarjeta formulario">
          <label className="campo">
            <span>Título de la transmisión</span>
            <input value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} />
          </label>

          <div className="campo">
            <span>Chat de la transmisión (opcional)</span>
            <label className="carga-chat">
              <input type="file" accept=".json,.txt,.log,.csv" hidden onChange={(e) => elegirChat(e.target.files?.[0])} />
              {chat ? (
                chat.mensajes ? (
                  <span>
                    ✓ <b>{chat.nombre}</b> · {chat.mensajes.toLocaleString('es-PE')} mensajes
                  </span>
                ) : (
                  <span className="texto-alerta">No encontramos mensajes con hora en {chat.nombre}. Se usará chat simulado.</span>
                )
              ) : (
                <span>Elegir archivo de chat (.json o .txt)</span>
              )}
            </label>
            <small className="ayuda">
              Acepta el JSON de TwitchDownloader o un .txt con una línea por mensaje y su hora, por ejemplo <code>[01:23:45] usuario: GOOOL</code>.
              Si no lo subes, el chat se simula a partir del volumen de tu voz.
            </small>
          </div>

          {error && <p className="texto-alerta">{error}</p>}
          <button type="button" className="boton boton-primario boton-ancho" disabled={enviando || sinCupo} onClick={analizar}>
            {enviando ? 'Preparando…' : 'Analizar transmisión'}
          </button>
        </div>
      )}
      {!video && error && <p className="aviso aviso-error">{error}</p>}
    </div>
  );
}
