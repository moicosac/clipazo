# Clipazo · Producto Mínimo Viable

Plataforma web con IA para la edición automatizada de clips dirigida a streamers emergentes de Lima Metropolitana.
Curso Formación de Empresas de Base Tecnológica I · Grupo 03 (Cueto Seclen, Loli Gomez, Sacsara Munaylla).

Clipazo toma una transmisión larga, detecta los mejores momentos combinando la actividad del chat (60 %) y el volumen de la voz (40 %)
y los convierte en clips verticales con subtítulos, listos para TikTok, Reels y Shorts.

## Qué hace el PMV

| Funcionalidad | Estado en el PMV |
|---|---|
| **F1. Carga de la transmisión** | Real: el usuario sube el video desde su computadora. Entrar con Kick, Twitch o YouTube es simulado y muestra transmisiones de ejemplo del canal. |
| **F2. Detección de momentos** | Real: FFmpeg mide el volumen de la voz segundo a segundo; el chat se lee de un archivo exportado (JSON de TwitchDownloader o `.txt` con horas) o se simula si no se sube. Aplica el algoritmo de la sección 5.1.5 y muestra la línea de tiempo. |
| **F3. Generación de clips** | Real: recorte de 15 a 60 s y paso a 9:16 (fondo desenfocado, recorte al centro o cámara arriba + juego abajo), con subtítulos y marca de agua. Se descarga como MP4. |
| **F4. Edición básica** | Real: título, inicio, duración, formato, posición de la cámara, texto y estilo de los subtítulos, con vista previa. |
| **F5. Aprobación y programación** | Aprobar y descartar es real. La programación se guarda con redes y fecha; la publicación automática por API queda fuera del PMV. |
| **F6. Planes y límites** | Los límites se aplican de verdad (Gratis: 2 transmisiones al mes, 5 clips por transmisión, 720p y marca de agua). El pago con Yape o Plin es de demostración (QR sin cobro). |

Además, la página **Métricas** (`/metricas`) calcula los indicadores de la sección 4.3.3 con datos anónimos:
porcentaje de clips aprobados (H4), tiempo de análisis por hora de transmisión (H2) y porcentaje de usuarios que hacen clic en un plan de pago (H3).

**Privacidad:** los videos nunca se suben al servidor. Se procesan en el navegador con FFmpeg compilado a WebAssembly;
el servidor solo guarda los datos (usuarios, transmisiones, momentos, clips, publicaciones, pagos y eventos).

## Arquitectura

```
Navegador (React + Vite)                       Servidor (Node.js + Express)        Datos
 ├─ Pantallas: bienvenida, inicio, subir,  ──►  /api/auth, /api/transmisiones,  ──►  PostgreSQL (Neon)
 │  analizando, resultados, clips, editor,      /api/clips, /api/pagos,             usuarios, transmisiones,
 │  programado, planes, pago, métricas          /api/metricas                       momentos, clips, publicaciones,
 └─ ffmpeg.wasm: volumen de la voz,             algoritmo de detección              pagos, eventos
    recorte vertical, subtítulos, MP4           límites de cada plan
```

- `client/`: interfaz en React. `client/src/lib/ffmpeg.js` hace el análisis de audio y genera los MP4; `client/src/lib/lienzo.js` define la composición vertical (la misma para la vista previa y para el MP4).
- `server/`: API en Express. `server/schema.sql` crea las tablas al iniciar.
- `shared/`: código usado por ambos lados: el algoritmo (`deteccion.js`), la lectura del chat (`chat.js`), los planes (`planes.js`) y los datos de ejemplo (`simulacion.js`).
- `test/`: pruebas del algoritmo (`npm test`).

### Ajustes al algoritmo respecto al informe

Al implementarlo encontramos dos casos que conviene reflejar en el informe:

1. **Se vuelve a escalar el puntaje después de suavizarlo.** Con el promedio móvil, un pico que dura un solo minuto queda en un tercio de su valor (≈ 0,33) y nunca supera el umbral de 0,38, aunque sea el mejor momento de la transmisión.
2. **El momento se ubica en el minuto con mayor puntaje real.** El suavizado convierte un pico aislado en una meseta de tres minutos; se elige el vecino con mayor puntaje sin suavizar.

Además, en videos de menos de 30 minutos el análisis usa intervalos más cortos que un minuto, y dentro del intervalo elegido el clip se centra en el segundo con la voz más fuerte.

## Cómo ejecutarlo en tu computadora

Requisitos: Node.js 20.12 o superior.

```bash
npm install
npm run dev
```

Abre http://localhost:5173. Sin configurar nada, los datos se guardan en una base PostgreSQL local embebida (PGlite) en `server/data/`.
Para usar la base de Neon, copia `server/.env.example` como `server/.env` y coloca tu `DATABASE_URL`.

Otros comandos:

```bash
npm test        # pruebas del algoritmo
npm run build   # compila la interfaz en client/dist
npm start       # servidor de producción (API + interfaz) en el puerto PORT
```

## Despliegue (Render + Neon)

- **Build command:** `npm ci && npm run build`
- **Start command:** `npm start`
- **Variable de entorno:** `DATABASE_URL` con la cadena de conexión de Neon.

## Fuera del PMV

Publicación automática en TikTok, YouTube e Instagram; descarga de transmisiones y chat por las API de Kick, Twitch y YouTube;
transcripción automática con Whisper; cobro real con Culqi o Mercado Pago; aplicación móvil; estadísticas de rendimiento de los clips.
