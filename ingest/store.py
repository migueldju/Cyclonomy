"""Escrituras de la ingesta en la base de datos (todas idempotentes)."""
from __future__ import annotations

import datetime as dt


def upsert_team(db, slug: str, name: str, level: str, season: int) -> int:
    return db.scalar(
        "insert into public.team (pcs_slug, name, level, season) values (%s, %s, %s, %s) "
        "on conflict (pcs_slug) do update set name = excluded.name, level = excluded.level, season = excluded.season "
        "returning id", (slug, name, level, season))


def upsert_rider(db, slug: str, name: str, team_id: int | None, nationality: str | None = None,
                 birthdate: dt.date | None = None, points: int | None = None) -> int:
    return db.scalar(
        "insert into public.rider (pcs_slug, name, nationality, team_id, birthdate, pcs_points_base, active) "
        "values (%s, %s, %s, %s, %s, coalesce(%s, 0), true) "
        "on conflict (pcs_slug) do update set name = excluded.name, "
        "  nationality = coalesce(excluded.nationality, public.rider.nationality), team_id = excluded.team_id, "
        "  birthdate = coalesce(excluded.birthdate, public.rider.birthdate), "
        "  pcs_points_base = coalesce(%s, public.rider.pcs_points_base), active = true, updated_at = now() "
        "returning id", (slug, name, nationality or None, team_id, birthdate, points, points))


def deactivate_missing(db, seen_slugs: list[str]) -> int:
    """Ciclistas que ya no están en ningún WorldTeam/ProTeam: fuera del juego (no salen al mercado)."""
    return db.scalar(
        "with u as (update public.rider set active = false, team_id = null "
        "           where active and not (pcs_slug = any (%s)) returning 1) select count(*) from u",
        (list(seen_slugs),))


def delete_stale_teams(db, season: int, kept_slugs: list[str]) -> int:
    """Equipos de la temporada que ya no están en el listado (o están excluidos) y se han quedado sin ciclistas."""
    return db.scalar(
        "with d as (delete from public.team t where t.season = %s and not (t.pcs_slug = any (%s)) "
        "           and not exists (select 1 from public.rider r where r.team_id = t.id and r.active) "
        "           returning 1) select count(*) from d",
        (season, list(kept_slugs)))


def riders_without_birthdate(db) -> list[str]:
    return [r[0] for r in db.fetchall("select pcs_slug from public.rider where active and birthdate is null")]


def set_birthdate(db, slug: str, birthdate: dt.date) -> None:
    db.execute("update public.rider set birthdate = %s where pcs_slug = %s", (birthdate, slug))


def upsert_race(db, race: dict, season: int) -> int | None:
    """Crea o actualiza una carrera. Devuelve None si ninguna regla de categoría la acepta."""
    cat = db.scalar("select public.classify_race(%s, %s, %s)", (race["slug"], race["name"], race["uci_class"]))
    if not cat:
        return None
    return db.scalar(
        "insert into public.race (pcs_slug, season, name, uci_class, category, country, start_date, end_date, "
        "                         is_stage_race, entries_close_at) "
        "values (%s, %s, %s, %s, %s, %s, %s, %s, %s, ((%s::date + time '11:00') at time zone 'Europe/Madrid')) "
        "on conflict (pcs_slug, season) do update set name = excluded.name, uci_class = excluded.uci_class, "
        "  category = excluded.category, country = excluded.country, is_stage_race = excluded.is_stage_race, "
        "  entries_close_at = case when public.race.start_date = excluded.start_date "
        "                          then public.race.entries_close_at else excluded.entries_close_at end, "
        "  start_date = excluded.start_date, end_date = excluded.end_date "
        "returning id",
        (race["slug"], season, race["name"], race["uci_class"], cat, race.get("country") or None,
         race["start_date"], race["end_date"], race["is_stage_race"], race["start_date"]))


def upsert_stage(db, race_id: int, stage: dict) -> int:
    return db.scalar(
        "insert into public.stage (race_id, number, date, distance_km, is_itt) values (%s, %s, %s, %s, %s) "
        "on conflict (race_id, number) do update set date = excluded.date, "
        "  distance_km = coalesce(excluded.distance_km, public.stage.distance_km), is_itt = excluded.is_itt "
        "returning id", (race_id, stage["number"], stage["date"], stage.get("distance_km"), stage.get("is_itt", False)))


def update_stage_times(db, stage_id: int, start_at: dt.datetime, est_finish_at: dt.datetime,
                       distance_km: float | None) -> None:
    db.execute("update public.stage set start_at = %s, est_finish_at = %s, "
               "distance_km = coalesce(%s, distance_km) where id = %s",
               (start_at, est_finish_at, distance_km, stage_id))


