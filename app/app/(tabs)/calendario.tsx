import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button } from '@/components/Button';
import { Flag } from '@/components/Flag';
import { BottomFill } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { getLang, t } from '@/i18n';
import { api } from '@/lib/api';
import { dateTime, dayMonth, ordinal, parseDay, points, todayISO } from '@/lib/format';
import { stageLabel } from '@/lib/stages';
import type { CalendarRow, RaceDetail } from '@/lib/types';
import { categoryColor, categoryName, categoryRank, colors, fonts, space, type } from '@/theme';

export default function Calendario() {
  const { leagueId } = useLeague();
  const id = leagueId ?? '';
  const { data, error, loading, reload } = useLoader(() => api.calendar(id), [id], !!leagueId);
  const [open, setOpen] = useState<number | null>(null);
  const [day, setDay] = useState(todayISO());
  const { width } = useWindowDimensions();
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

  const header = (
    <>
      {/* un mes por página: se desliza a izquierda y derecha */}
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
      <Txt variant="label" style={styles.dayTitle}>{dayTitle(day)}</Txt>
      <ErrorText error={error} />
    </>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.road }}
      data={dayRaces}
      keyExtractor={(r) => String(r.race_id)}
      ListHeaderComponent={header}
      ListFooterComponent={<BottomFill />}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
      ListEmptyComponent={<Txt variant="small" style={{ paddingHorizontal: space.l }}>
        {loading ? t('common.loading') : t('calendar.noRacesDay')}
      </Txt>}
      renderItem={({ item }) => (
        <RaceItem r={item} day={day} open={open === item.race_id} leagueId={id}
                  onToggle={() => setOpen(open === item.race_id ? null : item.race_id)} />
      )}
    />
  );
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

