import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { MonthGrid } from '../../app/(tabs)/calendar';
import { t } from '../i18n';
import { moneyShort, ordinal, points } from '../lib/format';
import { SAMPLE } from '../lib/landingSample';
import type { CalendarRow } from '../lib/types';
import { categoryName, colors, fonts, space, themed, type } from '../theme';
import { Flag } from './Flag';
import { PositionJersey } from './PositionJersey';
import { RiderAvatar } from './RiderAvatar';
import { ValueChart } from './ValueChart';
import { Txt } from './Txt';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Page = 'market' | 'ranking' | 'rider' | 'worlds' | 'standings' | 'calendar';
type Key = Parameters<typeof t>[0];

// páginas del juego que gira la portada, con datos de muestra reales (ver landingSample)
// `caption`: el rótulo que sale bajo el carrusel mientras la página está al frente
const PAGES: { page: Page; icon: IconName; title: () => string; caption?: Key }[] = [
  { page: 'market', icon: 'pricetags', title: () => t('tabs.market'), caption: 'landing.capMarket' },
  { page: 'ranking', icon: 'bar-chart', title: () => t('ranking.title') },
  { page: 'rider', icon: 'person', title: () => SAMPLE.rider.name, caption: 'landing.capRider' },
  { page: 'worlds', icon: 'list', title: () => t('stage.scores'), caption: 'landing.capWorlds' },
  { page: 'standings', icon: 'podium', title: () => t('tabs.standings'), caption: 'landing.capStandings' },
  { page: 'calendar', icon: 'calendar', title: () => t('tabs.calendar'), caption: 'landing.capCalendar' },
];
const N = PAGES.length;
const HALF = Math.floor(N / 2);
const EVERY = 3200;          // ms entre giro y giro
const CARD_W = 320;
const CARD_H = 560;

// posición relativa de la página i con la `front` delante: de -HALF a HALF
const offsetOf = (i: number, front: number) => {
  let d = (i - front) % N;
  if (d > HALF) d -= N;
  if (d < -HALF) d += N;
  return d;
};

/**
 * Carrusel giratorio con páginas del juego tal como se ven dentro: la del frente, grande, y las de los lados más
 * pequeñas, giradas y apagadas. Gira solo; se para con el ratón encima, y se trae una al frente tocándola o con los puntos.
 */
export function GameCarousel({ size = 1 }: { size?: number }) {
  const [front, setFront] = useState(0);
  const [paused, setPaused] = useState(false);
  const vals = useRef(PAGES.map((_, i) => new Animated.Value(offsetOf(i, 0)))).current;
  const last = useRef(PAGES.map((_, i) => offsetOf(i, 0)));
  const step = 175 * size;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setFront((f) => (f + 1) % N), EVERY);
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    PAGES.forEach((_, i) => {
      const d = offsetOf(i, front);
      // la que da la vuelta por detrás salta sin animación (va invisible)
      if (Math.abs(d - last.current[i]) > 1) vals[i].setValue(d);
      else Animated.timing(vals[i], { toValue: d, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
      last.current[i] = d;
    });
  }, [front, vals]);

  const range = Array.from({ length: 2 * HALF + 1 }, (_, k) => k - HALF);
  const hover = Platform.OS === 'web' ? { onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false) } : {};
  return (
    <View style={[styles.wrap, { height: (CARD_H + 110) * size }]} {...hover}>
      <View style={[styles.stage, { height: (CARD_H + 20) * size }]}>
        {PAGES.map((p, i) => {
          const d = offsetOf(i, front);
          const v = vals[i];
          return (
            <Animated.View key={p.page}
              style={[styles.slot, {
                zIndex: 10 - Math.abs(d),
                opacity: v.interpolate({ inputRange: range, outputRange: range.map((k) => (Math.abs(k) >= 2 ? 0 : 1 - Math.abs(k) * 0.35)) }),
                transform: [
                  { translateX: v.interpolate({ inputRange: range, outputRange: range.map((k) => k * step) }) },
                  { scale: v.interpolate({ inputRange: range, outputRange: range.map((k) => (1 - Math.min(Math.abs(k), 1) * 0.2) * size) }) },
                  { perspective: 1000 },
                  { rotateY: v.interpolate({ inputRange: range, outputRange: range.map((k) => `${-k * 22}deg`) }) },
                ],
              }]}>
              <Card icon={p.icon} title={p.title()}>{renderPage(p.page)}</Card>
              {/* las de los lados se traen al frente tocándolas (encima, para no meter botones dentro de botones) */}
              {d !== 0 ? (
                <Pressable onPress={() => setFront(i)} accessibilityRole="button" accessibilityLabel={p.title()}
                           style={StyleSheet.absoluteFill} />
              ) : null}
            </Animated.View>
          );
        })}
      </View>
      <View style={styles.dots}>
        {PAGES.map((p, i) => (
          <Pressable key={p.page} onPress={() => setFront(i)} accessibilityRole="button" accessibilityLabel={p.title()} hitSlop={6}
                     style={[styles.dot, i === front && styles.dotOn]} />
        ))}
      </View>
      {/* el rótulo de la página del frente */}
      <Txt style={[styles.caption, { fontSize: 30 * Math.max(size, 0.85), lineHeight: 33 * Math.max(size, 0.85) }]} numberOfLines={2} accessibilityLiveRegion="polite">
        {PAGES[front].caption ? t(PAGES[front].caption!) : ' '}
      </Txt>
    </View>
  );
}

