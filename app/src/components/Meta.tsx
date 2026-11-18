import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { categoryLabel, colors, fonts, isContinental, raceColors, STAR, themed } from '../theme';
import { Txt } from './Txt';

/** Segunda línea de una fila: datos cortos con icono y pastillas, en vez de una frase separada por puntos */
export function MetaLine({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.line, style]}>{children}</View>;
}

// texto oscuro sobre los colores claros (amarillo del Tour, gris de las .1)
const darkText = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150;
};

/** Franjas de color de una carrera: a lo alto (barra lateral de una fila) o a lo ancho (marca en el mes) */
export function ColorBar({ category, name, horizontal, style }: {
  category: string; name?: string | null; horizontal?: boolean; style?: ViewStyle;
}) {
  const list = raceColors(category, name);
  return (
    <View style={[{ flexDirection: horizontal ? 'row' : 'column', overflow: 'hidden' }, style]}>
      {list.map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}
      {/* continentales: la «estrella», un punto amarillo en el centro de la franja azul */}
      {isContinental(category) ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={styles.starDot} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Categoría de la carrera en una pastilla de su color: 1.1, 2.WT A, Monumento… Con dos colores (gran vuelta sin
 * concretar), mitad y mitad; con el arcoíris de los mundiales, pastilla blanca con las franjas debajo del texto.
 */
export function CategoryBadge({ code, stageRace, name }: { code: string; stageRace: boolean; name?: string | null }) {
  const list = raceColors(code, name);
  const rainbow = list.length > 2;
  const dark = rainbow || darkText(list[0]);
  return (
    <View style={[styles.badge, rainbow && styles.badgeRainbow]}>
      {rainbow ? null : (
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          {list.map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}
        </View>
      )}
      <View style={styles.badgeRow}>
        {isContinental(code) ? <Ionicons name="star" size={10} color={STAR} /> : null}
        <Txt style={[styles.badgeText, { color: rainbow ? colors.ink : dark ? colors.onLight : colors.onDark }]}>{categoryLabel(code, stageRace)}</Txt>
      </View>
      {rainbow ? (
        <View style={styles.rainbow}>{list.map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}</View>
      ) : null}
    </View>
  );
}

/** Un dato con su icono; `color` para resaltarlo (verde: a favor, rojo: en curso…) */
export function MetaItem({ icon, text, color, strong }: {
  icon?: ComponentProps<typeof Ionicons>['name']; text: string; color?: string; strong?: boolean;
}) {
  if (!text) return null;
  return (
    <View style={styles.item}>
      {icon ? <Ionicons name={icon} size={13} color={color ?? colors.inkSoft} /> : null}
      <Txt variant="small" numberOfLines={1}
           style={[{ flexShrink: 1 }, color ? { color } : null, strong ? { fontFamily: fonts.bodyBold } : null]}>{text}</Txt>
    </View>
  );
}

/** Estado con un punto de color delante (en curso, terminada…) */
export function MetaDot({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.item}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Txt variant="small" numberOfLines={1} style={{ flexShrink: 1, color }}>{text}</Txt>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 2, marginTop: 3 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  badgeRainbow: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, paddingBottom: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: STAR },
  rainbow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, flexDirection: 'row' },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 16, letterSpacing: 0.2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
}));
