// Fira Sans: la «l» lleva cola y no se confunde con la «i». Solo se importan los pesos que se usan.
import { FiraSans_400Regular } from '@expo-google-fonts/fira-sans/400Regular';
import { FiraSans_500Medium } from '@expo-google-fonts/fira-sans/500Medium';
import { FiraSans_600SemiBold } from '@expo-google-fonts/fira-sans/600SemiBold';
import { FiraSansCondensed_600SemiBold } from '@expo-google-fonts/fira-sans-condensed/600SemiBold';
import { FiraSansCondensed_700Bold } from '@expo-google-fonts/fira-sans-condensed/700Bold';
import { useFonts } from 'expo-font';
import { Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TopBar } from '@/components/TopBar';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LeagueProvider, useLeague } from '@/context/LeagueContext';
import { I18nProvider } from '@/i18n';
import { resetTo } from '@/lib/nav';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

const AUTH_SCREENS = ['login', 'registro', 'recuperar', 'auth'];
const NO_LEAGUE_SCREENS = ['ligas', 'liga', 'unirse', 'perfil', 'admin'];

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    FiraSans_400Regular, FiraSans_500Medium, FiraSans_600SemiBold, FiraSansCondensed_600SemiBold, FiraSansCondensed_700Bold,
  });
  useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync(); }, [fontsLoaded]);
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <I18nProvider>
        {(lang) => (
          <AuthProvider>
            <LeagueProvider>
              <StatusBar style="light" />
              <Gate key={lang} />
            </LeagueProvider>
          </AuthProvider>
        )}
      </I18nProvider>
    </SafeAreaProvider>
  );
}

/** Redirige según haya sesión y liga elegida */
function Gate() {
  const { session, loading } = useAuth();
  const { leagueId, ready, pendingInvite, setPendingInvite } = useLeague();
  const segments = useSegments();
  const first = segments[0] ?? '';
  // tras el enlace de recuperación ya hay sesión, pero hay que dejar poner la contraseña nueva
  const settingPassword = first === 'auth' && (segments as string[])[1] === 'nueva-contrasena';

  useEffect(() => {
    if (loading || !ready) return;
    if (!session) {
      if (!AUTH_SCREENS.includes(first) && first !== 'unirse') resetTo('/login');
    } else if (AUTH_SCREENS.includes(first) && !settingPassword) {
      if (pendingInvite) {
        resetTo(`/unirse/${pendingInvite}`);
        setPendingInvite(null);                // el código ya va en la URL
      } else {
        resetTo(leagueId ? '/' : '/ligas');
      }
    } else if (!leagueId && !NO_LEAGUE_SCREENS.includes(first)) {
      resetTo('/ligas');
    }
  }, [session, loading, leagueId, ready, first, settingPassword, pendingInvite, setPendingInvite]);

  const withBar = { headerShown: true, header: () => <TopBar back /> };
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.road } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="jugador/[memberId]" options={withBar} />
      <Stack.Screen name="carrera/[raceId]" options={withBar} />
      <Stack.Screen name="etapa/[stageId]" options={withBar} />
      <Stack.Screen name="normativa" options={withBar} />
      <Stack.Screen name="perfil" options={withBar} />
      <Stack.Screen name="admin" options={withBar} />
    </Stack>
  );
}
