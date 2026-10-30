-- Esquema de Clipazo (PostgreSQL). Se ejecuta al iniciar el servidor; es idempotente.

CREATE TABLE IF NOT EXISTS usuarios (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  plataforma  TEXT NOT NULL,                 -- kick | twitch | youtube | archivo
  canal       TEXT,
  plan        TEXT NOT NULL DEFAULT 'gratis', -- gratis | creador | pro
  creditos    INTEGER NOT NULL DEFAULT 0,     -- clips extra comprados
  token       TEXT NOT NULL UNIQUE,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transmisiones (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo          TEXT NOT NULL,
  origen          TEXT NOT NULL,              -- archivo | ejemplo
  archivo_nombre  TEXT,
  archivo_tamano  DOUBLE PRECISION,
  duracion_seg    DOUBLE PRECISION NOT NULL,
  chat_origen     TEXT,                       -- archivo | simulado
  intervalo_seg   INTEGER,
  serie_chat      JSONB,
  serie_audio     JSONB,
  puntajes        JSONB,
  analisis_seg    DOUBLE PRECISION,           -- tiempo que tardó el análisis (indicador H2)
  estado          TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | listo
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS momentos (
  id              SERIAL PRIMARY KEY,
  transmision_id  INTEGER NOT NULL REFERENCES transmisiones(id) ON DELETE CASCADE,
  posicion        INTEGER NOT NULL,           -- 1 = mejor momento
  indice          INTEGER NOT NULL,           -- intervalo de la línea de tiempo
  inicio_seg      DOUBLE PRECISION NOT NULL,
  puntaje         DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS clips (
  id              SERIAL PRIMARY KEY,
  transmision_id  INTEGER NOT NULL REFERENCES transmisiones(id) ON DELETE CASCADE,
  usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  momento_id      INTEGER REFERENCES momentos(id) ON DELETE SET NULL,
  titulo          TEXT NOT NULL,
  inicio_seg      DOUBLE PRECISION NOT NULL,
  duracion_seg    DOUBLE PRECISION NOT NULL,
  subtitulos      JSONB NOT NULL DEFAULT '[]',
  estilo          TEXT NOT NULL DEFAULT 'clasico',     -- clasico | amarillo | caja
  formato         TEXT NOT NULL DEFAULT 'desenfocado', -- desenfocado | centrado | camara
  camara          TEXT NOT NULL DEFAULT 'sup-der',     -- sup-izq | sup-der | inf-izq | inf-der
  estado          TEXT NOT NULL DEFAULT 'pendiente',   -- pendiente | aprobado | descartado
  generado        BOOLEAN NOT NULL DEFAULT false,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS publicaciones (
  id                SERIAL PRIMARY KEY,
  clip_id           INTEGER NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  red               TEXT NOT NULL,            -- tiktok | youtube | instagram
  fecha_programada  TIMESTAMPTZ NOT NULL,
  estado            TEXT NOT NULL DEFAULT 'programada',
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pagos (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  producto    TEXT NOT NULL,                  -- creador | pro | creditos
  metodo      TEXT NOT NULL,                  -- yape | plin
  monto       DOUBLE PRECISION NOT NULL,
  estado      TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | pagado
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  pagado_en   TIMESTAMPTZ
);

-- Eventos de uso para medir las hipótesis del PMV (H2, H3, H4).
CREATE TABLE IF NOT EXISTS eventos (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,
  datos       JSONB,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transmisiones_usuario_idx ON transmisiones(usuario_id);
CREATE INDEX IF NOT EXISTS clips_usuario_idx ON clips(usuario_id);
CREATE INDEX IF NOT EXISTS clips_transmision_idx ON clips(transmision_id);
CREATE INDEX IF NOT EXISTS momentos_transmision_idx ON momentos(transmision_id);
CREATE INDEX IF NOT EXISTS eventos_tipo_idx ON eventos(tipo);
