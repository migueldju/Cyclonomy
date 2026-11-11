import { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { colors, space } from '../theme';

/** Contenedor con scroll y "tirar para actualizar". Abajo, un poco de aire bajo la última tarjeta: la barra
 *  de pestañas no tapa la última tarjeta */
export function Screen({ children, onRefresh, refreshing = false, padded }: {
  children: ReactNode; onRefresh?: () => void; refreshing?: boolean; padded?: boolean;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[{ flexGrow: 1 }, padded && { padding: space.l }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
      {children}
      {padded ? null : <BottomFill />}
    </ScrollView>
  );
}

/** Aire hasta la barra de pestañas cuando el contenido no llena la pantalla (en listas: ListFooterComponent,
 *  con contentContainerStyle={{ flexGrow: 1 }}) */
export function BottomFill() {
  return <View style={styles.fill} />;
}

export function Field({ children }: { children: ReactNode }) {
  return <View style={{ marginBottom: space.l }}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.road },
  fill: { flexGrow: 1, minHeight: space.xl },           // aire bajo la última tarjeta
});
