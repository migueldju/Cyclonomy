"""Parsers de páginas de PCS (funciones puras: reciben HTML y devuelven datos).

Salen de pcs_calendario.py y pcs_equipos.py, más los parsers nuevos de páginas de carrera
(etapas, hora de salida, lista de salida y resultados).

AVISO: los selectores parten de la estructura que PCS mostraba al escribirlos y solo se han probado
con HTML simulado (PCS no es accesible desde el entorno donde se escribió esto). Si algo no cuadra,
guarda la página con `python -m ingest debug-page <ruta>` y ajusta el parser correspondiente.
Si la librería `procyclingstats` está instalada se usa primero y estos parsers quedan de respaldo.
"""
from __future__ import annotations

import datetime as dt
import re

from bs4 import BeautifulSoup

RIDER_HREF = re.compile(r"(?:^|/)rider/([A-Za-z0-9\-_.]+)(?:[/?#]|$)")
TEAM_HREF = re.compile(r"(?:^|/)team/([^/?#]+?)-(\d{4})(?:[/?#]|$)")
HEADING = re.compile(r"^h[1-6]$")
MENU_WORDS = re.compile(r"menu|nav|footer|dropdown|topbar|sidebar", re.I)
MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
     "november", "december"], 1)}


def _soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def _is_menu(a) -> bool:
    for p in a.parents:
        if getattr(p, "name", None) in ("nav", "header", "footer"):
            return True
        if getattr(p, "get", None) and MENU_WORDS.search(" ".join(p.get("class") or []) + " " + (p.get("id") or "")):
            return True
    return False


def _flag(el) -> str:
    flag = el.select_one("span.flag") if el else None
    return next((c for c in (flag.get("class", []) if flag else []) if c != "flag"), "").lower()


# =========================================================================== calendario
# Clases que entran en el juego: WT, .Pro, .1 y campeonatos (Mundial, continentales, nacionales)
WANTED_CLASSES = {"1.UWT", "2.UWT", "1.PRO", "2.PRO", "1.1", "2.1", "WC", "CC", "NC"}
EXCLUDE_NAME = re.compile(
    r"\b(women|womens|women's|ladies|lady|femmes?|feminas?|femenin\w*|dames?|donne|junior|juniors|"
    r"u23|u19|espoirs|under[ -]?23)\b|\s(WE|MJ|WJ|MU|WU)\b", re.I)
EXCLUDE_CIRCUIT = re.compile(r"\b(women|womens|women's|ladies|junior|juniors|u23|u19|u17)\b", re.I)
DATE_RE = re.compile(r"(\d{1,2})\.(\d{1,2})(?:\s*-\s*(\d{1,2})\.(\d{1,2}))?")
CLASS_RE = re.compile(r"^(\d\.[A-Za-z0-9]+|WC|CC|NC)$")


def select_options(html: str, name: str) -> list[tuple[str, str]]:
    sel = _soup(html).find("select", attrs={"name": name})
    if not sel:
        return []
    return [(o.get("value", ""), o.get_text(strip=True)) for o in sel.find_all("option")]


def parse_dates(text: str, year: int):
    m = DATE_RE.search(text)
    if not m:
        return None, None
    d1, m1, d2, m2 = m.groups()
    start = dt.date(year, int(m1), int(d1))
    if d2:
        end = dt.date(year + 1 if int(m2) < int(m1) else year, int(m2), int(d2))
    else:
        end = start
    return start, end


def parse_calendar_listing(html: str, year: int) -> list[dict]:
    """Filas de una tabla de calendario de PCS (races.php)."""
    rows = []
    for tr in _soup(html).select("table tr"):
        tds = tr.find_all("td")
        a = tr.find("a", href=re.compile(r"race/[^/]+/\d{4}"))
        if len(tds) < 3 or not a:
            continue
        m = re.search(r"race/([^/]+)/(\d{4})", a["href"])
        slug, race_year = m.group(1), int(m.group(2))
        if race_year != year:
            continue
        start, end = parse_dates(tds[0].get_text(" ", strip=True), year)
        cls = next((t.get_text(strip=True) for t in reversed(tds) if CLASS_RE.match(t.get_text(strip=True))), "")
        name = re.sub(r"\s+ME$", "", a.get_text(" ", strip=True))
        rows.append(dict(slug=slug, name=name, uci_class=cls.upper(), start_date=start, end_date=end,
                         country=_flag(tr)))
    return rows


