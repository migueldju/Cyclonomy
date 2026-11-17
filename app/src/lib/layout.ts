import { Platform, useWindowDimensions } from 'react-native';

/** Ancho máximo de la columna única (móvil, y web con la ventana estrecha) y de los diálogos */
export const MAX_WIDTH = 720;
/** Desde este ancho la web usa el diseño de escritorio: menú lateral y contenido a varias columnas */
export const WIDE_FROM = 1000;
export const SIDEBAR_WIDTH = 248;

/** Diseño de escritorio: solo en la web y con la ventana ancha */
export function useWide() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_FROM;
}

/** Ancho real de la columna única (el de la ventana, hasta MAX_WIDTH) */
export function useContentWidth() {
  return Math.min(useWindowDimensions().width, MAX_WIDTH);
}
