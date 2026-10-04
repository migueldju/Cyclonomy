import { useState } from 'react';
import { View } from 'react-native';
import { Input } from '@/components/Inputs';
import { DEFAULT_SETTINGS, LeagueSettingsForm } from '@/components/LeagueSettingsForm';
import { Screen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { api } from '@/lib/api';
import { resetTo } from '@/lib/nav';
import { space } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CrearLiga() {
  const insets = useSafeAreaInsets();
  const { selectLeague } = useLeague();
  const [team, setTeam] = useState('');

  return (
    <Screen padded>
      <Txt variant="hero" style={{ marginTop: insets.top + space.l }}>Nueva liga</Txt>
      <Txt variant="small" style={{ marginBottom: space.xl }}>
        Podrás cambiar todos los parámetros más adelante desde la normativa de la liga.
      </Txt>
      <LeagueSettingsForm
        initial={DEFAULT_SETTINGS}
        initialName=""
        submitLabel="Crear liga"
        onSubmit={async (name, s) => {
          if (!team.trim()) throw new Error('Ponle nombre a tu equipo.');
          const id = await api.createLeague(name, team.trim(), s);
          await selectLeague(id);
          resetTo('/');
        }}>
        <View>
          <Input label="Nombre de tu equipo" value={team} onChangeText={setTeam} maxLength={40} />
        </View>
      </LeagueSettingsForm>
    </Screen>
  );
}
