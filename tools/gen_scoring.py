"""Genera supabase/seed/puntuacion.csv (tabla de puntos editable) y categorias.csv.

Puntos del ganador: tabla pública de escalas de PCS (procyclingstats.com/info/point-scales).
Reparto por puestos: APROXIMADO (la página de detalle de PCS no es accesible a herramientas
automáticas). Edita el CSV a mano y vuelve a cargarlo con `python tools/load_seed.py`.
"""
import csv
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "supabase" / "seed"

# Fracciones del ganador por puesto (plantillas)
TOP25 = [500, 380, 340, 300, 280, 260, 240, 220, 200, 180, 160, 140, 130, 120, 110,
         100, 90, 80, 70, 60, 50, 40, 35, 30, 25]
STAGE15 = [100, 80, 65, 55, 45, 35, 30, 25, 20, 17, 15, 12, 10, 7, 5]
CLASS3 = [1.0, 0.6, 0.4]          # clasificación final de puntos / montaña (sobre su propio ganador)

# código, nombre, nivel de profundidad, máx. inscritos, es CRI,
#   (ganador clásica/general, puestos), (ganador etapa, puestos), ganador clas. puntos/montaña, maillot montaña por día
CATS = [
    ("TDF",    "Tour de France",              1, 8, False, (500, 25), (100, 15), 100, 10),
    ("GT",     "Grandes Vueltas (Giro, Vuelta)", 1, 8, False, (400, 25), (80, 15), 80, 8),
    ("WC",     "Campeonato del Mundo",        1, 6, False, (350, 25), None, None, None),
    ("WC_ITT", "Mundial CRI",                 1, 3, True,  (250, 15), None, None, None),
    ("MON",    "Monumentos",                  1, 7, False, (275, 25), None, None, None),
    ("MWT",    "WT principal (1.MWT / 2.MWT)", 1, 7, False, (225, 20), (50, 10), 50, None),
    ("SWT",    "WT secundaria (1.SWT / 2.SWT)", 2, 7, False, (180, 20), (40, 10), 40, None),
    ("CC",     "Campeonato continental",      2, 6, False, (150, 15), None, None, None),
    ("CC_ITT", "Campeonato continental CRI",  2, 3, True,  (60, 10), None, None, None),
    ("NC",     "Campeonato nacional",         2, 6, False, (50, 10), None, None, None),
    ("NC_ITT", "Campeonato nacional CRI",     2, 3, True,  (25, 5), None, None, None),
    ("PRO",    ".Pro (1.Pro / 2.Pro)",        3, 6, False, (125, 15), (30, 5), 30, None),
    ("C1",     ".1 (1.1 / 2.1)",              4, 6, False, (75, 10), (20, 5), 20, None),
]
# En las vueltas de una semana la general vale más que en la clásica equivalente (escala PCS 2.x)
ONLY_STAGE_RACES = {"TDF", "GT"}          # sin clásicas: solo general, etapas y clasificaciones
GC_WINNER = {"MWT": 250, "SWT": 200, "PRO": 150, "C1": 100}


def scale(template, winner, n):
    base = template[0]
    pts, prev = [], None
    for i in range(n):
        v = max(1, round(template[i] * winner / base))
        if prev is not None and v > prev:
            v = prev
        pts.append(v)
        prev = v
    return pts


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for code, name, lvl, maxn, itt, top, stage, cls, komday in CATS:
        win, n = top
        if code not in ONLY_STAGE_RACES:
            rows += [(code, "oneday", i + 1, p) for i, p in enumerate(scale(TOP25, win, n))]
        if stage:
            gw = GC_WINNER.get(code, win)
            rows += [(code, "gc", i + 1, p) for i, p in enumerate(scale(TOP25, gw, n))]
            rows += [(code, "stage", i + 1, p) for i, p in enumerate(scale(STAGE15, stage[0], stage[1]))]
        if cls:
            for kind in ("points_final", "kom_final"):
                rows += [(code, kind, i + 1, round(cls * f)) for i, f in enumerate(CLASS3)]
        if komday:
            rows.append((code, "kom_jersey", 1, komday))
    with open(OUT / "puntuacion.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["categoria", "tipo", "puesto", "puntos"])
        w.writerows(rows)
    with open(OUT / "categorias.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["codigo", "nombre", "nivel_profundidad", "max_inscritos", "es_cri"])
        w.writerows([(c[0], c[1], c[2], c[3], c[4]) for c in CATS])
    print(len(rows), "filas de puntuación")


if __name__ == "__main__":
    main()
