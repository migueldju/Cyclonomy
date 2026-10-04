#!/usr/bin/env bash
# Crea una base de pruebas desde cero, aplica migraciones + seed y ejecuta los tests.
#   PGHOST=/var/tmp/pgdata PGPORT=5433 bash supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-fantasy_test}
export PGUSER=${PGUSER:-postgres}
bash tests/apply.sh
P="psql -q -v ON_ERROR_STOP=1 -d $DB"
$P -o /dev/null -f tests/20_game_test.sql
echo "OK: todos los tests pasan"
