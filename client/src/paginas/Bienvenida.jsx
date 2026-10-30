import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../componentes/Logo.jsx';
import { api } from '../api.js';
import { useSesion } from '../sesion.jsx';

const OPCIONES = [
  { id: 'kick', texto: 'Entrar con Kick' },
  { id: 'twitch', texto: 'Entrar con Twitch' },
  { id: 'youtube', texto: 'Entrar con YouTube' },
];

export default function Bienvenida() {
  const { sesion, entrar } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [plataforma, setPlataforma] = useState(null);
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  if (sesion) return <Navigate to={ubicacion.state?.desde || '/inicio'} replace />;

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const { token } = await api('/auth/entrar', { metodo: 'POST', cuerpo: { nombre, plataforma, canal: nombre } });
      await entrar(token);
      navegar(plataforma === 'archivo' ? '/subir' : '/inicio');
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="bienvenida">
      <header className="bienvenida-cabecera">
        <Logo grande />
      </header>
      <section className="bienvenida-hero">
        <div>
          <h1>
            De 3 horas de stream a <span className="resaltado">5 clips listos</span> en minutos.
          </h1>
          <p className="bienvenida-sub">
            Clipazo encuentra los mejores momentos de tu transmisión usando el chat y tu voz, los pasa a formato vertical con subtítulos y
            te los deja listos para TikTok, Reels y Shorts. Sin saber editar y con precios en soles.
          </p>
          <ol className="pasos">
            <li><b>1</b> Sube tu transmisión</li>
            <li><b>2</b> La IA detecta los picos</li>
            <li><b>3</b> Revisa, edita y programa</li>
          </ol>
        </div>

        <div className="tarjeta tarjeta-entrar">
          {!plataforma ? (
            <>
              <h2>Empieza gratis</h2>
              <div className="botones-entrar">
                {OPCIONES.map((o) => (
                  <button key={o.id} type="button" className={`boton boton-${o.id}`} onClick={() => setPlataforma(o.id)}>
                    {o.texto}
                  </button>
                ))}
                <div className="separador"><span>o</span></div>
                <button type="button" className="boton boton-secundario" onClick={() => setPlataforma('archivo')}>
                  Subir un video desde mi computadora
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={enviar}>
              <h2>{plataforma === 'archivo' ? '¿Cómo te llamas?' : 'Nombre de tu canal'}</h2>
              <label className="campo">
                <span>{plataforma === 'archivo' ? 'Tu nombre o el de tu canal' : `Tu canal en ${OPCIONES.find((o) => o.id === plataforma).texto.replace('Entrar con ', '')}`}</span>
                <input autoFocus required maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: elchinogamer" />
              </label>
              {error && <p className="texto-alerta">{error}</p>}
              <button type="submit" className="boton boton-primario boton-ancho" disabled={enviando || !nombre.trim()}>
                {enviando ? 'Entrando…' : 'Continuar'}
              </button>
              <button type="button" className="boton-texto" onClick={() => setPlataforma(null)}>
                ← Elegir otra opción
              </button>
            </form>
          )}
          <p className="nota">
            Versión PMV: la conexión con Kick, Twitch y YouTube es simulada. Tus videos se procesan en tu navegador y no se suben a ningún
            servidor.
          </p>
        </div>
      </section>
    </div>
  );
}
