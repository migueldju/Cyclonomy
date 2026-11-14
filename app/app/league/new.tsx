import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CountryPicker } from '@/components/CountryPicker';
import { InfoButton } from '@/components/Info';
import { Input } from '@/components/Inputs';
import { currentMarketHour, DEFAULT_SETTINGS, LeagueSettingsForm } from '@/components/LeagueSettingsForm';
import { Screen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { showToast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { SignOutButton } from '@/components/SignOutButton';
import { useLeague } from '@/context/LeagueContext';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { resetTo } from '@/lib/nav';
import { cardShadow, colors, space } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CrearLiga() {
  const insets = useSafeAreaInsets();
  const { selectLeague } = useLeague();
  const [team, setTeam] = useState('');
  const [country, setCountry] = useState<string | null>(null);

  return (
    <Screen padded>
      <View style={[styles.wrap, { paddingTop: insets.top + space.s }]}>
      <View style={[styles.card, styles.head]}>
        <Txt variant="display" style={{ flex: 1 }}>{t('create.title')}</Txt>
        <InfoButton compact title={t('create.title')}
                    items={[t('create.note'), `${t('country.label')}: ${t('country.permanent')}`,
                            `${t('scoring.title')}: ${t('scoring.fixed')}`, t('scoring.cyclonomyHint'), t('scoring.uciHint'),
                            t('scoring.splitHint'), `${t('settings.clauses')}: ${t('settings.clausesHint')}`]} />
      </View>
      <View style={styles.card}>
      <LeagueSettingsForm
        initial={{ ...DEFAULT_SETTINGS, market_hour: currentMarketHour() }}
        initialName=""
        submitLabel={t('create.submit')}
        creating
        onSubmit={async (name, s) => {
          if (!team.trim()) throw new Error(t('team.nameRequired'));
          if (!country) throw new Error(t('team.countryRequired'));
          const id = await api.createLeague(name, team.trim(), s, country);
          showToast(t('toast.leagueCreated'));
          await selectLeague(id);
          resetTo('/');
        }}>
        <View>
          <Input label={t('team.yourTeamName')} value={team} onChangeText={setTeam} maxLength={40} />
          <CountryPicker value={country} onChange={setCountry} hint={false} />
        </View>
      </LeagueSettingsForm>
      </View>
      <Button kind="quiet" label={t('common.back')} onPress={() => resetTo('/leagues')} style={{ marginTop: space.m }} />
      <SignOutButton />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  card: { backgroundColor: colors.paper, borderRadius: 20, padding: space.l, ...cardShadow },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.m, marginBottom: space.l },
});
