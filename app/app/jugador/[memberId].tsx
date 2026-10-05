import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Flag } from '@/components/Flag';
import { ActionSheet, AmountSheet } from '@/components/Modal';
import { RiderRow, riderStatusNote } from '@/components/RiderRow';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { money, moneyShort, ordinal, points } from '@/lib/format';
import type { RosterRow } from '@/lib/types';
import { colors, fonts, space, type } from '@/theme';

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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, paddingTop: space.xl }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <Txt variant="hero" style={{ flexShrink: 1 }}>{player?.team_name ?? ''}</Txt>
            <Flag code={player?.country} height={16} />
          </View>
          <Txt variant="small">
            {player ? `${ordinal(player.pos)} · ${points(player.points_total)} · ${t('standings.squadValue', { amount: moneyShort(player.team_value) })}` : ''}
          </Txt>
        </View>
        {/* escudo del equipo: la imagen del perfil del jugador; si no tiene, su inicial */}
        {player ? (player.avatar_url ? (
          <Image source={{ uri: player.avatar_url }} style={styles.crest} accessibilityLabel={t('player.crest', { team: player.team_name })} />
        ) : (
          <View style={[styles.crest, styles.crestEmpty]}>
            <Txt style={styles.crestInitial}>{player.team_name.trim().slice(0, 1).toUpperCase()}</Txt>
          </View>
        )) : null}
      </View>
      <Section>
        {rows.length ? rows.map((r, i) => (
          <RiderRow key={r.ownership_id} name={r.rider_name} team={r.pro_team} status={r.status}
                    photo={r.photo_url} nationality={r.nationality}
                    note={riderStatusNote(r.status)} value={r.market_value}
                    detail={t('squad.clause', { amount: moneyShort(r.clause) })} onPress={() => setPicked(r)} last={i === rows.length - 1} />
        )) : <Empty text={roster.loading ? t('common.loading') : t('player.noRiders')} />}
      </Section>
      <ErrorText error={roster.error} />

      <ActionSheet
        visible={!!picked}
        onClose={() => setPicked(null)}
        title={picked?.rider_name ?? ''}
        subtitle={picked ? (picked.transferable
          ? t('player.riderSubtitle', { value: money(picked.market_value), clause: money(picked.clause), points: points(picked.season_points) })
          : t('player.pendingTransfer')) : undefined}
        actions={picked?.transferable ? [
          { label: t('player.payClause', { amount: moneyShort(picked.clause) }), kind: 'primary',
            hint: t('player.payClauseHint'),
            onPress: () => api.payClause(picked.ownership_id) },
          { label: t('player.makeOffer'), hint: t('player.makeOfferHint'),
            onPress: () => { const p = picked; setTimeout(() => setOffering(p), 350); } },
        ] : []}
        onDone={done}
      />
      <AmountSheet
        visible={!!offering}
        onClose={() => setOffering(null)}
        title={offering ? t('player.offerFor', { name: offering.rider_name }) : ''}
        subtitle={offering ? `${t('rider.marketValue')}: ${money(offering.market_value)}` : undefined}
        initial={offering?.market_value}
        confirmLabel={t('player.sendOffer')}
        onConfirm={(amount) => api.makeOffer(offering!.ownership_id, amount)}
        onDone={done}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  crest: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.line },
  crestEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.asphaltSoft },
  crestInitial: { fontFamily: fonts.display, fontSize: type.display, color: colors.paper },
});
