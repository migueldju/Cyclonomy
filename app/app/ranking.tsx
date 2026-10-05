import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { Flag } from '@/components/Flag';
import { RiderAvatar } from '@/components/RiderAvatar';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { api } from '@/lib/api';
import { moneyShort, points } from '@/lib/format';
import type { RankingRow } from '@/lib/types';
import { colors, fonts, space, type } from '@/theme';

// Propietario: todos, libres, míos o los de un jugador concreto (member_id)
type Owner = 'all' | 'free' | 'mine' | string;

const VALUE_RANGES: { key: string; label: string; min: number; max: number }[] = [
  { key: 'all', label: 'Cualquier valor', min: 0, max: Infinity },
  { key: 'v1', label: 'Hasta 250.000 €', min: 0, max: 250_000 },
  { key: 'v2', label: '250.000 € – 1 M €', min: 250_000, max: 1_000_000 },
  { key: 'v3', label: '1 – 3 M €', min: 1_000_000, max: 3_000_000 },
  { key: 'v4', label: 'Más de 3 M €', min: 3_000_000, max: Infinity },
];

/** Todos los ciclistas por puntos de la temporada, con filtros de propietario y valor de mercado */
export default function Ranking() {
  const { leagueId } = useLeague();
  const id = leagueId ?? '';
  const { data, error, loading, reload } = useLoader(() => api.ranking(id), [id], !!leagueId);
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState<Owner>('all');
  const [range, setRange] = useState('all');

  // el puesto es el del ranking completo, aunque se filtre
  const ranked = useMemo(() => (data ?? []).map((r, i) => ({ ...r, rank: i + 1 })), [data]);

  const owners = useMemo(() => {
    const seen = new Map<string, string>();
    (data ?? []).forEach((r) => { if (r.owner_member_id && !r.is_mine) seen.set(r.owner_member_id, r.owner_team ?? ''); });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const rows = useMemo(() => {
    const q = normalize(query);
    const v = VALUE_RANGES.find((x) => x.key === range)!;
    return ranked.filter((r) =>
      (owner === 'all' || (owner === 'free' ? !r.owner_member_id : owner === 'mine' ? r.is_mine : r.owner_member_id === owner))
      && r.market_value >= v.min && r.market_value < v.max
      && (!q || normalize(r.name).includes(q) || normalize(r.pro_team ?? '').includes(q)));
  }, [ranked, query, owner, range]);

  const ownerChips: [Owner, string][] = [['all', 'Todos'], ['free', 'Libres'], ['mine', 'Míos'], ...owners];

  return (
    <View style={{ flex: 1, backgroundColor: colors.road }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.rider_id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        initialNumToRender={20}
        keyboardShouldPersistTaps="handled"
        // los filtros se desplazan con la lista: en pantallas bajas no tapan los ciclistas
        ListHeaderComponent={
          <View style={styles.filters}>
            <Txt variant="hero">Ranking</Txt>
            <TextInput value={query} onChangeText={setQuery} placeholder="Buscar ciclista o equipo"
                       placeholderTextColor={colors.inkSoft} style={styles.search} accessibilityLabel="Buscar ciclista o equipo" />
            <Chips label="Propietario" items={ownerChips} value={owner} onChange={setOwner} />
            <Chips label="Valor de mercado" items={VALUE_RANGES.map((x) => [x.key, x.label] as [string, string])}
                   value={range} onChange={setRange} />
          </View>
        }
        ListFooterComponent={<ErrorText error={error} />}
        ListEmptyComponent={<Txt variant="small" style={{ padding: space.l }}>
          {loading ? 'Cargando…' : 'Ningún ciclista coincide con los filtros.'}
        </Txt>}
        renderItem={({ item }) => <RankRow r={item} />}
      />
    </View>
  );
}

function RankRow({ r }: { r: RankingRow & { rank: number } }) {
  const owner = r.is_mine ? 'tuyo' : r.owner_team ?? 'libre';
  return (
    <Pressable onPress={() => router.push(`/ciclista/${r.rider_id}`)} accessibilityRole="button"
               style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.road }]}>
      <Txt variant="number" style={styles.rank}>{r.rank}</Txt>
      <RiderAvatar url={r.photo_url} name={r.name} team={r.pro_team} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.nameLine}>
          <Txt variant="lead" numberOfLines={1} style={{ flexShrink: 1 }}>{r.name}</Txt>
          <Flag code={r.nationality} />
        </View>
        <Txt variant="small" numberOfLines={1}>
          {r.pro_team ?? 'Sin equipo'} · <Txt variant="small" style={r.is_mine ? styles.mine : undefined}>{owner}</Txt>
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Txt variant="number">{points(r.season_points)}</Txt>
        <Txt variant="small">{moneyShort(r.market_value)}</Txt>
      </View>
    </Pressable>
  );
}

function Chips<T extends string>({ label, items, value, onChange }: {
  label: string; items: [T, string][]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <Txt variant="label">{label}</Txt>
      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(c) => c[0]}
        contentContainerStyle={{ gap: space.s }}
        renderItem={({ item: [code, name] }) => {
          const on = value === code;
          return (
            <Pressable onPress={() => onChange(code)} accessibilityRole="button" accessibilityState={{ selected: on }}
                       style={[styles.chip, on && styles.chipOn]}>
              <Txt style={[styles.chipText, on && { color: colors.paper }]}>{name}</Txt>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const styles = StyleSheet.create({
  filters: { padding: space.l, paddingTop: space.xl, gap: space.m, backgroundColor: colors.road },
  search: {
    backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: space.m,
    paddingVertical: 10, fontFamily: fonts.body, fontSize: type.body, color: colors.ink,
  },
  chip: {
    paddingHorizontal: space.m, paddingVertical: 7, borderRadius: 16, borderWidth: 1.5,
    borderColor: colors.line, backgroundColor: colors.paper,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: type.small, color: colors.ink, letterSpacing: 0.2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, paddingVertical: space.m,
    backgroundColor: colors.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  rank: { width: 32, color: colors.inkSoft },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  mine: { color: colors.green, fontFamily: fonts.bodyBold },
});