/** El marco de una página: la barra de asfalto de la app con el título, y el contenido sobre el fondo gris */
function Card({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.bar}>
        <Ionicons name={icon} size={18} color={colors.jersey} />
        <Txt style={styles.barTitle} numberOfLines={1}>{title}</Txt>
      </View>
      {/* solo para ver: dentro no se pulsa nada */}
      <View style={styles.body} pointerEvents="none">{children}</View>
    </View>
  );
}

const Box = ({ children }: { children: ReactNode }) => <View style={styles.box}>{children}</View>;

function renderPage(page: Page) {
  switch (page) {
    case 'market':
      return (
        <Box>
          {SAMPLE.market.map((r, i) => {
            const trend = TREND[String(r.trend) as '1' | '0' | '-1'];
            return (
              <View key={r.id} style={[styles.row, i < SAMPLE.market.length - 1 && styles.line]}>
                <RiderAvatar name={r.name} team={r.team} size={34} />
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={styles.nameLine}>
                    <Txt style={styles.name} numberOfLines={1}>{r.name}</Txt><Flag code={r.nationality} />
                  </View>
                  <View style={styles.nameLine}>
                    <View style={styles.pts}><Txt style={styles.ptsText}>{points(r.points)}</Txt></View>
                    <Txt variant="small" numberOfLines={1} style={[styles.small, { flexShrink: 1 }]}>{r.team}</Txt>
                  </View>
                </View>
                <View style={styles.nameLine}>
                  <Ionicons name={trend.icon} size={13} color={trend.color} />
                  <Txt variant="number" style={styles.num}>{moneyShort(r.value)}</Txt>
                </View>
              </View>
            );
          })}
        </Box>
      );
    case 'ranking':
      return (
        <Box>
          {SAMPLE.ranking.map((r, i) => (
            <View key={r.id} style={[styles.row, i < SAMPLE.ranking.length - 1 && styles.line]}>
              <Txt variant="number" style={styles.rank}>{i + 1}</Txt>
              <RiderAvatar name={r.name} team={r.team} size={34} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.nameLine}>
                  <Txt style={styles.name} numberOfLines={1}>{r.name}</Txt><Flag code={r.nationality} />
                </View>
                <Txt variant="small" numberOfLines={1}>{r.team}</Txt>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Txt variant="number" style={styles.num}>{points(r.points)}</Txt>
                <Txt variant="small" style={styles.small}>{moneyShort(r.value)}</Txt>
              </View>
            </View>
          ))}
        </Box>
      );
    case 'rider': {
      const r = SAMPLE.rider;
      return (
        <>
          <View style={[styles.box, styles.riderHead]}>
            <RiderAvatar name={r.name} team={r.team} size={46} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.nameLine}>
                <Txt style={[styles.name, { fontSize: type.body }]} numberOfLines={1}>{r.name}</Txt><Flag code={r.nationality} />
              </View>
              <Txt variant="small" numberOfLines={1}>{r.team}</Txt>
            </View>
            <View style={styles.pts}><Txt style={styles.ptsText}>{points(r.points)}</Txt></View>
          </View>
          <View style={[styles.box, { padding: space.s }]}>
            <ValueChart points={r.values as unknown as { day: string; value: number }[]} />
          </View>
        </>
      );
    }
    case 'worlds': {
      // como la pantalla de puntuaciones de una carrera, con los equipos (inventados) de una liga
      const owner = (id: number) => WORLDS_OWNERS[id];
      const teams = Object.entries(WORLDS.reduce<Record<string, { pts: number; country: string }>>((acc, r) => {
        const o = owner(r.id);
        if (o) acc[o.team] = { pts: (acc[o.team]?.pts ?? 0) + r.score, country: o.country };
        return acc;
      }, {})).sort((x, y) => y[1].pts - x[1].pts);
      return (
        <>
          <View style={[styles.box, styles.stageHead]}>
            <View style={styles.nameLine}>
              <Txt style={styles.stageTitle} numberOfLines={1}>{categoryName('WC')}</Txt><Flag code="ca" height={13} />
            </View>
            <Txt variant="small" style={styles.small}>{t('race.oneDay')} · 27/09</Txt>
            <View style={styles.tabs}>
              <View style={[styles.tab, styles.tabOn]}><Txt style={[styles.tabText, { color: colors.paper }]}>{t('stage.scores')}</Txt></View>
              <View style={styles.tab}><Txt style={styles.tabText}>{t('stage.entries')}</Txt></View>
            </View>
          </View>
          <Txt style={styles.section}>{t('stage.leagueTeams')}</Txt>
          <Box>
            {teams.map(([team, v], i) => (
              <View key={team} style={[styles.row, styles.rowTight, i < teams.length - 1 && styles.line]}>
                <Txt variant="number" style={[styles.num, { width: 26 }]}>{ordinal(i + 1)}</Txt>
                <Flag code={v.country} />
                <Txt style={[styles.name, { flex: 1, fontFamily: fonts.bodyMedium }]} numberOfLines={1}>{team}</Txt>
                <Txt variant="number" style={styles.num}>{points(v.pts)}</Txt>
                <Ionicons name="chevron-down" size={14} color={colors.inkSoft} />
              </View>
            ))}
          </Box>
          <Txt style={styles.section}>{t('stage.scores')}</Txt>
          <Box>
            {WORLDS.map((r, i) => {
              const o = owner(r.id);
              return (
                <View key={r.id} style={[styles.row, styles.rowTight, i < WORLDS.length - 1 && styles.line]}>
                  <RiderAvatar name={r.name} team={r.team} size={30} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.nameLine}>
                      <Txt style={styles.name} numberOfLines={1}>{r.name}</Txt><Flag code={r.nationality} />
                    </View>
                    <Txt variant="small" numberOfLines={1} style={styles.small}>
                      {o ? t('stage.enteredBy', { teams: o.team }) : t('stage.noOwner')}
                    </Txt>
                  </View>
                  <Txt variant="number" style={styles.num}>{points(r.score)}</Txt>
                </View>
              );
            })}
          </Box>
        </>
      );
    }
    case 'standings':
      return (
        <Box>
          {STANDINGS.map((s, i) => (
            <View key={s.team} style={[styles.row, i < STANDINGS.length - 1 && styles.line, i === 1 && { backgroundColor: colors.highlight }]}>
              <PositionJersey position={i + 1} size={30} />
              <View style={[styles.crest, { backgroundColor: s.color }]}><Txt style={styles.crestText}>{s.team[0]}</Txt></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.nameLine}><Txt style={styles.name} numberOfLines={1}>{s.team}</Txt><Flag code={s.country} /></View>
                <Txt variant="small" numberOfLines={1}>{moneyShort(s.value)}</Txt>
              </View>
              <Txt variant="number" style={styles.num}>{points(s.points)}</Txt>
            </View>
          ))}
        </Box>
      );
    default:
      return (
        <View style={{ marginHorizontal: -space.l, marginTop: -space.l }}>
          <MonthGrid month="2026-09" width={CARD_W} races={SAMPLE.calendar as unknown as CalendarRow[]}
                     selected="2026-09-27" onSelect={() => undefined} />
        </View>
      );
  }
}

