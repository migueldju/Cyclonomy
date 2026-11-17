import { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useWide } from '../lib/layout';
import { colors, space, themed } from '../theme';

/** Contenedor con scroll y "tirar para actualizar". Abajo, un poco de aire bajo la última tarjeta: la barra
 *  de pestañas no tapa la última tarjeta */
export function Screen({ children, onRefresh, refreshing = false, padded, size = 'full' }: {
  children: ReactNode; onRefresh?: () => void; refreshing?: boolean; padded?: boolean;
  /** ancho del contenido en la web de escritorio: todo (pantallas a columnas), medio (listas) o estrecho (formularios) */
  size?: keyof typeof WIDTHS;
}) {
  const wide = useWide();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[{ flexGrow: 1 }, padded && { padding: space.l },
                              wide && { width: '100%', maxWidth: WIDTHS[size], alignSelf: 'center', paddingHorizontal: padded ? space.xl : space.s }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
      {children}
      {padded ? null : <BottomFill />}
    </ScrollView>
  );
}

/** Anchos del contenido en la web de escritorio */
export const WIDTHS = { full: 1400, medium: 960, narrow: 720 };

/** Aire hasta la barra de pestañas cuando el contenido no llena la pantalla (en listas: ListFooterComponent,
 *  con contentContainerStyle={{ flexGrow: 1 }}) */
export function BottomFill() {
  return <View style={styles.fill} />;
}

export function Field({ children }: { children: ReactNode }) {
  return <View style={{ marginBottom: space.l }}>{children}</View>;
}

const styles = themed(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.road },
  fill: { flexGrow: 1, minHeight: space.xl },           // aire bajo la última tarjeta
}));
