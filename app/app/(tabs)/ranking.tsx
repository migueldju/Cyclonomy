import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Flag } from '@/components/Flag';
import { RangeSlider } from '@/components/RangeSlider';
import { RiderAvatar } from '@/components/RiderAvatar';
import { BottomFill } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { moneyShort, points } from '@/lib/format';
import type { RankingRow } from '@/lib/types';
import { colors, fonts, space, type } from '@/theme';

// Propietario: todos, libres, míos o los de un jugador concreto (member_id)
type Owner = 'all' | 'free' | 'mine' | string;

// Escalones de la barra de valor: más finos en la zona barata, donde están la mayoría de los ciclistas.
// El último es "sin límite".
const VALUE_STEPS = [
  0, 30_000, 40_000, 50_000, 60_000, 80_000, 100_000, 120_000, 140_000, 160_000, 180_000, 200_000, 220_000,
  240_000, 260_000, 280_000, 300_000, 350_000, 400_000, 450_000, 500_000, 550_000, 600_000, 650_000, 700_000, 750_000, 875_000,
  1_000_000, 1_250_000, 1_500_000, 1_750_000, 2_000_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000, 5_000_000,
  6_000_000, 7_000_000, 8_000_000, 9_000_000, Infinity,
];
const LAST_STEP = VALUE_STEPS.length - 1;

/** Todos los ciclistas por puntos de la temporada, con filtros de propietario y valor de mercado */
export default function Ranking() {
  const { leagueId } = useLeague();
  const id = leagueId ?? '';
  const { data, error, loading, reload } = useLoader(() => api.ranking(id), [id], !!leagueId);
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState<Owner>('all');
  const [low, setLow] = useState(0);
  const [high, setHigh] = useState(LAST_STEP);

  // el puesto es el del ranking completo, aunque se filtre
  const ranked = useMemo(() => (data ?? []).map((r, i) => ({ ...r, rank: i + 1 })), [data]);

  const owners = useMemo(() => {
    const seen = new Map<string, string>();
    (data ?? []).forEach((r) => { if (r.owner_member_id && !r.is_mine) seen.set(r.owner_member_id, r.owner_team ?? ''); });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const rows = useMemo(() => {
    const q = normalize(query);
    const min = VALUE_STEPS[low];
    const max = VALUE_STEPS[high];
    return ranked.filter((r) =>
      (owner === 'all' || (owner === 'free' ? !r.owner_member_id : owner === 'mine' ? r.is_mine : r.owner_member_id === owner))
      && r.market_value >= min && r.market_value <= max
      && (!q || normalize(r.name).includes(q) || normalize(r.pro_team ?? '').includes(q)));
  }, [ranked, query, owner, low, high]);

  const ownerChips: [Owner, string][] = [['all', t('ranking.all')], ['free', t('ranking.free')], ['mine', t('ranking.mine')], ...owners];

  return (
    <View style={{ flex: 1, backgroundColor: colors.road }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.rider_id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        initialNumToRender={20}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
        // los filtros se desplazan con la lista: en pantallas bajas no tapan los ciclistas
        ListHeaderComponent={
          <View style={styles.filters}>
            <Txt variant="hero">{t('ranking.title')}</Txt>
            <TextInput value={query} onChangeText={setQuery} placeholder={t('ranking.search')}
                       placeholderTextColor={colors.inkSoft} style={styles.search} accessibilityLabel={t('ranking.search')} />
            <Chips label={t('ranking.owner')} items={ownerChips} value={owner} onChange={setOwner} />
            <View style={{ gap: space.xs }}>
              <View style={styles.valueHead}>
                <Txt variant="label">{t('rider.marketValue')}</Txt>
                <Txt variant="label" style={{ color: colors.ink }}>
                  {low === 0 && high === LAST_STEP ? t('ranking.anyValue')
                    : high === LAST_STEP ? t('ranking.from', { amount: moneyShort(VALUE_STEPS[low]) })
                    : low === 0 ? t('ranking.upTo', { amount: moneyShort(VALUE_STEPS[high]) })
                    : `${moneyShort(VALUE_STEPS[low])} – ${moneyShort(VALUE_STEPS[high])}`}
                </Txt>
              </View>
              <RangeSlider steps={VALUE_STEPS.length} low={low} high={high} label={t('rider.marketValue')}
                           onChange={(l, h) => { setLow(l); setHigh(h); }} />
            </View>
          </View>
        }
        ListFooterComponent={<><ErrorText error={error} /><BottomFill /></>}
        ListEmptyComponent={<Txt variant="small" style={{ padding: space.l }}>
          {loading ? t('common.loading') : t('ranking.noMatch')}
        </Txt>}
        renderItem={({ item }) => <RankRow r={item} />}
      />
    </View>
  );
}

function RankRow({ r }: { r: RankingRow & { rank: number } }) {
  const owner = r.is_mine ? t('rider.yours') : r.owner_team ?? t('rider.free');
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
          {r.pro_team ?? t('rider.noTeam')} · <Txt variant="small" style={r.is_mine ? styles.mine : undefined}>{owner}</Txt>
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Txt variant="number">{points(r.season_points)}</Txt>
        <Txt variant="small">{moneyShort(r.market_value)}</Txt>
      </View>
    </Pressable>
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
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, paddingVertical: space.m,
    backgroundColor: colors.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  rank: { width: 32, color: colors.inkSoft },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  valueHead: { flexDirection: 'row', justifyContent: 'space-between' },
  mine: { color: colors.green, fontFamily: fonts.bodyBold },
});
