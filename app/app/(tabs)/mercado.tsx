import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActionSheet, AmountSheet, SheetAction } from '@/components/Modal';
import { RiderRow } from '@/components/RiderRow';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
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
        out.push({ label: `Vender al juego por ${moneyShort(r.game_offer_amount)}`, kind: 'primary',
                   hint: 'El ciclista queda libre al momento y la venta se cierra.',
                   onPress: () => api.acceptGameOffer(r.game_offer_id!) });
      }
      out.push({ label: 'Quitar de la venta', kind: 'danger', hint: 'Sale del mercado y se anulan las pujas.',
                 onPress: () => api.setForSale(r.seller_ownership_id!, false) });
      return out;
    }
    return [
      { label: 'Cambiar la puja', kind: 'primary', onPress: () => { setTimeout(() => setBidding(r), 350); } },
      { label: 'Retirar la puja', kind: 'danger', onPress: () => api.cancelBid(r.listing_id) },
    ];
  }

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <View style={styles.head}>
        <View>
          <Txt variant="small">Cierre del mercado diario y ciclistas nuevos</Txt>
          <Txt variant="title">{countdown(me?.next_market_at ?? null)} · {time(me?.next_market_at ?? null)}</Txt>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt variant="small">Puedes gastar</Txt>
          <Txt variant="title" style={{ color: (me?.available ?? 0) >= 0 ? colors.green : colors.red }}>
            {moneyShort(me?.available)}
          </Txt>
        </View>
      </View>
      <Txt variant="small" style={styles.note}>
        Puja a ciegas: nadie ve tu cantidad. Gana la más alta; si empatan, la que se hizo antes. Los fichajes se pueden
        inscribir desde el lunes siguiente.
      </Txt>

      <Section title="Mercado del día">
        {free.length ? free.map((r, i) => (
          <ListingRow key={r.listing_id} r={r} last={i === free.length - 1} onPress={() => open(r)} />
        )) : <Empty text={loading ? 'Cargando…' : 'No hay ciclistas en el mercado. Salen nuevos en la próxima actualización.'} />}
      </Section>

      {sales.length ? (
        <Section title="Ventas de los jugadores">
          {sales.map((r, i) => <ListingRow key={r.listing_id} r={r} last={i === sales.length - 1} onPress={() => open(r)} />)}
        </Section>
      ) : null}
      <ErrorText error={error} />

      <ActionSheet
        visible={!!picked}
        onClose={() => setPicked(null)}
        title={picked?.rider_name ?? ''}
        subtitle={!picked ? undefined : picked.is_mine
          ? `Tu venta · cierra ${dateTime(picked.closes_at)} · ${picked.bid_count} ${picked.bid_count === 1 ? 'puja' : 'pujas'}`
            + (picked.game_offer_amount ? `\nEl juego te ofrece ${money(picked.game_offer_amount)} hasta el cierre.`
               : '\nEl juego te hará una oferta 12 horas antes del cierre.')
          : `Tu puja: ${money(picked.my_bid)} · ${picked.bid_count} pujas en total`}
        actions={picked ? actions(picked) : []}
        onDone={done}
      />
      <AmountSheet
        visible={!!bidding}
        onClose={() => setBidding(null)}
        title={bidding ? `Pujar por ${bidding.rider_name}` : ''}
        subtitle={bidding ? [bidding.pro_team, bidding.seller_team ? `lo vende ${bidding.seller_team}` : null,
                             `cierra ${countdown(bidding.closes_at)}`].filter(Boolean).join(' · ') : undefined}
        min={bidding?.base_value}
        initial={bidding?.my_bid ?? bidding?.base_value}
        confirmLabel="Pujar"
        onConfirm={(amount) => api.placeBid(bidding!.listing_id, amount)}
        onDone={done}
      />
    </Screen>
  );
}

function ListingRow({ r, last, onPress }: { r: MarketRow; last: boolean; onPress: () => void }) {
  const status = r.is_mine
    ? (r.game_offer_amount ? `el juego ofrece ${moneyShort(r.game_offer_amount)}` : `${r.bid_count} ${r.bid_count === 1 ? 'puja' : 'pujas'}`)
    : r.my_bid ? `Tu puja: ${moneyShort(r.my_bid)}` : `${r.bid_count} ${r.bid_count === 1 ? 'puja' : 'pujas'}`;
  const who = r.seller_member_id ? (r.is_mine ? 'tu venta' : `de ${r.seller_team}`) : null;
  return (
    <RiderRow
      name={r.rider_name}
      team={r.pro_team}
      photo={r.photo_url}
      nationality={r.nationality}
      note={[who, r.seller_member_id ? `cierra ${countdown(r.closes_at)}` : null,
             !r.seller_member_id && r.age ? `${r.age} años` : null].filter(Boolean).join(' · ')}
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
