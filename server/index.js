import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { iniciarDB, consultar, uno } from './db.js';
import { PLANES, CREDITOS } from '../shared/planes.js';
import { detectarMomentos, separacionEnIntervalos, ventanaDelClip } from '../shared/deteccion.js';

const archivoEnv = path.join(import.meta.dirname, '.env');
if (fs.existsSync(archivoEnv)) process.loadEnvFile(archivoEnv);

const app = express();
app.use(express.json({ limit: '5mb' }));

class ErrorHttp extends Error {
  constructor(estado, mensaje, extra = {}) {
    super(mensaje);
    this.estado = estado;
    this.extra = extra;
  }
}

function hms(segundos) {
  const s = Math.floor(segundos);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

async function registrarEvento(usuarioId, tipo, datos = null) {
  await consultar('INSERT INTO eventos (usuario_id, tipo, datos) VALUES ($1, $2, $3)', [usuarioId, tipo, datos]);
}

// ---------- Autenticación (simulada: entrar con el nombre del canal) ----------

async function autenticar(req, _res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const usuario = token ? await uno('SELECT * FROM usuarios WHERE token = $1', [token]) : null;
  if (!usuario) return next(new ErrorHttp(401, 'Inicia sesión para continuar.'));
  req.usuario = usuario;
  next();
}

const PLATAFORMAS = ['kick', 'twitch', 'youtube', 'archivo'];

app.post('/api/auth/entrar', async (req, res) => {
  const nombre = String(req.body.nombre || '').trim().slice(0, 40);
  const plataforma = PLATAFORMAS.includes(req.body.plataforma) ? req.body.plataforma : 'archivo';
  const canal = String(req.body.canal || nombre).trim().replace(/^@/, '').slice(0, 40);
  if (!nombre) throw new ErrorHttp(400, 'Escribe tu nombre o el de tu canal.');
  const token = crypto.randomBytes(24).toString('hex');
  const usuario = await uno(
    'INSERT INTO usuarios (nombre, plataforma, canal, token) VALUES ($1, $2, $3, $4) RETURNING *',
    [nombre, plataforma, canal, token],
  );
  await registrarEvento(usuario.id, 'registro', { plataforma });
  res.status(201).json({ token, usuario: limpiarUsuario(usuario) });
});

function limpiarUsuario(u) {
  const { token: _token, ...resto } = u;
  return resto;
}

async function usoDelMes(usuarioId) {
  const fila = await uno(
    `SELECT
       (SELECT count(*)::int FROM transmisiones WHERE usuario_id = $1 AND creado_en >= date_trunc('month', now())) AS transmisiones,
       (SELECT count(*)::int FROM clips WHERE usuario_id = $1 AND creado_en >= date_trunc('month', now())) AS clips`,
    [usuarioId],
  );
  return fila;
}

app.get('/api/yo', autenticar, async (req, res) => {
  const uso = await usoDelMes(req.usuario.id);
  res.json({ usuario: limpiarUsuario(req.usuario), plan: PLANES[req.usuario.plan], uso });
});

// ---------- Transmisiones (F1) y análisis (F2) ----------

app.get('/api/transmisiones', autenticar, async (req, res) => {
  const filas = await consultar(
    `SELECT t.id, t.titulo, t.origen, t.archivo_nombre, t.archivo_tamano, t.duracion_seg, t.chat_origen,
            t.estado, t.analisis_seg, t.creado_en,
            (SELECT count(*)::int FROM clips c WHERE c.transmision_id = t.id) AS clips,
            (SELECT count(*)::int FROM clips c WHERE c.transmision_id = t.id AND c.estado = 'aprobado') AS aprobados
       FROM transmisiones t WHERE t.usuario_id = $1 ORDER BY t.creado_en DESC`,
    [req.usuario.id],
  );
  res.json(filas);
});

app.post('/api/transmisiones', autenticar, async (req, res) => {
  const plan = PLANES[req.usuario.plan];
  const uso = await usoDelMes(req.usuario.id);
  if (plan.transmisionesMes !== null && uso.transmisiones >= plan.transmisionesMes) {
    await registrarEvento(req.usuario.id, 'limite_transmisiones', { plan: plan.id });
    throw new ErrorHttp(402, `Tu plan ${plan.nombre} permite ${plan.transmisionesMes} transmisiones al mes. Mejora tu plan para seguir.`, { limite: true });
  }
  const titulo = String(req.body.titulo || 'Transmisión').slice(0, 120);
  const origen = req.body.origen === 'ejemplo' ? 'ejemplo' : 'archivo';
  const duracion = Number(req.body.duracion_seg);
  if (!(duracion > 0)) throw new ErrorHttp(400, 'No se pudo leer la duración del video.');
  const t = await uno(
    `INSERT INTO transmisiones (usuario_id, titulo, origen, archivo_nombre, archivo_tamano, duracion_seg)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.usuario.id, titulo, origen, req.body.archivo_nombre || null, Number(req.body.archivo_tamano) || null, duracion],
  );
  res.status(201).json(t);
});

async function transmisionDelUsuario(id, usuarioId) {
  const t = await uno('SELECT * FROM transmisiones WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  if (!t) throw new ErrorHttp(404, 'No encontramos esa transmisión.');
  return t;
}

app.get('/api/transmisiones/:id', autenticar, async (req, res) => {
  const t = await transmisionDelUsuario(req.params.id, req.usuario.id);
  const momentos = await consultar('SELECT * FROM momentos WHERE transmision_id = $1 ORDER BY posicion', [t.id]);
  const clips = await consultar('SELECT * FROM clips WHERE transmision_id = $1 ORDER BY inicio_seg', [t.id]);
  res.json({ ...t, momentos, clips });
});

app.delete('/api/transmisiones/:id', autenticar, async (req, res) => {
  await transmisionDelUsuario(req.params.id, req.usuario.id);
  await consultar('DELETE FROM transmisiones WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

function serieNumerica(valor, nombre) {
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > 20000 || valor.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
    throw new ErrorHttp(400, `La serie "${nombre}" no es válida.`);
  }
  return valor;
}

app.post('/api/transmisiones/:id/analisis', autenticar, async (req, res) => {
  const t = await transmisionDelUsuario(req.params.id, req.usuario.id);
  if (t.estado === 'listo') throw new ErrorHttp(409, 'Esta transmisión ya fue analizada.');

  const intervalo = Math.max(1, Math.round(Number(req.body.intervalo_seg) || 60));
  const chat = serieNumerica(req.body.serie_chat, 'chat');
  const audio = serieNumerica(req.body.serie_audio, 'audio');
  if (chat.length !== audio.length) throw new ErrorHttp(400, 'Las series de chat y audio deben tener el mismo tamaño.');
  const audioPorSegundo = Array.isArray(req.body.audio_por_segundo) ? req.body.audio_por_segundo.slice(0, 100000) : null;

  // Cupo de clips: los del plan para este mes, más los créditos comprados.
  const plan = PLANES[req.usuario.plan];
  const uso = await usoDelMes(req.usuario.id);
  const libresDelMes = Math.max(0, plan.clipsMes - uso.clips);
  const maxClips = Math.min(plan.clipsPorTransmision, libresDelMes + req.usuario.creditos);

  const separacion = separacionEnIntervalos(t.duracion_seg, intervalo);
  const { puntaje, momentos } = detectarMomentos(chat, audio, maxClips, separacion);

  const creditosUsados = Math.max(0, momentos.length - libresDelMes);
  if (creditosUsados) await consultar('UPDATE usuarios SET creditos = creditos - $1 WHERE id = $2', [creditosUsados, req.usuario.id]);

  await consultar(
    `UPDATE transmisiones SET estado = 'listo', intervalo_seg = $2, serie_chat = $3, serie_audio = $4, puntajes = $5,
            chat_origen = $6, analisis_seg = $7 WHERE id = $1`,
    [t.id, intervalo, JSON.stringify(chat), JSON.stringify(audio), JSON.stringify(puntaje.map((p) => Math.round(p * 1000) / 1000)),
      req.body.chat_origen === 'archivo' ? 'archivo' : 'simulado', Number(req.body.analisis_seg) || null],
  );

  for (const [i, m] of momentos.entries()) {
    const { inicio, duracion } = ventanaDelClip({
      indice: m.indice,
      intervaloSeg: intervalo,
      audioPorSegundo,
      duracionTotal: t.duracion_seg,
    });
    const momento = await uno(
      'INSERT INTO momentos (transmision_id, posicion, indice, inicio_seg, puntaje) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [t.id, i + 1, m.indice, inicio, m.puntaje],
    );
    await consultar(
      `INSERT INTO clips (transmision_id, usuario_id, momento_id, titulo, inicio_seg, duracion_seg)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [t.id, req.usuario.id, momento.id, `Momento ${i + 1} · ${hms(inicio)}`, inicio, duracion],
    );
  }

  await registrarEvento(req.usuario.id, 'analisis', {
    transmision: t.id,
    momentos: momentos.length,
    limitados: momentos.length >= maxClips && maxClips < plan.clipsPorTransmision,
    duracion_seg: t.duracion_seg,
    analisis_seg: Number(req.body.analisis_seg) || null,
  });
  res.json({ momentos: momentos.length, maxClips });
});

