import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { RiderRow, riderStatusNote } from '@/components/RiderRow';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Section } from '@/components/Section';
import { StatusDot } from '@/components/StatusDot';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { moneyShort, points } from '@/lib/format';
import { colors, space } from '@/theme';

export default function Plantilla() {
  const { leagueId, me, refresh } = useLeague();
  const id = leagueId ?? '';
  const roster = useLoader(() => api.roster(id), [id], !!leagueId);
  const done = () => { roster.reload(); refresh(); };

  const rows = roster.data ?? [];
  const totalPoints = rows.filter((r) => r.status !== 'leaving').reduce((a, r) => a + r.league_points, 0);

  return (
    <Screen onRefresh={done} refreshing={roster.loading}>
      <View style={styles.summary}>
        <Stat label={t('squad.value')} value={moneyShort(me?.team_value)} />
        <Stat label={t('squad.points')} value={points(totalPoints)} />
        <Stat label={t('admin.riders')} value={me ? `${me.roster_count}/${me.max_riders}` : '—'} />
        <Stat label={t('squad.balance')} value={moneyShort(me?.balance)} color={(me?.balance ?? 0) < 0 ? colors.red : colors.green} />
      </View>


      <View style={styles.legend}>
        <View style={styles.legendItem}><StatusDot status="incoming" /><Txt variant="small">{t('squad.legendIncoming')}</Txt></View>
        <View style={styles.legendItem}><StatusDot status="leaving" /><Txt variant="small">{t('squad.legendLeaving')}</Txt></View>
      </View>

      <Section>
        {rows.length ? rows.map((r, i) => (
          <RiderRow
            key={r.ownership_id}
            name={r.rider_name}
            team={r.pro_team}
            photo={r.photo_url}
            nationality={r.nationality}
            status={r.status}
            note={[riderStatusNote(r.status), r.for_sale ? t('squad.forSale') : null,
                   r.game_offer_amount ? t('squad.gameOffers', { amount: moneyShort(r.game_offer_amount) }) : null].filter(Boolean).join(' · ')}
            value={r.market_value}
            detail={`${points(r.league_points)} · ${t('squad.clause', { amount: moneyShort(r.clause) })}`}
            onPress={() => router.push(`/ciclista/${r.rider_id}`)}
            last={i === rows.length - 1}
          />
        )) : <Empty text={roster.loading ? t('common.loading') : t('squad.empty')} />}
      </Section>
      <ErrorText error={roster.error} />
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Txt variant="small">{label}</Txt>
      <Txt variant="title" style={color ? { color } : undefined}>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', flexWrap: 'wrap', padding: space.l, paddingTop: space.xl, rowGap: space.m },
  stat: { width: '50%' },
  legend: { paddingHorizontal: space.l, paddingTop: space.l, gap: space.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.s },
});
