import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ActionSheet, AmountSheet } from '@/components/Modal';
import { RiderRow, riderStatusNote } from '@/components/RiderRow';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { api } from '@/lib/api';
import { money, moneyShort, ordinal, points } from '@/lib/format';
import type { RosterRow } from '@/lib/types';
import { space } from '@/theme';

/** Plantilla de otro jugador: desde aquí se hacen ofertas y se pagan cláusulas */
export default function Jugador() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { leagueId, refresh } = useLeague();
  const id = leagueId ?? '';
  const roster = useLoader(() => api.roster(id, memberId), [id, memberId], !!leagueId);
  const standings = useLoader(() => api.standings(id), [id], !!leagueId);
  const [picked, setPicked] = useState<RosterRow | null>(null);
  const [offering, setOffering] = useState<RosterRow | null>(null);
  const player = standings.data?.find((s) => s.member_id === memberId);
  const rows = roster.data ?? [];
  const done = () => { roster.reload(); refresh(); };

  return (
    <Screen onRefresh={roster.reload} refreshing={roster.loading}>
      <View style={{ padding: space.l, paddingTop: space.xl }}>
        <Txt variant="hero">{player?.team_name ?? ''}</Txt>
        <Txt variant="small">
          {player ? `${ordinal(player.pos)} · ${points(player.points_total)} · plantilla ${moneyShort(player.team_value)}` : ''}
        </Txt>
      </View>
      <Section>
        {rows.length ? rows.map((r, i) => (
          <RiderRow key={r.ownership_id} name={r.rider_name} team={r.pro_team} status={r.status}
                    note={riderStatusNote(r.status)} value={r.market_value}
                    detail={`cláusula ${moneyShort(r.clause)}`} onPress={() => setPicked(r)} last={i === rows.length - 1} />
        )) : <Empty text={roster.loading ? 'Cargando…' : 'Este jugador no tiene ciclistas.'} />}
      </Section>
      <ErrorText error={roster.error} />

      <ActionSheet
        visible={!!picked}
        onClose={() => setPicked(null)}
        title={picked?.rider_name ?? ''}
        subtitle={picked ? (picked.transferable
          ? `Valor ${money(picked.market_value)} · cláusula ${money(picked.clause)} · ${points(picked.season_points)} esta temporada`
          : 'Este ciclista tiene un traspaso pendiente hasta el lunes: no se puede ofertar ni pagar su cláusula.') : undefined}
        actions={picked?.transferable ? [
          { label: `Pagar la cláusula: ${moneyShort(picked.clause)}`, kind: 'primary',
            hint: 'El dinero va a su dueño. El ciclista pasa a tu plantilla el lunes a las 00:00; si ya estaba inscrito en una carrera, sigue puntuando para su dueño en ella.',
            onPress: () => api.payClause(picked.ownership_id) },
          { label: 'Hacer una oferta', hint: 'Su dueño tiene 48 horas para aceptarla o rechazarla.',
            onPress: () => { const p = picked; setTimeout(() => setOffering(p), 350); } },
        ] : []}
        onDone={done}
      />
      <AmountSheet
        visible={!!offering}
        onClose={() => setOffering(null)}
        title={offering ? `Oferta por ${offering.rider_name}` : ''}
        subtitle={offering ? `Valor de mercado: ${money(offering.market_value)}` : undefined}
        initial={offering?.market_value}
        confirmLabel="Enviar oferta"
        onConfirm={(amount) => api.makeOffer(offering!.ownership_id, amount)}
        onDone={done}
      />
    </Screen>
  );
}