// ---------- Clips (F3, F4, F5) ----------

const ESTADOS_CLIP = ['pendiente', 'aprobado', 'descartado'];
const ESTILOS = ['clasico', 'amarillo', 'caja'];
const FORMATOS = ['desenfocado', 'centrado', 'camara'];
const CAMARAS = ['sup-izq', 'sup-der', 'inf-izq', 'inf-der'];

const SELECT_CLIP = `
  SELECT c.*, t.titulo AS transmision_titulo, t.origen, t.archivo_nombre, t.archivo_tamano, t.duracion_seg AS transmision_duracion,
         COALESCE((SELECT json_agg(json_build_object('red', p.red, 'fecha', p.fecha_programada) ORDER BY p.red)
                     FROM publicaciones p WHERE p.clip_id = c.id), '[]') AS publicaciones
    FROM clips c JOIN transmisiones t ON t.id = c.transmision_id`;

app.get('/api/clips', autenticar, async (req, res) => {
  const filas = await consultar(`${SELECT_CLIP} WHERE c.usuario_id = $1 ORDER BY c.transmision_id DESC, c.inicio_seg`, [req.usuario.id]);
  res.json(filas);
});

async function clipDelUsuario(id, usuarioId) {
  const c = await uno(`${SELECT_CLIP} WHERE c.id = $1 AND c.usuario_id = $2`, [id, usuarioId]);
  if (!c) throw new ErrorHttp(404, 'No encontramos ese clip.');
  return c;
}

