import { useState } from 'react';
import { HeroCard } from '@/components/Hero';
import { Chips } from '@/components/Chips';
import { MoveRow } from '@/components/MoveRow';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, ListSection } from '@/components/Section';
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
      <HeroCard style={{ gap: space.m }}>
        <Txt variant="display">{t('moves.title')}</Txt>
        <Chips label={t('moves.player')} items={chips} value={player} onChange={setPlayer} />
      </HeroCard>
      <ListSection style={{ marginTop: space.l }} items={moves.data ?? []}
                   empty={<Empty text={moves.loading ? t('common.loading') : t('moves.empty')} />}
                   render={(m, last) => <MoveRow key={m.id} m={m} last={last} myId={me?.member_id} />} />
      <ErrorText error={moves.error ?? members.error} />
    </Screen>
  );
}
