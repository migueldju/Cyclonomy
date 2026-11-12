import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t } from '../i18n';
import { fonts } from '../theme';

// Maillot con el puesto en el pecho: amarillo el líder, plata el 2.º, bronce el 3.º y blanco el resto.
// fill: el cuerpo · trim: cuello, puños y bajo · edge: el contorno · ink: el número
const KITS: Record<number, { fill: string; trim: string; edge: string; ink: string }> = {
  1: { fill: '#F4C63F', trim: '#1E272C', edge: '#C9A12A', ink: '#1E272C' },
  2: { fill: '#C9CFD6', trim: '#6F7985', edge: '#8E97A2', ink: '#1E2227' },
  3: { fill: '#D9975A', trim: '#8A5425', edge: '#A96C36', ink: '#2E1A08' },
};
const REST = { fill: '#FFFFFF', trim: '#AEB7BD', edge: '#AEB7BD', ink: '#1E272C' };

// Cuerpo: hombros curvos, mangas cortas abiertas y bajo redondeado; el cuello, un arco
const BODY = 'M14.5 4.5 C16.5 8 23.5 8 25.5 4.5 L30.6 6.3 Q33 7.2 34.3 9.4 L38 15.6 L32.6 19.2 L30 16 L30 34 '
  + 'Q30 36.5 27.5 36.5 L12.5 36.5 Q10 36.5 10 34 L10 16 L7.4 19.2 L2 15.6 L5.7 9.4 Q7 7.2 9.4 6.3 Z';
const COLLAR = 'M14.5 4.5 C16.5 8 23.5 8 25.5 4.5';
const CUFF_L = 'M2 15.6 L7.4 19.2 L8.7 17.6 L3.1 13.8 Z';
const CUFF_R = 'M38 15.6 L32.6 19.2 L31.3 17.6 L36.9 13.8 Z';
const HEM = 'M10 32.8 L30 32.8 L30 34 Q30 36.5 27.5 36.5 L12.5 36.5 Q10 36.5 10 34 Z';
// costuras de las mangas y un brillo suave en el costado izquierdo
const SEAMS = 'M10 16 L12.6 8.6 M30 16 L27.4 8.6';
const SHINE = 'M11.2 17 L11.2 32 L13.6 32 L13.6 13.5 Z';

// El pecho (debajo del cuello y entre las mangas) está centrado en x = 20 y en y ≈ 22 de 40
const CHEST_OFFSET = 2.5 / 40;

export function PositionJersey({ position, size = 36 }: { position: number | null | undefined; size?: number }) {
  const kit = (position != null && KITS[position]) || REST;
  const label = position == null ? '—' : String(position);
  const fontSize = size * (label.length > 2 ? 0.26 : label.length > 1 ? 0.32 : 0.38);
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={t('bib.position', { value: label })}>
      <Svg width={size} height={size} viewBox="0 0 40 40" style={StyleSheet.absoluteFill}>
        <Path d={BODY} fill={kit.fill} stroke={kit.edge} strokeWidth={1.2} strokeLinejoin="round" />
        <Path d={SHINE} fill="#FFFFFF" opacity={0.28} />
        <Path d={SEAMS} stroke={kit.edge} strokeWidth={0.8} strokeLinecap="round" opacity={0.7} fill="none" />
        <Path d={HEM} fill={kit.trim} />
        <Path d={CUFF_L} fill={kit.trim} />
        <Path d={CUFF_R} fill={kit.trim} />
        <Path d={COLLAR} stroke={kit.trim} strokeWidth={2.2} strokeLinecap="round" fill="none" />
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
