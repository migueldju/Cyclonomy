import unittest

from ingest.history import parse_stage_url


class ParseStageUrlTest(unittest.TestCase):
    def test_kinds(self):
        self.assertEqual(parse_stage_url("race/vuelta-a-espana/2026/stage-20", 2026), ("vuelta-a-espana", "stage", 20))
        self.assertEqual(parse_stage_url("race/giro-d-italia/2026/prologue", 2026), ("giro-d-italia", "stage", 0))
        self.assertEqual(parse_stage_url("race/strade-bianche/2026/result", 2026), ("strade-bianche", "stage", 1))
        self.assertEqual(parse_stage_url("race/strade-bianche/2026", 2026), ("strade-bianche", "stage", 1))
        for kind in ("gc", "points", "kom"):
            self.assertEqual(parse_stage_url(f"race/tour-de-france/2026/{kind}", 2026), ("tour-de-france", kind, 1))

    def test_ignored(self):
        self.assertIsNone(parse_stage_url("race/tour-de-france/2026/youth", 2026))
        self.assertIsNone(parse_stage_url("race/tour-de-france/2025/gc", 2026))
        self.assertIsNone(parse_stage_url(None, 2026))
