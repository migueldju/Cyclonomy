import { ReactNode } from 'react';
import { View } from 'react-native';
import { useWide } from '../lib/layout';

/** En la web de escritorio reparte sus `Col` en columnas; en el móvil los deja uno debajo de otro */
export function Columns({ children }: { children: ReactNode }) {
  return useWide() ? <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>{children}</View> : <>{children}</>;
}

/** Una columna de `Columns`; `flex`: su anchura relativa */
export function Col({ children, flex = 1 }: { children: ReactNode; flex?: number }) {
  return useWide() ? <View style={{ flex, minWidth: 0 }}>{children}</View> : <>{children}</>;
}
