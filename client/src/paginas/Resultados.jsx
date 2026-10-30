import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useSesion } from '../sesion.jsx';
import LineaTiempo from '../componentes/LineaTiempo.jsx';
import Miniatura from '../componentes/Miniatura.jsx';
import SelectorArchivo from '../componentes/SelectorArchivo.jsx';
import { obtenerArchivo } from '../lib/videos.js';
import { ESTADOS_CLIP, duracionLarga, fecha, hms } from '../util.js';

export default function Resultados() {
  const { id } = useParams();
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const { plan } = useSesion();
  const [t, setT] = useState(null);
  const [error, setError] = useState('');
  const [, setArchivoListo] = useState(0);

  useEffect(() => {
    api(`/transmisiones/${id}`).then(setT).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="pagina"><p className="aviso aviso-error">{error}</p></div>;
  if (!t) return <div className="cargando-pagina">Cargando…</div>;

  const clipDeMomento = (m) => t.clips.find((c) => c.momento_id === m.id);
  const faltaArchivo = t.origen === 'archivo' && !obtenerArchivo(t.id);
  const limitado = t.momentos.length >= plan.clipsPorTransmision;

  async function eliminar() {
    if (!window.confirm('¿Eliminar esta transmisión y sus clips?')) return;
    await api(`/transmisiones/${t.id}`, { metodo: 'DELETE' });
    navegar('/inicio');
  }

  return (
    <div className="pagina">
      <header className="pagina-cabecera">
        <div>
          <p className="miga">
            <Link to="/inicio">Inicio</Link> / Resultados
          </p>
          <h1>{t.titulo}</h1>
          <p className="subtitulo">
            {fecha(t.creado_en)} · {duracionLarga(t.duracion_seg)} · {t.origen === 'ejemplo' ? 'datos de ejemplo' : t.archivo_nombre} ·{' '}
            {t.chat_origen === 'archivo' ? 'chat real' : 'chat simulado'}
            {t.analisis_seg ? ` · analizada en ${Math.round(t.analisis_seg)} s` : ''}
          </p>
        </div>
        <Link to="/clips" className="boton boton-primario">
          Ver mis clips →
        </Link>
      </header>

      {ubicacion.state?.recienAnalizada && t.momentos.length > 0 && (
        <p className="aviso aviso-exito">
          ¡Listo! Encontramos {t.momentos.length} {t.momentos.length === 1 ? 'momento' : 'momentos'} y {t.momentos.length === 1 ? 'creamos su clip' : 'creamos sus clips'}.
        </p>
      )}

      <section className="tarjeta">
        <h2 className="tarjeta-titulo">Línea de tiempo</h2>
        <LineaTiempo transmision={t} onElegir={(m) => { const c = clipDeMomento(m); if (c) navegar(`/clips/${c.id}`); }} />
      </section>

      {faltaArchivo && <SelectorArchivo transmision={t} onListo={() => setArchivoListo((n) => n + 1)} />}

      <section className="seccion">
        <h2>Momentos detectados</h2>
        {t.momentos.length === 0 ? (
          <div className="vacio">
            <p>Ningún momento superó el umbral de 0,38. Prueba con una transmisión con más reacciones o sube el chat.</p>
          </div>
        ) : (
          <div className="grilla-clips">
            {t.momentos.map((m) => {
              const c = clipDeMomento(m);
              if (!c) return null;
              return (
                <Link key={m.id} to={`/clips/${c.id}`} className="tarjeta-clip">
                  <Miniatura clip={{ ...c, origen: t.origen }} />
                  <div className="tarjeta-clip-cuerpo">
                    <span className="posicion">#{m.posicion}</span>
                    <strong>{c.titulo}</strong>
                    <span className="meta">
                      {hms(c.inicio_seg)} · puntaje {m.puntaje.toFixed(2).replace('.', ',')}
                    </span>
                    <span className={`etiqueta etiqueta-${c.estado}`}>{ESTADOS_CLIP[c.estado]}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {limitado && plan.id === 'gratis' && (
          <p className="nota">
            Tu plan {plan.nombre} crea hasta {plan.clipsPorTransmision} clips por transmisión. <Link to="/planes">Con Creador obtienes hasta 10.</Link>
          </p>
        )}
      </section>

      <button type="button" className="boton-texto boton-peligro" onClick={eliminar}>
        Eliminar transmisión
      </button>
    </div>
  );
}
