"""Campeones nacionales, continentales y del mundo (hombres élite, ruta y contrarreloj) de una temporada.

Salen del listado de carreras de PCS (races.php), que trae el ganador de cada campeonato. Solo sirven para mostrar
el maillot de campeón en la app; los campeonatos no puntúan (salvo el Mundial y el Europeo, que van por el calendario).
"""
from __future__ import annotations

import datetime as dt
import logging
import re

from bs4 import BeautifulSoup

from . import sources

log = logging.getLogger("ingest.titles")

CONTINENTS = (("europe", r"europ|uec"), ("asia", r"asia"), ("america", r"americ"), ("africa", r"africa"),
              ("oceania", r"oceania"))
LEVEL = {"NC": "nc", "CC": "cc", "WC": "wc"}


def parse_titles(html: str, season: int) -> list[dict]:
    out = []
    for tr in BeautifulSoup(html or "", "html.parser").select("table tr"):
        tds = tr.find_all("td")
        if len(tds) < 4:
            continue
        level = LEVEL.get(tds[-1].get_text(strip=True))
        race = tr.find("a", href=re.compile(r"^race/"))
        winner = tr.find("a", href=re.compile(r"^rider/"))
        if not level or not race or not winner:
            continue
        name = race.get_text(" ", strip=True)
        m = re.search(r"\bME - (Road Race|ITT)$", name)          # solo hombres élite
        if not m:
            continue
        day = re.match(r"(\d{1,2})\.(\d{1,2})", tds[0].get_text(strip=True))
        if not day:
            continue
        if level == "nc":
            flag = tr.select_one("span.flag")
            scope = flag.get("class")[1] if flag and len(flag.get("class", [])) > 1 else None
        elif level == "cc":
            scope = next((c for c, pat in CONTINENTS if re.search(pat, name.lower())), None)
        else:
            scope = "world"
        if not scope:
            continue
        out.append(dict(race_slug=race["href"].split("/", 1)[1].split("?")[0], season=season,
                        date=dt.date(season, int(day.group(2)), int(day.group(1))), level=level,
                        discipline="itt" if m.group(1) == "ITT" else "rr", scope=scope,
                        rider_slug=winner["href"].split("/", 1)[1].split("/")[0]))
    return out


def load_titles(db, seasons: list[int]) -> int:
    n = 0
    for season in seasons:
        # el listado general no los trae todos: también cada circuito (Europe Tour, Mundiales…)
        from .parsers import select_options
        first = sources.get_html(sources.listing_path(season), max_age_h=24) or ""
        pages = [first] + [sources.get_html(sources.listing_path(season, v), max_age_h=24) or ""
                           for v, _ in select_options(first, "circuit") if v]
        rows = list({r["race_slug"]: r for html in pages for r in parse_titles(html, season)}.values())
        for r in rows:
            db.execute(
                "insert into public.rider_title (race_slug, season, date, level, discipline, scope, rider_slug) "
                "values (%(race_slug)s, %(season)s, %(date)s, %(level)s, %(discipline)s, %(scope)s, %(rider_slug)s) "
                "on conflict (race_slug) do update set date = excluded.date, rider_slug = excluded.rider_slug", r)
        n += len(rows)
        log.info("Campeones %s: %s", season, len(rows))
    return n
