import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, registrarEvento } from '../api.js';
import Miniatura from '../componentes/Miniatura.jsx';
import { descargar, nombreArchivoClip, obtenerMp4 } from '../lib/videos.js';
import { REDES, fecha, hms } from '../util.js';

export default function Programado() {
  const { id } = useParams();
  const [clip, setClip] = useState(null);
  const [mp4, setMp4] = useState(null);

  useEffect(() => {
    api(`/clips/${id}`).then(setClip);
    obtenerMp4(id).then(setMp4);
  }, [id]);

  if (!clip) return <div className="cargando-pagina">Cargando…</div>;
  const cuando = clip.publicaciones[0]?.fecha;

  return (
    <div className="pagina pagina-angosta">
      <div className="tarjeta confirmacion">
        <span className="confirmacion-icono">✓</span>
        <h1>¡Clip programado!</h1>
        <p className="subtitulo">Se publicará el {cuando ? fecha(cuando, true) : '—'}</p>
        <div className="confirmacion-resumen">
          <Miniatura clip={clip} />
          <div>
            <strong>{clip.titulo}</strong>
            <p className="meta">
              {clip.transmision_titulo} · desde {hms(clip.inicio_seg)} · {Math.round(clip.duracion_seg)} s
            </p>
            <ul className="lista-redes">
              {clip.publicaciones.map((p) => (
                <li key={p.red}>
                  <i style={{ background: REDES[p.red].color }} /> {REDES[p.red].nombre}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="fila-botones centrado">
          {mp4 && (
            <button
              type="button"
              className="boton boton-lima"
              onClick={() => {
                descargar(mp4.blob, nombreArchivoClip(clip));
                registrarEvento('clip_descargado', { clip: clip.id });
              }}
            >
              ⬇ Descargar MP4
            </button>
          )}
          <Link to="/clips" className="boton boton-primario">
            Ver mis clips
          </Link>
          <Link to="/inicio" className="boton boton-fantasma">
            Volver al inicio
          </Link>
        </div>
        <p className="nota">Demostración del PMV: la publicación automática en redes aún no está conectada.</p>
      </div>
    </div>
  );
}
