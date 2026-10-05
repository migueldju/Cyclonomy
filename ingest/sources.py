"""Lecturas de PCS: combinan la descarga (pcs_client) con los parsers.

Si la librería `procyclingstats` está instalada se intenta primero con ella (sus métodos devuelven
diccionarios con 'rider_url' y 'rank'); si falla o no devuelve nada, se usan los parsers propios.
"""
from __future__ import annotations

import datetime as dt
import logging
import re

from . import parsers
from .pcs_client import get_html

log = logging.getLogger("ingest.sources")


def _library(cls_name: str, path: str, html: str, method: str):
    try:
        import procyclingstats  # noqa: F401
        cls = getattr(__import__("procyclingstats", fromlist=[cls_name]), cls_name)
        return getattr(cls(path, html=html, update_html=False), method)()
    except Exception:
        return None


def _slug(url: str | None) -> str | None:
    m = parsers.RIDER_HREF.search(url or "")
    return m.group(1) if m else None


def stage_path(slug: str, year: int, number: int, is_stage_race: bool) -> str:
    if not is_stage_race:
        return f"race/{slug}/{year}/result"
    return f"race/{slug}/{year}/prologue" if number == 0 else f"race/{slug}/{year}/stage-{number}"


# ------------------------------------------------------------------------- calendario
def listing_path(year: int, circuit: str = "", cls: str = "") -> str:
    return f"races.php?year={year}&circuit={circuit}&class={cls}&filter=Filter"


def fetch_calendar(year: int, with_stages: bool = True) -> list[dict]:
    """Carreras masculinas WT, .Pro, .1 y campeonatos del año, con sus etapas."""
    first = get_html(listing_path(year), max_age_h=24)
    circuits = [(v, t) for v, t in parsers.select_options(first or "", "circuit")
                if v and not parsers.EXCLUDE_CIRCUIT.search(t)]
    pages = [first] if not circuits else [get_html(listing_path(year, v), max_age_h=24) for v, _ in circuits]
    races, seen = [], set()
    for html in pages:
        for r in parsers.parse_calendar_listing(html or "", year):
            if r["slug"] in seen or not parsers.keep_race(r):
                continue
            seen.add(r["slug"])
            races.append(r)

    for r in races:
        r["is_stage_race"] = r["uci_class"].startswith("2.") or r["end_date"] > r["start_date"]
        stages = []
        if r["is_stage_race"] and with_stages:
            html = get_html(f"race/{r['slug']}/{year}", max_age_h=24 * 7)
            stages = parsers.parse_race_stages(html or "", r["slug"], year)
        if not stages:
            days = (r["end_date"] - r["start_date"]).days + 1
            stages = [dict(number=i + 1, date=r["start_date"] + dt.timedelta(days=i), distance_km=None,
                           is_itt=guess_itt(r["slug"] + " " + r["name"]) if days == 1 else False)
                      for i in range(days)]
        for i, s in enumerate(stages):                       # fechas que falten: una por día
            if s["date"] is None:
                s["date"] = r["start_date"] + dt.timedelta(days=i)
        r["stages"] = stages
    return races


# ------------------------------------------------------------------------- equipos y ciclistas
def ranking_path(points_year: int, offset: int) -> str:
    last = min(dt.date.today(), dt.date(points_year, 12, 31)).isoformat()
    return (f"rankings.php?date={last}&nation=&age=&zage=&page=smallerorequal&team=&offset={offset}"
            f"&filter=Filter&p=me&s=season-individual")


def fetch_season_points(points_year: int, max_pages: int = 80) -> dict[str, float]:
    result, first_prev = {}, None
    for page in range(max_pages):
        rows = parsers.parse_ranking(get_html(ranking_path(points_year, page * 100), max_age_h=6) or "")
        if not rows:
            if page == 0:
                raise RuntimeError("No pude leer el ranking de puntos de PCS (página vacía)")
            break
        if page > 0 and rows[0][0] == first_prev:
            raise RuntimeError("La paginación del ranking no avanza: revisa ranking_path()")
        first_prev = rows[0][0]
        for slug, _pos, pts in rows:
            result.setdefault(slug, pts or 0)
        if (rows[-1][2] or 0) == 0:
            break
    return result


