import { t } from './i18n';
import type { Key } from './i18n/types';

// Identidad visual: la carretera y el dorsal.
// Asfalto para la barra superior, gris de marca vial de fondo, amarillo maillot para la acción principal.
const LIGHT = {
  asphalt: '#1E272C',      // barra superior y de pestañas: oscura en los dos temas
  asphaltSoft: '#3A464D',
  road: '#EEF1EF',         // fondo, claro: las tarjetas blancas se separan con sombra
  paper: '#FFFFFF',        // dorsal, superficies
  line: '#E3E8E5',         // separadores
  ink: '#1E272C',          // texto principal
  inkSoft: '#5E6B71',
  jersey: '#F4C63F',       // acción principal: el amarillo del logo
  jerseyInk: '#2A2300',
  green: '#17834A',        // dinero y puntos a favor
  orange: '#E9852B',       // llega el lunes
  red: '#D23A3A',          // se va el lunes / errores
  focus: '#2F6FDB',
  blue: '#2F6FB7',         // blindado
  onDark: '#FFFFFF',       // texto sobre asfalto o sobre un color: blanco en los dos temas
  onLight: '#1E272C',      // texto sobre un color claro (amarillo, gris): oscuro en los dos temas
  highlight: '#FFF7D1',    // fila o tarjeta destacada (la tuya, la elegida)
  zebra: '#F7F9F8',        // filas alternas de las tablas
  greenSoft: '#DDF0E4',    // cabecera verde suave
  greenInk: '#0E4F2C',
};

// Tema oscuro: mismo papel de cada color, sobre fondo casi negro y tarjetas gris asfalto
const DARK: typeof LIGHT = {
  asphalt: '#1E272C',
  asphaltSoft: '#3A464D',
  road: '#0E1315',
  paper: '#1A2125',
  line: '#2C373D',
  ink: '#EEF1EF',
  inkSoft: '#9BA8AE',
  jersey: '#F4C63F',
  jerseyInk: '#2A2300',
  green: '#3DBE78',
  orange: '#F09A4A',
  red: '#F06A6A',
  focus: '#6EA0F0',
  blue: '#6FA6E0',
  onDark: '#FFFFFF',
  onLight: '#1E272C',
  highlight: '#3A3214',
  zebra: '#20292E',
  greenSoft: '#173A27',
  greenInk: '#9FE0BB',
};

/** Colores del tema actual. El objeto es siempre el mismo: al cambiar de tema se le cambian los valores. */
export const colors = { ...LIGHT };

let version = 0;
let dark = false;
export const isDark = () => dark;

/** Pone el tema claro u oscuro. Quien lo llama vuelve a pintar la app (ver ThemeProvider). */
export function applyScheme(toDark: boolean) {
  if (toDark === dark) return;
  dark = toDark;
  Object.assign(colors, dark ? DARK : LIGHT);
  Object.assign(categoryColor, dark ? CATEGORY_DARK : CATEGORY_LIGHT);
  version += 1;
}

/**
 * Estilos (o cualquier tabla de colores) que dependen del tema: se calculan la primera vez que se usan y otra vez
 * cuando cambia el tema. Se usa igual que el objeto que devuelve `make`.
 */
export function themed<T extends object>(make: () => T): T {
  let cache: T | null = null;
  let at = -1;
  const now = (): T => {
    if (!cache || at !== version) { cache = make(); at = version; }
    return cache;
  };
  return new Proxy({} as T, {
    get: (_, key) => {
      const target = now() as Record<PropertyKey, unknown>;
      const v = target[key];
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
    has: (_, key) => key in now(),
    ownKeys: () => Reflect.ownKeys(now()),
    getOwnPropertyDescriptor: (_, key) => {
      const d = Reflect.getOwnPropertyDescriptor(now(), key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

export const fonts = {
  body: 'FiraSans_400Regular',
  bodyMedium: 'FiraSans_500Medium',
  bodyBold: 'FiraSans_600SemiBold',
  display: 'BebasNeue_400Regular',         // títulos: condensada y en mayúsculas
  number: 'FiraSansCondensed_700Bold',
  password: 'PasswordDisc',                // todos los caracteres se dibujan como un punto
};

// Escala tipográfica (1,2): 13 · 15 · 18 · 24 · 30 · 38 (los títulos, en Bebas Neue, algo mayores: es más estrecha)
export const type = {
  small: 13,
  body: 15,
  lead: 18,
  title: 24,
  display: 30,
  hero: 38,
};

// Esquinas y sombra de las tarjetas
export const radius = { s: 8, m: 12, l: 16, pill: 999 };
export const cardShadow = {
  shadowColor: '#1E272C', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
};

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };

// Categorías: un color por tipo de carrera, para reconocerlas de un vistazo en el calendario
// WorldTour en turquesa (A, el tono fuerte; B, el suave) y .1 en marrón: sin grises, que en oscuro no se distinguían
const CATEGORY_LIGHT: Record<string, string> = {
  TDF: '#F4C63F', GT: '#E8578A', MON: '#7A4BC2', WC: '#0073CF', WC_ITT: '#0073CF',
  MWT: '#0B5C6B', SWT: '#1098AD', WT: '#0B5C6B', CC: '#003399', CC_ITT: '#003399', NC: '#C0613A', NC_ITT: '#C0613A',
  PRO: '#17834A', C1: '#6B4A22',
};
// En oscuro, los tonos que sobre las tarjetas gris asfalto se perderían van más luminosos
const CATEGORY_DARK: Record<string, string> = {
  ...CATEGORY_LIGHT,
  MWT: '#3BC9DB', WT: '#3BC9DB', SWT: '#1789A0', CC: '#4C7BE0', CC_ITT: '#4C7BE0', PRO: '#3DBE78', C1: '#9A733F',
};
export const categoryColor: Record<string, string> = { ...CATEGORY_LIGHT };

const GIRO = '#E8578A';      // maglia rosa
const VUELTA = '#D8232A';    // maillot rojo
// arcoíris de la UCI: azul, rojo, negro, amarillo y verde
const UCI_RAINBOW = ['#0073CF', '#E4002B', '#111111', '#FFD100', '#00A651'];

/**
 * Colores de una carrera, en franjas: casi todas uno solo, el de su categoría. Las grandes vueltas, mitad rosa y
 * mitad roja como categoría, y cada una el suyo si se sabe cuál es (Giro, rosa; Vuelta, roja); los mundiales, el
 * arcoíris de la UCI.
 */
export function raceColors(category: string, name?: string | null): string[] {
  if (category === 'GT') {
    if (name && /giro/i.test(name)) return [GIRO];
    if (name && /vuelta/i.test(name)) return [VUELTA];
    return [GIRO, VUELTA];
  }
  if (category === 'WC' || category === 'WC_ITT') return UCI_RAINBOW;
  return [categoryColor[category] ?? colors.inkSoft];
}

// Clases UCI de las categorías WT, .Pro y .1 (las demás tienen nombre corto traducido)
const CATEGORY_CLASS: Record<string, string> = { MWT: 'WT A', SWT: 'WT B', PRO: 'Pro', C1: '1' };

/** Nombre completo de la categoría en el idioma actual (la base de datos lo guarda en español) */
export function categoryName(code: string): string {
  const key = `cat.${code}` as Key;
  const s = t(key);
  return s === key ? code : s;
}

/** Nombre corto; en WT, .Pro y .1 la clase: 1.WT A / 2.WT A, 1.WT B / 2.WT B, 1.Pro / 2.Pro, 1.1 / 2.1 (clásica / vuelta) */
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
