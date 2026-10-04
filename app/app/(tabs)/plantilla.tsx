import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { ActionSheet, SheetAction } from '@/components/Modal';
import { RiderRow, riderStatusNote } from '@/components/RiderRow';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Row, Section } from '@/components/Section';
import { StatusDot } from '@/components/StatusDot';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { api } from '@/lib/api';
import { dateTime, money, moneyShort, points } from '@/lib/format';
import type { OfferRow, RosterRow } from '@/lib/types';
import { colors, space } from '@/theme';

export default function Plantilla() {
  const { leagueId, me, refresh } = useLeague();
  const id = leagueId ?? '';
  const roster = useLoader(() => api.roster(id), [id], !!leagueId);
  const offers = useLoader(() => api.offers(id), [id], !!leagueId);
  const [picked, setPicked] = useState<RosterRow | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const done = () => { roster.reload(); offers.reload(); refresh(); };

  const rows = roster.data ?? [];
  const totalPoints = rows.filter((r) => r.status !== 'leaving').reduce((a, r) => a + r.league_points, 0);

  async function respond(o: OfferRow, accept: boolean) {
    setOfferError(null);
    try {
      if (o.direction === 'received') await api.respondOffer(o.offer_id, accept);
      else await api.cancelOffer(o.offer_id);
      done();
    } catch (e) {
      setOfferError((e as Error).message);
    }
  }

  return (
    <Screen onRefresh={done} refreshing={roster.loading}>
      <View style={styles.summary}>
        <Stat label="Valor de la plantilla" value={moneyShort(me?.team_value)} />
        <Stat label="Puntos en la liga" value={points(totalPoints)} />
        <Stat label="Ciclistas" value={me ? `${me.roster_count}/${me.max_riders}` : '—'} />
        <Stat label="Saldo" value={moneyShort(me?.balance)} color={(me?.balance ?? 0) < 0 ? colors.red : colors.green} />
      </View>

      {offers.data?.length ? (
        <Section title="Ofertas">
          {offers.data.map((o, i) => (
            <Row key={o.offer_id} last={i === offers.data!.length - 1}>
              <View style={{ flex: 1 }}>
                <Txt variant="lead">{o.rider_name}</Txt>
                <Txt variant="small">
                  {o.direction === 'received' ? `${o.other_team} te ofrece` : `Ofreces a ${o.other_team}`} {money(o.amount)} ·
                  caduca {dateTime(o.expires_at)}
                </Txt>
              </View>
              {o.direction === 'received' ? (
                <View style={{ gap: space.xs }}>
                  <Button small label="Aceptar" onPress={() => respond(o, true)} />
                  <Button small kind="quiet" label="Rechazar" onPress={() => respond(o, false)} />
                </View>
              ) : <Button small kind="secondary" label="Retirar" onPress={() => respond(o, false)} />}
            </Row>
          ))}
        </Section>
      ) : null}
      <ErrorText error={offerError} />

      <View style={styles.legend}>
        <View style={styles.legendItem}><StatusDot status="incoming" /><Txt variant="small">Llega el lunes: aún no se puede inscribir</Txt></View>
        <View style={styles.legendItem}><StatusDot status="leaving" /><Txt variant="small">Se va el lunes por un traspaso</Txt></View>
      </View>

      <Section>
        {rows.length ? rows.map((r, i) => (
          <RiderRow
            key={r.ownership_id}
            name={r.rider_name}
            team={r.pro_team}
            status={r.status}
            note={[riderStatusNote(r.status), r.for_sale ? 'en venta' : null,
                   r.game_offer_amount ? `el juego ofrece ${moneyShort(r.game_offer_amount)}` : null].filter(Boolean).join(' · ')}
            value={r.market_value}
            detail={`${points(r.league_points)} · cláusula ${moneyShort(r.clause)}`}
            onPress={() => setPicked(r)}
            last={i === rows.length - 1}
          />
        )) : <Empty text={roster.loading ? 'Cargando…' : 'Tu plantilla está vacía.'} />}
      </Section>
      <ErrorText error={roster.error} />

      <ActionSheet
        visible={!!picked}
        onClose={() => setPicked(null)}
        title={picked?.rider_name ?? ''}
        subtitle={picked ? `Valor ${money(picked.market_value)} · pagaste ${money(picked.price_paid)} · cláusula ${money(picked.clause)}` +
          `\n${points(picked.season_points)} esta temporada` : undefined}
        actions={picked ? actionsFor(picked) : []}
        onDone={done}
      />
    </Screen>
  );
}

function actionsFor(r: RosterRow): SheetAction[] {
  if (!r.transferable) return [];               // le llega o se va el lunes: no se puede tocar
  const out: SheetAction[] = [];
  if (r.game_offer_id && r.game_offer_amount) {
    out.push({
      label: `Vender al juego por ${moneyShort(r.game_offer_amount)}`, kind: 'primary',
      hint: `La oferta caduca ${dateTime(r.game_offer_expires)}. El ciclista queda libre al momento.`,
      onPress: () => api.acceptGameOffer(r.game_offer_id!),
    });
  }
  if (r.next_clause > r.clause) {
    out.push({
      label: `Subir la cláusula a ${moneyShort(r.next_clause)}`,
      hint: `Cuesta ${money(r.next_clause_cost)}. Tope: el 300 % de lo que pagaste (${money(r.price_paid * 3)}).`,
      onPress: () => api.raiseClause(r.ownership_id),
    });
  }
  out.push(r.for_sale
    ? { label: 'Quitar de la venta', onPress: () => api.setForSale(r.ownership_id, false) }
    : { label: 'Poner a la venta', hint: 'En la próxima actualización del mercado el juego te ofrecerá su valor ±10 %.',
        onPress: () => api.setForSale(r.ownership_id, true) });
  return out;
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
