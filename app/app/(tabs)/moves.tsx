import { useState } from 'react';
import { View } from 'react-native';
import { Chips } from '@/components/Chips';
import { MoveRow } from '@/components/MoveRow';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { space } from '@/theme';

/** Histórico de movimientos del mercado de la liga, filtrable por jugador. */
export default function Movimientos() {
  const { leagueId, me } = useLeague();
  const id = leagueId ?? '';
  const [player, setPlayer] = useState<string>('all');
  const members = useLoader(() => api.standings(id), [id], !!leagueId);
  const moves = useLoader(() => api.moves(id, player === 'all' ? null : player, 200), [id, player], !!leagueId);
  const chips: [string, string][] = [['all', t('moves.all')],
    ...(members.data ?? []).map((m) => [m.member_id, m.team_name] as [string, string])];

  return (
    <Screen onRefresh={moves.reload} refreshing={moves.loading}>
      <View style={{ padding: space.l, paddingTop: space.xl, gap: space.m }}>
        <Txt variant="hero">{t('moves.title')}</Txt>
        <Chips label={t('moves.player')} items={chips} value={player} onChange={setPlayer} />
      </View>
      <Section style={{ marginTop: 0 }}>
        {moves.data?.length ? moves.data.map((m, i) => (
          <MoveRow key={m.id} m={m} last={i === moves.data!.length - 1} myId={me?.member_id} />
        )) : <Empty text={moves.loading ? t('common.loading') : t('moves.empty')} />}
      </Section>
      <ErrorText error={moves.error ?? members.error} />
    </Screen>
  );
}
