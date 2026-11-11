import { ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { cardShadow, colors, radius, space } from '../theme';
import { Txt } from './Txt';

/** Bloque con su título encima y el contenido en una tarjeta blanca redondeada. */
export function Section({ title, action, children, style }: {
  title?: string; action?: ReactNode; children: ReactNode; style?: ViewStyle;
}) {
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <View style={styles.head}>
          <Txt variant="title">{title}</Txt>
          {action}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

export function Row({ children, onPress, last }: { children: ReactNode; onPress?: () => void; last?: boolean }) {
  const content = <View style={[styles.row, !last && styles.rowLine]}>{children}</View>;
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: colors.road }}>
      {content}
    </Pressable>
  ) : content;
}

export function Empty({ text }: { text: string }) {
  return <Txt variant="small" style={styles.empty}>{text}</Txt>;
}

export function ErrorText({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <Txt style={styles.error} accessibilityRole="alert">{error}</Txt>;
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.l + 4, marginBottom: space.s,
  },
  body: {
    backgroundColor: colors.paper, marginHorizontal: space.l, borderRadius: radius.l, overflow: 'hidden', ...cardShadow,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, paddingVertical: space.m, gap: space.m },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  empty: { padding: space.l },
  error: { color: colors.red, paddingHorizontal: space.l, paddingVertical: space.s },
});
