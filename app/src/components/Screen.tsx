import { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { colors, space } from '../theme';

/** Contenedor con scroll y "tirar para actualizar" */
export function Screen({ children, onRefresh, refreshing = false, padded }: {
  children: ReactNode; onRefresh?: () => void; refreshing?: boolean; padded?: boolean;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[{ paddingBottom: space.xxl * 2 }, padded && { padding: space.l }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
      {children}
    </ScrollView>
  );
}

export function Field({ children }: { children: ReactNode }) {
  return <View style={{ marginBottom: space.l }}>{children}</View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.road } });
