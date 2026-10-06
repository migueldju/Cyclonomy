import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { CountryPicker } from '@/components/CountryPicker';
import { Input } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { resetTo } from '@/lib/nav';
import { space } from '@/theme';

/** Se abre con el enlace de invitación: cyclonomy://unirse/ABC123 */
export default function Unirse() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useAuth();
  const { selectLeague, setPendingInvite } = useLeague();
  const [team, setTeam] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = String(code ?? '').toUpperCase();

  useEffect(() => { if (!session && clean) setPendingInvite(clean); }, [session, clean, setPendingInvite]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const id = await api.joinLeague(clean, team.trim(), country!);
      setPendingInvite(null);
      await selectLeague(id);
      resetTo('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen padded>
      <Txt variant="hero" style={{ marginTop: space.xxl * 2 }}>{t('join.title')}</Txt>
      <Txt style={{ marginVertical: space.l }}>{t('join.code', { code: clean })}</Txt>
      {session ? (
        <>
          <Input label={t('team.yourTeamName')} value={team} onChangeText={setTeam} maxLength={40} />
          <CountryPicker value={country} onChange={setCountry} />
          <ErrorText error={error} />
          <Button label={t('join.submit')} onPress={join} busy={busy} disabled={!team.trim() || !country} />
          <Txt variant="small" style={{ marginTop: space.m }}>
            {t('join.start')}
          </Txt>
        </>
      ) : (
        <>
          <Txt variant="small" style={{ marginBottom: space.l }}>{t('join.signInFirst')}</Txt>
          <Button label={t('join.signIn')} onPress={() => router.replace('/login')} />
        </>
      )}
    </Screen>
  );
}
