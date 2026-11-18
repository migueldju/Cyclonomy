import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { t } from '../i18n';
import { categoryColor, colors, fonts, space, themed, UCI_RAINBOW } from '../theme';
import { PositionJersey } from './PositionJersey';
import { Txt } from './Txt';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Kind = 'home' | 'market' | 'squad' | 'standings' | 'calendar' | 'clauses' | 'leagues';

// los menús y funciones del juego, cada uno con un color de carrera
const CARDS: { kind: Kind; icon: IconName; title: Parameters<typeof t>[0]; tint: string }[] = [
  { kind: 'home', icon: 'home', title: 'tabs.home', tint: 'TDF' },
  { kind: 'market', icon: 'pricetags', title: 'tabs.market', tint: 'PRO' },
  { kind: 'squad', icon: 'people', title: 'tabs.squad', tint: 'MWT' },
  { kind: 'standings', icon: 'podium', title: 'tabs.standings', tint: 'GT' },
  { kind: 'calendar', icon: 'calendar', title: 'tabs.calendar', tint: 'SWT' },
  { kind: 'clauses', icon: 'flash', title: 'landing.f3T', tint: 'MON' },
  { kind: 'leagues', icon: 'trophy', title: 'landing.f4T', tint: 'NC' },
];
const N = CARDS.length;
const HALF = Math.floor(N / 2);
const EVERY = 2800;          // ms entre giro y giro

// posición relativa de la tarjeta i con la i-ésima al frente: de -HALF a HALF
const offsetOf = (i: number, front: number) => {
  let d = (i - front) % N;
  if (d > HALF) d -= N;
  if (d < -HALF) d += N;
  return d;
};

/**
 * Carrusel giratorio con los menús del juego: la tarjeta del frente, grande, y las de los lados más pequeñas y
 * apagadas. Gira solo; al pasar el ratón se para, y se puede tocar una tarjeta o un punto para traerla al frente.
 */
