"""Respaldo de PCS: resultados y listas de salida desde CyclingFlash (cyclingflash.com), cuando PCS bloquea la ingesta.

CyclingFlash permite el acceso automático a sus páginas de carreras (robots.txt). Se le pide poco y despacio:
una petición cada MIN_DELAY segundos, solo cuando PCS falla.

  /race/{carrera}-{año}                           la carrera: su slug sale de nuestros datos (slug de PCS o nombre)
  /calendar/road/{año}/men-elite/{mes}            solo si no: el calendario del mes, por fecha y nombre
  /race/{carrera}-{año}/result                    resultado de una clásica
  /race/{carrera}-{año}/result/stage-{n}          resultado de la etapa n (clasificación completa)
  /race/{carrera}-{año}/result/stage-{n}/gc       general tras la etapa  (/points: puntos, /mountain: montaña)
  /race/{carrera}-{año}/startlist                 lista de salida, por equipos, con dorsales y nacionalidad

Los ciclistas se emparejan con los del juego (que usan los nombres y slugs de PCS) por slug y por nombre.
"""
from __future__ import annotations

import datetime as dt
import html as htmllib
import logging
import os
import re
import time
import unicodedata

import requests

log = logging.getLogger("ingest.cyclingflash")

BASE = "https://cyclingflash.com"
HEADERS = {"User-Agent": os.environ.get("CF_USER_AGENT", "Cyclonomy/0.1 (https://github.com/migueldju/Cyclonomy)")}
MIN_DELAY = float(os.environ.get("CF_MIN_DELAY", "5"))
_last = 0.0
_pages: dict[str, str | None] = {}       # páginas ya leídas en esta pasada


def get(path: str) -> str | None:
    """HTML de una página (None si no existe). Una petición cada MIN_DELAY segundos; reintenta si se satura."""
    global _last
    if path in _pages:
        return _pages[path]
    for attempt in range(3):
        wait = MIN_DELAY - (time.time() - _last)
        if wait > 0:
            time.sleep(wait)
        r = requests.get(BASE + path, headers=HEADERS, timeout=30)
        _last = time.time()
        if r.status_code == 404:
            _pages[path] = None
            return None
        if r.status_code in (429, 503):
            time.sleep(int(r.headers.get("Retry-After", 20 * (attempt + 1))))
            continue
        r.raise_for_status()
        _pages[path] = r.text
        return r.text
    r.raise_for_status()
    return None