app.get('/api/clips/:id', autenticar, async (req, res) => {
  res.json(await clipDelUsuario(req.params.id, req.usuario.id));
});

app.patch('/api/clips/:id', autenticar, async (req, res) => {
  const c = await clipDelUsuario(req.params.id, req.usuario.id);
  const b = req.body;
  const cambios = {};
  if (typeof b.titulo === 'string') cambios.titulo = b.titulo.trim().slice(0, 100) || c.titulo;
  if (b.duracion_seg !== undefined) cambios.duracion_seg = Math.min(60, Math.max(15, Number(b.duracion_seg) || 30), c.transmision_duracion);
  if (b.inicio_seg !== undefined) {
    const duracion = cambios.duracion_seg ?? c.duracion_seg;
    cambios.inicio_seg = Math.min(Math.max(0, Number(b.inicio_seg) || 0), Math.max(0, c.transmision_duracion - duracion));
  }
  if (Array.isArray(b.subtitulos)) cambios.subtitulos = JSON.stringify(b.subtitulos.map((s) => String(s).slice(0, 120)).filter(Boolean).slice(0, 12));
  if (ESTILOS.includes(b.estilo)) cambios.estilo = b.estilo;
  if (FORMATOS.includes(b.formato)) cambios.formato = b.formato;
  if (CAMARAS.includes(b.camara)) cambios.camara = b.camara;
  if (ESTADOS_CLIP.includes(b.estado)) cambios.estado = b.estado;
  if (typeof b.generado === 'boolean') cambios.generado = b.generado;

  const columnas = Object.keys(cambios);
  if (columnas.length) {
    const sets = columnas.map((col, i) => `${col} = $${i + 2}`).join(', ');
    await consultar(`UPDATE clips SET ${sets}, actualizado_en = now() WHERE id = $1`, [c.id, ...columnas.map((col) => cambios[col])]);
    if (cambios.estado && cambios.estado !== c.estado) {
      await registrarEvento(req.usuario.id, `clip_${cambios.estado}`, { clip: c.id });
    }
  }
  res.json(await clipDelUsuario(c.id, req.usuario.id));
});

