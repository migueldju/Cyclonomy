import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Row, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { api } from '@/lib/api';
import { dayMonth, points } from '@/lib/format';
import { colors, space } from '@/theme';

/** Puntuaciones de una etapa (o clásica): por jugador de la liga y por ciclista */
export default function Etapa() {
  const { stageId } = useLocalSearchParams<{ stageId: string }>();
  const { leagueId } = useLeague();
  const id = leagueId ?? '';
  const { data, error, loading, reload } = useLoader(() => api.stageScores(id, Number(stageId)), [id, stageId], !!leagueId);
  const st = data?.stage;
  const pending = st && st.status !== 'scored';

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <View style={{ padding: space.l, paddingTop: space.xl }}>
        <Txt variant="hero">{st?.race_name ?? ''}</Txt>
        <Txt variant="small">
          {st ? `${st.is_stage_race ? (st.number === 0 ? 'Prólogo' : `Etapa ${st.number}`) : 'Clásica'} · ${dayMonth(st.date)}` : ''}
        </Txt>
      </View>
      <ErrorText error={error} />
      {pending ? <Txt style={{ paddingHorizontal: space.l }}>Aún no hay puntos: se calculan cuando PCS publica la clasificación.</Txt> : null}

      <Section title="Jugadores">
        {data?.members.length ? data.members.map((m, i) => (
          <Row key={m.member_id} last={i === data.members.length - 1}>
            <Txt variant="number" style={{ width: 36 }}>{i + 1}.º</Txt>
            <Txt style={{ flex: 1 }} numberOfLines={1}>{m.team_name}</Txt>
            <Txt variant="number">{points(m.points)}</Txt>
          </Row>
        )) : <Empty text={loading ? 'Cargando…' : 'Ningún jugador de la liga ha puntuado en esta etapa.'} />}
      </Section>

      <Section title="Ciclistas que puntúan">
        {data?.riders.length ? data.riders.map((r, i) => (
          <Row key={r.rider_id} last={i === data.riders.length - 1}>
            <View style={{ flex: 1 }}>
              <Txt variant="lead" numberOfLines={1}>{r.name}</Txt>
              <Txt variant="small" style={r.entered_by_me ? { color: colors.green } : undefined}>
                {r.entered_by_me ? 'Inscrito por ti' : r.owner ? `De ${r.owner}` : 'Sin dueño en la liga'}
              </Txt>
            </View>
            <Txt variant="number">{points(r.points)}</Txt>
          </Row>
        )) : <Empty text={loading ? 'Cargando…' : 'Todavía no hay resultados.'} />}
      </Section>
    </Screen>
  );
}