# Equipos que PCS lista para la temporada pero que no van a existir (sin licencia, desaparecen…).
# Se indican sin el año, como en el listado.
EXCLUDED_TEAMS = {"equipo-kern-pharma"}


def team_list_path(year: int) -> str:
    return f"teams.php?year={year}&filter=Filter&s=worldtour"


def fetch_teams(year: int, list_url: str | None = None) -> list[dict]:
    """[{slug, name, level, riders:[{slug, name, nationality}]}] de WorldTeams y ProTeams del año.

    Usa el listado de equipos de ese año: así entran los equipos que cambian de nombre (y de slug) y
    quedan fuera los que desaparecen.
    """
    list_url = list_url or team_list_path(year)
    html = get_html(list_url, max_age_h=12)
    if not html:
        raise RuntimeError(f"No existe la página de listado '{list_url}'")
    teams = []
    for slug_base, _y, tier, listed_name in parsers.parse_team_list(html):
        if slug_base in EXCLUDED_TEAMS:
            log.info("Equipo excluido: %s", slug_base)
            continue
        slug = f"{slug_base}-{year}"
        page = get_html(f"team/{slug}", max_age_h=12)
        parsed = parsers.parse_team(page, year) if page else None
        # PCS responde 200 con una página "Page not found" cuando el equipo aún no existe ese año
        if not parsed or parsed["name"].lower().startswith("page not found"):
            log.warning("Equipo sin página en %s: %s (¿cambió de nombre?)", year, slug)
            continue
        lib = _library("Team", f"team/{slug}", page, "riders") or []
        riders = [dict(slug=_slug(d.get("rider_url")), name=parsers.display_name(d.get("rider_name") or ""),
                       nationality=(d.get("nationality") or "").lower()) for d in lib if _slug(d.get("rider_url"))]
        # sin patrocinador anunciado PCS pone "Equipo ??": vale el nombre del listado
        name = parsed["name"] if parsed["name"] and "??" not in parsed["name"] else listed_name
        teams.append(dict(slug=slug, name=name, level=tier, riders=riders or parsed["riders"]))
    return teams


def fetch_birthdate(rider_slug: str) -> dt.date | None:
    html = get_html(f"rider/{rider_slug}", max_age_h=24 * 30)
    return parsers.parse_birthdate(html) if html else None


# ------------------------------------------------------------------------- carrera
def fetch_stage_info(slug: str, year: int, number: int, is_stage_race: bool) -> dict:
    html = get_html(stage_path(slug, year, number, is_stage_race), max_age_h=6)
    return parsers.parse_stage_info(html) if html else {}


def fetch_startlist(slug: str, year: int) -> list[str]:
    path = f"race/{slug}/{year}/startlist"
    html = get_html(path, max_age_h=0)
    if not html:
        return []
    lib = _library("RaceStartlist", path, html, "startlist") or []
    slugs = [s for s in (_slug(d.get("rider_url")) for d in lib) if s]
    return slugs or parsers.parse_startlist(html)


def fetch_results(slug: str, year: int, number: int, is_stage_race: bool) -> dict[str, list[tuple[str, int]]]:
    path = stage_path(slug, year, number, is_stage_race)
    html = get_html(path, max_age_h=0)
    if not html:
        return {}
    out = {}
    for kind, method in (("stage", "results"), ("gc", "gc"), ("points", "points"), ("kom", "kom")):
        rows = _library("Stage", path, html, method) or []
        parsed = [(_slug(d.get("rider_url")), d.get("rank")) for d in rows]
        parsed = [(s, int(p)) for s, p in parsed if s and str(p).isdigit()]
        if parsed:
            out[kind] = parsed
    return out or parsers.parse_results(html)


def results_complete(res: dict, is_stage_race: bool) -> bool:
    """¿Están ya los resultados? Clásica: el resultado; vuelta: la etapa y la general."""
    if not res.get("stage"):
        return False
    return (not is_stage_race) or bool(res.get("gc"))


def guess_itt(text: str) -> bool:
    return bool(re.search(r"(\bitt\b|-itt\b|time trial|contre-la-montre|contrarreloj)", text, re.I))