const REDES = ['tiktok', 'youtube', 'instagram'];

// Publicación programada (simulada: se guarda la fecha; la publicación real por API queda fuera del PMV).
app.post('/api/clips/:id/publicaciones', autenticar, async (req, res) => {
  const c = await clipDelUsuario(req.params.id, req.usuario.id);
  const redes = (req.body.redes || []).filter((r) => REDES.includes(r));
  const fecha = new Date(req.body.fecha);
  if (!redes.length) throw new ErrorHttp(400, 'Elige al menos una red social.');
  if (Number.isNaN(fecha.getTime())) throw new ErrorHttp(400, 'Elige una fecha y hora válidas.');
  await consultar('DELETE FROM publicaciones WHERE clip_id = $1', [c.id]);
  for (const red of redes) {
    await consultar('INSERT INTO publicaciones (clip_id, red, fecha_programada) VALUES ($1, $2, $3)', [c.id, red, fecha.toISOString()]);
  }
  if (c.estado !== 'aprobado') {
    await consultar(`UPDATE clips SET estado = 'aprobado', actualizado_en = now() WHERE id = $1`, [c.id]);
    await registrarEvento(req.usuario.id, 'clip_aprobado', { clip: c.id });
  }
  await registrarEvento(req.usuario.id, 'publicacion_programada', { clip: c.id, redes });
  res.status(201).json(await clipDelUsuario(c.id, req.usuario.id));
});

// ---------- Planes y pagos (F6, pago simulado con Yape/Plin) ----------

app.post('/api/pagos', autenticar, async (req, res) => {
  const producto = req.body.producto;
  const metodo = req.body.metodo === 'plin' ? 'plin' : 'yape';
  const precio = producto === 'creditos' ? CREDITOS.precio : PLANES[producto]?.precio;
  if (!precio) throw new ErrorHttp(400, 'Ese plan no existe.');
  const pago = await uno(
    'INSERT INTO pagos (usuario_id, producto, metodo, monto) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.usuario.id, producto, metodo, precio],
  );
  await registrarEvento(req.usuario.id, 'clic_plan_pago', { producto, plan_actual: req.usuario.plan });
  res.status(201).json(pago);
});

