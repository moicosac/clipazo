import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Logo from '../componentes/Logo.jsx';
import { useSesion } from '../sesion.jsx';

function Indicador({ hipotesis, titulo, valor, detalle, meta, cumple }) {
  return (
    <div className="tarjeta indicador">
      <span className="indicador-h">{hipotesis}</span>
      <h3>{titulo}</h3>
      <strong className="indicador-valor">{valor}</strong>
      <p className="meta">{detalle}</p>
      {meta && (
        <span className={`etiqueta ${cumple === null ? 'etiqueta-pendiente' : cumple ? 'etiqueta-aprobado' : 'etiqueta-descartado'}`}>
          {cumple === null ? 'Sin datos aún' : cumple ? 'Cumple' : 'No cumple'} · meta: {meta}
        </span>
      )}
    </div>
  );
}

export default function Metricas() {
  const { sesion } = useSesion();
  const [m, setM] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/metricas').then(setM).catch((e) => setError(e.message));
  }, []);

  if (!m) return <div className="cargando-pagina">{error || 'Cargando…'}</div>;

  const revisados = m.clips_aprobados + m.clips_descartados;
  const aprobacion = revisados ? m.clips_aprobados / revisados : null;
  const clicPago = m.usuarios_con_analisis ? m.usuarios_clic_pago / m.usuarios_con_analisis : null;
  const segundosPorHora = m.analisis_promedio_seg && m.duracion_promedio_seg ? m.analisis_promedio_seg / (m.duracion_promedio_seg / 3600) : null;
  const porHora =
    segundosPorHora === null ? null : segundosPorHora < 90 ? `${Math.round(segundosPorHora)} s` : `${(segundosPorHora / 60).toFixed(1).replace('.', ',')} min`;

  return (
    <div className="pagina">
      {!sesion && (
        <div className="cabecera-publica">
          <Logo />
          <Link to="/" className="boton boton-chico boton-primario">Probar Clipazo</Link>
        </div>
      )}
      <header className="pagina-cabecera">
        <div>
          <h1>Métricas del PMV</h1>
          <p className="subtitulo">Indicadores para validar las hipótesis del negocio con los usuarios de prueba (datos agregados y anónimos).</p>
        </div>
      </header>

      <section className="resumen resumen-4">
        <div className="tarjeta medidor"><span className="medidor-titulo">Usuarios</span><strong className="medidor-valor">{m.usuarios}</strong></div>
        <div className="tarjeta medidor"><span className="medidor-titulo">Transmisiones analizadas</span><strong className="medidor-valor">{m.transmisiones}</strong></div>
        <div className="tarjeta medidor"><span className="medidor-titulo">Clips sugeridos</span><strong className="medidor-valor">{m.clips_sugeridos}</strong></div>
        <div className="tarjeta medidor"><span className="medidor-titulo">Publicaciones programadas</span><strong className="medidor-valor">{m.publicaciones}</strong></div>
      </section>

      <section className="grilla-indicadores">
        <Indicador
          hipotesis="H4"
          titulo="Clips sugeridos que el usuario aprueba"
          valor={aprobacion === null ? '—' : `${Math.round(aprobacion * 100)} %`}
          detalle={`${m.clips_aprobados} aprobados de ${revisados} revisados`}
          meta="al menos 1 de cada 3 (33 %)"
          cumple={aprobacion === null ? null : aprobacion >= 1 / 3}
        />
        <Indicador
          hipotesis="H2"
          titulo="Tiempo para obtener los clips"
          valor={m.analisis_promedio_seg ? `${Math.round(m.analisis_promedio_seg)} s` : '—'}
          detalle={
            porHora === null
              ? 'Promedio por video real analizado (sin contar los de ejemplo)'
              : `≈ ${porHora} de análisis por cada hora de transmisión (editar a mano toma horas)`
          }
        />
        <Indicador
          hipotesis="H3"
          titulo="Usuarios que hacen clic en un plan de pago"
          valor={clicPago === null ? '—' : `${Math.round(clicPago * 100)} %`}
          detalle={`${m.usuarios_clic_pago} de ${m.usuarios_con_analisis} usuarios que analizaron una transmisión · ${m.pagos_demo} pagos de demostración`}
        />
      </section>
    </div>
  );
}
