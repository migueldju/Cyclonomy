"""Conexión a Postgres (Supabase). Usa psycopg 3 y la cadena de conexión DATABASE_URL.

En Supabase: Project Settings → Database → Connection string (usa el usuario postgres o uno con
permisos de escritura; la ingesta no pasa por RLS).
"""
from __future__ import annotations

import os


class Database:
    def __init__(self, dsn: str | None = None):
        import psycopg  # pip install "psycopg[binary]"
        self.conn = psycopg.connect(dsn or os.environ["DATABASE_URL"], autocommit=True)

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
