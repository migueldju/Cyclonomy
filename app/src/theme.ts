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
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodyBold: 'Barlow_600SemiBold',
  display: 'BarlowCondensed_600SemiBold',
  number: 'BarlowCondensed_700Bold',
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

// Nombre corto de cada categoría, para las filas donde no cabe el nombre completo
export const categoryShort: Record<string, string> = {
  TDF: 'Tour de Francia', GT: 'Gran Vuelta', MON: 'Monumento', WC: 'Mundial', WC_ITT: 'Mundial CRI',
  MWT: 'MWT', SWT: 'SWT', CC: 'Continental', CC_ITT: 'Continental CRI',
  NC: 'Nacional', NC_ITT: 'Nacional CRI', PRO: 'Pro', C1: '1',
};

/** Nombre corto; en WT, .Pro y .1 la clase: 1.MWT / 2.MWT, 1.SWT / 2.SWT, 1.Pro / 2.Pro, 1.1 / 2.1 (clásica / vuelta) */
export function categoryLabel(code: string, isStageRace: boolean, fallback = code): string {
  if (['MWT', 'SWT', 'PRO', 'C1'].includes(code)) return `${isStageRace ? 2 : 1}.${categoryShort[code]}`;
  return categoryShort[code] ?? fallback;
}

// Categorías de mayor a menor importancia (orden de los filtros del calendario)
export const categoryOrder = ['TDF', 'GT', 'MON', 'WC', 'WC_ITT', 'MWT', 'SWT', 'CC', 'CC_ITT', 'NC', 'NC_ITT', 'PRO', 'C1'];
export const categoryRank = (code: string) => {
  const i = categoryOrder.indexOf(code);
  return i < 0 ? categoryOrder.length : i;
};
