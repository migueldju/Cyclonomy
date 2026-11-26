import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button } from '@/components/Button';
import { Features, HowItWorks } from '@/components/GameIntro';
import { LanguageButton } from '@/components/LanguagePicker';
import { Txt } from '@/components/Txt';
import { useAuth } from '@/context/AuthContext';
import { t } from '@/i18n';
import { colors, fonts, space, themed, UCI_RAINBOW } from '@/theme';

const MAX = 1120;

/** «Cómo funciona»: los pasos del juego y lo que ofrece. Se abre desde la portada; se puede ver sin sesión. */
export default function How() {
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const wide = width >= 900;
  const columns = width >= 900 ? 3 : width >= 620 ? 2 : 1;
  const back = () => (router.canGoBack() ? router.back() : router.replace(session ? '/' : '/welcome'));

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={styles.top}>
        <View style={[styles.inner, styles.nav]}>
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.navLeft} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.onDark} />
            <Image source={require('../assets/logo-horizontal.png')} style={styles.logo} resizeMode="contain"
                   tintColor={colors.onDark} accessibilityLabel="Cyclonomy" />
          </Pressable>
          <LanguageButton />
        </View>
        <View style={[styles.inner, { paddingTop: space.xl }]}>
          <Txt style={[styles.title, !wide && styles.titleNarrow]}>{t('landing.howTitle')}</Txt>
          <Txt style={styles.subtitle}>{t('landing.subtitle')}</Txt>
        </View>
      </View>
      {/* franja con el arcoíris de la UCI, como en la portada */}
      <View style={styles.stripes}>
        {UCI_RAINBOW.map((c) => <View key={c} style={{ flex: 1, backgroundColor: c }} />)}
      </View>

      <View style={[styles.inner, styles.block]}>
        <HowItWorks columns={columns} />
      </View>

      <View style={[styles.inner, styles.block]}>
        <Txt variant="hero" style={styles.blockTitle}>{t('landing.featTitle')}</Txt>
        <Features columns={wide ? 2 : 1} />
      </View>

      {/* llamada final, en amarillo maillot (sin sesión: crear cuenta) */}
      {session ? null : (
        <View style={[styles.inner, styles.block]}>
          <View style={[styles.band, wide && styles.bandWide]}>
            <Txt style={styles.bandTitle}>{t('landing.title')}</Txt>
            <Button kind="dark" label={t('landing.cta')} onPress={() => router.push('/signup')} />
          </View>
        </View>
      )}

      <View style={{ flexGrow: 1 }} />
      <Txt variant="small" style={styles.footer}>© {new Date().getFullYear()} Cyclonomy</Txt>
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.road },
  inner: { width: '100%', maxWidth: MAX, alignSelf: 'center', paddingHorizontal: space.xl },
  top: { backgroundColor: colors.asphalt, paddingBottom: space.xxl },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.l },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  logo: { width: 168, height: 28 },
  title: { fontFamily: fonts.display, fontSize: 56, lineHeight: 60, letterSpacing: 1, color: colors.onDark },
  titleNarrow: { fontSize: 40, lineHeight: 44 },
  subtitle: { fontFamily: fonts.body, fontSize: 18, lineHeight: 28, color: '#C9D2D6', maxWidth: 620, marginTop: space.s },
  stripes: { flexDirection: 'row', height: 8 },
  block: { paddingTop: space.xxl * 1.5 },
  blockTitle: { marginBottom: space.l },
  band: { backgroundColor: colors.jersey, borderRadius: 24, padding: space.xxl, gap: space.l, alignItems: 'flex-start' },
  bandWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bandTitle: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.jerseyInk, flexShrink: 1 },
  footer: { textAlign: 'center', paddingVertical: space.xxl },
}));
