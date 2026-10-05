import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { colors, fonts } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) =>
  <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        header: () => <TopBar />,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12, letterSpacing: 0.2 },
        sceneStyle: { backgroundColor: colors.road },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="mercado" options={{ title: 'Mercado', tabBarIcon: icon('pricetags-outline') }} />
      <Tabs.Screen name="plantilla" options={{ title: 'Mi plantilla', tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="clasificacion" options={{ title: 'Clasificación', tabBarIcon: icon('podium-outline') }} />
      <Tabs.Screen name="calendario" options={{ title: 'Calendario', tabBarIcon: icon('calendar-outline') }} />
    </Tabs>
  );
}
