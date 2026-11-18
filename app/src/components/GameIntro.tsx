import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { t } from '../i18n';
import { cardShadow, categoryColor, colors, fonts, space, themed, type } from '../theme';
import { Txt } from './Txt';

type IconName = ComponentProps<typeof Ionicons>['name'];

const STEPS = [
  { title: 'landing.s1T', text: 'landing.s1' },
  { title: 'landing.s2T', text: 'landing.s2' },
  { title: 'landing.s3T', text: 'landing.s3' },
] as const;

// cada ventaja con un color de carrera: así la página tiene los mismos colores que el calendario
const FEATURES: { icon: IconName; title: Parameters<typeof t>[0]; text: Parameters<typeof t>[0]; tint: string }[] = [
  { icon: 'calendar-outline', title: 'landing.f1T', text: 'landing.f1', tint: 'MWT' },
  { icon: 'trending-up-outline', title: 'landing.f2T', text: 'landing.f2', tint: 'PRO' },
  { icon: 'flash-outline', title: 'landing.f3T', text: 'landing.f3', tint: 'MON' },
  { icon: 'trophy-outline', title: 'landing.f4T', text: 'landing.f4', tint: 'NC' },
];

/** Los tres pasos del juego, numerados; `columns`: cuántos por fila (1 en el móvil, 3 en pantallas anchas) */
export function HowItWorks({ columns = 1 }: { columns?: number }) {
  return (
    <View style={styles.grid}>
      {STEPS.map((s, i) => (
        <View key={s.title} style={[styles.card, { flexBasis: columns > 1 ? `${100 / columns - 3}%` : '100%' }]}>
          <View style={styles.stepNum}><Txt style={styles.stepNumText}>{i + 1}</Txt></View>
          <Txt variant="lead" style={styles.cardTitle}>{t(s.title)}</Txt>
          <Txt style={styles.cardText}>{t(s.text)}</Txt>
        </View>
      ))}
    </View>
  );
}

/** Lo que ofrece el juego, en tarjetas con icono; `columns`: cuántas por fila */
export function Features({ columns = 1 }: { columns?: number }) {
  return (
    <View style={styles.grid}>
      {FEATURES.map((f) => {
        const tint = categoryColor[f.tint];
        return (
          <View key={f.title} style={[styles.card, { flexBasis: columns > 1 ? `${100 / columns - 3}%` : '100%' }]}>
            <View style={[styles.icon, { backgroundColor: tint + '22' }]}>
              <Ionicons name={f.icon} size={22} color={tint} />
            </View>
            <Txt variant="lead" style={styles.cardTitle}>{t(f.title)}</Txt>
            <Txt style={styles.cardText}>{t(f.text)}</Txt>
          </View>
        );
      })}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.l },
  card: {
    flexGrow: 1, backgroundColor: colors.paper, borderRadius: 20, padding: space.xl, gap: space.s, ...cardShadow,
  },
  stepNum: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.jersey, alignItems: 'center', justifyContent: 'center',
    marginBottom: space.xs,
  },
  stepNumText: { fontFamily: fonts.number, fontSize: 20, color: colors.jerseyInk },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  cardTitle: { fontFamily: fonts.bodyBold },
  cardText: { color: colors.inkSoft, fontSize: type.body, lineHeight: 22 },
}));
