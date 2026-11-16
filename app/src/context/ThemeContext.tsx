import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { applyScheme } from '../theme';

/** Tema elegido en los ajustes: el del sistema, claro u oscuro */
export type ThemePref = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'cyclonomy:theme';
const PREFS: ThemePref[] = ['system', 'light', 'dark'];

const ThemeCtx = createContext<{ pref: ThemePref; setPref: (p: ThemePref) => void; dark: boolean } | null>(null);

/**
 * Carga el tema guardado y pone sus colores antes de pintar. Los hijos reciben 'light' o 'dark' para usarlo de
 * `key`: al cambiar de tema la app se vuelve a montar, igual que al cambiar de idioma.
 */
export function ThemeProvider({ children }: { children: (scheme: 'light' | 'dark') => ReactNode }) {
  const system = useColorScheme();
  const [pref, setState] = useState<ThemePref>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => { if (saved && PREFS.includes(saved as ThemePref)) setState(saved as ThemePref); })
      .finally(() => setReady(true));
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => undefined);
  }, []);

  if (!ready) return null;
  const dark = pref === 'dark' || (pref === 'system' && system === 'dark');
  applyScheme(dark);          // antes de pintar a los hijos: sus estilos se calculan ya con estos colores
  return <ThemeCtx.Provider value={{ pref, setPref, dark }}>{children(dark ? 'dark' : 'light')}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme fuera de ThemeProvider');
  return ctx;
}
