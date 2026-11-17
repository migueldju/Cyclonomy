// Fira Sans: la «l» lleva cola y no se confunde con la «i». Solo se importan los pesos que se usan.
import { FiraSans_400Regular } from '@expo-google-fonts/fira-sans/400Regular';
import { FiraSans_500Medium } from '@expo-google-fonts/fira-sans/500Medium';
import { FiraSans_600SemiBold } from '@expo-google-fonts/fira-sans/600SemiBold';
import { FiraSansCondensed_600SemiBold } from '@expo-google-fonts/fira-sans-condensed/600SemiBold';
import { FiraSansCondensed_700Bold } from '@expo-google-fonts/fira-sans-condensed/700Bold';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue/400Regular';
import { useFonts } from 'expo-font';
import { Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SideBar } from '@/components/SideBar';
import { ToastHost } from '@/components/Toast';
import { TopBar } from '@/components/TopBar';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LeagueProvider, useLeague } from '@/context/LeagueContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { I18nProvider } from '@/i18n';
import { MAX_WIDTH, useWide } from '@/lib/layout';
import { resetTo } from '@/lib/nav';
import { colors, themed } from '@/theme';

SplashScreen.preventAutoHideAsync();
// fondo de la vista raíz: es lo que se ve en la franja del sistema bajo la barra de pestañas (asfalto, como la barra)
SystemUI.setBackgroundColorAsync(colors.asphalt).catch(() => {});

const AUTH_SCREENS = ['login', 'signup', 'reset-password', 'auth'];
const NO_LEAGUE_SCREENS = ['leagues', 'league', 'join', 'unirse', 'profile', 'security', 'admin'];

export default function RootLayout() {
  return <ThemeProvider>{(scheme) => <Root scheme={scheme} />}</ThemeProvider>;
}

function Root({ scheme }: { scheme: string }) {
  const [fontsLoaded] = useFonts({
    FiraSans_400Regular, FiraSans_500Medium, FiraSans_600SemiBold, FiraSansCondensed_600SemiBold, FiraSansCondensed_700Bold,
    BebasNeue_400Regular,
    // todos los caracteres como puntos: oculta la contraseña en Android sin el destello de la última letra
    PasswordDisc: require('../assets/fonts/password-disc.ttf'),
  });
  // la pantalla de arranque nativa se quita enseguida: la de carga (el logo) la pinta la app, también en Expo Go
  useEffect(() => { SplashScreen.hideAsync(); }, []);
  // el logo se ve al menos un momento, aunque todo cargue al instante
  const [shown, setShown] = useState(false);
  useEffect(() => { const id = setTimeout(() => setShown(true), 1200); return () => clearTimeout(id); }, []);
  if (!fontsLoaded) return <LoadingScreen />;

  return (
    <SafeAreaProvider>
      <I18nProvider>
        {(lang) => (
          <AuthProvider>
            <LeagueProvider>
              <StatusBar style="light" />
              <Shell key={lang + scheme} splash={!shown} />
            </LeagueProvider>
          </AuthProvider>
        )}
      </I18nProvider>
    </SafeAreaProvider>
  );
}

/**
 * Marco de la app. En el móvil (y en la web con la ventana estrecha), una columna centrada; en la web de escritorio,
 * el menú lateral y el contenido a todo el ancho.
 */
function Shell({ splash }: { splash: boolean }) {
  const wide = useWide();
  const { session } = useAuth();
  const { leagueId } = useLeague();
  const first = useSegments()[0] ?? '';
  // sin sesión o sin liga elegida no hay menú: son pantallas de acceso o de elegir liga
  const menu = wide && !!session && !!leagueId && !AUTH_SCREENS.includes(first)
    && !['leagues', 'league', 'join', 'unirse'].includes(first);
  return (
    <View style={[styles.page, wide && styles.pageWide]}>
      {menu ? <SideBar /> : null}
      <View style={wide ? styles.main : styles.column}>
        <Gate splash={splash} />
        <ToastHost />
      </View>
    </View>
  );
}

/** Redirige según haya sesión y liga elegida */
function Gate({ splash }: { splash: boolean }) {
  const { session, loading } = useAuth();
  const { leagueId, ready, pendingInvite, setPendingInvite } = useLeague();
  const segments = useSegments();
  const first = segments[0] ?? '';
  // tras el enlace de recuperación ya hay sesión, pero hay que dejar poner la contraseña nueva
  const settingPassword = first === 'auth' && (segments as string[])[1] === 'new-password';

  useEffect(() => {
    if (loading || !ready) return;
    if (!session) {
      if (!AUTH_SCREENS.includes(first) && first !== 'join' && first !== 'unirse') resetTo('/login');
    } else if (AUTH_SCREENS.includes(first) && !settingPassword) {
      if (pendingInvite) {
        resetTo(`/join/${pendingInvite}`);
        setPendingInvite(null);                // el código ya va en la URL
      } else {
        resetTo(leagueId ? '/' : '/leagues');
      }
    } else if (!leagueId && !NO_LEAGUE_SCREENS.includes(first)) {
      resetTo('/leagues');
    }
  }, [session, loading, leagueId, ready, first, settingPassword, pendingInvite, setPendingInvite]);

  const withBar = { headerShown: true, header: () => <TopBar back /> };
  return (
    <>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.road } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="player/[memberId]" options={withBar} />
      <Stack.Screen name="race/[raceId]" options={withBar} />
      <Stack.Screen name="stage/[stageId]" options={withBar} />
      <Stack.Screen name="rules" options={withBar} />
      <Stack.Screen name="profile" options={withBar} />
      <Stack.Screen name="security" options={withBar} />
      <Stack.Screen name="admin" options={withBar} />
    </Stack>
    {/* pantalla de carga, mientras se lee la sesión y la liga: el logo sobre el amarillo del icono */}
    {loading || !ready || splash ? <LoadingScreen /> : null}
    </>
  );
}

/** Pantalla de carga: el logo horizontal sobre blanco */
function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <Image source={require('../assets/logo-horizontal.png')} style={styles.logo} resizeMode="contain" tintColor={colors.ink}
             accessibilityLabel="Cyclonomy" />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.asphalt, alignItems: 'center' },
  pageWide: { flexDirection: 'row', alignItems: 'stretch' },
  column: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, backgroundColor: colors.road, overflow: 'hidden' },
  main: { flex: 1, minWidth: 0, backgroundColor: colors.road, overflow: 'hidden' },
  loading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 260, height: 44 },
}));