def keep_race(row: dict) -> bool:
    return (row["uci_class"] in WANTED_CLASSES and row["start_date"] is not None
            and not EXCLUDE_NAME.search(row["name"]) and not EXCLUDE_NAME.search(row["slug"].replace("-", " ")))


def parse_race_stages(html: str, slug: str, year: int) -> list[dict]:
    """Etapas de una vuelta desde su página principal: [{number, date, distance_km, is_itt}].

    number 0 = prólogo. La fecha sale de la columna 'dd/mm' de la tabla de etapas.
    """
    out, seen = [], set()
    pat = re.compile(rf"race/{re.escape(slug)}/{year}/(stage-(\d+)|prologue)(?:[/?#]|$)")
    for a in _soup(html).find_all("a", href=pat):
        m = pat.search(a["href"])
        number = 0 if m.group(1) == "prologue" else int(m.group(2))
        if number in seen:
            continue
        row = a.find_parent("tr") or a.parent
        text = row.get_text(" ", strip=True) if row else a.get_text(" ", strip=True)
        md = re.search(r"\b(\d{1,2})/(\d{1,2})\b", text)
        km = re.search(r"\(?\s*(\d+(?:[.,]\d+)?)\s*k(?:m)?\s*\)?", text)
        seen.add(number)
        out.append(dict(number=number,
                        date=dt.date(year, int(md.group(2)), int(md.group(1))) if md else None,
                        distance_km=float(km.group(1).replace(",", ".")) if km else None,
                        is_itt=bool(re.search(r"\(ITT\)|\bITT\b|time trial|prologue", text, re.I)) or number == 0))
    return sorted(out, key=lambda s: s["number"])


# =========================================================================== página de etapa / clásica
def parse_stage_info(html: str) -> dict:
    """Hora de salida (local), distancia y fecha de una etapa o clásica."""
    text = _soup(html).get_text(" ", strip=True)
    st = re.search(r"Start\s*time\s*:?\s*(\d{1,2})[:.h](\d{2})", text, re.I)
    km = re.search(r"Distance\s*:?\s*(\d+(?:[.,]\d+)?)\s*km", text, re.I)
    dd = re.search(r"Date\s*:?\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})", text, re.I)
    date = None
    if dd and dd.group(2).lower() in MONTHS:
        date = dt.date(int(dd.group(3)), MONTHS[dd.group(2).lower()], int(dd.group(1)))
    return dict(start_time=dt.time(int(st.group(1)), int(st.group(2))) if st else None,
                distance_km=float(km.group(1).replace(",", ".")) if km else None,
                date=date)


def _rank(td_text: str) -> int | None:
    t = td_text.strip().rstrip(".")
    return int(t) if t.isdigit() else None


def _table_rows(table) -> list[tuple[str, int]]:
    out = []
    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        a = tr.find("a", href=RIDER_HREF)
        if not tds or not a:
            continue
        pos = _rank(tds[0].get_text(" ", strip=True))
        if pos is not None:
            out.append((RIDER_HREF.search(a["href"]).group(1), pos))
    return out


TAB_KINDS = {"stage": "stage", "result": "stage", "gc": "gc", "general": "gc", "points": "points",
             "kom": "kom", "mountains": "kom"}


def parse_results(html: str) -> dict[str, list[tuple[str, int]]]:
    """Resultados de una etapa: {'stage': [(slug, puesto)], 'gc': [...], 'points': [...], 'kom': [...]}.

    Las pestañas de PCS (ul.restabs) dan el orden de las tablas; sin pestañas (clásica), la primera tabla
    de resultados es el resultado.
    """
    soup = _soup(html)
    tables = soup.select("table.results")
    tabs = [li.get_text(" ", strip=True).lower() for li in soup.select("ul.restabs li")]
    out: dict[str, list] = {}
    if tabs and len(tabs) >= len(tables):
        for label, table in zip(tabs, tables):
            kind = TAB_KINDS.get(label.split()[0]) if label else None
            if kind and kind not in out:
                out[kind] = _table_rows(table)
    elif tables:
        out["stage"] = _table_rows(tables[0])
    return {k: v for k, v in out.items() if v}


def parse_startlist(html: str) -> list[str]:
    """Slugs de los ciclistas de la lista de salida."""
    soup = _soup(html)
    h1 = soup.find("h1")
    anchors = h1.find_all_next("a", href=RIDER_HREF) if h1 else soup.find_all("a", href=RIDER_HREF)
    out, seen = [], set()
    for a in anchors:
        if _is_menu(a):
            continue
        slug = RIDER_HREF.search(a["href"]).group(1)
        if slug not in seen:
            seen.add(slug)
            out.append(slug)
    return out