export function GameCarousel({ size = 1 }: { size?: number }) {
  const [front, setFront] = useState(0);
  const [paused, setPaused] = useState(false);
  const vals = useRef(CARDS.map((_, i) => new Animated.Value(offsetOf(i, 0)))).current;
  const last = useRef(CARDS.map((_, i) => offsetOf(i, 0)));
  const step = 150 * size;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setFront((f) => (f + 1) % N), EVERY);
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    CARDS.forEach((_, i) => {
      const d = offsetOf(i, front);
      // la que da la vuelta por detrás salta sin animación (va invisible)
      if (Math.abs(d - last.current[i]) > 1) vals[i].setValue(d);
      else Animated.timing(vals[i], { toValue: d, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
      last.current[i] = d;
    });
  }, [front, vals]);

  const range = Array.from({ length: N }, (_, k) => k - HALF);
  return (
    <View style={[styles.wrap, { height: 380 * size }]}
          // @ts-expect-error: solo en la web (el ratón encima para el giro)
          onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <View style={[styles.stage, { height: 330 * size }]}>
        {CARDS.map((c, i) => {
          const d = offsetOf(i, front);
          const v = vals[i];
          return (
            <Animated.View key={c.kind}
              style={[styles.slot, {
                zIndex: 10 - Math.abs(d),
                opacity: v.interpolate({ inputRange: range, outputRange: range.map((k) => (Math.abs(k) >= HALF ? 0 : 1 - Math.abs(k) * 0.3)) }),
                transform: [
                  { translateX: v.interpolate({ inputRange: range, outputRange: range.map((k) => k * step - Math.sign(k) * Math.max(0, Math.abs(k) - 1) * step * 0.35) }) },
                  { scale: v.interpolate({ inputRange: range, outputRange: range.map((k) => 1 - Math.min(Math.abs(k), 2) * 0.16) }) },
                  { perspective: 900 },
                  { rotateY: v.interpolate({ inputRange: range, outputRange: range.map((k) => `${-k * 18}deg`) }) },
                ],
              }]}>
              <Pressable onPress={() => setFront(i)} disabled={d === 0} accessibilityRole="button"
                         accessibilityLabel={t(c.title)} style={{ transform: [{ scale: size }] }}>
                <Card c={c} />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
      <View style={styles.dots}>
        {CARDS.map((c, i) => (
          <Pressable key={c.kind} onPress={() => setFront(i)} accessibilityRole="button" accessibilityLabel={t(c.title)} hitSlop={6}
                     style={[styles.dot, i === front && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

/** Una tarjeta: cabecera del color del menú con su icono y su nombre, y debajo un dibujo de la pantalla */
function Card({ c }: { c: (typeof CARDS)[number] }) {
  const tint = categoryColor[c.tint];
  return (
    <View style={styles.card}>
      <View style={[styles.head, { backgroundColor: tint }]}>
        <View style={styles.headIcon}><Ionicons name={c.icon} size={20} color={tint} /></View>
        <Txt style={[styles.headTitle, { color: c.tint === 'TDF' ? colors.onLight : colors.onDark }]} numberOfLines={1}>{t(c.title)}</Txt>
      </View>
      <View style={styles.body}><Sketch kind={c.kind} tint={tint} /></View>
    </View>
  );
}

// barra gris de «texto»
const Bar = ({ w, h = 8, c }: { w: number | `${number}%`; h?: number; c?: string }) =>
  <View style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: c ?? colors.line }} />;
const Dot = ({ s = 26, c }: { s?: number; c?: string }) =>
  <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: c ?? colors.line }} />;

/** Dibujo esquemático de cada pantalla (sin datos de verdad) */
function Sketch({ kind, tint }: { kind: Kind; tint: string }) {
  const row = (k: number, right: React.ReactNode) => (
    <View key={k} style={styles.row}>
      <Dot />
      <View style={{ flex: 1, gap: 5 }}><Bar w="80%" /><Bar w="50%" h={6} /></View>
      {right}
    </View>
  );
  switch (kind) {
    case 'market':
      return <>{[0, 1, 2, 3].map((k) => row(k, (
        <View style={styles.price}>
          <Ionicons name={k % 3 === 2 ? 'arrow-down' : 'arrow-up'} size={11} color={k % 3 === 2 ? colors.red : colors.green} />
          <Bar w={34} h={7} c={colors.ink} />
        </View>
      )))}</>;
    case 'squad':
      return (
        <View style={styles.grid}>
          {Array.from({ length: 9 }, (_, k) => (
            <View key={k} style={styles.gridCell}><Dot s={30} c={k % 4 === 0 ? tint + '55' : undefined} /><Bar w={36} h={6} /></View>
          ))}
        </View>
      );
    case 'standings':
      return <>{[1, 2, 3, 4].map((p) => (
        <View key={p} style={styles.row}>
          <PositionJersey position={p} size={28} />
          <View style={{ flex: 1, gap: 5 }}><Bar w="70%" /><Bar w="40%" h={6} /></View>
          <Bar w={30} h={9} c={colors.ink} />
        </View>
      ))}</>;
    case 'calendar':
      return (
        <View style={styles.grid}>
          {Array.from({ length: 28 }, (_, k) => (
            <View key={k} style={styles.calCell}>
              <View style={[styles.calNum, k === 17 && { backgroundColor: colors.jersey }]} />
              {k % 3 === 0 ? <View style={[styles.calDot, { backgroundColor: Object.values(categoryColor)[k % 9] }]} /> : null}
            </View>
          ))}
          <View style={[styles.calLine, { top: 34, left: '28%', width: '58%', backgroundColor: categoryColor.MWT }]} />
          <View style={[styles.calLine, { top: 104, left: '0%', width: '44%', backgroundColor: categoryColor.SWT }]} />
        </View>
      );
    case 'clauses':
      return (
        <View style={styles.center}>
          <View style={[styles.bigIcon, { backgroundColor: tint + '22' }]}><Ionicons name="flash" size={42} color={tint} /></View>
          <Bar w="70%" h={10} c={colors.ink} />
          <View style={styles.clauseRow}><Ionicons name="lock-closed" size={14} color={colors.blue} /><Bar w={90} /></View>
        </View>
      );
    case 'leagues':
      return (
        <View style={styles.center}>
          <View style={styles.podium}>
            <View style={[styles.step, { height: 46 }]}><PositionJersey position={2} size={34} /></View>
            <View style={[styles.step, { height: 66 }]}><PositionJersey position={1} size={40} /></View>
            <View style={[styles.step, { height: 34 }]}><PositionJersey position={3} size={30} /></View>
          </View>
          <View style={styles.rainbow}>{UCI_RAINBOW.map((c) => <View key={c} style={{ flex: 1, backgroundColor: c }} />)}</View>
        </View>
      );
    default:   // inicio
      return (
        <>
          <View style={[styles.hero, { backgroundColor: colors.road }]}>
            <PositionJersey position={1} size={34} />
            <View style={{ flex: 1, gap: 5 }}><Bar w="40%" h={6} /><Bar w="60%" h={12} c={colors.ink} /></View>
          </View>
          {[0, 1, 2].map((k) => (
            <View key={k} style={styles.row}>
              <View style={[styles.swatch, { backgroundColor: [categoryColor.MWT, categoryColor.PRO, categoryColor.C1][k] }]} />
              <View style={{ flex: 1, gap: 5 }}><Bar w="75%" /><Bar w="45%" h={6} /></View>
            </View>
          ))}
        </>
      );
  }
}

const CARD_W = 230;
const styles = themed(() => StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  stage: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  slot: { position: 'absolute' },
  card: {
    width: CARD_W, height: 300, backgroundColor: colors.paper, borderRadius: 22, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.l, paddingVertical: space.m },
  headIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 0.6, flexShrink: 1 },
  body: { flex: 1, padding: space.m, gap: space.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingVertical: 4 },
  price: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.s },
  gridCell: { width: '33.3%', alignItems: 'center', gap: 5, paddingVertical: 2 },
  calCell: { width: `${100 / 7}%`, height: 34, alignItems: 'center', gap: 4, paddingTop: 2 },
  calNum: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.line },
  calDot: { width: 5, height: 5, borderRadius: 3 },
  calLine: { position: 'absolute', height: 4, borderRadius: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.m },
  bigIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  clauseRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  step: { width: 56, backgroundColor: colors.road, borderTopLeftRadius: 8, borderTopRightRadius: 8, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 0, marginTop: 40 },
  rainbow: { flexDirection: 'row', width: 180, height: 5, borderRadius: 3, overflow: 'hidden' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.s, borderRadius: 14, padding: space.s, marginBottom: 2 },
  swatch: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  dots: { flexDirection: 'row', gap: 8, marginTop: space.m },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotOn: { width: 22, backgroundColor: colors.jersey },
}));
