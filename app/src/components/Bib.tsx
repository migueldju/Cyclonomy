import { StyleSheet, View } from 'react-native';
import { colors, fonts } from '../theme';
import { t } from '../i18n';
import { Txt } from './Txt';

/** Dorsal de carrera: el puesto en la clasificación, prendido con cuatro imperdibles. */
export function Bib({ value, size = 'm', dark = false }: { value: string; size?: 's' | 'm' | 'l'; dark?: boolean }) {
  const dims = { s: { w: 40, h: 30, f: 18 }, m: { w: 56, h: 40, f: 26 }, l: { w: 104, h: 74, f: 52 } }[size];
  return (
    <View style={[styles.bib, { width: dims.w, height: dims.h }, dark && styles.dark]}
          accessibilityLabel={t('bib.position', { value })}>
      {(['tl', 'tr', 'bl', 'br'] as const).map((p) => (
        <View key={p} style={[styles.pin, pins[p], size === 'l' && styles.pinL]} />
      ))}
      <Txt style={{ fontFamily: fonts.number, fontSize: dims.f, lineHeight: dims.f + 2, color: colors.ink }}>
        {value}
      </Txt>
    </View>
  );
}

const pins = {
  tl: { top: 3, left: 3 }, tr: { top: 3, right: 3 }, bl: { bottom: 3, left: 3 }, br: { bottom: 3, right: 3 },
};

const styles = StyleSheet.create({
  bib: {
    backgroundColor: colors.paper,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dark: { borderColor: colors.asphaltSoft },
  pin: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: '#B9C1BD' },
  pinL: { width: 6, height: 6, borderRadius: 3 },
});
