import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Flag } from '@/components/Flag';
import { BottomFill } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { getLang, t } from '@/i18n';
import { api } from '@/lib/api';
import { useContentWidth, useWide } from '@/lib/layout';
import { course, dateTime, dayMonth, ordinal, parseDay, points, todayISO } from '@/lib/format';
import { CategoryBadge, ColorBar, MetaItem, MetaLine } from '@/components/Meta';
import { stageLabel } from '@/lib/stages';
import type { CalendarRow, RaceDetail } from '@/lib/types';
import { cardShadow, categoryColor, categoryName, categoryRank, colors, fonts, space, themed, type } from '@/theme';

export default function Calendario() {
  const { leagueId } = useLeague();
  const id = leagueId ?? '';
  const { data, error, loading, reload } = useLoader(() => api.calendar(id), [id], !!leagueId);
  const [open, setOpen] = useState<number | null>(null);
  const [day, setDay] = useState(todayISO());
  const wide = useWide();
  const contentWidth = useContentWidth();
  const width = wide ? 460 : contentWidth;
  const pager = useRef<FlatList<string>>(null);

  const rows = data ?? [];

  // meses entre la primera y la última carrera (y siempre el actual)
  const months = useMemo(() => {
    const all = [todayISO(), ...(data ?? []).flatMap((r) => [r.start_date, r.end_date])].map((d) => d.slice(0, 7)).sort();
    const out: string[] = [];
    let [y, m] = all[0].split('-').map(Number);
    const last = all[all.length - 1];
    while (`${y}-${String(m).padStart(2, '0')}` <= last) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return out;
  }, [data]);
  const startIndex = Math.max(0, months.indexOf(todayISO().slice(0, 7)));

  const dayRaces = rows.filter((r) => r.start_date <= day && day <= r.end_date)
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category));

  // un mes por página: se desliza a izquierda y derecha
  const monthPager = (
      <FlatList
        ref={pager}
        key={months.length}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        data={months}
        keyExtractor={(m) => m}
        initialScrollIndex={startIndex}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index }) => (
          <MonthGrid month={item} width={width} races={rows} selected={day} onSelect={setDay}
                     onPrev={index > 0 ? () => pager.current?.scrollToIndex({ index: index - 1 }) : undefined}
                     onNext={index < months.length - 1 ? () => pager.current?.scrollToIndex({ index: index + 1 }) : undefined} />
        )}
      />
  );
  const header = (
    <>
      {wide ? null : monthPager}
      <Txt variant="title" style={styles.dayTitle}>{dayTitle(day)}</Txt>
      <ErrorText error={error} />
    </>
  );

  const list = (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.road }}
      data={dayRaces}
      keyExtractor={(r) => String(r.race_id)}
      ListHeaderComponent={header}
      ListFooterComponent={<BottomFill />}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
      ListEmptyComponent={<Txt variant="small" style={{ paddingHorizontal: space.l + 4 }}>
        {loading ? t('common.loading') : t('calendar.noRacesDay')}
      </Txt>}
      renderItem={({ item }) => (
        <RaceItem r={item} day={day} open={open === item.race_id} leagueId={id}
                  onToggle={() => setOpen(open === item.race_id ? null : item.race_id)} />
      )}
    />
  );
  return wide ? (
    <View style={styles.wide}>
      <View style={{ width }}>{monthPager}</View>
      {list}
    </View>
  ) : list;
}

/** Título de un mes en el idioma de la app ("octubre de 2026"); sin Intl, el mes abreviado */
function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number);
  try {
    return capitalize(new Intl.DateTimeFormat(getLang(), { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 15)));
  } catch {
    return `${t('fmt.months').split(',')[m - 1]} ${y}`;
  }
}

