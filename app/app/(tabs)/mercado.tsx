import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActionSheet, AmountSheet, SheetAction } from '@/components/Modal';
import { RiderRow } from '@/components/RiderRow';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { countdown, dateTime, money, moneyShort, time } from '@/lib/format';
import type { MarketRow } from '@/lib/types';
import { colors, space } from '@/theme';

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
        out.push({ label: t('actions.sellToGame', { amount: moneyShort(r.game_offer_amount) }), kind: 'primary',
                   hint: t('market.sellToGameHint'),
                   onPress: () => api.acceptGameOffer(r.game_offer_id!) });
      }
      out.push({ label: t('actions.unsell'), kind: 'danger', hint: t('actions.unsellHint'),
                 onPress: () => api.setForSale(r.seller_ownership_id!, false) });
      return out;
    }
    return [
      { label: t('market.changeBid'), kind: 'primary', onPress: () => { setTimeout(() => setBidding(r), 350); } },
      { label: t('market.cancelBid'), kind: 'danger', onPress: () => api.cancelBid(r.listing_id) },
    ];
  }

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <View style={styles.head}>
        <View>
          <Txt variant="small">{t('market.nextUpdate')}</Txt>
          <Txt variant="title">{countdown(me?.next_market_at ?? null)} · {time(me?.next_market_at ?? null)}</Txt>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt variant="small">{t('market.canSpend')}</Txt>
          <Txt variant="title" style={{ color: (me?.available ?? 0) >= 0 ? colors.green : colors.red }}>
            {moneyShort(me?.available)}
          </Txt>
        </View>
      </View>
      <Txt variant="small" style={styles.note}>
        {t('market.note')}
      </Txt>

      <Section title={t('market.daily')}>
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
        subtitle={bidding ? [bidding.pro_team, bidding.seller_team ? t('market.soldBy', { team: bidding.seller_team }) : null,
                             t('market.closes', { when: countdown(bidding.closes_at) })].filter(Boolean).join(' · ') : undefined}
        min={bidding?.base_value}
        initial={bidding?.my_bid ?? bidding?.base_value}
        confirmLabel={t('market.bid')}
        onConfirm={(amount) => api.placeBid(bidding!.listing_id, amount)}
        onDone={done}
      />
    </Screen>
  );
}

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
      note={[who, r.seller_member_id ? t('market.closes', { when: countdown(r.closes_at) }) : null,
             !r.seller_member_id && r.age ? t('rider.age', { n: r.age }) : null].filter(Boolean).join(' · ')}
      value={r.base_value}
      last={last}
      onPress={onPress}
      right={
        <View style={{ alignItems: 'flex-end' }}>
          <Txt variant="number">{moneyShort(r.base_value)}</Txt>
          <Txt variant="small" style={r.my_bid || (r.is_mine && r.game_offer_amount) ? { color: colors.green } : undefined}>
            {status}
          </Txt>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', padding: space.l, paddingTop: space.xl },
  note: { paddingHorizontal: space.l },
});
