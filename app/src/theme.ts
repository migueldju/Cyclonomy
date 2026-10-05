import { t } from './i18n';
import type { Key } from './i18n/types';

// Identidad visual: la carretera y el dorsal.
// Asfalto para la barra superior, gris de marca vial de fondo, amarillo maillot para la acción principal.
export const colors = {
  asphalt: '#1E272C',      // barra superior, texto principal
  asphaltSoft: '#3A464D',
  road: '#EDF0EE',         // fondo
  paper: '#FFFFFF',        // dorsal, superficies
  line: '#D5DBD8',         // separadores
  ink: '#1E272C',
  inkSoft: '#5E6B71',
  jersey: '#F5C400',       // acción principal (maillot amarillo)
  jerseyInk: '#2A2300',
  green: '#17834A',        // dinero y puntos a favor
  orange: '#E9852B',       // llega el lunes
  red: '#D23A3A',          // se va el lunes / errores
  focus: '#2F6FDB',
};

export const fonts = {
  body: 'FiraSans_400Regular',
  bodyMedium: 'FiraSans_500Medium',
  bodyBold: 'FiraSans_600SemiBold',
  display: 'FiraSansCondensed_600SemiBold',
  number: 'FiraSansCondensed_700Bold',
};

// Escala tipográfica (1,2): 13 · 15 · 18 · 22 · 26 · 32
export const type = {
  small: 13,
  body: 15,
  lead: 18,
  title: 22,
  display: 26,
  hero: 32,
};

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };

// Categorías: un color por tipo de carrera, para reconocerlas de un vistazo en el calendario
export const categoryColor: Record<string, string> = {
  TDF: '#F5C400', GT: '#E8578A', MON: '#7A4BC2', WC: '#2F6FDB', WC_ITT: '#2F6FDB',
  MWT: '#1E272C', SWT: '#6B7A82', CC: '#2A9BB8', CC_ITT: '#2A9BB8', NC: '#C0613A', NC_ITT: '#C0613A',
  PRO: '#17834A', C1: '#9AA5AA',
};

// Clases UCI de las categorías WT, .Pro y .1 (las demás tienen nombre corto traducido)
const CATEGORY_CLASS: Record<string, string> = { MWT: 'MWT', SWT: 'SWT', PRO: 'Pro', C1: '1' };

/** Nombre completo de la categoría en el idioma actual (la base de datos lo guarda en español) */
export function categoryName(code: string): string {
  const key = `cat.${code}` as Key;
  const s = t(key);
  return s === key ? code : s;
}

/** Nombre corto; en WT, .Pro y .1 la clase: 1.MWT / 2.MWT, 1.SWT / 2.SWT, 1.Pro / 2.Pro, 1.1 / 2.1 (clásica / vuelta) */
export function categoryLabel(code: string, isStageRace: boolean): string {
  if (CATEGORY_CLASS[code]) return `${isStageRace ? 2 : 1}.${CATEGORY_CLASS[code]}`;
  const key = `catShort.${code}` as Key;
  const s = t(key);
  return s === key ? code : s;
}

// Categorías de mayor a menor importancia (orden de los filtros del calendario)
export const categoryOrder = ['TDF', 'GT', 'MON', 'WC', 'WC_ITT', 'MWT', 'SWT', 'CC', 'CC_ITT', 'NC', 'NC_ITT', 'PRO', 'C1'];
export const categoryRank = (code: string) => {
  const i = categoryOrder.indexOf(code);
  return i < 0 ? categoryOrder.length : i;
};