# =========================================================================== equipos y ciclistas
def parse_team_list(html: str) -> list[tuple[str, int, str, str]]:
    """[(slug_base, año_del_slug, nivel WT|PRT, nombre)] de la página 'Men's World & ProTeams'."""
    out, seen = [], set()
    for a in _soup(html).find_all("a", href=TEAM_HREF):
        h = a.find_previous(HEADING)
        title = h.get_text(" ", strip=True).lower() if h else ""
        if "worldteam" in title:
            tier = "WT"
        elif "proteam" in title:
            tier = "PRT"
        else:
            continue
        m = TEAM_HREF.search(a["href"])
        if m.group(1) in seen:
            continue
        seen.add(m.group(1))
        out.append((m.group(1), int(m.group(2)), tier, a.get_text(" ", strip=True)))
    return out


def display_name(full: str) -> str:
    """'VAN AERT Wout' -> 'Wout Van Aert'. Si no sigue el patrón APELLIDO Nombre, lo deja igual."""
    toks = full.split()

    def is_upper(t):
        return any(c.isalpha() for c in t) and not any(c.islower() and c != "ß" for c in t)
    i = 0
    while i < len(toks) and is_upper(toks[i]):
        i += 1
    if i == 0 or i == len(toks):
        return full
    last = " ".join(w.capitalize() if w.isalpha() else w.title() for w in toks[:i])
    return f"{' '.join(toks[i:])} {last}"


def parse_team(html: str, year: int) -> dict:
    """Nombre del equipo y su plantilla [{slug, name, nationality}]."""
    soup = _soup(html)
    h1 = soup.find("h1")
    title = h1.get_text(" ", strip=True) if h1 else ""
    m = re.search(r"^(.*?)\s*\(([A-Z]{2,3})\)\s*$", title)
    name = m.group(1).strip() if m else title
    riders, seen = [], set()

    def add(a):
        mm = RIDER_HREF.search(a.get("href", ""))
        txt = a.get_text(" ", strip=True)
        if mm and txt and mm.group(1) not in seen:
            seen.add(mm.group(1))
            riders.append(dict(slug=mm.group(1), name=display_name(txt), nationality=_flag(a.parent)))

    heading = next((h for h in soup.find_all(HEADING)
                    if len(h.get_text(" ", strip=True)) < 40
                    and re.fullmatch(rf"\s*{year}\b.*\([A-Z]{{2,3}}\)\s*", h.get_text(" ", strip=True))), None)
    if heading:
        for el in heading.next_elements:
            nm = getattr(el, "name", None)
            if nm == "table" or (nm and HEADING.match(nm) and el is not heading):
                break
            if nm == "a" and not _is_menu(el):
                add(el)
    if not riders:
        for a in (h1.find_all_next("a", href=RIDER_HREF) if h1 else soup.find_all("a", href=RIDER_HREF)):
            if not _is_menu(a):
                add(a)
    return dict(name=name, riders=riders)


def parse_ranking(html: str) -> list[tuple[str, int | None, float | None]]:
    """[(slug, posición, puntos)] de una página del ranking 'PCS Season - Individual'."""
    rows = []
    for tr in _soup(html).select("table tr"):
        tds = tr.find_all("td")
        a = tr.find("a", href=RIDER_HREF)
        if not a or len(tds) < 3:
            continue
        pts = None
        for td in reversed(tds):
            t = td.get_text(strip=True).replace(",", ".")
            if re.fullmatch(r"\d+(\.\d+)?", t):
                pts = float(t)
                break
        first = tds[0].get_text(strip=True)
        rows.append((RIDER_HREF.search(a["href"]).group(1), int(first) if first.isdigit() else None, pts))
    return rows


def parse_birthdate(html: str) -> dt.date | None:
    """Fecha de nacimiento de la página de un ciclista ('Date of birth: 21st September 1998 (28)')."""
    text = _soup(html).get_text(" ", strip=True)
    m = re.search(r"Date of birth\s*:?\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})", text, re.I)
    if m and m.group(2).lower() in MONTHS:
        return dt.date(int(m.group(3)), MONTHS[m.group(2).lower()], int(m.group(1)))
    return None
