"""Tests de los parsers con HTML SIMULADO (imita la estructura de PCS; no es HTML real descargado).

    python -m unittest discover -s ingest/tests -t .
"""
import datetime as dt
import unittest
from pathlib import Path

from ingest import parsers

FX = Path(__file__).parent / "fixtures"


def fx(name):
    return (FX / name).read_text(encoding="utf-8")


class CalendarTests(unittest.TestCase):
    def test_listing_keeps_men_wt_and_championships(self):
        rows = parsers.parse_calendar_listing(fx("races_listing.html"), 2027)
        kept = [r for r in rows if parsers.keep_race(r)]
        self.assertEqual([r["slug"] for r in kept], ["strade-bianche", "tirreno-adriatico", "nc-spain-itt"])
        tirreno = kept[1]
        self.assertEqual((tirreno["start_date"], tirreno["end_date"]), (dt.date(2027, 3, 9), dt.date(2027, 3, 15)))
        self.assertEqual(tirreno["uci_class"], "2.UWT")
        self.assertEqual(tirreno["country"], "it")
        self.assertEqual(kept[0]["name"], "Strade Bianche")          # sin el sufijo ME

    def test_circuits_dropdown(self):
        opts = parsers.select_options(fx("races_listing.html"), "circuit")
        men = [v for v, t in opts if v and not parsers.EXCLUDE_CIRCUIT.search(t)]
        self.assertEqual(men, ["1"])

    def test_race_stages(self):
        stages = parsers.parse_race_stages(fx("race_overview.html"), "tirreno-adriatico", 2027)
        self.assertEqual([s["number"] for s in stages], [1, 2, 3])
        self.assertEqual(stages[0]["date"], dt.date(2027, 3, 9))
        self.assertTrue(stages[0]["is_itt"])
        self.assertFalse(stages[1]["is_itt"])
        self.assertEqual(stages[2]["distance_km"], 239.0)


class RacePageTests(unittest.TestCase):
    def test_stage_info(self):
        info = parsers.parse_stage_info(fx("stage_page.html"))
        self.assertEqual(info["start_time"], dt.time(12, 15))
        self.assertEqual(info["distance_km"], 199.0)
        self.assertEqual(info["date"], dt.date(2027, 3, 10))
        info = parsers.parse_stage_info(fx("oneday_result.html"))
        self.assertEqual((info["start_time"], info["distance_km"], info["date"]),
                         (dt.time(10, 50), 213.5, dt.date(2027, 3, 6)))

    def test_stage_results_by_tab(self):
        res = parsers.parse_results(fx("stage_page.html"))
        self.assertEqual(res["stage"], [("jonathan-milan", 1), ("tadej-pogacar", 2)])   # DNF fuera
        self.assertEqual(res["gc"][0], ("tadej-pogacar", 1))
        self.assertEqual(res["points"], [("jonathan-milan", 1)])
        self.assertEqual(res["kom"][0], ("climber", 1))
        self.assertNotIn("teams", res)

    def test_oneday_results(self):
        res = parsers.parse_results(fx("oneday_result.html"))
        self.assertEqual(res, {"stage": [("tadej-pogacar", 1), ("tom-pidcock", 2)]})

    def test_startlist_ignores_header_and_footer(self):
        self.assertEqual(parsers.parse_startlist(fx("startlist.html")), ["tadej-pogacar", "tim-wellens", "tom-pidcock"])


class TeamTests(unittest.TestCase):
    def test_team_list(self):
        teams = parsers.parse_team_list(fx("team_list.html"))
        self.assertEqual([(t[0], t[2]) for t in teams],
                         [("uae-team-emirates-xrg", "WT"), ("burgos-burpellet-bh", "PRT")])

    def test_team_page(self):
        t = parsers.parse_team(fx("team_page.html"), 2027)
        self.assertEqual(t["name"], "UAE Team Emirates - XRG")
        self.assertEqual([r["slug"] for r in t["riders"]], ["tadej-pogacar", "juan-ayuso"])
        self.assertEqual(t["riders"][0]["name"], "Tadej Pogačar")
        self.assertEqual(t["riders"][1]["nationality"], "es")

    def test_display_name(self):
        self.assertEqual(parsers.display_name("VAN AERT Wout"), "Wout Van Aert")
        self.assertEqual(parsers.display_name("Wout van Aert"), "Wout van Aert")

    def test_birthdate(self):
        self.assertEqual(parsers.parse_birthdate(fx("rider_page.html")), dt.date(1998, 9, 21))


if __name__ == "__main__":
    unittest.main()
