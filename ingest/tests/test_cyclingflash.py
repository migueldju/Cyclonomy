"""Tests del respaldo de CyclingFlash con HTML SIMULADO (imita su estructura; no es HTML real descargado).

    python -m unittest discover -s ingest/tests -t .
"""
import datetime as dt
import unittest
from pathlib import Path
from unittest import mock

from ingest import cyclingflash as cf

FX = Path(__file__).parent / "fixtures"


def fx(name):
    return (FX / name).read_text(encoding="utf-8")


class CalendarTests(unittest.TestCase):
    def test_parse_calendar(self):
        rows = cf.parse_calendar(fx("cf_calendar.html"))
        self.assertEqual([r["slug"] for r in rows],
                         ["itzulia-basque-country-2026", "region-pays-de-la-loire-tour-2026", "some-other-race-2026"])
        self.assertEqual(rows[1]["name"], "Région Pays de la Loire Tour")
        self.assertEqual(rows[0]["start"], dt.date(2026, 4, 6))

    def test_race_slug_by_date_and_name(self):
        with mock.patch.object(cf, "get", return_value=fx("cf_calendar.html")):
            # mismo slug que PCS
            self.assertEqual(cf.race_slug("itzulia-basque-country", "Itzulia Basque Country", 2026, dt.date(2026, 4, 6)),
                             "itzulia-basque-country-2026")
            # slug distinto: el del mismo día que más se parece en el nombre
            self.assertEqual(cf.race_slug("region-pays-de-la-loire", "Région Pays de la Loire Tour", 2026, dt.date(2026, 4, 7)),
                             "region-pays-de-la-loire-tour-2026")
            # ninguna del mismo día se parece: no se adivina
            self.assertIsNone(cf.race_slug("tour-de-bretagne", "Tour de Bretagne", 2026, dt.date(2026, 4, 7)))


class RiderTests(unittest.TestCase):
    INDEX = ({"paul-seixas", "mattias-skjelmose-jensen", "sergio-higuita", "ion-izagirre"},
             {"paul seixas": "paul-seixas", "mattias skjelmose": "mattias-skjelmose-jensen",
              "sergio higuita": "sergio-higuita", "ion izagirre": "ion-izagirre"})

    def test_rows_and_matching(self):
        rows = cf.parse_rows(fx("cf_stage.html"))
        self.assertEqual([r for r, _, _ in rows], ["1", "2", "3", "4", "DNF"])
        mapped = [cf.to_pcs(s, n, self.INDEX) for _, s, n in rows]
        self.assertEqual(mapped, ["paul-seixas", "mattias-skjelmose-jensen", "sergio-higuita", "ion-izagirre",
                                  "someone-else"])


class StartlistTests(unittest.TestCase):
    def test_parse_startlist(self):
        rows = cf.parse_startlist(fx("cf_startlist.html"))
        # el bloque de abandonos no cuenta: cada corredor una vez, con su equipo
        self.assertEqual(rows, [
            dict(cf_slug="noah-hobbs", name="Noah Hobbs", nationality="gb", bib=1, team="EF Education - EasyPost"),
            dict(cf_slug="sergio-andres-higuita", name="Sergio Andrés Higuita", nationality="co", bib=2,
                 team="EF Education - EasyPost"),
        ])


if __name__ == "__main__":
    unittest.main()
