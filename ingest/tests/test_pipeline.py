"""Prueba de punta a punta de la ingesta contra un Postgres real, con PCS simulado.

Necesita psql y un servidor Postgres (PGHOST/PGPORT/PGUSER). Se salta si no hay.
Simula un día de carrera: calendario → plan del día → lista de salida y alineaciones automáticas →
resultados incompletos (reintento) → resultados → puntos → relectura con corrección al día siguiente.
"""
import datetime as dt
import os
import shutil
import subprocess
import unittest
from pathlib import Path
from zoneinfo import ZoneInfo

from ingest import jobs, sources
from ingest.tests.psql_db import PsqlDatabase

MAD = ZoneInfo("Europe/Madrid")
ROOT = Path(__file__).resolve().parents[2]
DB = "fantasy_ingest_test"


def madrid(*a):
    return dt.datetime(*a, tzinfo=MAD)


@unittest.skipUnless(shutil.which("psql") and os.environ.get("PGHOST"), "sin Postgres de pruebas")
class PipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(["bash", str(ROOT / "supabase/tests/apply.sh")], check=True, capture_output=True,
                       env={**os.environ, "TEST_DB": DB})
        cls.db = PsqlDatabase(DB, now=madrid(2027, 3, 8, 10, 0))
        cls.db.execute("select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false), "
                       "public.create_league('Liga ingesta', 'Equipo Ana', '{}')")
        # el mejor ciclista de Ana: lo haremos ganar
        cls.star = cls.db.scalar(
            "select r.pcs_slug from public.ownership o join public.rider r on r.id = o.rider_id "
            "order by r.market_value desc limit 1")

    def setUp(self):
        self.calls = []
        self._orig = {n: getattr(sources, n) for n in
                      ("fetch_calendar", "fetch_stage_info", "fetch_startlist", "fetch_results")}

    def tearDown(self):
        for n, f in self._orig.items():
            setattr(sources, n, f)

    def test_race_day(self):
        db = self.db
        sources.fetch_calendar = lambda season: [dict(
            slug="tirreno-adriatico", name="Tirreno-Adriatico", uci_class="2.UWT", country="it",
            start_date=dt.date(2027, 3, 9), end_date=dt.date(2027, 3, 10), is_stage_race=True,
            stages=[dict(number=1, date=dt.date(2027, 3, 9), distance_km=None, is_itt=False),
                    dict(number=2, date=dt.date(2027, 3, 10), distance_km=None, is_itt=False)])]
        self.assertEqual(jobs.load_calendar(db, 2027), dict(races=1, stages=2, skipped=0))
        race_id, cat = db.fetchone("select id, category from public.race where pcs_slug = 'tirreno-adriatico'")
        self.assertEqual(cat, "MWT")

        # 00:00: plan del día (salida 12:15 hora local de Italia = Madrid; 168 km a 42 km/h = 4 h)
        sources.fetch_stage_info = lambda slug, year, number, sr: dict(start_time=dt.time(12, 15), distance_km=168.0)
        db.now = madrid(2027, 3, 9, 0, 0)
        self.assertEqual(jobs.plan_day(db, db.now), 3)       # Tirreno hoy y mañana + GP del Martes (fixtures)
        close = db.scalar("select entries_close_at at time zone 'Europe/Madrid' from public.race where id = %s", (race_id,))
        self.assertTrue(str(close).startswith("2027-03-09 12:15"))
        finish = db.scalar("select to_char(est_finish_at at time zone 'Europe/Madrid', 'HH24:MI') from public.stage "
                           "where race_id = %s and number = 1", (race_id,))
        self.assertEqual(finish, "16:30")                    # 12:15 + 4 h + 15 min

        # 12:16: lista de salida → alineación automática de Ana (no se inscribió)
        sources.fetch_startlist = lambda slug, year: [self.star, "rider-300", "no-esta-en-el-juego"]
        db.now = madrid(2027, 3, 9, 12, 16)
        out = jobs.tick(db, db.now)
        self.assertTrue(any(o.startswith("OK startlist tirreno") for o in out), out)
        entered = db.fetchall("select rd.pcs_slug from public.race_entry e join public.race_entry_rider er on er.entry_id = e.id "
                              "join public.rider rd on rd.id = er.rider_id where e.race_id = %s and e.auto", (race_id,))
        self.assertIn((self.star,), entered)

        # 17:01: resultados incompletos → reintento en 30 min
        results = {"stage": [(self.star, 1), ("rider-300", 2)]}
        sources.fetch_results = lambda slug, year, number, sr: dict(results)
        db.now = madrid(2027, 3, 9, 17, 1)
        out = jobs.tick(db, db.now)
        self.assertTrue(any(o.startswith("REINTENTO results tirreno") for o in out), out)

        # 17:31: completos → puntos
        results["gc"] = [(self.star, 1)]
        results["kom"] = [("rider-300", 1)]
        db.now = madrid(2027, 3, 9, 17, 31)
        out = jobs.tick(db, db.now)
        self.assertTrue(any(o.startswith("OK results tirreno") for o in out), out)
        pts = db.scalar("select sum(ms.points) from public.member_score ms join public.stage s on s.id = ms.stage_id "
                        "where s.race_id = %s", (race_id,))
        self.assertEqual(pts, 50, "etapa de WT principal: 50 al ganador")

        # día siguiente: relectura; PCS corrigió el resultado (descalificación del ganador)
        results["stage"] = [("rider-300", 1), (self.star, 2)]
        db.now = madrid(2027, 3, 10, 0, 0)
        jobs.plan_day(db, db.now)
        out = jobs.tick(db, db.now)
        self.assertTrue(any(o.startswith("OK recheck") and "recalculados" in o for o in out), out)
        pts = db.scalar("select sum(ms.points) from public.member_score ms join public.stage s on s.id = ms.stage_id "
                        "where s.race_id = %s and s.number = 1", (race_id,))
        self.assertEqual(pts, 40 + (50 if ("rider-300",) in entered else 0), "puntos recalculados tras la corrección")


if __name__ == "__main__":
    unittest.main()
