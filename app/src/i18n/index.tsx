import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import es from './locales/es';
import type { Dict, Key } from './types';

/**
 * Idiomas de la app. El español es el de referencia: si a otro idioma le falta un texto, sale en español.
 * Uso: t('login.title') o t('market.bids', { n: 3 }) — los {nombres} entre llaves se sustituyen.
 * Plurales: t(n === 1 ? 'x.one' : 'x.other', { n }) (simplificación: 1 frente al resto).
 */
export const LANGUAGES: { code: Lang; name: string }[] = [
  { code: 'es', name: 'Español' }, { code: 'en', name: 'English' }, { code: 'fr', name: 'Français' }, { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' }, { code: 'nl', name: 'Nederlands' }, { code: 'de', name: 'Deutsch' },
  { code: 'ca', name: 'Català' }, { code: 'eu', name: 'Euskara' }, { code: 'gl', name: 'Galego' },
  { code: 'pl', name: 'Polski' }, { code: 'ru', name: 'Русский' }, { code: 'ar', name: 'العربية' },
  { code: 'ja', name: '日本語' }, { code: 'da', name: 'Dansk' }, { code: 'sl', name: 'Slovenščina' },
  { code: 'cs', name: 'Čeština' },
];
export type Lang = 'es' | 'en' | 'fr' | 'pt' | 'it' | 'nl' | 'de' | 'ca' | 'eu' | 'gl' | 'pl' | 'ru' | 'ar' | 'ja' | 'da' | 'sl' | 'cs';

// Solo el español va en el paquete inicial (es el de referencia). Los demás se cargan al elegirlos: en la web cada
// uno es un fichero aparte, así que la primera carga no arrastra los 17 idiomas.
const LOADERS: Record<Exclude<Lang, 'es'>, () => Promise<{ default: Partial<Dict> }>> = {
  ar: () => import('./locales/ar'),
  ca: () => import('./locales/ca'),
  cs: () => import('./locales/cs'),
  da: () => import('./locales/da'),
  de: () => import('./locales/de'),
  en: () => import('./locales/en'),
  eu: () => import('./locales/eu'),
  fr: () => import('./locales/fr'),
  gl: () => import('./locales/gl'),
  it: () => import('./locales/it'),
  ja: () => import('./locales/ja'),
  nl: () => import('./locales/nl'),
  pl: () => import('./locales/pl'),
  pt: () => import('./locales/pt'),
  ru: () => import('./locales/ru'),
  sl: () => import('./locales/sl'),
};
const DICTS: Partial<Record<Lang, Partial<Dict>>> = { es };
const isLang = (code: string): code is Lang => code === 'es' || code in LOADERS;

/** Deja cargado el diccionario de un idioma; si falla (sin red), la app sigue en español */
async function loadDict(l: Lang) {
  if (DICTS[l] || l === 'es') return;
  try { DICTS[l] = (await LOADERS[l]()).default; } catch { /* se queda el español */ }
}
const STORAGE_KEY = 'cyclonomy:lang';

function deviceLang(): Lang {
  try {
    for (const l of getLocales()) {
      const code = (l.languageCode ?? '').toLowerCase();
      if (isLang(code)) return code;
    }
  } catch { /* sin información del dispositivo */ }
  return 'es';
}

let current: Lang = deviceLang();

/** Texto traducido al idioma actual (con {parámetros}) */
export function t(key: Key, params?: Record<string, string | number>): string {
  let s = DICTS[current]?.[key] ?? es[key] ?? key;
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
      .then((saved) => { if (saved && isLang(saved)) current = saved; })
      .catch(() => undefined)
      .then(() => loadDict(current))
      .finally(() => { setState(current); setReady(true); });
  }, []);

  const setLang = useCallback((l: Lang) => {
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => undefined);
    // la app se vuelve a pintar cuando el diccionario ya está cargado
    loadDict(l).then(() => { current = l; setState(l); });
  }, []);

  if (!ready) return null;
  return <I18nCtx.Provider value={{ lang, setLang }}>{children(lang)}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('useI18n fuera de I18nProvider');
  return ctx;
}
