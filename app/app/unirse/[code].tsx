import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { api } from '@/lib/api';
import { resetTo } from '@/lib/nav';
import { space } from '@/theme';

/** Se abre con el enlace de invitación: cyclonomy://unirse/ABC123 */
export default function Unirse() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useAuth();
  const { selectLeague, setPendingInvite } = useLeague();
  const [team, setTeam] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = String(code ?? '').toUpperCase();

  useEffect(() => { if (!session && clean) setPendingInvite(clean); }, [session, clean, setPendingInvite]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const id = await api.joinLeague(clean, team.trim());
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
      <Txt variant="hero" style={{ marginTop: space.xxl * 2 }}>Te han invitado a una liga</Txt>
      <Txt style={{ marginVertical: space.l }}>Código de invitación: {clean}</Txt>
      {session ? (
        <>
          <Input label="Nombre de tu equipo" value={team} onChangeText={setTeam} maxLength={40} />
          <ErrorText error={error} />
          <Button label="Unirme a la liga" onPress={join} busy={busy} disabled={!team.trim()} />
          <Txt variant="small" style={{ marginTop: space.m }}>
            Empezarás con 8.000.000 € y 16 ciclistas al azar.
          </Txt>
        </>
      ) : (
        <>
          <Txt variant="small" style={{ marginBottom: space.l }}>Inicia sesión o crea una cuenta para unirte.</Txt>
          <Button label="Iniciar sesión" onPress={() => router.replace('/login')} />
        </>
      )}
    </Screen>
  );
}
