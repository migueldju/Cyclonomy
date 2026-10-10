import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { t } from '@/i18n';
import { colors, fonts } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;
// la pestaña activa lleva el icono relleno; las demás, solo el contorno
const icon = (name: IconName) => ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) =>
  <Ionicons name={(focused ? name.replace('-outline', '') : name) as IconName} color={color} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        header: () => <TopBar />,
        // a juego con la barra superior: asfalto, y la pestaña activa en amarillo maillot
        tabBarActiveTintColor: colors.jersey,
        tabBarInactiveTintColor: '#A9B4B9',
        tabBarStyle: { backgroundColor: colors.asphalt, borderTopWidth: 0 },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12, letterSpacing: 0.2 },
        sceneStyle: { backgroundColor: colors.road },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="mercado" options={{ title: t('tabs.market'), tabBarIcon: icon('pricetags-outline') }} />
      <Tabs.Screen name="plantilla" options={{ title: t('tabs.squad'), tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="clasificacion" options={{ title: t('tabs.standings'), tabBarIcon: icon('podium-outline') }} />
      <Tabs.Screen name="calendario" options={{ title: t('tabs.calendar'), tabBarIcon: icon('calendar-outline') }} />
      {/* pantallas dentro de las pestañas (sin botón propio): conservan la barra inferior */}
      <Tabs.Screen name="ranking" options={{ href: null, header: () => <TopBar back /> }} />
      <Tabs.Screen name="movimientos" options={{ href: null, header: () => <TopBar back /> }} />
      <Tabs.Screen name="ciclista/[riderId]" options={{ href: null, header: () => <TopBar back /> }} />
    </Tabs>
  );
}
