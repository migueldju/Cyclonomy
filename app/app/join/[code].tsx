import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button } from '@/components/Button';
import { CountryPicker } from '@/components/CountryPicker';
import { Features, HowItWorks } from '@/components/GameIntro';
import { HeroCard } from '@/components/Hero';
import { Input } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { SignOutButton } from '@/components/SignOutButton';
import { showToast } from '@/components/Toast';
import { Txt } from '@/components/Txt';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { resetTo } from '@/lib/nav';
import { colors, fonts, space, themed } from '@/theme';

/** Se abre con el enlace de invitación (cyclonomy.app/join/ABC123): el código, cómo entrar y en qué consiste el juego */
export default function Unirse() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useAuth();
  const { selectLeague, setPendingInvite } = useLeague();
  const { width } = useWindowDimensions();
  const [team, setTeam] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = String(code ?? '').toUpperCase();
  const columns = width >= 900 ? 3 : width >= 620 ? 2 : 1;
  // con sesión: si ya estoy en la liga de este código, no se ofrece unirse otra vez
  const [member, setMember] = useState<{ id: string; name: string; team: string } | null | undefined>(undefined);

  useEffect(() => {
    if (!session || !clean) { setMember(undefined); return; }
    let alive = true;
    (async () => {
      try {
        const lg = await api.myLeagueByCode(clean);
        const mine = lg ? (await api.myLeagues()).find((l) => l.league_id === lg.id) : null;
        if (alive) setMember(lg ? { id: lg.id, name: lg.name, team: mine?.team_name ?? '' } : null);
      } catch {
        if (alive) setMember(null);          // sin poder comprobarlo, se deja unirse (el servidor no duplica)
      }
    })();
    return () => { alive = false; };
  }, [session, clean]);

  async function goToLeague() {
    if (!member) return;
    setPendingInvite(null);
    await selectLeague(member.id);
    resetTo('/');
  }

  // sin sesión, el código se guarda: al entrar o crear la cuenta se vuelve aquí
  useEffect(() => { if (!session && clean) setPendingInvite(clean); }, [session, clean, setPendingInvite]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const id = await api.joinLeague(clean, team.trim(), country!);
      showToast(t('toast.joined'));
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
    <Screen padded size="medium">
      <View style={styles.wrap}>
        <HeroCard style={styles.card}>
          <View style={styles.badge}><Ionicons name="people" size={26} color={colors.jerseyInk} /></View>
          <Txt variant="hero" style={{ textAlign: 'center' }}>{t('join.title')}</Txt>
          <View style={styles.codeBox} accessibilityLabel={t('join.code', { code: clean })}>
            <Txt variant="label">{t('landing.invited')}</Txt>
            <Txt style={styles.code}>{clean}</Txt>
          </View>
          {session && member === undefined ? (
            <Txt style={{ textAlign: 'center', color: colors.inkSoft }}>{t('common.loading')}</Txt>
          ) : session && member ? (
            <View style={styles.form}>
              <View style={styles.already}>
                <Ionicons name="checkmark-circle" size={22} color={colors.green} />
                <Txt style={{ flex: 1 }}>{t('join.already', { league: member.name, team: member.team })}</Txt>
              </View>
              <Button label={t('join.goToLeague')} leftIcon="arrow-forward" onPress={goToLeague} />
              <Button kind="quiet" label={t('common.back')} onPress={() => { setPendingInvite(null); router.replace('/leagues'); }} />
            </View>
          ) : session ? (
            <View style={styles.form}>
              <Input label={t('team.yourTeamName')} value={team} onChangeText={setTeam} maxLength={40} />
              <CountryPicker value={country} onChange={setCountry} />
              <ErrorText error={error} />
              <Button label={t('join.submit')} onPress={join} busy={busy} disabled={!team.trim() || !country} />
              <Txt variant="small" style={{ textAlign: 'center' }}>{t('join.start')}</Txt>
              <Button kind="quiet" label={t('common.back')} onPress={() => { setPendingInvite(null); router.replace('/leagues'); }} />
              <SignOutButton />
            </View>
          ) : (
            <View style={styles.form}>
              <Txt style={{ textAlign: 'center', color: colors.inkSoft }}>{t('join.signInFirst')}</Txt>
              <Button label={t('landing.cta')} leftIcon="bicycle" onPress={() => router.push('/signup')} />
              <Button kind="secondary" label={t('landing.haveAccount')} onPress={() => router.push('/login')} />
            </View>
          )}
        </HeroCard>
      </View>

      {/* en qué consiste el juego, para quien llega sin conocerlo */}
      <Txt style={styles.intro}>{t('landing.subtitle')}</Txt>
      <Txt variant="title" style={styles.blockTitle}>{t('landing.howTitle')}</Txt>
      <HowItWorks columns={columns} />
      <Txt variant="title" style={styles.blockTitle}>{t('landing.featTitle')}</Txt>
      <Features columns={columns >= 2 ? 2 : 1} />
      <View style={{ height: space.xxl }} />
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { width: '100%', maxWidth: 480, alignSelf: 'center', marginTop: space.xl },
  card: { marginHorizontal: 0, padding: space.xl, alignItems: 'stretch', gap: space.l },
  badge: {
    alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: colors.jersey,
    alignItems: 'center', justifyContent: 'center',
  },
  codeBox: {
    alignItems: 'center', gap: 2, backgroundColor: colors.road, borderRadius: 16, paddingVertical: space.m,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line,
  },
  code: { fontFamily: fonts.number, fontSize: 34, letterSpacing: 4, color: colors.ink },
  form: { gap: space.m },
  already: {
    flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.greenSoft, borderRadius: 14,
    padding: space.m,
  },
  intro: {
    fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 26, textAlign: 'center', color: colors.inkSoft,
    maxWidth: 620, alignSelf: 'center', marginTop: space.xxl,
  },
  blockTitle: { marginTop: space.xxl, marginBottom: space.m },
}));
