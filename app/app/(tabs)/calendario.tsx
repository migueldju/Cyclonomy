import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { api } from '@/lib/api';
import { dateRange, dateTime, dayMonth, points, todayISO } from '@/lib/format';
import type { CalendarRow, RaceDetail } from '@/lib/types';
import { categoryColor, colors, fonts, space, type } from '@/theme';

export default function Calendario() {
  const { leagueId } = useLeague();
  const id = leagueId ?? '';
  const { data, error, loading, reload } = useLoader(() => api.calendar(id), [id], !!leagueId);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const list = useRef<FlatList<CalendarRow>>(null);
  const scrolled = useRef(false);

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    (data ?? []).forEach((r) => seen.set(r.category, r.category_name));
    return [...seen.entries()];
  }, [data]);

  const rows = useMemo(() => {
    const q = normalize(query);
    return (data ?? []).filter((r) => (!cat || r.category === cat) && (!q || normalize(r.name).includes(q)));
  }, [data, query, cat]);

  // Al abrir, el scroll se coloca en la carrera en curso o la siguiente
  const nearest = Math.max(0, rows.findIndex((r) => r.end_date >= todayISO()));
  useEffect(() => {
    if (!rows.length || scrolled.current) return;
    scrolled.current = true;
    setTimeout(() => list.current?.scrollToIndex({ index: nearest, animated: false }), 50);
  }, [rows.length, nearest]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.road }}>
      <View style={styles.filters}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Buscar carrera" placeholderTextColor={colors.inkSoft}
                   style={styles.search} accessibilityLabel="Buscar carrera" />
        <FlatList
          horizontal showsHorizontalScrollIndicator={false}
          data={[[null, 'Todas'] as [string | null, string], ...categories]}
          keyExtractor={(c) => String(c[0])}
          contentContainerStyle={{ gap: space.s }}
          renderItem={({ item: [code, name] }) => {
            const on = cat === code;
            return (
              <Pressable onPress={() => { setCat(code); scrolled.current = false; }} accessibilityRole="button"
                         accessibilityState={{ selected: on }} style={[styles.chip, on && styles.chipOn]}>
                {code ? <View style={[styles.dot, { backgroundColor: categoryColor[code] ?? colors.line }]} /> : null}
                <Txt style={[styles.chipText, on && { color: colors.paper }]}>{name}</Txt>
              </Pressable>
            );
          }}
        />
      </View>
      <ErrorText error={error} />
      <FlatList
        ref={list}
        data={rows}
        keyExtractor={(r) => String(r.race_id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        onScrollToIndexFailed={(info) => {
          list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => list.current?.scrollToIndex({ index: info.index, animated: false }), 100);
        }}
        ListEmptyComponent={<Txt variant="small" style={{ padding: space.l }}>
          {loading ? 'Cargando…' : 'Ninguna carrera coincide con la búsqueda.'}
        </Txt>}
        renderItem={({ item }) => (
          <RaceItem r={item} open={open === item.race_id} leagueId={id}
                    onToggle={() => setOpen(open === item.race_id ? null : item.race_id)} />
        )}
      />
    </View>
  );
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const STATUS = { upcoming: 'próxima', live: 'en curso', finished: 'terminada' };

function RaceItem({ r, open, onToggle, leagueId }: { r: CalendarRow; open: boolean; onToggle: () => void; leagueId: string }) {
  return (
    <View style={styles.item}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.itemHead}>
        <View style={[styles.swatch, { backgroundColor: categoryColor[r.category] ?? colors.line }]} />
        <View style={{ flex: 1 }}>
          <Txt variant="lead" numberOfLines={1}>{r.name}</Txt>
          <Txt variant="small">
            {dateRange(r.start_date, r.end_date)} · {r.category_name}
            {r.is_stage_race ? ` · ${r.n_stages} etapas` : ''} · {STATUS[r.status]}
          </Txt>
        </View>
        <Txt variant="label">{open ? 'Cerrar' : 'Ver'}</Txt>
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
            Inscripción abierta hasta {dateTime(r.entries_close_at)} · {r.my_entry_count}/{r.max_entries}
          </Txt>
          <Button small label="Inscribir" onPress={() => router.push(`/carrera/${r.race_id}`)} />
        </View>
      ) : null}
      <ErrorText error={error} />
      {d ? (
        <>
          <Txt variant="label" style={styles.subhead}>{r.is_stage_race ? 'Etapas' : 'Carrera'}</Txt>
          {d.stages.map((s) => (
            <Pressable key={s.stage_id} onPress={() => router.push(`/etapa/${s.stage_id}`)} style={styles.detailLine}
                       accessibilityRole="button">
              <Txt style={{ width: 92 }}>{r.is_stage_race ? (s.number === 0 ? 'Prólogo' : `Etapa ${s.number}`) : 'Resultado'}</Txt>
              <Txt variant="small" style={{ width: 56 }}>{dayMonth(s.date)}</Txt>
              <Txt variant="small" style={{ flex: 1 }} numberOfLines={1}>
                {s.status === 'scored' ? (s.top_member ? `mejor: ${s.top_member.team_name}` : 'sin puntos en la liga') : 'pendiente'}
              </Txt>
              <Txt variant="number">{s.status === 'scored' ? points(s.my_points) : ''}</Txt>
            </Pressable>
          ))}
          {d.league_total.length ? (
            <>
              <Txt variant="label" style={styles.subhead}>Puntos de la liga en la carrera</Txt>
              {d.league_total.map((m, i) => (
                <View key={m.member_id} style={styles.detailLine}>
                  <Txt variant="number" style={{ width: 32 }}>{i + 1}.º</Txt>
                  <Txt style={{ flex: 1 }} numberOfLines={1}>{m.team_name}</Txt>
                  <Txt variant="number">{points(m.points)}</Txt>
                </View>
              ))}
            </>
          ) : null}
          {d.gc.length ? (
            <>
              <Txt variant="label" style={styles.subhead}>{r.is_stage_race ? 'General' : 'Clasificación'}</Txt>
              {d.gc.map((g) => (
                <View key={g.rider_id} style={styles.detailLine}>
                  <Txt variant="number" style={{ width: 32 }}>{g.position}.º</Txt>
                  <Txt style={{ flex: 1 }}>{g.name}</Txt>
                </View>
              ))}
            </>
          ) : null}
        </>
      ) : !error ? <Txt variant="small">Cargando…</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { padding: space.l, gap: space.m, backgroundColor: colors.road },
  search: {
    backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: space.m,
    paddingVertical: 10, fontFamily: fonts.body, fontSize: type.body, color: colors.ink,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.m, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.paper,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: type.small, color: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4 },
  item: { backgroundColor: colors.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l },
  swatch: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  detail: { paddingHorizontal: space.l, paddingBottom: space.l, paddingLeft: space.l + 16 },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingVertical: 6 },
  subhead: { marginTop: space.m, marginBottom: 2 },
});
