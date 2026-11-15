import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { HeroCard, StatTile, StatTiles } from '@/components/Hero';
import { AdSlot, InfoButton } from '@/components/Info';
import { Button } from '@/components/Button';
import { ActionSheet, AmountSheet, SheetAction } from '@/components/Modal';
import { OffersSection } from '@/components/OffersSection';
import { RiderRow } from '@/components/RiderRow';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { countdown, dateTime, money, moneyShort, points } from '@/lib/format';
import type { MarketRow } from '@/lib/types';
import { colors, fonts, space, type } from '@/theme';

export default function Mercado() {
  const { leagueId, me, refresh } = useLeague();
  const id = leagueId ?? '';
  const { data, error, loading, reload } = useLoader(() => api.market(id), [id], !!leagueId);
  const [picked, setPicked] = useState<MarketRow | null>(null);
  const [bidding, setBidding] = useState<MarketRow | null>(null);
  const done = () => { reload(); refresh(); };

  const rows = data ?? [];
  const sales = rows.filter((r) => r.seller_member_id);
  const free = rows.filter((r) => !r.seller_member_id);

  // tocar: mi venta -> acciones de la venta; una puja mía -> cambiarla o retirarla; si no, pujar
  const open = (r: MarketRow) => (r.is_mine || r.my_bid ? setPicked(r) : setBidding(r));

  function actions(r: MarketRow): SheetAction[] {
    if (r.is_mine) {
      const out: SheetAction[] = [];
      if (r.game_offer_id && r.game_offer_amount) {
        out.push({ icon: 'cash-outline', kind: 'primary', label: t('actions.sellToGameShort'),
                   detail: t('actions.sellToGameDetail', { amount: moneyShort(r.game_offer_amount), when: dateTime(r.game_offer_expires) }),
                   onPress: () => api.acceptGameOffer(r.game_offer_id!),
                   done: t('toast.soldToGame', { name: r.rider_name, amount: money(r.game_offer_amount) }) });
      }
      out.push({ icon: 'close-circle-outline', kind: 'danger', label: t('actions.unsell'), detail: t('actions.unsellDetail'),
                 onPress: () => api.setForSale(r.seller_ownership_id!, false), done: t('toast.unsold', { name: r.rider_name }) });
      return out;
    }
    return [
      { icon: 'create-outline', kind: 'primary', label: t('market.changeBid'),
        detail: r.my_bid ? t('market.yourBid', { amount: moneyShort(r.my_bid) }) : undefined,
        onPress: () => { setTimeout(() => setBidding(r), 350); } },
      { icon: 'close-circle-outline', kind: 'danger', label: t('market.cancelBid'), onPress: () => api.cancelBid(r.listing_id),
        done: t('toast.bidCancelled', { name: r.rider_name }) },
    ];
  }

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <HeroCard>
        <StatTiles>
          <StatTile label={t('market.nextUpdate')} icon="time-outline" value={countdown(me?.next_market_at ?? null)} />
          <StatTile label={t('market.canSpend')} value={moneyShort(me?.available)}
                    color={(me?.available ?? 0) >= 0 ? colors.green : colors.red} />
        </StatTiles>
        <InfoButton title={t('tabs.market')} style={{ marginTop: space.m }}
                    items={[t('market.note'), t('rules.r8'), t('rules.r2')]} />
      </HeroCard>
      <AdSlot />

      <OffersSection />

      <Section title={t('market.daily')}
               action={<Button small kind="dark" label={t('moves.history')} onPress={() => router.push('/moves')} />}>
        {free.length ? free.map((r, i) => (
          <ListingRow key={r.listing_id} r={r} last={i === free.length - 1} onPress={() => open(r)} />
        )) : <Empty text={loading ? t('common.loading') : t('market.empty')} />}
      </Section>

      {sales.length ? (
        <Section title={t('market.sales')}>
          {sales.map((r, i) => <ListingRow key={r.listing_id} r={r} last={i === sales.length - 1} onPress={() => open(r)} />)}
        </Section>
      ) : null}
      <ErrorText error={error} />

      <ActionSheet
        visible={!!picked}
        onClose={() => setPicked(null)}
        title={picked?.rider_name ?? ''}
        onTitlePress={picked ? () => router.push(`/rider/${picked.rider_id}`) : undefined}
        subtitle={!picked ? undefined : picked.is_mine
          ? `${t('market.yourSale')} · ${t('market.closes', { when: dateTime(picked.closes_at) })} · ${bids(picked.bid_count)}`
            + '\n' + (picked.game_offer_amount ? t('market.gameOffersYou', { amount: money(picked.game_offer_amount) })
               : t('market.gameWillOffer'))
          : `${t('market.yourBid', { amount: money(picked.my_bid) })} · ${t('market.totalBids', { n: picked.bid_count })}`}
        actions={picked ? actions(picked) : []}
        onDone={done}
      />
      <AmountSheet
        visible={!!bidding}
        onClose={() => setBidding(null)}
        title={bidding ? t('market.bidFor', { name: bidding.rider_name }) : ''}
        onTitlePress={bidding ? () => router.push(`/rider/${bidding.rider_id}`) : undefined}
        chips={bidding ? [
          ...(bidding.pro_team ? [{ icon: 'shirt-outline' as const, text: bidding.pro_team }] : []),
          ...(bidding.seller_team ? [{ icon: 'person-outline' as const, text: bidding.seller_team }] : []),
          { icon: 'podium-outline' as const, text: points(bidding.season_points) },
          { icon: 'time-outline' as const, text: countdown(bidding.closes_at) },
        ] : undefined}
        min={bidding?.base_value}
        initial={bidding?.my_bid ?? bidding?.base_value}
        confirmLabel={t('market.bid')}
        quick={false}
        onConfirm={(amount) => api.placeBid(bidding!.listing_id, amount)}
        done={(amount) => t('toast.bid', { name: bidding!.rider_name, amount: money(amount) })}
        onDone={done}
      />
    </Screen>
  );
}