function dayTitle(day: string): string {
  const d = parseDay(day);
  return capitalize(`${t('fmt.weekdays').split(',')[d.getDay()]} ${dayMonth(day)}`);
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const LANES = 3;          // vueltas por etapas que caben a la vez, una línea cada una
const MAX_DOTS = 5;       // carreras de un día que caben como puntos
const ROW_H = 66;         // alto de una semana
const LANE_TOP = 45;      // donde empiezan las líneas de las vueltas

/**
 * Cuadrícula de un mes (semanas de lunes a domingo). Las vueltas por etapas son una línea continua de su color que
 * cruza los días que duran; las carreras de un día, un punto bajo el número. Todo va a alturas fijas: el número, los
 * puntos y las tres líneas quedan alineados en todos los días.
 */
function MonthGrid({ month, width, races, selected, onSelect, onPrev, onNext }: {
  month: string; width: number; races: CalendarRow[]; selected: string; onSelect: (d: string) => void;
  onPrev?: () => void; onNext?: () => void;
}) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;            // huecos antes del día 1 (la semana empieza en lunes)
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const wd = t('fmt.weekdays').split(',');
  const weekdays = [...wd.slice(1), wd[0]];
  const today = todayISO();
  const cell = (width - space.l * 2 - space.s * 2) / 7;

  // cada vuelta, en su línea: las más importantes primero, y cada una en la primera línea que tenga libre esos días
  const { tours, lane, singles } = useMemo(() => {
    const first = iso(y, m, 1), last = iso(y, m, days);
    const here = races.filter((r) => r.start_date <= last && r.end_date >= first);
    const multi = here.filter((r) => r.start_date !== r.end_date)
      .sort((p, q) => categoryRank(p.category) - categoryRank(q.category) || p.start_date.localeCompare(q.start_date));
    const taken: CalendarRow[][] = [];
    const where = new Map<number, number>();
    for (const r of multi) {
      let l = taken.findIndex((rs) => rs.every((o) => o.end_date < r.start_date || o.start_date > r.end_date));
      if (l < 0) { l = taken.length; taken.push([]); }
      taken[l].push(r);
      where.set(r.race_id, l);
    }
    return { tours: multi, lane: where, singles: here.filter((r) => r.start_date === r.end_date) };
  }, [races, y, m, days]);

  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  return (
    <View style={{ width, paddingHorizontal: space.l, paddingTop: space.l, paddingBottom: space.m }}>
      <View style={styles.month}>
      <View style={styles.monthHead}>
        <Pressable onPress={onPrev} disabled={!onPrev} hitSlop={10} accessibilityRole="button"
                   style={[styles.monthBtn, !onPrev && { opacity: 0.3 }]}>
          <Ionicons name="chevron-back" size={18} color={colors.ink} />
        </Pressable>
        <Txt variant="title">{monthTitle(month)}</Txt>
        <Pressable onPress={onNext} disabled={!onNext} hitSlop={10} accessibilityRole="button"
                   style={[styles.monthBtn, !onNext && { opacity: 0.3 }]}>
          <Ionicons name="chevron-forward" size={18} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {weekdays.map((w) => <Txt key={w} variant="label" style={[styles.weekday, { width: cell }]}>{w}</Txt>)}
      </View>
      {weeks.map((week, w) => {
        const from = week.find((d) => d != null)!, to = [...week].reverse().find((d) => d != null)!;
        const weekFrom = iso(y, m, from), weekTo = iso(y, m, to);
        return (
          <View key={w} style={{ height: ROW_H }}>
            <View style={styles.week}>
              {week.map((d, i) => {
                if (d == null) return <View key={`x${i}`} style={{ width: cell }} />;
                const date = iso(y, m, d);
                // puntos: las carreras de un día y las vueltas que no han cabido en las líneas
                const dots = [
                  ...singles.filter((r) => r.start_date === date),
                  ...tours.filter((r) => (lane.get(r.race_id) ?? 0) >= LANES && r.start_date <= date && date <= r.end_date),
                ].sort((p, q) => categoryRank(p.category) - categoryRank(q.category));
                const on = date === selected;
                return (
                  <Pressable key={date} onPress={() => onSelect(date)} accessibilityRole="button"
                             accessibilityState={{ selected: on }} style={[styles.day, { width: cell }, on && styles.dayOn]}>
                    <View style={[styles.num, date === today && styles.numToday, on && styles.numOn]}>
                      <Txt style={[styles.dayNum, (on || date === today) && styles.dayNumOn, on && { color: colors.jerseyInk }]}>{d}</Txt>
                    </View>
                    <View style={styles.dots}>
                      {dots.slice(0, dots.length > MAX_DOTS ? MAX_DOTS - 1 : MAX_DOTS).map((r) => (
                        <ColorBar key={r.race_id} category={r.category} name={r.name} horizontal style={styles.dot} />
                      ))}
                      {dots.length > MAX_DOTS ? <View style={[styles.dot, styles.dotMore]} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {/* las vueltas: un tramo por semana, redondeado solo donde la carrera empieza o acaba de verdad */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {tours.map((r) => {
                const l = lane.get(r.race_id) ?? 0;
                if (l >= LANES || r.start_date > weekTo || r.end_date < weekFrom) return null;
                const starts = r.start_date >= weekFrom, ends = r.end_date <= weekTo;
                const a = week.indexOf(starts ? Number(r.start_date.slice(8)) : from);
                const z = week.indexOf(ends ? Number(r.end_date.slice(8)) : to);
                return (
                  <ColorBar key={r.race_id} category={r.category} name={r.name} horizontal
                            style={{
                              position: 'absolute', top: LANE_TOP + l * 6, height: 4,
                              left: a * cell + (starts ? 5 : 0), width: (z - a + 1) * cell - (starts ? 5 : 0) - (ends ? 5 : 0),
                              borderTopLeftRadius: starts ? 2 : 0, borderBottomLeftRadius: starts ? 2 : 0,
                              borderTopRightRadius: ends ? 2 : 0, borderBottomRightRadius: ends ? 2 : 0,
                            }} />
                );
              })}
            </View>
          </View>
        );
      })}
      </View>
    </View>
  );
}

const status = (s: 'upcoming' | 'live' | 'finished') => t(`calendar.status.${s}`);

function RaceItem({ r, day, open, onToggle, leagueId }: {
  r: CalendarRow; day: string; open: boolean; onToggle: () => void; leagueId: string;
}) {
  const stage = r.stages.find((x) => x.date === day);
  const last = Math.max(0, ...r.stages.map((x) => x.number));
  return (
    <View style={styles.item}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.itemHead}>
        <ColorBar category={r.category} name={r.name} style={styles.swatch} />
        {/* bandera en una columna fija, a la altura del nombre: todas alineadas */}
        <View style={styles.flagCol}><Flag code={r.country} /></View>
        <View style={{ flex: 1 }}>
          <Txt variant="lead" numberOfLines={1}>{r.name}</Txt>
          <MetaLine>
            <CategoryBadge code={r.category} stageRace={r.is_stage_race} name={r.name} />
            <MetaItem icon="flag-outline" text={stageLabel(r.is_stage_race, stage?.number, last)} />
            {/* solo se marca la que ya ha terminado */}
            {r.status === 'finished' ? <MetaItem icon="checkmark-circle-outline" text={status(r.status)} /> : null}
          </MetaLine>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkSoft}
                  accessibilityLabel={open ? t('common.close') : t('common.see')} />
      </Pressable>
      {open ? <RaceDetailView r={r} leagueId={leagueId} /> : null}
    </View>
  );
}

function RaceDetailView({ r, leagueId }: { r: CalendarRow; leagueId: string }) {
  const [d, setD] = useState<RaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.raceDetail(leagueId, r.race_id).then(setD).catch((e: Error) => setError(e.message));
  }, [leagueId, r.race_id]);

  return (
    <View style={styles.detail}>
      {r.entries_open ? (
        <View style={styles.detailLine}>
          <Txt variant="small" style={{ flex: 1 }}>
            {t('calendar.entriesOpen', { when: dateTime(r.entries_close_at) })} · {r.my_entry_count}/{r.max_entries}
          </Txt>
          <Button small label={t('race.enter')} onPress={() => router.push(`/race/${r.race_id}`)} />
        </View>
      ) : null}
      <ErrorText error={error} />
      {d ? (
        <>
          <Txt variant="label" style={styles.subhead}>{r.is_stage_race ? t('calendar.stagesTitle') : t('calendar.race')}</Txt>
          <View style={styles.table}>
            <View style={[styles.tr, styles.th]}>
              <Txt variant="label" style={[styles.stageCol, styles.thText]}>{r.is_stage_race ? t('calendar.stage') : ''}</Txt>
              <Txt variant="label" style={[{ width: 52 }, styles.thText]}>{t('calendar.date')}</Txt>
              <Txt variant="label" style={[{ flex: 1 }, styles.thText]}>{t('calendar.winner')}</Txt>
              <Txt variant="label" style={[styles.numCol, styles.thText]}>{t('calendar.yourPoints')}</Txt>
            </View>
            {d.stages.map((s, i) => (
              <Pressable key={s.stage_id} onPress={() => router.push(`/stage/${s.stage_id}`)} accessibilityRole="button"
                         style={({ pressed }) => [styles.tr, i === d.stages.length - 1 && styles.trLast,
                                                  pressed && { backgroundColor: colors.road }]}>
                <View style={styles.stageCol}>
                  <Txt>{r.is_stage_race ? (s.number === 0 ? t('race.prologue') : t('race.stageN', { n: s.number })) : t('calendar.result')}</Txt>
                  {course(s.distance_km, s.vertical_m) ? (
                    <Txt variant="small" numberOfLines={1}>{course(s.distance_km, s.vertical_m)}</Txt>
                  ) : null}
                </View>
                <Txt variant="small" style={{ width: 52 }}>{dayMonth(s.date)}</Txt>
                {s.winner ? (
                  <View style={styles.winner}>
                    <Flag code={s.winner.nationality} />
                    <Txt variant="small" style={{ flex: 1 }} numberOfLines={1}>{s.winner.name}</Txt>
                  </View>
                ) : (
                  <Txt variant="small" style={{ flex: 1 }} numberOfLines={1}>
                    {s.status === 'scored' ? '—' : t('calendar.pending')}
                  </Txt>
                )}
                <Txt variant="number" style={styles.numCol}>{s.status === 'scored' ? points(s.my_points) : '—'}</Txt>
              </Pressable>
            ))}
          </View>

          {d.league_total.length ? (
            <>
              <Txt variant="label" style={styles.subhead}>{t('calendar.leaguePoints')}</Txt>
              <View style={styles.table}>
                <View style={[styles.tr, styles.th]}>
                  <Txt variant="label" style={[styles.posCol, styles.thText]}>{t('calendar.pos')}</Txt>
                  <View style={styles.flagCell} />
                  <Txt variant="label" style={[{ flex: 1 }, styles.thText]}>{t('calendar.team')}</Txt>
                  <Txt variant="label" style={[styles.numCol, styles.thText]}>{t('kind.points')}</Txt>
                </View>
                {d.league_total.map((m, i) => (
                  <View key={m.member_id} style={[styles.tr, i === d.league_total.length - 1 && styles.trLast]}>
                    <Txt variant="number" style={styles.posCol}>{ordinal(i + 1)}</Txt>
                    <View style={styles.flagCell}><Flag code={m.country} /></View>
                    <Txt style={{ flex: 1 }} numberOfLines={1}>{m.team_name}</Txt>
                    <Txt variant="number" style={styles.numCol}>{points(m.points)}</Txt>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {d.gc.length ? (
            <>
              <Txt variant="label" style={styles.subhead}>{r.is_stage_race ? t('kind.gc') : t('admin.classification')}</Txt>
              {/* tabla: posición · bandera (columna fija, todas alineadas) · ciclista · equipo de la liga que puntuó */}
              <View style={styles.table}>
                <View style={[styles.tr, styles.th]}>
                  <Txt variant="label" style={[styles.posCol, styles.thText]}>{t('calendar.pos')}</Txt>
                  <View style={styles.flagCell} />
                  <Txt variant="label" style={[{ flex: 1 }, styles.thText]}>{t('calendar.rider')}</Txt>
                  <Txt variant="label" style={[styles.teamCol, styles.thText]}>{t('calendar.scoresFor')}</Txt>
                </View>
                {d.gc.map((g, i) => {
                  const cells = (
                    <>
                      <Txt variant="number" style={styles.posCol}>{ordinal(g.position)}</Txt>
                      <View style={styles.flagCell}><Flag code={g.nationality} /></View>
                      <Txt numberOfLines={1} style={[{ flex: 1 }, g.rider_id == null && { color: colors.inkSoft }]}>{g.name}</Txt>
                      <Txt variant="small" numberOfLines={1} style={[styles.teamCol, g.scored_for.length ? styles.scoredFor : null]}>
                        {g.rider_id == null ? '' : g.scored_for.length ? g.scored_for.join(', ') : '—'}
                      </Txt>
                    </>
                  );
                  const rowStyle = [styles.tr, i === d.gc.length - 1 && styles.trLast];
                  // los que no están en el juego no tienen ficha: fila sin botón
                  return g.rider_id == null ? (
                    <View key={`x${g.position}-${g.name}`} style={rowStyle}>{cells}</View>
                  ) : (
                    <Pressable key={g.rider_id} onPress={() => router.push(`/rider/${g.rider_id}`)} accessibilityRole="button"
                               style={({ pressed }) => [...rowStyle, pressed && { backgroundColor: colors.road }]}>
                      {cells}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </>
      ) : !error ? <Txt variant="small">{t('common.loading')}</Txt> : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wide: { flex: 1, flexDirection: 'row', backgroundColor: colors.road, width: '100%', maxWidth: 1400, alignSelf: 'center', paddingHorizontal: space.s },
  stageCol: { width: 116 },
  winner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  month: { backgroundColor: colors.paper, borderRadius: 20, padding: space.s, paddingBottom: space.m, ...cardShadow },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.s, paddingBottom: space.m },
  monthBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.road, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  weekday: { textAlign: 'center', paddingBottom: space.xs, textTransform: 'capitalize' },
  day: { height: ROW_H, alignItems: 'center', paddingTop: 3, borderRadius: 12 },
  dayOn: { backgroundColor: colors.road },
  // el número, en un círculo: gris el de hoy, amarillo el elegido
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  numToday: { borderWidth: 1.5, borderColor: colors.ink },
  numOn: { backgroundColor: colors.jersey, borderWidth: 0 },
  dayNumOn: { fontFamily: fonts.bodyBold },
  dayNum: { fontFamily: fonts.bodyMedium, fontSize: type.body, lineHeight: 20, color: colors.ink },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 2, height: 5, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotMore: { backgroundColor: colors.line },
  dayTitle: { paddingHorizontal: space.l + 4, paddingTop: space.xs, paddingBottom: space.s },
  item: {
    backgroundColor: colors.paper, marginHorizontal: space.l, marginBottom: space.s, borderRadius: 16, overflow: 'hidden',
    ...cardShadow,
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l },
  swatch: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  flagCol: { width: 18, alignSelf: 'flex-start', marginTop: 6 },     // 6 = (alto de línea 24 − bandera 12) / 2
  detail: { paddingHorizontal: space.l, paddingBottom: space.l },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingVertical: 6 },
  subhead: { marginTop: space.m, marginBottom: 2 },
  scoredFor: { color: colors.green, fontFamily: fonts.bodyMedium },
  // tablas del desplegable: separadores finos y cabecera negra
  table: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 12, overflow: 'hidden',
           backgroundColor: colors.paper },
  tr: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.m, paddingVertical: 7,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  trLast: { borderBottomWidth: 0 },
  th: { backgroundColor: colors.asphalt, paddingVertical: 7, borderBottomWidth: 0 },
  thText: { color: colors.onDark },
  posCol: { width: 34 },
  flagCell: { width: 18, alignItems: 'center' },
  numCol: { width: 64, textAlign: 'right' },
  teamCol: { width: 104, textAlign: 'right' },
}));
