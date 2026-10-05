"""Fotos de los ciclistas desde Wikimedia Commons, buscadas en Wikidata por el id de PCS (propiedad P1663).

Wikidata marca una sola imagen por ciclista (P18), a menudo antigua. Si el ciclista tiene categoría en Commons
(P373), se busca una foto más reciente en ella (ver category_best) y se usa si es de un año posterior.

Las fotos de Commons tienen licencias libres (CC BY, CC BY-SA, dominio público) que obligan a citar al autor y
la licencia: por eso se guardan autor, licencia, enlace a la licencia y página del archivo junto a la URL.
El id numérico de PCS se lee de la ficha del ciclista (normalmente ya en caché).
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

from .pcs_client import get_html

log = logging.getLogger("ingest.photos")

HEADERS = {"User-Agent": os.environ.get("WIKI_USER_AGENT", "Cyclonomy/0.1 (https://github.com/migueldju/Cyclonomy)")}
SPARQL = "https://query.wikidata.org/sparql"
COMMONS = "https://commons.wikimedia.org/w/api.php"
THUMB_WIDTH = 400
RIDER_ID = re.compile(r'id="riderid" value="(\d+)"')


def pcs_id(slug: str) -> int | None:
    html = get_html(f"rider/{slug}", max_age_h=24 * 30) or ""
    m = RIDER_ID.search(html)
    return int(m.group(1)) if m else None


def _get(url: str, params: dict) -> dict:
    for attempt in range(4):
        r = requests.get(url, params=params, headers=HEADERS, timeout=60)
        if r.status_code in (429, 503):
            time.sleep(int(r.headers.get("Retry-After", 10 * (attempt + 1))))
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError(f"Wikimedia rechazó la petición a {url}")


def wikidata_lookup(ids: list[int]) -> dict[int, dict]:
    """{id de PCS: {image: archivo P18 o None, category: categoría de Commons P373 o None}}."""
    out: dict[int, dict] = {}
    for i in range(0, len(ids), 200):
        values = " ".join(f'"{x}"' for x in ids[i:i + 200])
        q = (f"SELECT ?pcs ?image ?cat WHERE {{ VALUES ?pcs {{ {values} }} ?item wdt:P1663 ?pcs . "
             f"OPTIONAL {{ ?item wdt:P18 ?image }} OPTIONAL {{ ?item wdt:P373 ?cat }} }}")
        data = _get(SPARQL, {"query": q, "format": "json"})
        for b in data["results"]["bindings"]:
            row = out.setdefault(int(b["pcs"]["value"]), dict(image=None, category=None))
            if "image" in b and not row["image"]:      # si hay varias, la primera
                row["image"] = requests.utils.unquote(b["image"]["value"].rsplit("/", 1)[-1])
            if "cat" in b and not row["category"]:
                row["category"] = b["cat"]["value"]
        time.sleep(1)
    return out


def _text(meta: dict, key: str) -> str | None:
    raw = (meta.get(key) or {}).get("value")
    if not raw:
        return None
    txt = htmllib.unescape(re.sub(r"<[^>]+>", "", str(raw))).strip()
    return re.sub(r"\s+", " ", txt)[:200] or None


def _year(meta: dict) -> int | None:
    for key in ("DateTimeOriginal", "DateTime"):
        m = re.search(r"(?:19|20)\d\d", _text(meta, key) or "")
        if m:
            return int(m.group(0))
    return None


def _meta(info: dict) -> dict:
    meta = info.get("extmetadata") or {}
    return dict(url=(info.get("thumburl") or info.get("url") or "").split("?")[0] or None,
                author=_text(meta, "Artist") or "Autor desconocido",
                license=_text(meta, "LicenseShortName") or "Ver la página del archivo",
                license_url=_text(meta, "LicenseUrl"),
                page_url=info.get("descriptionurl"),
                year=_year(meta),
                portrait=(info.get("height") or 0) > (info.get("width") or 0))


def _plain(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def _category_files(category: str) -> list[tuple[str, dict]]:
    """(título normalizado, metadatos) de las fotos de una categoría, lo último subido primero."""
    data = _get(COMMONS, {"action": "query", "format": "json", "generator": "categorymembers",
                          "gcmtitle": f"Category:{category}", "gcmtype": "file", "gcmlimit": 50,
                          "gcmsort": "timestamp", "gcmdir": "desc",
                          "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": THUMB_WIDTH})
    out = []
    for page in ((data.get("query") or {}).get("pages") or {}).values():
        info = (page.get("imageinfo") or [None])[0]
        title = _plain(page.get("title", ""))
        if info and re.search(r"\.(jpe?g|png)$", title):
            m = _meta(info)
            if m["url"]:
                out.append((title, m))
    return out


def _pick(files: list[tuple[str, dict]], needles: list[str], year: int | None = None) -> dict | None:
    """Entre las que nombran al ciclista, mejor un recorte ("cropped") y vertical; después la más reciente."""
    best, best_key = None, None
    for title, m in files:
        if not all(n in title for n in needles):
            continue
        key = ("crop" in title, m["portrait"], m["year"] or year or 0)
        if best_key is None or key > best_key:
            best, best_key = m, key
    if best and not best["year"]:
        best["year"] = year
    return best


def category_best(category: str, rider_name: str, this_year: int) -> dict | None:
    """Foto reciente de la categoría del ciclista en Commons.

    Primero las subcategorías por año ("Sepp Kuss in 2026", del año actual hacia atrás): sus fotos son del
    ciclista ese año, basta con que el archivo lleve su apellido. Si no hay, la categoría general, pero
    exigiendo nombre y apellido en el título (así no cuela, p. ej., una rotonda con su nombre).
    """
    words = [_plain(w) for w in rider_name.split() if len(w) >= 3]
    if not words:
        return None
    surname, first = words[-1], words[0]
    for year in range(this_year, this_year - 3, -1):
        found = _pick(_category_files(f"{category} in {year}"), [surname], year)
        time.sleep(0.3)
        if found:
            return found
    found = _pick(_category_files(category), [first, surname])
    return found if found and found["year"] else None


def commons_info(files: list[str]) -> dict[str, dict]:
    """Miniatura, autor y licencia de cada archivo de Commons (de 50 en 50)."""
    out: dict[str, dict] = {}
    for i in range(0, len(files), 50):
        chunk = files[i:i + 50]
        data = _get(COMMONS, {"action": "query", "format": "json", "prop": "imageinfo",
                              "iiprop": "url|size|extmetadata", "iiurlwidth": THUMB_WIDTH,
                              "titles": "|".join(f"File:{f}" for f in chunk)})
        norm = {n["to"]: n["from"] for n in data["query"].get("normalized", [])}
        for page in data["query"]["pages"].values():
            info = (page.get("imageinfo") or [None])[0]
            if not info:
                continue
            title = norm.get(page["title"], page["title"])
            out[title.removeprefix("File:")] = _meta(info)
        time.sleep(1)
    return out


def load_photos(db) -> dict:
    riders = db.fetchall("select id, pcs_slug, pcs_id, name from public.rider where active")
    ids, names = {}, {}
    for rider_id, slug, known, name in riders:
        pid = known or pcs_id(slug)
        if pid:
            ids[rider_id], names[rider_id] = pid, name
            if not known:
                db.execute("update public.rider set pcs_id = %s where id = %s", (pid, rider_id))
    wd = wikidata_lookup(sorted(set(ids.values())))
    this_year = dt.date.today().year
    info = commons_info(sorted({w["image"] for w in wd.values() if w["image"]}))
    with_photo = newer = 0
    for rider_id, pid in ids.items():
        w = wd.get(pid) or {}
        meta = info.get(w.get("image") or "")
        if w.get("category"):
            cand = category_best(w["category"], names[rider_id], this_year)
            time.sleep(0.3)
            if cand and (not meta or not meta["year"] or cand["year"] > meta["year"]):
                meta, newer = cand, newer + 1
        if meta and meta["url"]:
            with_photo += 1
            db.execute("update public.rider set photo_url = %s, photo_author = %s, photo_license = %s, "
                       "photo_license_url = %s, photo_page_url = %s where id = %s",
                       (meta["url"], meta["author"], meta["license"], meta["license_url"], meta["page_url"], rider_id))
    summary = dict(riders=len(riders), with_pcs_id=len(ids), with_photo=with_photo, newer_from_category=newer)
    log.info("Fotos cargadas: %s", summary)
    return summary
