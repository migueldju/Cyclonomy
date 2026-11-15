import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { categoryColor, categoryLabel, colors, fonts } from '../theme';
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

/** Categoría de la carrera en una pastilla de su color: 1.1, 2.WT A, Monumento… */
export function CategoryBadge({ code, stageRace }: { code: string; stageRace: boolean }) {
  const bg = categoryColor[code] ?? colors.inkSoft;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Txt style={[styles.badgeText, { color: darkText(bg) ? colors.ink : colors.paper }]}>{categoryLabel(code, stageRace)}</Txt>
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

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 2, marginTop: 3 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 16, letterSpacing: 0.2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
