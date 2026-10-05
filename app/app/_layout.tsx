import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, useFonts } from '@expo-google-fonts/barlow';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TopBar } from '@/components/TopBar';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LeagueProvider, useLeague } from '@/context/LeagueContext';
import { resetTo } from '@/lib/nav';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

const AUTH_SCREENS = ['login', 'registro', 'recuperar', 'auth'];
const NO_LEAGUE_SCREENS = ['ligas', 'liga', 'unirse', 'perfil', 'admin'];

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold,
  });
  useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync(); }, [fontsLoaded]);
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LeagueProvider>
          <StatusBar style="light" />
          <Gate />
        </LeagueProvider>
      </AuthProvider>
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
