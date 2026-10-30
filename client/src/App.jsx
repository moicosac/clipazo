import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Logo from './componentes/Logo.jsx';
import { RequiereSesion, useSesion } from './sesion.jsx';
import { PLATAFORMAS } from './util.js';
import Bienvenida from './paginas/Bienvenida.jsx';
import Inicio from './paginas/Inicio.jsx';
import Subir from './paginas/Subir.jsx';
import Analizando from './paginas/Analizando.jsx';
import Resultados from './paginas/Resultados.jsx';
import MisClips from './paginas/MisClips.jsx';
import Editor from './paginas/Editor.jsx';
import Programado from './paginas/Programado.jsx';
import Planes from './paginas/Planes.jsx';
import Pago from './paginas/Pago.jsx';
import PagoExitoso from './paginas/PagoExitoso.jsx';
import Metricas from './paginas/Metricas.jsx';

function Menu() {
  const { usuario, plan, salir } = useSesion();
  const navegar = useNavigate();
  const plataforma = PLATAFORMAS[usuario.plataforma];
  return (
    <aside className="menu">
      <NavLink to="/inicio" className="menu-logo">
        <Logo />
      </NavLink>
      <nav className="menu-enlaces">
        <NavLink to="/inicio">
          <span aria-hidden="true">⌂</span> Inicio
        </NavLink>
        <NavLink to="/subir">
          <span aria-hidden="true">⇪</span> Subir
        </NavLink>
        <NavLink to="/clips">
          <span aria-hidden="true">▶</span> Mis clips
        </NavLink>
        <NavLink to="/planes">
          <span aria-hidden="true">★</span> Planes
        </NavLink>
        <NavLink to="/metricas" className="menu-secundario">
          <span aria-hidden="true">◔</span> Métricas
        </NavLink>
      </nav>
      <div className="menu-usuario">
        <span className="avatar" style={{ background: plataforma.color }}>
          {usuario.nombre.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong>{usuario.nombre}</strong>
          <span className={`etiqueta-plan plan-${plan.id}`}>Plan {plan.nombre}</span>
        </div>
        <button
          type="button"
          className="boton-texto"
          onClick={() => {
            salir();
            navegar('/');
          }}
        >
          Salir
        </button>
      </div>
    </aside>
  );
}

function ConMenu({ children }) {
  return (
    <RequiereSesion>
      <div className="app">
        <Menu />
        <main className="contenido">{children}</main>
      </div>
    </RequiereSesion>
  );
}

function MetricasPublicas() {
  const { sesion } = useSesion();
  if (sesion) return <ConMenu><Metricas /></ConMenu>;
  return (
    <main className="contenido contenido-solo">
      <Metricas />
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Bienvenida />} />
      <Route path="/inicio" element={<ConMenu><Inicio /></ConMenu>} />
      <Route path="/subir" element={<ConMenu><Subir /></ConMenu>} />
      <Route path="/transmisiones/:id/analizando" element={<ConMenu><Analizando /></ConMenu>} />
      <Route path="/transmisiones/:id" element={<ConMenu><Resultados /></ConMenu>} />
      <Route path="/clips" element={<ConMenu><MisClips /></ConMenu>} />
      <Route path="/clips/:id" element={<ConMenu><Editor /></ConMenu>} />
      <Route path="/clips/:id/programado" element={<ConMenu><Programado /></ConMenu>} />
      <Route path="/planes" element={<ConMenu><Planes /></ConMenu>} />
      <Route path="/pago/:id" element={<ConMenu><Pago /></ConMenu>} />
      <Route path="/pago/:id/exito" element={<ConMenu><PagoExitoso /></ConMenu>} />
      <Route path="/metricas" element={<MetricasPublicas />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
