import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLeague } from '../context/LeagueContext';

/**
 * Carga datos al entrar en la pantalla, al volver a ella y cada vez que algo cambia en la liga
 * (refresh() del contexto). Devuelve también reload() para "tirar para actualizar".
 * Con enabled = false no carga (por ejemplo, mientras no hay liga elegida).
 */
export function useLoader<T>(load: () => Promise<T>, deps: unknown[] = [], enabled = true) {
  const { version } = useLeague();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const d = await load();
      if (alive.current) { setData(d); setError(null); }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [version, enabled, ...deps]);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  return { data, error, loading, reload, setData };
}
