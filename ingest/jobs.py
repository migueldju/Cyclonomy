"""Tareas de la ingesta: cargar equipos y calendario, planificar el día y ejecutar las lecturas pendientes.

Horario (hora de Madrid):
  00:00           plan_day(): horas de salida de hoy y mañana, cierre de inscripciones, tareas del día
                  y relectura de los resultados de ayer
  cada 5 min      tick(): ejecuta las tareas que tocan
                    · startlist  → a la salida de la 1.ª etapa: lista de salida + alineación automática
                                   (reintenta cada 15 min, hasta 8 veces = 2 horas)
                    · results    → 30 min después de la llegada estimada: resultados + puntos
                                   (reintenta cada 30 min, hasta 6 veces)
                    · recheck    → al día siguiente: si PCS corrigió algo, se recalcula
  lunes 03:00     equipos y plantillas
  lunes 03:30     calendario
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import smtplib
import urllib.request
from email.message import EmailMessage

from . import sources, store
from .tz import MADRID, race_tz

log = logging.getLogger("ingest.jobs")

AVG_SPEED_KMH = 42
FINISH_MARGIN = dt.timedelta(minutes=15)
RESULTS_DELAY = dt.timedelta(minutes=30)
DEFAULT_START = dt.time(12, 0)
DEFAULT_DISTANCE = 170.0


class NotReady(RuntimeError):
    """PCS aún no tiene el dato (lista de salida o resultados)."""


# --------------------------------------------------------------------------- avisos
def notify(subject: str, body: str) -> None:
    """Aviso de fallos: email (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, ALERT_EMAIL) y/o webhook (ALERT_WEBHOOK)."""
    log.error("%s — %s", subject, body)
    if os.environ.get("ALERT_WEBHOOK"):
        try:
            req = urllib.request.Request(os.environ["ALERT_WEBHOOK"],
                                         data=json.dumps({"text": f"{subject}\n{body}"}).encode(),
                                         headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=10)
        except Exception as exc:  # el aviso nunca debe tumbar la ingesta
            log.warning("No se pudo enviar el webhook: %s", exc)
    if os.environ.get("SMTP_HOST") and os.environ.get("ALERT_EMAIL"):
        try:
            msg = EmailMessage()
            msg["Subject"], msg["To"] = f"[cyclonomy] {subject}", os.environ["ALERT_EMAIL"]
            msg["From"] = os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "ingesta@localhost"))
            msg.set_content(body)
            with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "587")), timeout=20) as s:
                s.starttls()
                if os.environ.get("SMTP_USER"):
                    s.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
                s.send_message(msg)
        except Exception as exc:
            log.warning("No se pudo enviar el email: %s", exc)


# --------------------------------------------------------------------------- cargas
def load_teams(db, season: int, points_year: int | None = None, birthdates: bool = False,
               seed_values: bool = False) -> dict:
    """WorldTeams y ProTeams con sus ciclistas y los puntos PCS de points_year (por defecto, season-1)."""
    teams = sources.fetch_teams(season)
    points = sources.fetch_season_points(points_year or season - 1)
    seen = []
    for t in teams:
        team_id = store.upsert_team(db, t["slug"], t["name"], t["level"], season)
        for r in t["riders"]:
            store.upsert_rider(db, r["slug"], r["name"], team_id, r.get("nationality"),
                               points=int(round(points.get(r["slug"], 0))))
            seen.append(r["slug"])
    inactive = store.deactivate_missing(db, seen)
    if birthdates:
        for slug in store.riders_without_birthdate(db):
            bd = sources.fetch_birthdate(slug)
            if bd:
                store.set_birthdate(db, slug, bd)
    if seed_values:
        db.execute("select public.seed_initial_values()")
    summary = dict(teams=len(teams), riders=len(set(seen)), inactive=inactive)
    log.info("Equipos cargados: %s", summary)
    return summary


def load_calendar(db, season: int) -> dict:
    races = sources.fetch_calendar(season)
    n_races = n_stages = skipped = 0
    for r in races:
        race_id = store.upsert_race(db, r, season)
        if race_id is None:
            skipped += 1
            continue
        n_races += 1
        for s in r["stages"]:
            store.upsert_stage(db, race_id, s)
            n_stages += 1
    summary = dict(races=n_races, stages=n_stages, skipped=skipped)
    log.info("Calendario cargado: %s", summary)
    return summary


# --------------------------------------------------------------------------- planificación diaria
def madrid_now(now: dt.datetime | None = None) -> dt.datetime:
    return (now or dt.datetime.now(dt.timezone.utc)).astimezone(MADRID)


def estimate(stage_date: dt.date, start_local: dt.time | None, distance_km: float | None, tz) -> tuple:
    start = dt.datetime.combine(stage_date, start_local or DEFAULT_START, tzinfo=tz).astimezone(MADRID)
    hours = (distance_km or DEFAULT_DISTANCE) / AVG_SPEED_KMH
    return start, start + dt.timedelta(hours=hours) + FINISH_MARGIN


def plan_day(db, now: dt.datetime | None = None) -> int:
    """Lee horas de salida y distancias de las etapas de hoy y mañana y crea las tareas del día."""
    now = madrid_now(now)
    today = now.date()
    rows = db.fetchall(
        "select s.id, s.number, s.date, s.distance_km, r.id, r.pcs_slug, r.season, r.country, r.is_stage_race, "
        "       (select min(x.number) from public.stage x where x.race_id = r.id) "
        "from public.stage s join public.race r on r.id = s.race_id "
        "where s.date between %s and %s and s.status <> 'scored' order by s.date", (today, today + dt.timedelta(days=1)))
    planned = 0
    for stage_id, number, date, dist, race_id, slug, season, country, is_stage_race, first in rows:
        try:
            info = sources.fetch_stage_info(slug, season, number, is_stage_race)
        except Exception as exc:                      # sin datos: se planifica con valores por defecto
            log.warning("Sin información de %s etapa %s: %s", slug, number, exc)
            info = {}
        distance = info.get("distance_km") or (float(dist) if dist else None)
        start, finish = estimate(date, info.get("start_time"), distance, race_tz(slug, country))
        store.update_stage_times(db, stage_id, start, finish, distance)
        if number == first:
            store.set_entries_close(db, race_id, start)
            store.create_task(db, "startlist", race_id, None, start, 8, dt.timedelta(minutes=15))
        store.create_task(db, "results", race_id, stage_id, finish + RESULTS_DELAY, 6, dt.timedelta(minutes=30))
        planned += 1

    # relectura de ayer (correcciones, descalificaciones)
    for stage_id, race_id in db.fetchall(
            "select s.id, s.race_id from public.stage s where s.date = %s and s.status = 'scored'",
            (today - dt.timedelta(days=1),)):
        store.create_task(db, "recheck", race_id, stage_id, now, 3, dt.timedelta(hours=1))
    log.info("Plan del %s: %s etapas", today, planned)
    return planned


# --------------------------------------------------------------------------- ejecución de tareas
def run_task(db, task: dict) -> str:
    slug, season = task["slug"], task["season"]
    if task["kind"] == "startlist":
        slugs = sources.fetch_startlist(slug, season)
        if not slugs:
            raise NotReady("lista de salida vacía")
        n = store.set_startlist(db, task["race_id"], slugs)
        db.execute("select public.auto_lineup(%s)", (task["race_id"],))
        return f"lista de salida: {len(slugs)} ciclistas ({n} del juego); alineaciones automáticas hechas"

    res = sources.fetch_results(slug, season, task["number"], task["is_stage_race"])
    if task["kind"] == "results":
        if not sources.results_complete(res, task["is_stage_race"]):
            raise NotReady("resultados aún incompletos")
        n = store.set_results(db, task["stage_id"], res, task["is_stage_race"])
        db.execute("select public.score_stage(%s)", (task["stage_id"],))
        return f"resultados: {n} filas; puntos calculados"

    # recheck
    if not sources.results_complete(res, task["is_stage_race"]):
        raise NotReady("no se pudieron releer los resultados")
    before = store.stored_results(db, task["stage_id"])
    store.set_results(db, task["stage_id"], res, task["is_stage_race"])
    after = store.stored_results(db, task["stage_id"])
    if after != before:
        db.execute("select public.score_stage(%s)", (task["stage_id"],))
        return "resultados corregidos: puntos recalculados"
    return "sin cambios"


def tick(db, now: dt.datetime | None = None) -> list[str]:
    now = madrid_now(now)
    out = []
    for task in store.due_tasks(db, now):
        label = f"{task['kind']} {task['slug']} {task['season']}" + (
            f" etapa {task['number']}" if task["stage_id"] else "")
        try:
            msg = run_task(db, task)
            store.finish_task(db, task["id"])
            out.append(f"OK {label}: {msg}")
        except Exception as exc:
            status = store.retry_task(db, task, f"{type(exc).__name__}: {exc}", now)
            out.append(f"{'FALLO' if status == 'failed' else 'REINTENTO'} {label}: {exc}")
            attempts = task["attempts"] + 1
            if status == "failed" or (attempts == 2 and not isinstance(exc, NotReady)):
                notify(f"La ingesta falla: {label}",
                       f"Intento {attempts} de {task['max_attempts']}: {exc}\n"
                       "Si PCS está bloqueando, carga los datos a mano desde la pantalla de administración.")
    for line in out:
        log.info(line)
    return out
