"""Línea de comandos de la ingesta.

    export DATABASE_URL=postgresql://postgres:<clave>@db.<proyecto>.supabase.co:5432/postgres
    python -m ingest teams --season 2027 --points-year 2026 --birthdates --seed-values   # inicio de temporada
    python -m ingest calendar --season 2027
    python -m ingest history --season 2026    # resultados de la temporada pasada para las fichas
    python -m ingest photos                   # fotos de Wikimedia Commons (vía Wikidata)
    python -m ingest plan            # a las 00:00
    python -m ingest tick            # cada 5 minutos
    python -m ingest run             # proceso continuo que hace todo lo anterior a su hora
    python -m ingest debug-page race/strade-bianche/2027/result   # guarda el HTML para ajustar parsers
"""
import argparse
import datetime as dt
import logging
import time
from pathlib import Path

from . import jobs
from .pcs_client import get_html


def main(argv=None):
    ap = argparse.ArgumentParser(prog="python -m ingest")
    sub = ap.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("teams", help="equipos, ciclistas y puntos PCS")
    t.add_argument("--season", type=int, required=True)
    t.add_argument("--points-year", type=int)
    t.add_argument("--birthdates", action="store_true", help="lee la fecha de nacimiento de cada ciclista nuevo")
    t.add_argument("--seed-values", action="store_true", help="recalcula los valores iniciales (solo al empezar)")
    c = sub.add_parser("calendar", help="carreras y etapas de la temporada")
    c.add_argument("--season", type=int, required=True)
    h = sub.add_parser("history", help="resultados de una temporada pasada (para la ficha del ciclista)")
    h.add_argument("--season", type=int, required=True)
    sub.add_parser("photos", help="fotos de los ciclistas desde Wikimedia Commons, con autor y licencia")
    sub.add_parser("seed-values", help="valores de mercado iniciales a partir de los puntos PCS")
    sub.add_parser("plan", help="planifica hoy y mañana")
    sub.add_parser("tick", help="ejecuta las tareas pendientes")
    sub.add_parser("run", help="proceso continuo")
    d = sub.add_parser("debug-page", help="guarda una página de PCS en debug/")
    d.add_argument("path")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    if args.cmd == "debug-page":
        html = get_html(args.path, max_age_h=0) or ""
        out = Path("debug") / (args.path.replace("/", "_") + ".html")
        out.parent.mkdir(exist_ok=True)
        out.write_text(html, encoding="utf-8")
        print(f"Guardado en {out} ({len(html)} caracteres)")
        return

    from .db import Database
    db = Database()
    if args.cmd == "teams":
        print(jobs.load_teams(db, args.season, args.points_year, args.birthdates, args.seed_values))
    elif args.cmd == "calendar":
        print(jobs.load_calendar(db, args.season))
    elif args.cmd == "history":
        from .history import load_history
        print(load_history(db, args.season))
    elif args.cmd == "photos":
        from .photos import load_photos
        print(load_photos(db))
    elif args.cmd == "seed-values":
        print(db.scalar("select public.seed_initial_values()"), "ciclistas valorados")
    elif args.cmd == "plan":
        print(jobs.plan_day(db), "etapas planificadas")
    elif args.cmd == "tick":
        print("\n".join(jobs.tick(db)) or "Nada pendiente")
    elif args.cmd == "run":
        run_forever(db)


def run_forever(db):
    """Bucle: tick cada 5 min; plan a las 00:00; equipos y calendario los lunes de madrugada."""
    log = logging.getLogger("ingest.run")
    done = set()
    while True:
        now = jobs.madrid_now()
        today = now.date()
        try:
            if ("plan", today) not in done:
                jobs.plan_day(db, now)
                done.add(("plan", today))
            if now.isoweekday() == 1 and now.hour >= 3 and ("teams", today) not in done:
                jobs.load_teams(db, now.year)
                done.add(("teams", today))
            if now.isoweekday() == 1 and (now.hour, now.minute) >= (3, 30) and ("calendar", today) not in done:
                jobs.load_calendar(db, now.year)
                done.add(("calendar", today))
            jobs.tick(db, now)
        except Exception as exc:
            log.exception("Error en el ciclo de la ingesta")
            jobs.notify("Error en el ciclo de la ingesta", repr(exc))
        done = {k for k in done if k[1] >= today - dt.timedelta(days=2)}
        time.sleep(300 - time.time() % 300 + 1)        # alinea con múltiplos de 5 minutos


if __name__ == "__main__":
    main()
