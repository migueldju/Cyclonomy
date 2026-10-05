import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import ar from './locales/ar';
import ca from './locales/ca';
import cs from './locales/cs';
import da from './locales/da';
import de from './locales/de';
import es from './locales/es';
import eu from './locales/eu';
import fr from './locales/fr';
import gl from './locales/gl';
import it from './locales/it';
import ja from './locales/ja';
import nl from './locales/nl';
import pl from './locales/pl';
import pt from './locales/pt';
import ru from './locales/ru';
import sl from './locales/sl';
import type { Dict, Key } from './types';

/**
 * Idiomas de la app. El español es el de referencia: si a otro idioma le falta un texto, sale en español.
 * Uso: t('login.title') o t('market.bids', { n: 3 }) — los {nombres} entre llaves se sustituyen.
 * Plurales: t(n === 1 ? 'x.one' : 'x.other', { n }) (simplificación: 1 frente al resto).
 */
export const LANGUAGES: { code: Lang; name: string }[] = [
  { code: 'es', name: 'Español' }, { code: 'fr', name: 'Français' }, { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' }, { code: 'nl', name: 'Nederlands' }, { code: 'de', name: 'Deutsch' },
  { code: 'ca', name: 'Català' }, { code: 'eu', name: 'Euskara' }, { code: 'gl', name: 'Galego' },
  { code: 'pl', name: 'Polski' }, { code: 'ru', name: 'Русский' }, { code: 'ar', name: 'العربية' },
  { code: 'ja', name: '日本語' }, { code: 'da', name: 'Dansk' }, { code: 'sl', name: 'Slovenščina' },
  { code: 'cs', name: 'Čeština' },
];
export type Lang = 'es' | 'fr' | 'pt' | 'it' | 'nl' | 'de' | 'ca' | 'eu' | 'gl' | 'pl' | 'ru' | 'ar' | 'ja' | 'da' | 'sl' | 'cs';

const DICTS: Record<Lang, Partial<Dict>> = { es, fr, pt, it, nl, de, ca, eu, gl, pl, ru, ar, ja, da, sl, cs };
const STORAGE_KEY = 'cyclonomy:lang';

function deviceLang(): Lang {
  try {
    for (const l of getLocales()) {
      const code = (l.languageCode ?? '').toLowerCase();
      if (code in DICTS) return code as Lang;
    }
  } catch { /* sin información del dispositivo */ }
  return 'es';
}

let current: Lang = deviceLang();

/** Texto traducido al idioma actual (con {parámetros}) */
export function t(key: Key, params?: Record<string, string | number>): string {
  let s = DICTS[current][key] ?? es[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export const getLang = () => current;

const I18nCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void } | null>(null);

/** Carga el idioma guardado (o el del dispositivo) y vuelve a pintar la app al cambiarlo */
export function I18nProvider({ children }: { children: (lang: Lang) => ReactNode }) {
  const [lang, setState] = useState<Lang>(current);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => { if (saved && saved in DICTS) { current = saved as Lang; setState(current); } })
      .finally(() => setReady(true));
  }, []);

  const setLang = useCallback((l: Lang) => {
    current = l;
    setState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => undefined);
  }, []);

  if (!ready) return null;
  return <I18nCtx.Provider value={{ lang, setLang }}>{children(lang)}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('useI18n fuera de I18nProvider');
  return ctx;
}
