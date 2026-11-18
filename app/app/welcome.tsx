import { router } from 'expo-router';
import { Image, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button } from '@/components/Button';
import { Features, HowItWorks } from '@/components/GameIntro';
import { PositionJersey } from '@/components/PositionJersey';
import { Txt } from '@/components/Txt';
import { t } from '@/i18n';
import { categoryColor, colors, fonts, space, themed } from '@/theme';

const MAX = 1120;
// franjas de colores de carrera bajo la portada: el pelotón del calendario
const STRIPES = ['TDF', 'GT', 'MON', 'MWT', 'SWT', 'CC', 'NC', 'PRO', 'C1'];

/** Portada de la web para quien aún no tiene sesión: qué es el juego y cómo entrar */
export default function Welcome() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const columns = width >= 900 ? 3 : width >= 620 ? 2 : 1;
  const signUp = () => router.push('/signup');
  const signIn = () => router.push('/login');

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ flexGrow: 1 }}>
      {/* portada, sobre asfalto */}
      <View style={styles.top}>
        <View style={[styles.inner, styles.nav]}>
          <Image source={require('../assets/logo-horizontal.png')} style={styles.logo} resizeMode="contain"
                 tintColor={colors.onDark} accessibilityLabel="Cyclonomy" />
          <View style={styles.navButtons}>
            {wide ? <Button small kind="ghost" label={t('login.signIn')} onPress={signIn} /> : null}
            <Button small label={wide ? t('auth.createAccount') : t('login.signIn')} onPress={wide ? signUp : signIn} />
          </View>
        </View>

        <View style={[styles.inner, styles.hero, wide && styles.heroWide]}>
          <View style={{ flex: wide ? 1.3 : undefined, gap: space.l }}>
            <Txt style={[styles.title, !wide && styles.titleNarrow]}>{t('landing.title')}</Txt>
            <Txt style={styles.subtitle}>{t('landing.subtitle')}</Txt>
            <View style={[styles.ctas, !wide && { flexDirection: 'column' }]}>
              <Button label={t('landing.cta')} leftIcon="bicycle" onPress={signUp} style={styles.cta} />
              <Button kind="ghost" label={t('landing.haveAccount')} onPress={signIn} style={styles.cta} />
            </View>
          </View>
          {/* el podio: los maillots del 1.º, 2.º y 3.º */}
          <View style={[styles.podium, !wide && { marginTop: space.xl }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={{ marginTop: 34 }}><PositionJersey position={2} size={wide ? 104 : 76} /></View>
            <PositionJersey position={1} size={wide ? 140 : 100} />
            <View style={{ marginTop: 50 }}><PositionJersey position={3} size={wide ? 96 : 70} /></View>
          </View>
        </View>
      </View>
      <View style={styles.stripes}>
        {STRIPES.map((c) => <View key={c} style={{ flex: 1, backgroundColor: categoryColor[c] }} />)}
      </View>

      <View style={[styles.inner, styles.block]}>
        <Txt variant="hero" style={styles.blockTitle}>{t('landing.howTitle')}</Txt>
        <HowItWorks columns={columns} />
      </View>

      <View style={[styles.inner, styles.block]}>
        <Txt variant="hero" style={styles.blockTitle}>{t('landing.featTitle')}</Txt>
        <Features columns={wide ? 2 : 1} />
      </View>

      {/* llamada final, en amarillo maillot */}
      <View style={[styles.inner, styles.block]}>
        <View style={[styles.band, wide && styles.bandWide]}>
          <Txt style={styles.bandTitle}>{t('landing.title')}</Txt>
          <Button kind="dark" label={t('landing.cta')} onPress={signUp} />
        </View>
      </View>

      <View style={{ flexGrow: 1 }} />
      <Txt variant="small" style={styles.footer}>© {new Date().getFullYear()} Cyclonomy</Txt>
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.road },
  inner: { width: '100%', maxWidth: MAX, alignSelf: 'center', paddingHorizontal: space.xl },
  top: { backgroundColor: colors.asphalt, paddingBottom: space.xxl * 1.5 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.l },
  logo: { width: 168, height: 28 },
  navButtons: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  hero: { paddingTop: space.xxl },
  heroWide: { flexDirection: 'row', alignItems: 'center', gap: space.xxl, paddingTop: space.xxl * 1.5 },
  title: { fontFamily: fonts.display, fontSize: 64, lineHeight: 66, letterSpacing: 1, color: colors.onDark },
  titleNarrow: { fontSize: 44, lineHeight: 46 },
  subtitle: { fontFamily: fonts.body, fontSize: 18, lineHeight: 28, color: '#C9D2D6', maxWidth: 560 },
  ctas: { flexDirection: 'row', gap: space.m, marginTop: space.s },
  cta: { paddingHorizontal: space.xl },
  podium: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: space.s, flex: 1 },
  stripes: { flexDirection: 'row', height: 8 },
  block: { paddingTop: space.xxl * 1.5 },
  blockTitle: { marginBottom: space.l },
  band: {
    backgroundColor: colors.jersey, borderRadius: 24, padding: space.xxl, gap: space.l, alignItems: 'flex-start',
  },
  bandWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bandTitle: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.jerseyInk, flexShrink: 1 },
  footer: { textAlign: 'center', paddingVertical: space.xxl },
}));
