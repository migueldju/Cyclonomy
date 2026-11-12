import { router } from 'expo-router';
import { HeroCard, StatTile, StatTiles } from '@/components/Hero';
import { AdSlot, InfoButton } from '@/components/Info';
import { RiderRow, riderStatusNote } from '@/components/RiderRow';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Section } from '@/components/Section';
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
      <HeroCard>
        <StatTiles>
          <StatTile label={t('squad.value')} value={moneyShort(me?.team_value)} />
          <StatTile label={t('squad.points')} value={points(totalPoints)} />
          <StatTile label={t('admin.riders')} value={me ? `${me.roster_count}/${me.max_riders}` : '—'} />
          <StatTile label={t('squad.balance')} value={moneyShort(me?.balance)} color={(me?.balance ?? 0) < 0 ? colors.red : colors.green} />
        </StatTiles>
        <InfoButton title={t('tabs.squad')} style={{ marginTop: space.m }}
                    items={[{ dot: colors.orange, text: t('squad.legendIncoming') }, { dot: colors.red, text: t('squad.legendLeaving') },
                            t('rules.r5'), t('rules.r10'), t('rules.r6')]} />
      </HeroCard>
      <AdSlot />

      <Section style={{ marginTop: space.l }}>
        {rows.length ? rows.map((r, i) => (
          <RiderRow
            key={r.ownership_id}
            name={r.rider_name}
            team={r.pro_team}
            photo={r.photo_url}
            nationality={r.nationality}
            status={r.status}
            note={[riderStatusNote(r.status), r.for_sale ? t('squad.forSale') : null,
                   r.locked ? t('squad.locked') : r.locked_next ? t('squad.lockedNext') : null,
                   r.game_offer_amount ? t('squad.gameOffers', { amount: moneyShort(r.game_offer_amount) }) : null].filter(Boolean).join(' · ')}
            value={r.market_value}
            detail={`${points(r.league_points)} · ${t('squad.clause', { amount: moneyShort(r.clause) })}`}
            onPress={() => router.push(`/rider/${r.rider_id}`)}
            last={i === rows.length - 1}
          />
        )) : <Empty text={roster.loading ? t('common.loading') : t('squad.empty')} />}
      </Section>
      <ErrorText error={roster.error} />
    </Screen>
  );
}