def set_entries_close(db, race_id: int, close_at: dt.datetime) -> None:
    """Fija el cierre de inscripciones a la hora real de salida (si la carrera aún no ha empezado)."""
    db.execute("update public.race set entries_close_at = %s "
               "where id = %s and public.app_now() < entries_close_at and not auto_lineup_done",
               (close_at, race_id))


def create_task(db, kind: str, race_id: int, stage_id: int | None, due_at: dt.datetime,
                max_attempts: int, retry_every: dt.timedelta) -> None:
    db.execute(
        "insert into public.ingest_task (kind, race_id, stage_id, due_at, max_attempts, retry_every) "
        "values (%s, %s, %s, %s, %s, %s) "
        "on conflict (kind, race_id, coalesce(stage_id, 0)) where status = 'pending' "
        "do update set due_at = excluded.due_at, updated_at = now()",
        (kind, race_id, stage_id, due_at, max_attempts, retry_every))


def due_tasks(db, now: dt.datetime) -> list[dict]:
    rows = db.fetchall(
        "select t.id, t.kind, t.race_id, t.stage_id, t.attempts, t.max_attempts, extract(epoch from t.retry_every), "
        "       r.pcs_slug, r.season, r.is_stage_race, s.number "
        "from public.ingest_task t join public.race r on r.id = t.race_id "
        "left join public.stage s on s.id = t.stage_id "
        "where t.status = 'pending' and t.due_at <= %s order by t.due_at", (now,))
    keys = ["id", "kind", "race_id", "stage_id", "attempts", "max_attempts", "retry_seconds",
            "slug", "season", "is_stage_race", "number"]
    return [dict(zip(keys, r)) for r in rows]


def finish_task(db, task_id: int) -> None:
    db.execute("update public.ingest_task set status = 'done', attempts = attempts + 1, last_error = null, "
               "updated_at = now() where id = %s", (task_id,))


def retry_task(db, task: dict, error: str, now: dt.datetime) -> str:
    """Programa un reintento o marca la tarea como fallida. Devuelve el nuevo estado."""
    attempts = task["attempts"] + 1
    status = "failed" if attempts >= task["max_attempts"] else "pending"
    db.execute("update public.ingest_task set attempts = %s, status = %s, last_error = %s, "
               "due_at = %s, updated_at = now() where id = %s",
               (attempts, status, error[:500], now + dt.timedelta(seconds=float(task["retry_seconds"])), task["id"]))
    return status


def set_startlist(db, race_id: int, slugs: list[str]) -> int:
    db.execute("delete from public.startlist where race_id = %s", (race_id,))
    return db.scalar(
        "with ins as (insert into public.startlist (race_id, rider_id) "
        "             select %s, id from public.rider where pcs_slug = any (%s) on conflict do nothing returning 1) "
        "select count(*) from ins", (race_id, list(slugs)))


def stored_results(db, stage_id: int) -> dict[str, list[tuple[str, int]]]:
    out: dict[str, list] = {}
    for kind, slug, pos in db.fetchall(
            "select r.kind, rd.pcs_slug, r.position from public.result r join public.rider rd on rd.id = r.rider_id "
            "where r.stage_id = %s order by r.kind, r.position", (stage_id,)):
        out.setdefault(kind, []).append((slug, pos))
    return out


def set_results(db, stage_id: int, results: dict[str, list[tuple[str, int]]], is_stage_race: bool) -> int:
    """Guarda los resultados (solo de ciclistas del juego). En vueltas, el líder de la montaña tras la etapa
    es el 1.º de la clasificación de la montaña."""
    rows = {k: v for k, v in results.items() if k in ("stage", "gc", "points", "kom")}
    if is_stage_race and rows.get("kom"):
        leader = min(rows["kom"], key=lambda x: x[1])
        rows["kom_leader"] = [(leader[0], 1)]
    db.execute("delete from public.result where stage_id = %s", (stage_id,))
    n = 0
    for kind, items in rows.items():
        if not items:
            continue
        slugs = [s for s, _ in items]
        positions = [int(p) for _, p in items]
        n += db.scalar(
            "with ins as (insert into public.result (stage_id, kind, rider_id, position) "
            "  select %s, %s, rd.id, x.pos from unnest(%s::text[], %s::int[]) as x(slug, pos) "
            "  join public.rider rd on rd.pcs_slug = x.slug on conflict do nothing returning 1) "
            "select count(*) from ins", (stage_id, kind, slugs, positions))
    db.execute("update public.stage set status = 'finished' where id = %s and status = 'scheduled'", (stage_id,))
    return n