/** Cuadrícula de un mes (semanas de lunes a domingo); cada día, una rayita del color de la categoría por carrera */
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
  const cell = (width - space.l * 2) / 7;
  return (
    <View style={{ width, paddingHorizontal: space.l }}>
      <View style={styles.monthHead}>
        <Pressable onPress={onPrev} disabled={!onPrev} hitSlop={10} accessibilityRole="button">
          <Txt variant="title" style={!onPrev && { opacity: 0.25 }}>‹</Txt>
        </Pressable>
        <Txt variant="title">{monthTitle(month)}</Txt>
        <Pressable onPress={onNext} disabled={!onNext} hitSlop={10} accessibilityRole="button">
          <Txt variant="title" style={!onNext && { opacity: 0.25 }}>›</Txt>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {weekdays.map((w) => <Txt key={w} variant="label" style={[styles.weekday, { width: cell }]}>{w}</Txt>)}
        {cells.map((d, i) => {
          if (d == null) return <View key={`x${i}`} style={{ width: cell, height: 50 }} />;
          const date = iso(y, m, d);
          const here = races.filter((r) => r.start_date <= date && date <= r.end_date)
            .sort((a, b) => categoryRank(a.category) - categoryRank(b.category));
          const on = date === selected;
          return (
            <Pressable key={date} onPress={() => onSelect(date)} accessibilityRole="button" accessibilityState={{ selected: on }}
                       style={[styles.day, { width: cell }, on && styles.dayOn, date === today && !on && styles.dayToday]}>
              <Txt style={[styles.dayNum, on && { color: colors.paper }]}>{d}</Txt>
              <View style={styles.bars}>
                {here.slice(0, 3).map((r) => (
                  <View key={r.race_id} style={[styles.bar, { backgroundColor: categoryColor[r.category] ?? colors.inkSoft }]} />
                ))}
                {here.length > 3 ? <Txt style={[styles.more, on && { color: colors.paper }]}>+{here.length - 3}</Txt> : null}
              </View>
            </Pressable>
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
        <View style={[styles.swatch, { backgroundColor: categoryColor[r.category] ?? colors.line }]} />
        {/* bandera en una columna fija, a la altura del nombre: todas alineadas */}
        <View style={styles.flagCol}><Flag code={r.country} /></View>
        <View style={{ flex: 1 }}>
          <Txt variant="lead" numberOfLines={1}>{r.name}</Txt>
          <Txt variant="small" numberOfLines={1}>
            {stageLabel(r.is_stage_race, stage?.number, last)} · {categoryName(r.category)} · {status(r.status)}
          </Txt>
        </View>
        <Txt variant="label">{open ? t('common.close') : t('common.see')}</Txt>
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
          <Button small label={t('race.enter')} onPress={() => router.push(`/carrera/${r.race_id}`)} />
        </View>
      ) : null}
      <ErrorText error={error} />
      {d ? (
        <>
          <Txt variant="label" style={styles.subhead}>{r.is_stage_race ? t('calendar.stagesTitle') : t('calendar.race')}</Txt>
          <View style={styles.table}>
            <View style={[styles.tr, styles.th]}>
              <Txt variant="label" style={{ width: 84 }}>{r.is_stage_race ? t('calendar.stage') : ''}</Txt>
              <Txt variant="label" style={{ width: 52 }}>{t('calendar.date')}</Txt>
              <Txt variant="label" style={{ flex: 1 }}>{t('calendar.bestInLeague')}</Txt>
              <Txt variant="label" style={styles.numCol}>{t('calendar.yourPoints')}</Txt>
            </View>
            {d.stages.map((s, i) => (
              <Pressable key={s.stage_id} onPress={() => router.push(`/etapa/${s.stage_id}`)} accessibilityRole="button"
                         style={({ pressed }) => [styles.tr, i === d.stages.length - 1 && styles.trLast,
                                                  pressed && { backgroundColor: colors.road }]}>
                <Txt style={{ width: 84 }}>{r.is_stage_race ? (s.number === 0 ? t('race.prologue') : t('race.stageN', { n: s.number })) : t('calendar.result')}</Txt>
                <Txt variant="small" style={{ width: 52 }}>{dayMonth(s.date)}</Txt>
                <Txt variant="small" style={{ flex: 1 }} numberOfLines={1}>
                  {s.status === 'scored' ? (s.top_member ? s.top_member.team_name : t('calendar.noPoints')) : t('calendar.pending')}
                </Txt>
                <Txt variant="number" style={styles.numCol}>{s.status === 'scored' ? points(s.my_points) : '—'}</Txt>
              </Pressable>
            ))}
          </View>

          {d.league_total.length ? (
            <>
              <Txt variant="label" style={styles.subhead}>{t('calendar.leaguePoints')}</Txt>
              <View style={styles.table}>
                <View style={[styles.tr, styles.th]}>
                  <Txt variant="label" style={styles.posCol}>{t('calendar.pos')}</Txt>
                  <View style={styles.flagCell} />
                  <Txt variant="label" style={{ flex: 1 }}>{t('calendar.team')}</Txt>
                  <Txt variant="label" style={styles.numCol}>{t('kind.points')}</Txt>
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
                  <Txt variant="label" style={styles.posCol}>{t('calendar.pos')}</Txt>
                  <View style={styles.flagCell} />
                  <Txt variant="label" style={{ flex: 1 }}>{t('calendar.rider')}</Txt>
                  <Txt variant="label" style={styles.teamCol}>{t('calendar.scoresFor')}</Txt>
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
                    <Pressable key={g.rider_id} onPress={() => router.push(`/ciclista/${g.rider_id}`)} accessibilityRole="button"
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

const styles = StyleSheet.create({
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.m, paddingBottom: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { textAlign: 'center', paddingBottom: space.xs, textTransform: 'capitalize' },
  day: { height: 50, alignItems: 'center', paddingTop: 5, borderRadius: 8 },
  dayOn: { backgroundColor: colors.ink },
  dayToday: { borderWidth: 1.5, borderColor: colors.ink },
  dayNum: { fontFamily: fonts.bodyMedium, fontSize: type.body, color: colors.ink },
  bars: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 2, marginTop: 4,
    paddingHorizontal: 3,
  },
  bar: { width: 9, height: 4, borderRadius: 2 },
  more: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.inkSoft },
  dayTitle: { paddingHorizontal: space.l, paddingTop: space.xs, paddingBottom: space.xs },
  item: { backgroundColor: colors.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l },
  swatch: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  flagCol: { width: 18, alignSelf: 'flex-start', marginTop: 6 },     // 6 = (alto de línea 24 − bandera 12) / 2
  detail: { paddingHorizontal: space.l, paddingBottom: space.l, paddingLeft: space.l + 16 },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingVertical: 6 },
  subhead: { marginTop: space.m, marginBottom: 2 },
  scoredFor: { color: colors.green, fontFamily: fonts.bodyMedium },
  // tablas del desplegable: borde y separadores finos, cabecera sobre el gris de fondo
  table: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 6, overflow: 'hidden',
           backgroundColor: colors.paper },
  tr: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.m, paddingVertical: 7,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  trLast: { borderBottomWidth: 0 },
  th: { backgroundColor: colors.road, paddingVertical: 5 },
  posCol: { width: 34 },
  flagCell: { width: 18, alignItems: 'center' },
  numCol: { width: 64, textAlign: 'right' },
  teamCol: { width: 104, textAlign: 'right' },
});
