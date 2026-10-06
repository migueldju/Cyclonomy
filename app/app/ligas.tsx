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
import { t } from '@/i18n';
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
      <Txt variant="hero" style={{ marginTop: insets.top + space.xl, paddingHorizontal: space.l }}>{t('leagues.title')}</Txt>
      <Section>
        {data?.length ? data.map((l, i) => (
          <Row key={l.league_id} onPress={() => open(l.league_id)} last={i === data.length - 1}>
            <View style={{ flex: 1 }}>
              <Txt variant="lead">{l.name}</Txt>
              <Txt variant="small">
                {l.team_name} · {t(l.members === 1 ? 'leagues.players.one' : 'leagues.players.other', { n: l.members })}
                {l.is_admin ? ` · ${t('leagues.admin')}` : ''}
              </Txt>
            </View>
            {l.league_id === leagueId ? <Txt variant="label">{t('leagues.open')}</Txt> : null}
          </Row>
        )) : <Empty text={loading ? t('common.loading') : t('leagues.empty')} />}
      </Section>
      <ErrorText error={error} />

      <View style={{ padding: space.l }}>
        <Button label={t('leagues.create')} onPress={() => router.push('/liga/crear')} />
      </View>

      <Section title={t('leagues.joinWithCode')}>
        <View style={{ padding: space.l }}>
          <Input label={t('leagues.inviteCode')} value={code} onChangeText={(t) => setCode(t.toUpperCase())}
                 autoCapitalize="characters" maxLength={6} />
          <Input label={t('team.yourTeamName')} value={team} onChangeText={setTeam} maxLength={40} />
          <CountryPicker value={country} onChange={setCountry} />
          <ErrorText error={joinError} />
          <Button label={t('leagues.join')} kind="secondary" onPress={join} busy={busy}
                  disabled={code.length < 6 || !team.trim() || !country} />
        </View>
      </Section>
      <View style={{ padding: space.l }}>
        <Button label={t('topbar.profile')} kind="quiet" onPress={() => router.push('/perfil')} />
      </View>
    </Screen>
  );
}
