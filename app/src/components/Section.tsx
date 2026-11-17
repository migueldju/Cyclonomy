import { ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { useWide } from '../lib/layout';
import { cardShadow, colors, radius, space, themed } from '../theme';
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

/**
 * Sección con una lista de filas. En la web de escritorio, con bastantes filas, las reparte en dos tarjetas una al
 * lado de la otra (se lee primero la izquierda de arriba abajo); en el móvil es una `Section` normal.
 */
export function ListSection<T>({ title, action, style, items, render, empty, min = 4 }: {
  title?: string; action?: ReactNode; style?: ViewStyle; items: T[];
  render: (item: T, last: boolean, index: number) => ReactNode;
  empty?: ReactNode;               // lo que se muestra sin filas
  min?: number;                    // con menos filas no se parte
}) {
  const wide = useWide();
  if (!wide || items.length < min) {
    return (
      <Section title={title} action={action} style={style}>
        {items.length ? items.map((it, i) => render(it, i === items.length - 1, i)) : empty}
      </Section>
    );
  }
  const half = Math.ceil(items.length / 2);
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <View style={styles.head}>
          <Txt variant="title">{title}</Txt>
          {action}
        </View>
      ) : null}
      <View style={styles.split}>
        <View style={[styles.body, styles.half]}>{items.slice(0, half).map((it, i) => render(it, i === half - 1, i))}</View>
        <View style={[styles.body, styles.half]}>
          {items.slice(half).map((it, i) => render(it, half + i === items.length - 1, half + i))}
        </View>
      </View>
    </View>
  );
}

export function Row({ children, onPress, last, highlight }: {
  children: ReactNode; onPress?: () => void; last?: boolean; highlight?: boolean;      // highlight: la fila propia
}) {
  const content = <View style={[styles.row, !last && styles.rowLine, highlight && styles.rowMine]}>{children}</View>;
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

const styles = themed(() => StyleSheet.create({
  section: { marginTop: space.xl },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.l + 4, marginBottom: space.s,
  },
  body: {
    backgroundColor: colors.paper, marginHorizontal: space.l, borderRadius: radius.l, overflow: 'hidden', ...cardShadow,
  },
  split: { flexDirection: 'row', alignItems: 'flex-start' },
  half: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, paddingVertical: space.m, gap: space.m },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowMine: { backgroundColor: colors.highlight },
  empty: { padding: space.l },
  error: { color: colors.red, paddingHorizontal: space.l, paddingVertical: space.s },
}));