const TREND = themed(() => ({
  '1': { icon: 'arrow-up' as IconName, color: colors.green },
  '0': { icon: 'remove' as IconName, color: colors.inkSoft },
  '-1': { icon: 'arrow-down' as IconName, color: colors.red },
}));

// los cuatro primeros del Mundial (caben en la tarjeta)
const WORLDS = SAMPLE.worlds.slice(0, 4);

// quién tiene a cada ciclista del Mundial en la liga de muestra (equipos inventados; uno sin dueño)
const WORLDS_OWNERS: Record<number, { team: string; country: string } | undefined> = Object.fromEntries(
  WORLDS.map((r, i) => [r.id, [
    { team: 'Los Escaladores', country: 'es' }, { team: 'Abanico CC', country: 'nl' }, { team: 'Pavé & Barro', country: 'be' },
    undefined,
  ][i]]));

// equipos inventados (las ligas de los jugadores son privadas)
const STANDINGS = [
  { team: 'Los Escaladores', country: 'es', points: 4210, value: 58_400_000, color: '#2B66D9' },
  { team: 'Pavé & Barro', country: 'be', points: 3985, value: 61_200_000, color: '#C0613A' },
  { team: 'Abanico CC', country: 'nl', points: 3640, value: 49_800_000, color: '#1F9A57' },
  { team: 'La Grupeta', country: 'it', points: 3310, value: 52_100_000, color: '#7A4BC2' },
  { team: 'Contrarreloj FC', country: 'fr', points: 2975, value: 44_900_000, color: '#16A3B8' },
  { team: 'Fuga Bidea', country: 'es', points: 2730, value: 40_300_000, color: '#E8578A' },
];

