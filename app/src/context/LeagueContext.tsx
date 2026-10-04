import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Me } from '../lib/types';
import { useAuth } from './AuthContext';

const KEY = 'fantasy:league_id';

interface LeagueState {
  leagueId: string | null;
  ready: boolean;                    // ya se ha leído la liga guardada
  me: Me | null;                     // mi resumen en la liga (barra superior)
  version: number;                   // sube tras cada cambio: las pantallas recargan
  pendingInvite: string | null;      // código de un enlace abierto antes de iniciar sesión
  selectLeague: (id: string | null) => Promise<void>;
  refresh: () => void;
  setPendingInvite: (code: string | null) => void;
}

const LeagueCtx = createContext<LeagueState | null>(null);

export function LeagueProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [version, setVersion] = useState(0);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((id) => { setLeagueId(id); setReady(true); });
  }, []);

  useEffect(() => {
    if (!session) { setMe(null); return; }
    if (!leagueId) { setMe(null); return; }
    let alive = true;
    api.me(leagueId)
      .then((m) => { if (alive) setMe(m); })
      .catch((e: Error) => {
        if (!alive) return;
        setMe(null);
        // ya no soy miembro de esa liga: vuelvo a la lista de ligas (un fallo de red no borra la elección)
        if (/No perteneces/.test(e.message)) { setLeagueId(null); AsyncStorage.removeItem(KEY); }
      });
    return () => { alive = false; };
  }, [session, leagueId, version]);

  const selectLeague = useCallback(async (id: string | null) => {
    if (id) await AsyncStorage.setItem(KEY, id);
    else await AsyncStorage.removeItem(KEY);
    setMe(null);
    setLeagueId(id);
  }, []);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  return (
    <LeagueCtx.Provider value={{ leagueId, ready, me, version, pendingInvite, selectLeague, refresh, setPendingInvite }}>
      {children}
    </LeagueCtx.Provider>
  );
}

export function useLeague() {
  const ctx = useContext(LeagueCtx);
  if (!ctx) throw new Error('useLeague fuera de LeagueProvider');
  return ctx;
}
