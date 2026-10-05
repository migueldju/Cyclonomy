import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Flag } from '@/components/Flag';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { api } from '@/lib/api';
import { dateRange, dateTime, dayMonth, points, todayISO } from '@/lib/format';
import type { CalendarRow, RaceDetail } from '@/lib/types';
import { categoryColor, categoryRank, colors, fonts, space, type } from '@/theme';

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
    return [...seen.entries()].sort((a, b) => categoryRank(a[0]) - categoryRank(b[0]));
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
        {/* bandera en una columna fija, a la altura del nombre: todas alineadas */}
        <View style={styles.flagCol}><Flag code={r.country} /></View>
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
          <View style={styles.table}>
            <View style={[styles.tr, styles.th]}>
              <Txt variant="label" style={{ width: 84 }}>{r.is_stage_race ? 'Etapa' : ''}</Txt>
              <Txt variant="label" style={{ width: 52 }}>Fecha</Txt>
              <Txt variant="label" style={{ flex: 1 }}>Mejor de la liga</Txt>
              <Txt variant="label" style={styles.numCol}>Tus pts</Txt>
            </View>
            {d.stages.map((s, i) => (
              <Pressable key={s.stage_id} onPress={() => router.push(`/etapa/${s.stage_id}`)} accessibilityRole="button"
                         style={({ pressed }) => [styles.tr, i === d.stages.length - 1 && styles.trLast,
                                                  pressed && { backgroundColor: colors.road }]}>
                <Txt style={{ width: 84 }}>{r.is_stage_race ? (s.number === 0 ? 'Prólogo' : `Etapa ${s.number}`) : 'Resultado'}</Txt>
                <Txt variant="small" style={{ width: 52 }}>{dayMonth(s.date)}</Txt>
                <Txt variant="small" style={{ flex: 1 }} numberOfLines={1}>
                  {s.status === 'scored' ? (s.top_member ? s.top_member.team_name : 'sin puntos') : 'pendiente'}
                </Txt>
                <Txt variant="number" style={styles.numCol}>{s.status === 'scored' ? points(s.my_points) : '—'}</Txt>
              </Pressable>
            ))}
          </View>

          {d.league_total.length ? (
            <>
              <Txt variant="label" style={styles.subhead}>Puntos de la liga en la carrera</Txt>
              <View style={styles.table}>
                <View style={[styles.tr, styles.th]}>
                  <Txt variant="label" style={styles.posCol}>Pos.</Txt>
                  <View style={styles.flagCell} />
                  <Txt variant="label" style={{ flex: 1 }}>Equipo</Txt>
                  <Txt variant="label" style={styles.numCol}>Puntos</Txt>
                </View>
                {d.league_total.map((m, i) => (
                  <View key={m.member_id} style={[styles.tr, i === d.league_total.length - 1 && styles.trLast]}>
                    <Txt variant="number" style={styles.posCol}>{i + 1}.º</Txt>
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
              <Txt variant="label" style={styles.subhead}>{r.is_stage_race ? 'General' : 'Clasificación'}</Txt>
              {/* tabla: posición · bandera (columna fija, todas alineadas) · ciclista · equipo de la liga que puntuó */}
              <View style={styles.table}>
                <View style={[styles.tr, styles.th]}>
                  <Txt variant="label" style={styles.posCol}>Pos.</Txt>
                  <View style={styles.flagCell} />
                  <Txt variant="label" style={{ flex: 1 }}>Ciclista</Txt>
                  <Txt variant="label" style={styles.teamCol}>Puntúa para</Txt>
                </View>
                {d.gc.map((g, i) => (
                  <Pressable key={g.rider_id} onPress={() => router.push(`/ciclista/${g.rider_id}`)} accessibilityRole="button"
                             style={({ pressed }) => [styles.tr, i === d.gc.length - 1 && styles.trLast,
                                                      pressed && { backgroundColor: colors.road }]}>
                    <Txt variant="number" style={styles.posCol}>{g.position}.º</Txt>
                    <View style={styles.flagCell}><Flag code={g.nationality} /></View>
                    <Txt numberOfLines={1} style={{ flex: 1 }}>{g.name}</Txt>
                    <Txt variant="small" numberOfLines={1} style={[styles.teamCol, g.scored_for.length ? styles.scoredFor : null]}>
                      {g.scored_for.length ? g.scored_for.join(', ') : '—'}
                    </Txt>
                  </Pressable>
                ))}
              </View>
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
  chipText: { fontFamily: fonts.bodyMedium, fontSize: type.small, color: colors.ink, letterSpacing: 0.2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
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
