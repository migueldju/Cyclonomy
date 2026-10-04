#!/usr/bin/env bash
# Crea la base de pruebas y aplica stub + migraciones + seed + fixtures
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-fantasy_test}
export PGUSER=${PGUSER:-postgres}
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" 2>/dev/null
P="psql -q -v ON_ERROR_STOP=1 -d $DB"
$P -f tests/00_stub_supabase.sql
for f in $(ls migrations/000*.sql | grep -v 0006_); do $P -f "$f"; done
$P -f seed.sql
$P -f tests/10_fixtures.sql
