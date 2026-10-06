"""Conexión a Postgres (Supabase). Usa psycopg 3 y la cadena de conexión DATABASE_URL.

En Supabase: botón Connect → Session pooler
(postgresql://postgres.<ref>:<clave>@aws-0-<región>.pooler.supabase.com:5432/postgres). La conexión directa
usa IPv6 y falla desde muchas redes. La ingesta escribe como postgres: no pasa por RLS.
"""
from __future__ import annotations

import os


class Database:
    def __init__(self, dsn: str | None = None):
        self.dsn = dsn or os.environ["DATABASE_URL"]
        self._conn = None

    @property
    def conn(self):
        """Conexión abierta. Si el pooler la ha cerrado (pasa tras horas de inactividad o un corte), abre otra:
        la consulta que falló no se repite, pero la siguiente ya funciona y el bucle de la ingesta se recupera."""
        import psycopg  # pip install "psycopg[binary]"
        if self._conn is None or self._conn.closed or self._conn.broken:
            self._conn = psycopg.connect(self.dsn, autocommit=True)
        return self._conn

    def execute(self, sql: str, params: tuple | list = ()) -> None:
        with self.conn.cursor() as cur:
            cur.execute(sql, params)

    def fetchall(self, sql: str, params: tuple | list = ()) -> list[tuple]:
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()

    def fetchone(self, sql: str, params: tuple | list = ()):
        rows = self.fetchall(sql, params)
        return rows[0] if rows else None

    def scalar(self, sql: str, params: tuple | list = ()):
        row = self.fetchone(sql, params)
        return row[0] if row else None
