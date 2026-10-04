# Cyclonomy

App móvil (Android e iOS) de fantasy de ciclismo al estilo Mister: ligas privadas, mercado diario con
subastas a ciegas, cláusulas, inscripciones por carrera y puntos según los resultados reales.
Las reglas completas están en el documento de especificación.

```
app/          App Expo (React Native + TypeScript, expo-router)
supabase/     Base de datos: esquema, lógica del juego (funciones SQL), seguridad, tareas programadas
  migrations/   0001 catálogo · 0002 juego · 0003 lógica interna · 0004 funciones de la app
                0005 seguridad · 0006 Storage y pg_cron · 0007 cola de la ingesta
  seed/         CSV editables: categorías y tabla de puntos
  seed.sql      generado desde los CSV (tools/build_seed.py)
  tests/        tests SQL que simulan una semana completa de liga
ingest/       Ingesta de ProCyclingStats en Python (tus scripts, unificados y conectados a la base)
tools/        Generadores de la tabla de puntos y comprobación de tipos de la app
```

La app solo habla con Supabase. Todo lo que mueve dinero (pujas, cierres de mercado, cláusulas,
ventas, pagos semanales) son funciones de Postgres que se ejecutan en una sola transacción, así que
no se puede trucar desde el móvil.

## 1. Supabase

1. Crea un proyecto en supabase.com e instala la CLI (`npm i -g supabase`).
2. `supabase link --project-ref <tu-proyecto>` y `supabase db push` (aplica `supabase/migrations`).
3. Carga categorías y puntos: `psql "$DATABASE_URL" -f supabase/seed.sql`.
4. Authentication → Providers: activa Email y Google (necesitas un cliente OAuth de Google Cloud).
5. Authentication → URL Configuration → Redirect URLs: añade `fantasyciclismo://auth/callback`
   (y la URL `exp://…/--/auth/callback` que te muestre Expo Go mientras desarrollas).
6. Database → Extensions: activa `pg_cron` si `0006` no pudo hacerlo. La tarea `fantasy-run-due-jobs`
   se ejecuta cada minuto y decide qué toca en hora de Madrid (mercados, cambio de semana, valores).
7. Para usar la carga manual de datos desde la app:
   `insert into app_admin values ('<tu user id>');`

## 2. Ingesta de PCS

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r ingest/requirements.txt
export DATABASE_URL="postgresql://postgres:<clave>@db.<proyecto>.supabase.co:5432/postgres"

# inicio de temporada
python -m ingest teams --season 2027 --points-year 2026 --birthdates --seed-values
python -m ingest calendar --season 2027

# después, de forma continua (o con .github/workflows/ingesta.yml)
python -m ingest run
```

`run` planifica cada día a las 00:00 (horas de salida, cierre de inscripciones), lee la lista de
salida al empezar cada carrera (y hace las alineaciones automáticas), lee los resultados 30 minutos
después de la llegada estimada (reintenta cada 30 minutos) y los relee al día siguiente por si hay
correcciones. Avisos de fallos por email (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `ALERT_EMAIL`) o
webhook (`ALERT_WEBHOOK`).

Si un parser no encaja con el HTML real de PCS: `python -m ingest debug-page <ruta>` guarda la página
en `debug/` para ajustar `ingest/parsers.py`. Si está instalada la librería `procyclingstats`, se usa
primero.

**Antes de publicar en las tiendas**, pide permiso a PCS o usa una fuente con licencia.

## 3. App

```bash
cd app
cp .env.example .env              # URL y clave anon de Supabase
npm install
npx expo install --fix            # alinea las versiones con tu SDK de Expo
npx expo start                    # prueba en Expo Go o en un emulador
```

Para las tiendas: `npx eas build -p android` / `-p ios` (necesitas cuenta de Expo y de desarrollador
de Apple/Google). Cambia `bundleIdentifier` y `package` en `app.json`.

## 4. Puntuación

Edita `supabase/seed/puntuacion.csv` (categoría, tipo, puesto, puntos) y `categorias.csv`
(profundidad e inscritos máximos), y luego:

```bash
python tools/build_seed.py && psql "$DATABASE_URL" -f supabase/seed.sql
```

`tools/gen_scoring.py` regenera la tabla aproximada inicial (puntos del ganador de la escala pública
de PCS; el reparto por puestos es una aproximación). La categoría de cada carrera la deciden las
reglas de `category_rule` (por clase UCI y nombre); la lista de "WT principal" está en
`tools/build_seed.py`.

## 5. Tests

```bash
# Postgres local (16+) con psql en el PATH
PGHOST=... PGPORT=... PGUSER=postgres bash supabase/tests/run.sh
PGHOST=... PGPORT=... PGUSER=postgres python -m unittest discover -s ingest/tests -t .
```

- **SQL:** simula una semana completa (alta en la liga, plantilla inicial, pujas con empate, cierre
  de mercado, subida de cláusula, clausulazo, oferta entre jugadores, venta al juego, bloqueo del
  domingo, alineación automática, puntos de clásica y de vuelta, cambio de semana con pagos,
  traspasos y sanción por deuda, valores diarios y permisos desde el rol de la app).
- **Ingesta:** parsers con HTML simulado y un día de carrera completo contra Postgres con PCS simulado.
- **App:** comprobación de tipos (`tools/tscheck`) con declaraciones mínimas; **no se ha ejecutado en
  un dispositivo**.