async function pagoDelUsuario(id, usuarioId) {
  const p = await uno('SELECT * FROM pagos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  if (!p) throw new ErrorHttp(404, 'No encontramos ese pago.');
  return p;
}

app.get('/api/pagos/:id', autenticar, async (req, res) => {
  res.json(await pagoDelUsuario(req.params.id, req.usuario.id));
});

app.post('/api/pagos/:id/confirmar', autenticar, async (req, res) => {
  const p = await pagoDelUsuario(req.params.id, req.usuario.id);
  if (p.estado !== 'pagado') {
    const metodo = ['yape', 'plin'].includes(req.body?.metodo) ? req.body.metodo : p.metodo;
    await consultar(`UPDATE pagos SET estado = 'pagado', metodo = $2, pagado_en = now() WHERE id = $1`, [p.id, metodo]);
    p.metodo = metodo;
    if (p.producto === 'creditos') {
      await consultar('UPDATE usuarios SET creditos = creditos + $1 WHERE id = $2', [CREDITOS.clips, req.usuario.id]);
    } else {
      await consultar('UPDATE usuarios SET plan = $1 WHERE id = $2', [p.producto, req.usuario.id]);
    }
    await registrarEvento(req.usuario.id, 'pago_demo', { producto: p.producto, metodo: p.metodo });
  }
  res.json(await pagoDelUsuario(p.id, req.usuario.id));
});

// ---------- Eventos e indicadores del PMV ----------

const EVENTOS_CLIENTE = ['ver_planes', 'clip_descargado', 'clip_generado'];

app.post('/api/eventos', autenticar, async (req, res) => {
  if (!EVENTOS_CLIENTE.includes(req.body.tipo)) throw new ErrorHttp(400, 'Evento no válido.');
  await registrarEvento(req.usuario.id, req.body.tipo, req.body.datos ?? null);
  res.status(204).end();
});

// Indicadores agregados (sin datos personales) para validar H2, H3 y H4.
app.get('/api/metricas', async (_req, res) => {
  const m = await uno(`
    SELECT
      (SELECT count(*)::int FROM usuarios) AS usuarios,
      (SELECT count(*)::int FROM transmisiones WHERE estado = 'listo') AS transmisiones,
      (SELECT count(*)::int FROM clips) AS clips_sugeridos,
      (SELECT count(*)::int FROM clips WHERE estado = 'aprobado') AS clips_aprobados,
      (SELECT count(*)::int FROM clips WHERE estado = 'descartado') AS clips_descartados,
      (SELECT count(*)::int FROM publicaciones) AS publicaciones,
      (SELECT avg(analisis_seg) FROM transmisiones WHERE analisis_seg IS NOT NULL AND origen = 'archivo') AS analisis_promedio_seg,
      (SELECT avg(duracion_seg) FROM transmisiones WHERE analisis_seg IS NOT NULL AND origen = 'archivo') AS duracion_promedio_seg,
      (SELECT count(DISTINCT usuario_id)::int FROM eventos WHERE tipo = 'clic_plan_pago') AS usuarios_clic_pago,
      (SELECT count(DISTINCT usuario_id)::int FROM eventos WHERE tipo = 'analisis') AS usuarios_con_analisis,
      (SELECT count(*)::int FROM pagos WHERE estado = 'pagado') AS pagos_demo
  `);
  res.json(m);
});

// ---------- Errores y frontend ----------

app.use('/api', (_req, _res, next) => next(new ErrorHttp(404, 'Ruta no encontrada.')));

app.use((err, _req, res, _next) => {
  if (!(err instanceof ErrorHttp)) console.error(err);
  const estado = err.estado || (err.type === 'entity.too.large' ? 413 : 500);
  res.status(estado).json({ error: err.estado ? err.message : 'Ocurrió un error en el servidor.', ...err.extra });
});

const dist = path.join(import.meta.dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// En desarrollo la API va en el 3001 (Vite usa el 5173 y le reenvía /api); en producción usa PORT.
const puerto = process.argv.includes('--dev') ? 3001 : Number(process.env.PORT) || 3001;
const motor = await iniciarDB();
app.listen(puerto, () => {
  console.log(`Clipazo API en http://localhost:${puerto} · base de datos: ${motor}`);
});
