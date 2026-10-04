import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActionSheet, AmountSheet } from '@/components/Modal';
import { RiderRow } from '@/components/RiderRow';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { api } from '@/lib/api';
import { countdown, money, moneyShort, time } from '@/lib/format';
import type { MarketRow } from '@/lib/types';
import { colors, space } from '@/theme';

export default function Mercado() {
  const { leagueId, me, refresh } = useLeague();
  const id = leagueId ?? '';
  const { data, error, loading, reload } = useLoader(() => api.market(id), [id], !!leagueId);
  const [picked, setPicked] = useState<MarketRow | null>(null);
  const [bidding, setBidding] = useState<MarketRow | null>(null);

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <View style={styles.head}>
        <View>
          <Txt variant="small">Cierre de pujas y ciclistas nuevos</Txt>
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

      <Section>
        {data?.length ? data.map((r, i) => (
          <RiderRow
            key={r.listing_id}
            name={r.rider_name}
            team={r.pro_team}
            note={[r.age ? `${r.age} años` : null, `${r.season_points} pts`].filter(Boolean).join(' · ')}
            value={r.base_value}
            last={i === data.length - 1}
            onPress={() => (r.my_bid ? setPicked(r) : setBidding(r))}
            right={
              <View style={{ alignItems: 'flex-end' }}>
                <Txt variant="number">{moneyShort(r.base_value)}</Txt>
                <Txt variant="small" style={r.my_bid ? { color: colors.green } : undefined}>
                  {r.my_bid ? `Tu puja: ${moneyShort(r.my_bid)}` : `${r.bid_count} ${r.bid_count === 1 ? 'puja' : 'pujas'}`}
                </Txt>
              </View>
            }
          />
        )) : <Empty text={loading ? 'Cargando…' : 'No hay ciclistas en el mercado. Salen nuevos en la próxima actualización.'} />}
      </Section>
      <ErrorText error={error} />

      <ActionSheet
        visible={!!picked}
        onClose={() => setPicked(null)}
        title={picked?.rider_name ?? ''}
        subtitle={picked ? `Tu puja: ${money(picked.my_bid)} · ${picked.bid_count} pujas en total` : undefined}
        actions={picked ? [
          { label: 'Cambiar la puja', kind: 'primary', onPress: () => { const p = picked; setTimeout(() => setBidding(p), 350); } },
          { label: 'Retirar la puja', kind: 'danger', onPress: () => api.cancelBid(picked.listing_id) },
        ] : []}
        onDone={() => { reload(); refresh(); }}
      />
      <AmountSheet
        visible={!!bidding}
        onClose={() => setBidding(null)}
        title={bidding ? `Pujar por ${bidding.rider_name}` : ''}
        subtitle={bidding ? `${bidding.pro_team ?? ''} · cierra ${countdown(bidding.closes_at)}` : undefined}
        min={bidding?.base_value}
        initial={bidding?.my_bid ?? bidding?.base_value}
        confirmLabel="Pujar"
        onConfirm={(amount) => api.placeBid(bidding!.listing_id, amount)}
        onDone={() => { reload(); refresh(); }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', padding: space.l, paddingTop: space.xl },
  note: { paddingHorizontal: space.l },
});
