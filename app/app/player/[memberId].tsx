import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { HeroCard, StatTile, StatTiles } from '@/components/Hero';
import { InfoButton } from '@/components/Info';
import { Flag } from '@/components/Flag';
import { ActionSheet, AmountSheet } from '@/components/Modal';
import { RiderRow, riderStatusNote } from '@/components/RiderRow';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { ValueChart } from '@/components/ValueChart';
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
  const [chart, setChart] = useState(false);          // gráfica del valor, al tocar su baldosa
  useEffect(() => { setChart(false); }, [picked?.ownership_id]);
  const player = standings.data?.find((s) => s.member_id === memberId);
  const rows = roster.data ?? [];
  const done = () => { roster.reload(); refresh(); };

  return (
    <Screen onRefresh={roster.reload} refreshing={roster.loading}>
      <HeroCard style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <Txt variant="display" style={{ flexShrink: 1 }}>{player?.team_name ?? ''}</Txt>
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
      </HeroCard>
      <Section style={{ marginTop: space.l }}>
        {rows.length ? rows.map((r, i) => (
          <RiderRow key={r.ownership_id} name={r.rider_name} team={r.pro_team} status={r.status}
                    photo={r.photo_url} nationality={r.nationality}
                    note={[riderStatusNote(r.status), r.locked_next ? t('squad.lockedNext') : null].filter(Boolean).join(' · ') || undefined}
                    value={r.market_value}
                    detail={t('squad.clause', { amount: moneyShort(r.clause) })} onPress={() => setPicked(r)} last={i === rows.length - 1} />
        )) : <Empty text={roster.loading ? t('common.loading') : t('player.noRiders')} />}
      </Section>
      <ErrorText error={roster.error} />

      <ActionSheet
        visible={!!picked}
        onClose={() => setPicked(null)}
        title={picked?.rider_name ?? ''}
        // sin frases: las cifras en baldosas, las acciones con icono y la explicación en «Cómo funciona»
        subtitle={picked ? (picked.transferable ? (picked.locked_next ? t('player.lockedClause') : undefined)
          : t('player.pendingTransfer')) : undefined}
        header={picked ? (
          <StatTiles style={{ marginBottom: space.m }}>
            {chart ? <View style={styles.chart}><ValueHistory leagueId={id} riderId={picked.rider_id} /></View> : null}
            <StatTile label={t('rider.marketValue')} value={moneyShort(picked.market_value)} icon="trending-up-outline"
                      onPress={() => setChart((c) => !c)} open={chart} />
            <StatTile label={t('rider.clause')} value={moneyShort(picked.clause)}
                      icon={picked.locked_next ? 'lock-closed-outline' : 'flash-outline'} />
            <StatTile wide label={t('rider.seasonPoints')} value={points(picked.season_points)} icon="podium-outline" />
          </StatTiles>
        ) : null}
        actions={picked?.transferable ? [
          { icon: 'flash-outline' as const, kind: 'primary' as const, label: t('player.payClause', { amount: moneyShort(picked.clause) }),
            onPress: () => api.payClause(picked.ownership_id),
            done: t(picked.locked_next ? 'toast.clausePaidLater' : 'toast.clausePaid', { name: picked.rider_name }) },
          { icon: 'pricetag-outline' as const, label: t('player.makeOffer'),
            onPress: () => { const p = picked; setTimeout(() => setOffering(p), 350); } },
        ] : []}
        footer={picked?.transferable ? (
          <InfoButton title={picked.rider_name} items={[t('player.payClauseHint'), t('player.makeOfferHint'), t('rules.r7')]} />
        ) : undefined}
        onDone={done}
      />
      <AmountSheet
        visible={!!offering}
        onClose={() => setOffering(null)}
        title={offering ? t('player.offerFor', { name: offering.rider_name }) : ''}
        chips={offering ? [{ icon: 'trending-up-outline' as const, text: money(offering.market_value) },
                           { icon: 'time-outline' as const, text: '48 h' }] : undefined}
        initial={offering?.market_value}
        confirmLabel={t('player.sendOffer')}
        onConfirm={(amount) => api.makeOffer(offering!.ownership_id, amount)}
        done={(amount) => t('toast.offerSent', { name: offering!.rider_name, amount: money(amount) })}
        onDone={done}
      />
    </Screen>
  );
}

/** Evolución del valor de un ciclista (se pide al abrirla) */
function ValueHistory({ leagueId, riderId }: { leagueId: string; riderId: number }) {
  const detail = useLoader(() => api.rider(leagueId, riderId), [leagueId, riderId]);
  if (detail.error) return <ErrorText error={detail.error} />;
  if (!detail.data) return <Txt variant="small" style={{ padding: space.l }}>{t('common.loading')}</Txt>;
  return <ValueChart points={detail.data.values} />;
}

const styles = StyleSheet.create({
  chart: { flexBasis: '100%', minHeight: 150, borderWidth: 1, borderColor: colors.line, borderRadius: 14, overflow: 'hidden' },
  crest: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.line },
  crestEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.asphaltSoft },
  crestInitial: { fontFamily: fonts.display, fontSize: type.display, color: colors.paper },
});
