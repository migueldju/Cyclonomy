import { useState } from 'react';
import { View } from 'react-native';
import { CountryPicker } from '@/components/CountryPicker';
import { Input } from '@/components/Inputs';
import { DEFAULT_SETTINGS, LeagueSettingsForm } from '@/components/LeagueSettingsForm';
import { Screen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { resetTo } from '@/lib/nav';
import { space } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CrearLiga() {
  const insets = useSafeAreaInsets();
  const { selectLeague } = useLeague();
  const [team, setTeam] = useState('');
  const [country, setCountry] = useState<string | null>(null);

  return (
    <Screen padded>
      <Txt variant="hero" style={{ marginTop: insets.top + space.l }}>{t('create.title')}</Txt>
      <Txt variant="small" style={{ marginBottom: space.xl }}>
        {t('create.note')}
      </Txt>
      <LeagueSettingsForm
        initial={DEFAULT_SETTINGS}
        initialName=""
        submitLabel={t('create.submit')}
        onSubmit={async (name, s) => {
          if (!team.trim()) throw new Error(t('team.nameRequired'));
          if (!country) throw new Error(t('team.countryRequired'));
          const id = await api.createLeague(name, team.trim(), s, country);
          await selectLeague(id);
          resetTo('/');
        }}>
        <View>
          <Input label={t('team.yourTeamName')} value={team} onChangeText={setTeam} maxLength={40} />
          <CountryPicker value={country} onChange={setCountry} />
        </View>
      </LeagueSettingsForm>
    </Screen>
  );
}
