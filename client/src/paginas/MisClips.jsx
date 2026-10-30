import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Miniatura from '../componentes/Miniatura.jsx';
import { ESTADOS_CLIP, REDES, fecha, hms } from '../util.js';

const FILTROS = [
  { id: 'todos', texto: 'Todos' },
  { id: 'pendiente', texto: 'Por revisar' },
  { id: 'aprobado', texto: 'Aprobados' },
  { id: 'descartado', texto: 'Descartados' },
];

export default function MisClips() {
  const [clips, setClips] = useState(null);
  const [filtro, setFiltro] = useState('todos');
  const [error, setError] = useState('');

  useEffect(() => {
    api('/clips').then(setClips).catch((e) => setError(e.message));
  }, []);

  async function cambiarEstado(clip, estado) {
    try {
      const actualizado = await api(`/clips/${clip.id}`, { metodo: 'PATCH', cuerpo: { estado } });
      setClips((lista) => lista.map((c) => (c.id === clip.id ? actualizado : c)));
    } catch (e) {
      setError(e.message);
    }
  }

  if (!clips) return <div className="cargando-pagina">{error || 'Cargando…'}</div>;

  const cuenta = (estado) => clips.filter((c) => estado === 'todos' || c.estado === estado).length;
  const visibles = clips.filter((c) => filtro === 'todos' || c.estado === filtro);

  return (
    <div className="pagina">
      <header className="pagina-cabecera">
        <div>
          <h1>Mis clips</h1>
          <p className="subtitulo">Aprueba los que te gusten, descarta el resto y edita los detalles antes de publicar.</p>
        </div>
      </header>

      <div className="pestanas" role="tablist">
        {FILTROS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} className={filtro === f.id ? 'activa' : ''} onClick={() => setFiltro(f.id)}>
            {f.texto} <span className="contador">{cuenta(f.id)}</span>
          </button>
        ))}
      </div>

      {error && <p className="aviso aviso-error">{error}</p>}

      {visibles.length === 0 ? (
        <div className="vacio">
          {clips.length === 0 ? (
            <>
              <p>Aún no tienes clips.</p>
              <Link to="/subir" className="boton boton-primario">Subir una transmisión</Link>
            </>
          ) : (
            <p>No hay clips en esta categoría.</p>
          )}
        </div>
      ) : (
        <div className="grilla-clips">
          {visibles.map((c) => (
            <article key={c.id} className={`tarjeta-clip estado-${c.estado}`}>
              <Link to={`/clips/${c.id}`}>
                <Miniatura clip={c} />
              </Link>
              <div className="tarjeta-clip-cuerpo">
                <Link to={`/clips/${c.id}`} className="titulo-clip">{c.titulo}</Link>
                <span className="meta">
                  {c.transmision_titulo} · {hms(c.inicio_seg)}
                </span>
                <span className={`etiqueta etiqueta-${c.estado}`}>{ESTADOS_CLIP[c.estado]}</span>
                {c.publicaciones.length > 0 && (
                  <span className="meta programado">
                    🗓 {fecha(c.publicaciones[0].fecha, true)} · {c.publicaciones.map((p) => REDES[p.red].nombre).join(', ')}
                  </span>
                )}
                <div className="acciones-clip">
                  {c.estado !== 'aprobado' && (
                    <button type="button" className="boton boton-chico boton-exito" onClick={() => cambiarEstado(c, 'aprobado')}>
                      ✓ Aprobar
                    </button>
                  )}
                  {c.estado !== 'descartado' && (
                    <button type="button" className="boton boton-chico boton-fantasma" onClick={() => cambiarEstado(c, 'descartado')}>
                      ✕ Descartar
                    </button>
                  )}
                  <Link to={`/clips/${c.id}`} className="boton boton-chico boton-secundario">
                    ✎ Editar
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
