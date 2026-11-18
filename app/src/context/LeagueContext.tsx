import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { setGameClock } from '../lib/format';
import type { Me } from '../lib/types';
import { useAuth } from './AuthContext';

const KEY = 'fantasy:league_id';
const INVITE_KEY = 'cyclonomy:invite';

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
  const [pendingInvite, setInvite] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.multiGet([KEY, INVITE_KEY])
      .then(([[, id], [, invite]]) => { setLeagueId(id); setInvite(invite); })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  // se guarda: en la web, entrar con Google recarga la página y se perdería el código
  const setPendingInvite = useCallback((code: string | null) => {
    setInvite(code);
    (code ? AsyncStorage.setItem(INVITE_KEY, code) : AsyncStorage.removeItem(INVITE_KEY)).catch(() => undefined);
  }, []);

  // la hora del juego (puede estar simulada): «hoy» y las cuentas atrás se calculan con ella
  useEffect(() => {
    if (!session) return;
    api.gameNow().then((now) => { setGameClock(now); setVersion((v) => v + 1); }).catch(() => {});
  }, [session]);

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
