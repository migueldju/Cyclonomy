import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t } from '../i18n';
import { colors, fonts } from '../theme';

// Maillot con el puesto en el pecho: amarillo el líder, plata el 2.º, bronce el 3.º y blanco grisáceo el resto
const KITS: Record<number, { fill: string; stroke: string; ink: string }> = {
  1: { fill: '#F5CF1B', stroke: '#C9A50A', ink: '#2A2300' },
  2: { fill: '#A9B0B9', stroke: '#747C87', ink: '#1E2227' },
  3: { fill: '#D08A4C', stroke: '#A3632C', ink: '#2E1A08' },
};
const REST = { fill: '#E9ECEF', stroke: '#A3A9B1', ink: colors.ink };

// El pecho (debajo del cuello y entre las mangas) está centrado en x = 20 y en y ≈ 24 de 40
const CHEST_OFFSET = 4 / 40;

export function PositionJersey({ position, size = 36 }: { position: number | null | undefined; size?: number }) {
  const kit = (position != null && KITS[position]) || REST;
  const label = position == null ? '—' : String(position);
  const fontSize = size * (label.length > 2 ? 0.26 : label.length > 1 ? 0.32 : 0.38);
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={t('bib.position', { value: label })}>
      <Svg width={size} height={size} viewBox="0 0 40 40" style={StyleSheet.absoluteFill}>
        <Path
          d="M14 4 L8 6 L2 13 L7 18 L10 15 L10 37 L30 37 L30 15 L33 18 L38 13 L32 6 L26 4 Q20 9 14 4 Z"
          fill={kit.fill} stroke={kit.stroke} strokeWidth={1.4} strokeLinejoin="round"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center, { paddingTop: size * CHEST_OFFSET * 2 }]}>
        <Text allowFontScaling={false}
              style={{ fontFamily: fonts.number, fontSize, lineHeight: fontSize * 1.1, color: kit.ink,
                       textAlign: 'center', includeFontPadding: false }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
