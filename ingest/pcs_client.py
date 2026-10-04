"""Descarga de páginas de PCS: caché en disco, una petición cada MIN_DELAY segundos y reintentos.

Unifica el get_html que repetían pcs_ejemplo.py, pcs_calendario.py y pcs_equipos.py.
"""
import hashlib
import logging
import os
import random
import time
from pathlib import Path

import requests

BASE = "https://www.procyclingstats.com/"
CACHE = Path(os.environ.get("PCS_CACHE_DIR", "pcs_cache"))
HEADERS = {"User-Agent": os.environ.get("PCS_USER_AGENT", "cyclonomy/0.1 (contacto: tu@email.com)")}
MIN_DELAY = float(os.environ.get("PCS_MIN_DELAY", "3"))
NOT_FOUND = "__404__"

log = logging.getLogger("ingest.pcs")
_last = 0.0


class Blocked(RuntimeError):
    """PCS rechaza las peticiones (403/429/503 repetidos): probable bloqueo antibot."""


def get_html(path: str, max_age_h: float = 24, session: requests.Session | None = None) -> str | None:
    """HTML de una página de PCS (ruta sin dominio). None si no existe (404).

    max_age_h=0 obliga a descargar de nuevo (resultados del día).
    """
    global _last
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / (hashlib.md5(path.encode()).hexdigest() + ".html")
    if max_age_h > 0 and f.exists() and time.time() - f.stat().st_mtime < max_age_h * 3600:
        txt = f.read_text(encoding="utf-8")
        return None if txt == NOT_FOUND else txt

    http = session or requests
    for attempt in range(4):
        wait = MIN_DELAY - (time.time() - _last)
        if wait > 0:
            time.sleep(wait + random.random())
        resp = http.get(BASE + path, headers=HEADERS, timeout=30)
        _last = time.time()
        if resp.status_code == 200:
            f.write_text(resp.text, encoding="utf-8")
            return resp.text
        if resp.status_code == 404:
            f.write_text(NOT_FOUND, encoding="utf-8")
            return None
        if resp.status_code in (403, 429, 503):
            log.warning("PCS respondió %s a %s (intento %s)", resp.status_code, path, attempt + 1)
            time.sleep(30 * (attempt + 1))
            continue
        resp.raise_for_status()
    raise Blocked(f"PCS rechazó la petición de '{path}' (¿bloqueo antibot?)")
