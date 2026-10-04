"""Construye supabase/seed.sql a partir de los CSV editables de supabase/seed/.

    python tools/gen_scoring.py      # (opcional) regenera la tabla de puntos aproximada
    python tools/build_seed.py       # escribe supabase/seed.sql

Para aplicar cambios de puntuación en una base ya creada, ejecuta seed.sql de nuevo: borra y
vuelve a cargar categorías, puntos y reglas de categoría.
"""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED_DIR = ROOT / "supabase" / "seed"

# Reglas para decidir la categoría de cada carrera (prioridad, categoría, clases UCI, regex, solo CRI)
MAIN_WT = ("paris-nice|tirreno-adriatico|volta-a-catalunya|itzulia|tour-de-romandie|dauphine|"
           "tour-auvergne-rhone-alpes|tour-de-suisse|uae-tour|omloop-het-nieuwsblad|strade-bianche|"
           "e3-|gent-wevelgem|amstel-gold-race|la-fleche-wallonne|fleche-wallonne|san-sebastian")
CATEGORY_RULES = [
    (10, "TDF",    ["2.UWT"], r"^tour-de-france", None),
    (20, "GT",     ["2.UWT"], r"^(giro-d-italia|vuelta-a-espana)", None),
    (30, "MON",    ["1.UWT"], r"^(milano-sanremo|ronde-van-vlaanderen|paris-roubaix|liege-bastogne-liege|il-lombardia)", None),
    (40, "MWT",    ["1.UWT", "2.UWT"], rf"^({MAIN_WT})", None),
    (50, "SWT",    ["1.UWT", "2.UWT"], None, None),
    (60, "WC_ITT", ["WC"], None, True),
    (61, "WC",     ["WC"], None, False),
    (70, "CC_ITT", ["CC"], None, True),
    (71, "CC",     ["CC"], None, False),
    (80, "NC_ITT", ["NC"], None, True),
    (81, "NC",     ["NC"], None, False),
    (90, "PRO",    ["1.PRO", "2.PRO"], None, None),
    (100, "C1",    ["1.1", "2.1"], None, None),
]


def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def main():
    out = ["-- Generado por tools/build_seed.py. No editar a mano: edita los CSV de supabase/seed/.",
           "begin;",
           "delete from public.scoring_rule;",
           "delete from public.category_rule;"]
    cats = list(csv.DictReader(open(SEED_DIR / "categorias.csv", encoding="utf-8")))
    for c in cats:
        out.append(
            "insert into public.race_category (code, name, depth_level, max_entries, is_itt) values "
            f"({q(c['codigo'])}, {q(c['nombre'])}, {int(c['nivel_profundidad'])}, {int(c['max_inscritos'])}, "
            f"{q(c['es_cri'].strip().lower() == 'true')}) on conflict (code) do update set name = excluded.name, "
            "depth_level = excluded.depth_level, max_entries = excluded.max_entries, is_itt = excluded.is_itt;")
    rows = list(csv.DictReader(open(SEED_DIR / "puntuacion.csv", encoding="utf-8")))
    values = ",\n  ".join(f"({q(r['categoria'])}, {q(r['tipo'])}, {int(r['puesto'])}, {int(r['puntos'])})" for r in rows)
    out.append(f"insert into public.scoring_rule (category, kind, position, points) values\n  {values};")
    for prio, cat, classes, pattern, itt in CATEGORY_RULES:
        arr = "array[" + ", ".join(q(c) for c in classes) + "]"
        out.append("insert into public.category_rule (priority, category, uci_classes, pattern, itt) values "
                   f"({prio}, {q(cat)}, {arr}, {q(pattern)}, {q(itt)});")
    out.append("commit;")
    (ROOT / "supabase" / "seed.sql").write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"seed.sql: {len(cats)} categorías, {len(rows)} reglas de puntos, {len(CATEGORY_RULES)} reglas de categoría")


if __name__ == "__main__":
    main()
