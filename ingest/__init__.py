"""Ingesta de datos de ProCyclingStats para el fantasy de ciclismo.

Lee de PCS (con caché y pausas entre peticiones) y escribe en el Postgres de Supabase.
La app nunca habla con PCS: solo lee de la base de datos.
"""
