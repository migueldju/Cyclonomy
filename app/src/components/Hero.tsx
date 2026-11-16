import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { cardShadow, colors, fonts, space, themed, type } from '../theme';
import { Txt } from './Txt';

/** Tarjeta de cabecera de una pantalla: el resumen (título, cifras, filtros) sobre blanco, como las secciones */
export function HeroCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Cifras del resumen, en baldosas de dos en dos */
export function StatTiles({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.tiles, style]}>{children}</View>;
}

export function StatTile({ label, value, color, icon, wide, onPress, open }: {
  label: string; value: string; color?: string; icon?: ComponentProps<typeof Ionicons>['name'];
  wide?: boolean;                 // ocupa toda la fila: para textos largos
  /** baldosa que despliega algo al tocarla (`open`: si está desplegado) */
  onPress?: () => void; open?: boolean;
}) {
  const body = (
    <>
      <View style={styles.tileValue}>
        <Txt variant="small" numberOfLines={2} style={{ flex: 1 }}>{label}</Txt>
        {onPress ? <Ionicons name={open ? 'eye-off-outline' : 'eye-outline'} size={17} color={colors.ink} /> : null}
      </View>
      <View style={styles.tileValue}>
        {icon ? <Ionicons name={icon} size={17} color={color ?? colors.ink} /> : null}
        <Txt variant="title" numberOfLines={1} style={[{ flexShrink: 1 }, color ? { color } : null]}>{value}</Txt>
      </View>
    </>
  );
  const style = [styles.tile, wide && { flexBasis: '100%' as const }, open && styles.tileOpen];
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}
               accessibilityState={{ expanded: !!open }} style={({ pressed }) => [...style, pressed && { opacity: 0.7 }]}>
      {body}
    </Pressable>
  ) : <View style={style}>{body}</View>;
}

/** Selector de una opción entre pocas: pastilla con la elegida en negro */
export function Pills<T extends string>({ options, value, onChange, style, compact }: {
  options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; style?: ViewStyle;
  compact?: boolean;              // pastillas más estrechas, para cuando son muchas
}) {
  return (
    <View style={[styles.pills, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab"
                     accessibilityState={{ selected: on }} style={[styles.pill, compact && { paddingHorizontal: 10 }, on && styles.pillOn]}>
            <Txt style={[styles.pillText, on && { color: colors.paper }]}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: {
    backgroundColor: colors.paper, marginHorizontal: space.l, marginTop: space.l, padding: space.l, borderRadius: 20,
    ...cardShadow,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  tile: {
    flexGrow: 1, flexBasis: '45%', backgroundColor: colors.road, borderRadius: 14, paddingHorizontal: space.m,
    paddingVertical: 10, gap: 2, justifyContent: 'space-between',
  },
  tileOpen: { backgroundColor: colors.highlight },
  tileValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pills: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: colors.line, borderRadius: 999, padding: 3 },
  pill: { paddingHorizontal: space.l, paddingVertical: 6, borderRadius: 999 },
  pillOn: { backgroundColor: colors.ink },
  pillText: { fontFamily: fonts.bodyMedium, fontSize: type.small, color: colors.ink, letterSpacing: 0.2 },
}));
