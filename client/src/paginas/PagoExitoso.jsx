import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { CREDITOS, PLANES, formatearSoles } from '../../../shared/planes.js';

export default function PagoExitoso() {
  const { id } = useParams();
  const [pago, setPago] = useState(null);

  useEffect(() => {
    api(`/pagos/${id}`).then(setPago);
  }, [id]);

  if (!pago) return <div className="cargando-pagina">Cargando…</div>;
  const esCreditos = pago.producto === 'creditos';
  const plan = PLANES[pago.producto];

  return (
    <div className="pagina pagina-angosta">
      <div className="tarjeta confirmacion">
        <span className="confirmacion-icono">✓</span>
        <h1>{esCreditos ? '¡Créditos agregados!' : `¡Bienvenido al plan ${plan.nombre}!`}</h1>
        <p className="subtitulo">
          Pago de demostración por {formatearSoles(pago.monto)} con {pago.metodo === 'plin' ? 'Plin' : 'Yape'}.
        </p>
        <div className="desbloqueado">
          <h2>Lo que se desbloquea</h2>
          <ul>
            {esCreditos ? <li>{CREDITOS.clips} clips adicionales para usar cuando se acabe tu cupo</li> : plan.incluye.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
        <div className="fila-botones centrado">
          <Link to="/subir" className="boton boton-primario">
            Subir una transmisión
          </Link>
          <Link to="/clips" className="boton boton-fantasma">
            Ir a mis clips
          </Link>
        </div>
      </div>
    </div>
  );
}
