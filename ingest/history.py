"""Historial de resultados de una temporada pasada (p. ej. 2026), solo para la ficha del ciclista.

Lee los resultados de la temporada en la página de cada ciclista de PCS (la misma que se descarga para la
fecha de nacimiento, así que suele estar en caché) y el listado de carreras de esa temporada para saber el
nombre, la clase UCI y las fechas de cada carrera. Solo guarda carreras que encajan en una categoría del juego.
"""
from __future__ import annotations

import logging
import re

from . import sources
from .pcs_client import get_html

log = logging.getLogger("ingest.history")

STAGE_URL = re.compile(r"race/([^/]+)/(\d{4})(?:/([a-z0-9-]+))?")


def parse_stage_url(url: str, season: int) -> tuple[str, str, int] | None:
    """'race/vuelta-a-espana/2026/stage-20' → ('vuelta-a-espana', 'stage', 20). None si no interesa."""
    m = STAGE_URL.search(url or "")
    if not m or int(m.group(2)) != season:
        return None
    slug, suffix = m.group(1), m.group(3) or "result"
    if suffix == "result":
        return slug, "stage", 1
    if suffix == "prologue":
        return slug, "stage", 0
    if mm := re.fullmatch(r"stage-(\d+)", suffix):
        return slug, "stage", int(mm.group(1))
    if suffix in ("gc", "points", "kom"):
        return slug, suffix, 1
    return None                                   # jóvenes, equipos, etapas partidas…


def season_results(slug: str) -> list[dict]:
    """Resultados de la temporada en curso de la ficha de PCS (vía la librería procyclingstats)."""
    html = get_html(f"rider/{slug}", max_age_h=24 * 30)
    if not html:
        return []
    return sources._library("Rider", f"rider/{slug}", html, "season_results") or []


def load_history(db, season: int) -> dict:
    races = {r["slug"]: r for r in sources.fetch_calendar(season, with_stages=False)}
    cats = {slug: db.scalar("select public.classify_race(%s, %s, %s)", (slug, r["name"], r["uci_class"]))
            for slug, r in races.items()}
    riders = db.fetchall("select id, pcs_slug from public.rider where active")
    rows, empty = [], 0
    for rider_id, slug in riders:
        results = season_results(slug)
        if not results:
            empty += 1
        seen = set()
        for x in results:
            parsed = parse_stage_url(x.get("stage_url"), season)
            pos = x.get("result")
            if not parsed or not isinstance(pos, int) or pos < 1:
                continue
            race_slug, kind, number = parsed
            race, cat = races.get(race_slug), cats.get(race_slug)
            if not race or not cat:
                continue                           # carrera fuera de las categorías del juego
            if kind != "stage" and not race["is_stage_race"]:
                continue
            key = (race_slug, kind, number)
            if key in seen:
                continue
            seen.add(key)
            date = x.get("date") or (race["end_date"] if kind != "stage" else race["start_date"])
            rows.append((rider_id, season, race_slug, race["name"], race["uci_class"], cat, race["is_stage_race"],
                         number, date, kind, pos))

    with db.conn.transaction():
        db.execute("delete from public.rider_history_result where season = %s", (season,))
        with db.conn.cursor() as cur:
            cur.executemany(
                "insert into public.rider_history_result (rider_id, season, race_slug, race_name, uci_class, category, "
                "  is_stage_race, number, date, kind, position) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                rows)
    summary = dict(riders=len(riders), without_results=empty, results=len(rows),
                   races=len({r[2] for r in rows}))
    log.info("Historial %s cargado: %s", season, summary)
    return summary