const TREND = {
  1: { icon: 'arrow-up', color: colors.green },
  0: { icon: 'remove', color: colors.inkSoft },
  [-1]: { icon: 'arrow-down', color: colors.red },
} as const;

const bids = (n: number) => t(n === 1 ? 'market.bids.one' : 'market.bids.other', { n });

function ListingRow({ r, last, onPress }: { r: MarketRow; last: boolean; onPress: () => void }) {
  const status = r.is_mine
    ? (r.game_offer_amount ? t('squad.gameOffers', { amount: moneyShort(r.game_offer_amount) }) : bids(r.bid_count))
    : r.my_bid ? t('market.yourBid', { amount: moneyShort(r.my_bid) }) : bids(r.bid_count);
  const who = r.seller_member_id ? (r.is_mine ? t('market.yourSaleShort') : t('market.from', { team: r.seller_team ?? '' })) : null;
  return (
    <RiderRow
      name={r.rider_name}
      team={r.pro_team}
      photo={r.photo_url}
      nationality={r.nationality}
      // segunda línea: los puntos de la temporada en un recuadro y, después, equipo y datos de la venta
      sub={(
        <View style={styles.sub}>
          <View style={styles.pts}><Txt style={styles.ptsText}>{points(r.season_points)}</Txt></View>
          <Txt variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>
            {[r.pro_team, who, r.seller_member_id ? t('market.closes', { when: countdown(r.closes_at) }) : null].filter(Boolean).join(' · ')}
          </Txt>
        </View>
      )}
      value={r.base_value}
      last={last}
      onPress={onPress}
      right={
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {/* tendencia del valor en la última semana: sube, estable o baja */}
            <Ionicons name={TREND[r.trend ?? 0].icon} size={16} color={TREND[r.trend ?? 0].color}
                      accessibilityLabel={TREND[r.trend ?? 0].icon} />
            <Txt variant="number">{moneyShort(r.base_value)}</Txt>
          </View>
          <Txt variant="small" style={r.my_bid || (r.is_mine && r.game_offer_amount) ? { color: colors.green } : undefined}>
            {status}
          </Txt>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  pts: { backgroundColor: colors.road, borderRadius: 6, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 6, paddingVertical: 1 },
  ptsText: { fontFamily: fonts.bodyBold, fontSize: type.small - 1, color: colors.ink },
});