const styles = themed(() => StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  stage: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  slot: { position: 'absolute' },
  card: {
    width: CARD_W, height: CARD_H, backgroundColor: colors.road, borderRadius: 26, overflow: 'hidden',
    borderWidth: 4, borderColor: '#0E1315',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 26, shadowOffset: { width: 0, height: 12 }, elevation: 10,
  },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.asphalt,
    paddingHorizontal: space.l, paddingVertical: space.m, borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
  },
  barTitle: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 0.8, color: colors.onDark, flexShrink: 1 },
  body: { flex: 1, padding: space.l, gap: space.m, overflow: 'hidden' },
  box: { backgroundColor: colors.paper, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.m, paddingVertical: 9 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rank: { width: 16, color: colors.inkSoft, fontSize: type.small },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontFamily: fonts.bodyBold, fontSize: type.small, color: colors.ink, flexShrink: 1 },
  num: { fontSize: type.small },
  small: { fontSize: 11 },
  pts: { backgroundColor: colors.road, borderRadius: 5, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 4 },
  ptsText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.ink },
  raceHead: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  crest: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  crestText: { fontFamily: fonts.bodyBold, color: '#FFFFFF', fontSize: type.small },
  dots: { flexDirection: 'row', gap: 8, marginTop: space.m },
  stageHead: { padding: space.m, gap: 2 },
  stageTitle: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 0.6, color: colors.ink, flexShrink: 1 },
  tabs: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: colors.line, borderRadius: 999, padding: 2, marginTop: 6 },
  tab: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tabOn: { backgroundColor: colors.ink },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.ink },
  section: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 0.6, color: colors.ink, marginBottom: -6 },
  rowTight: { paddingVertical: 6 },
  caption: {
    fontFamily: fonts.display, color: colors.jersey, letterSpacing: 0.8, textAlign: 'center', marginTop: space.m,
    minHeight: 40, paddingHorizontal: space.l,
  },
  riderHead: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m },
  tiles: { flexDirection: 'row', gap: space.s },
  tile: { flex: 1, backgroundColor: colors.paper, borderRadius: 12, paddingHorizontal: space.m, paddingVertical: space.s, gap: 2 },
  score: { backgroundColor: colors.greenSoft, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  scoreText: { fontFamily: fonts.number, fontSize: type.small, color: colors.green },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotOn: { width: 22, backgroundColor: colors.jersey },
}));
