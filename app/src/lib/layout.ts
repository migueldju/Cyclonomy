import { useWindowDimensions } from 'react-native';

/** Ancho máximo del contenido: en la web, con la ventana grande, la app va en una columna centrada */
export const MAX_WIDTH = 720;

/** Ancho real de la columna de contenido (el de la ventana, hasta MAX_WIDTH) */
export function useContentWidth() {
  return Math.min(useWindowDimensions().width, MAX_WIDTH);
}
