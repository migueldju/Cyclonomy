"""Doble de pruebas de ingest.db.Database que ejecuta cada consulta con `psql` (sin psycopg).

Solo para tests: interpola los parámetros como literales SQL y convierte la salida a tipos de Python.
`now` fija app.now (el reloj del juego) en cada consulta.
"""
import datetime as dt
import os
import re
import subprocess
from decimal import Decimal

SEP = "\x1f"


def lit(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float, Decimal)):
        return str(v)
    if isinstance(v, dt.datetime):
        return f"'{v.isoformat()}'::timestamptz"
    if isinstance(v, dt.date):
        return f"'{v.isoformat()}'::date"
    if isinstance(v, dt.timedelta):
        return f"'{v.total_seconds()} seconds'::interval"
    if isinstance(v, (list, tuple)):
        if not v:
            return "'{}'"
        return "array[" + ", ".join(lit(x) for x in v) + "]"
    return "'" + str(v).replace("'", "''") + "'"


def conv(s):
    if s == "":
        return None
    if s in ("t", "f"):
        return s == "t"
    if re.fullmatch(r"-?\d+", s):
        return int(s)
    if re.fullmatch(r"-?\d+\.\d+", s):
        return float(s)
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return dt.date.fromisoformat(s)
    return s


class PsqlDatabase:
    def __init__(self, dbname, now=None):
        self.dbname, self.now = dbname, now

    def _run(self, sql, params=()):
        parts = sql.split("%s")
        assert len(parts) - 1 == len(params), (sql, params)
        q = parts[0] + "".join(lit(p) + rest for p, rest in zip(params, parts[1:]))
        if self.now:
            q = f"set app.now = '{self.now.isoformat()}'; " + q
        out = subprocess.run(["psql", "-X", "-q", "-At", "-F", SEP, "-v", "ON_ERROR_STOP=1", "-d", self.dbname,
                              "-c", q], capture_output=True, text=True, env=os.environ)
        if out.returncode:
            raise RuntimeError(out.stderr.strip())
        return [tuple(conv(c) for c in line.split(SEP)) for line in out.stdout.splitlines() if line != ""]

    def execute(self, sql, params=()):
        self._run(sql, params)

    def fetchall(self, sql, params=()):
        return self._run(sql, params)

    def fetchone(self, sql, params=()):
        rows = self._run(sql, params)
        return rows[0] if rows else None

    def scalar(self, sql, params=()):
        row = self.fetchone(sql, params)
        return row[0] if row else None
