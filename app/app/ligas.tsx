import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { CountryPicker } from '@/components/CountryPicker';
import { Input } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Row, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { api } from '@/lib/api';
import { resetTo } from '@/lib/nav';
import { space } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Ligas() {
  const insets = useSafeAreaInsets();
  const { leagueId, selectLeague } = useLeague();
  const { data, error, loading, reload } = useLoader(() => api.myLeagues());
  const [code, setCode] = useState('');
  const [team, setTeam] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function open(id: string) {
    await selectLeague(id);
    resetTo('/');
  }

  async function join() {
    setBusy(true);
    setJoinError(null);
    try {
      const id = await api.joinLeague(code.trim(), team.trim(), country!);
      await open(id);
    } catch (e) {
      setJoinError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <Txt variant="hero" style={{ marginTop: insets.top + space.xl, paddingHorizontal: space.l }}>Mis ligas</Txt>
      <Section>
        {data?.length ? data.map((l, i) => (
          <Row key={l.league_id} onPress={() => open(l.league_id)} last={i === data.length - 1}>
            <View style={{ flex: 1 }}>
              <Txt variant="lead">{l.name}</Txt>
              <Txt variant="small">
                {l.team_name} · {l.members} {l.members === 1 ? 'jugador' : 'jugadores'}{l.is_admin ? ' · administras esta liga' : ''}
              </Txt>
            </View>
            {l.league_id === leagueId ? <Txt variant="label">Abierta</Txt> : null}
          </Row>
        )) : <Empty text={loading ? 'Cargando…' : 'Todavía no estás en ninguna liga. Crea una o únete con un código.'} />}
      </Section>
      <ErrorText error={error} />

      <View style={{ padding: space.l }}>
        <Button label="Crear una liga" onPress={() => router.push('/liga/crear')} />
      </View>

      <Section title="Unirme con un código">
        <View style={{ padding: space.l }}>
          <Input label="Código de invitación" value={code} onChangeText={(t) => setCode(t.toUpperCase())}
                 autoCapitalize="characters" maxLength={6} />
          <Input label="Nombre de tu equipo" value={team} onChangeText={setTeam} maxLength={40} />
          <CountryPicker value={country} onChange={setCountry} />
          <ErrorText error={joinError} />
          <Button label="Unirme" kind="secondary" onPress={join} busy={busy}
                  disabled={code.length < 6 || !team.trim() || !country} />
        </View>
      </Section>
      <View style={{ padding: space.l }}>
        <Button label="Mi perfil" kind="quiet" onPress={() => router.push('/perfil')} />
      </View>
    </Screen>
  );
}