# --------------------------------------------------------------------------- nombres
def normalize(name: str) -> str:
    s = unicodedata.normalize("NFKD", htmllib.unescape(name)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _words(name: str) -> set[str]:
    return {w for w in normalize(name).split() if len(w) > 2 and w not in {"tour", "the", "grand", "prix", "race"}}


# --------------------------------------------------------------------------- carrera
def parse_calendar(page: str) -> list[dict]:
    """Carreras del calendario de un mes: {'slug', 'name', 'start'}."""
    out = []
    for row in re.findall(r"<tr[^>]*SportsEvent[^>]*>(.*?)</tr>", page, re.S):
        start = re.search(r'itemProp="startDate" content="(\d{4}-\d{2}-\d{2})', row)
        link = re.search(r'href="/race/([^"/]+)"[^>]*>(?:<span[^>]*>.*?</span>)?([^<]+)</a>', row, re.S)
        if start and link:
            out.append(dict(slug=link.group(1), name=htmllib.unescape(link.group(2)).strip(),
                            start=dt.date.fromisoformat(start.group(1))))
    return out


def race_slug(pcs_slug: str, name: str, season: int, start: dt.date) -> str | None:
    """Slug de la carrera en CyclingFlash («itzulia-basque-country-2026»): la del calendario de su mes que empieza
    el mismo día y más se parece en el nombre (o en el slug de PCS)."""
    page = get(f"/calendar/road/{start.year}/men-elite/{start.month}") or ""
    same_day = [r for r in parse_calendar(page) if r["start"] == start]
    if not same_day:
        return None
    exact = f"{pcs_slug}-{season}"
    for r in same_day:
        if r["slug"] == exact:
            return r["slug"]
    want = _words(name) | _words(pcs_slug.replace("-", " "))
    best = max(same_day, key=lambda r: len(want & (_words(r["name"]) | _words(r["slug"].replace("-", " ")))))
    if not want & (_words(best["name"]) | _words(best["slug"].replace("-", " "))):
        return None                                   # ninguna se parece: mejor no adivinar
    return best["slug"]


# --------------------------------------------------------------------------- tablas
def parse_rows(page: str) -> list[tuple[str | None, str, str]]:
    """Filas de la tabla de resultados (o de la lista de salida): (puesto, slug de CyclingFlash, nombre).
    El puesto es None en las listas sin puesto; en los resultados puede ser DNF, DNS…"""
    body = page[page.find("<tbody"):] if "<tbody" in page else page
    out = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", body, re.S):
        link = re.search(r'href="/profile/([^"]+)".*?white-space:nowrap">([^<]+)</span>', row, re.S)
        if not link:
            continue
        first = re.search(r"<td[^>]*>(.*?)</td>", row, re.S)
        rank = re.sub(r"<[^>]+>", "", first.group(1)).strip() if first else None
        out.append((rank, link.group(1), htmllib.unescape(link.group(2)).strip()))
    return out


def rider_index(db) -> tuple[set[str], dict[str, str]]:
    """Slugs de PCS de los ciclistas del juego y su nombre normalizado → slug."""
    slugs, names = set(), {}
    for slug, name in db.fetchall("select pcs_slug, name from public.rider"):
        slugs.add(slug)
        names[normalize(name)] = slug
    return slugs, names


def to_pcs(cf_slug: str, name: str, index: tuple[set[str], dict[str, str]]) -> str:
    """Slug de PCS del ciclista: el mismo slug, el de PCS sin los apellidos de más que añade CyclingFlash
    («ion-izagirre-insausti» → «ion-izagirre»), o el de mismo nombre. Si no es del juego, su slug de CyclingFlash."""
    slugs, names = index
    if cf_slug in slugs:
        return cf_slug
    by_name = names.get(normalize(name))
    if by_name:
        return by_name
    parts = cf_slug.split("-")
    for k in range(len(parts) - 1, 1, -1):
        if "-".join(parts[:k]) in slugs:
            return "-".join(parts[:k])
    # CyclingFlash añade nombres o apellidos que PCS omite («sergio-andres-higuita» → «sergio-higuita»,
    # «harold-alfonso-tejada-canacue» → «harold-tejada»): el único del juego cuyas palabras están todas en el suyo
    words = set(parts)
    hits = [s for s in slugs if len(s.split("-")) >= 2 and set(s.split("-")) <= words]
    return hits[0] if len(hits) == 1 else cf_slug


# --------------------------------------------------------------------------- lo que pide la ingesta
def candidates(pcs_slug: str, name: str, season: int) -> list[str]:
    """Slugs probables de la carrera en CyclingFlash, sacados de nuestros datos: el de PCS con el año
    («itzulia-basque-country-2026») o el nombre con el año («region-pays-de-la-loire-tour-2026»)."""
    return list(dict.fromkeys([f"{pcs_slug}-{season}", f"{normalize(name).replace(' ', '-')}-{season}"]))


def _page(db, race_id: int, suffix: str) -> tuple[str | None, str | None, str]:
    """Primera página de la carrera que existe (/race/{slug}{suffix}) con los slugs probables; si ninguno, el de su
    calendario. Devuelve (página, slug, nombre)."""
    pcs_slug, name, season, start = db.fetchone(
        "select pcs_slug, name, season, start_date from public.race where id = %s", (race_id,))
    for slug in candidates(pcs_slug, name, season):
        page = get(f"/race/{slug}{suffix}")
        if page:
            return page, slug, name
    slug = race_slug(pcs_slug, name, season, start)
    if not slug:
        log.warning("CyclingFlash: no encuentro %s (%s)", name, start)
        return None, None, name
    return get(f"/race/{slug}{suffix}"), slug, name


def fetch_results(db, race_id: int, number: int, is_stage_race: bool) -> dict[str, list[tuple[str, int]]]:
    """Como sources.fetch_results, pero desde CyclingFlash: {tipo: [(slug de PCS, puesto)]}."""
    path = "/result" + (f"/stage-{number}" if is_stage_race else "")
    first, slug, name = _page(db, race_id, path)
    if not slug:
        return {}
    base = f"/race/{slug}{path}"
    kinds = (("stage", ""), ("gc", "/gc"), ("points", "/points"), ("kom", "/mountain")) if is_stage_race else (("stage", ""),)
    index = rider_index(db)
    out = {}
    for kind, suffix in kinds:
        page = first if kind == "stage" else get(base + suffix)
        if not page:
            continue
        rows = [(to_pcs(s, n, index), int(r)) for r, s, n in parse_rows(page) if r and r.isdigit()]
        if rows:
            out[kind] = rows
    log.info("CyclingFlash (%s, %s): %s", name, base, {k: len(v) for k, v in out.items()})
    return out


def parse_startlist(page: str) -> list[dict]:
    """Lista de salida: un bloque por equipo (su nombre en el <h2>) con una fila por corredor: dorsal, enlace a su
    perfil con la bandera y el nombre. Devuelve [{cf_slug, name, nationality, bib, team}]."""
    out = []
    for section in page.split("<section")[1:]:
        # solo los bloques de un equipo (con enlace a su página); el de abandonos («Dropouts») repite corredores
        team = re.search(r'href="/team/[^"]+"[^>]*>.*?<h2[^>]*>([^<]+)</h2>', section, re.S)
        if not team:
            continue
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", section, re.S):
            link = re.search(r'href="/profile/([^"]+)"', row)
            name = re.search(r'itemProp="name"[^>]*>([^<]+)<', row)
            if not link or not name:
                continue
            bib = re.search(r"<td[^>]*>(?:\s*<span[^>]*>)*\s*(\d+)\s*<", row)
            flag = re.search(r'alt="([A-Za-z]{2}) flag"', row)
            out.append(dict(cf_slug=link.group(1), name=htmllib.unescape(name.group(1)).strip(),
                            nationality=flag.group(1).lower() if flag else None,
                            bib=int(bib.group(1)) if bib else None,
                            team=htmllib.unescape(team.group(1)).strip()))
    return out


def fetch_startlist(db, race_id: int) -> list[dict]:
    """Lista de salida desde CyclingFlash, como sources.fetch_startlist_full: [{slug (de PCS), name, nationality, bib,
    team}]."""
    page, _, _ = _page(db, race_id, "/startlist")
    if not page:
        return []
    index = rider_index(db)
    rows = []
    for r in parse_startlist(page):
        rows.append(dict(slug=to_pcs(r.pop("cf_slug"), r["name"], index), **r))
    return list({r["slug"]: r for r in reversed(rows)}.values())[::-1]     # sin repetidos, el primero que sale
