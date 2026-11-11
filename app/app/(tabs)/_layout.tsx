import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { type ColorValue, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '@/components/TopBar';
import { t } from '@/i18n';
import { colors, fonts } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;
// la pestaña activa lleva el icono relleno; las demás, solo el contorno
const icon = (name: IconName) => ({ color, focused }: { color: ColorValue; size: number; focused: boolean }) => (
  <View style={[styles.icon, focused && styles.iconOn]}>
    <Ionicons name={(focused ? name.replace('-outline', '') : name) as IconName}
              color={focused ? colors.jerseyInk : color} size={21} />
  </View>
);

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        header: () => <TopBar />,
        // a juego con la barra superior: asfalto, y la pestaña activa en amarillo maillot
        tabBarActiveTintColor: colors.jersey,
        tabBarInactiveTintColor: '#A9B4B9',
        tabBarStyle: { backgroundColor: colors.road, borderTopWidth: 0, elevation: 0, paddingTop: 8,
                       height: 66 + insets.bottom },   // caben la pastilla del icono y el nombre
        tabBarBackground: () => <View style={styles.bar} />,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 0.2, marginTop: 4 },
        sceneStyle: { backgroundColor: colors.road },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="market" options={{ title: t('tabs.market'), tabBarIcon: icon('pricetags-outline') }} />
      <Tabs.Screen name="squad" options={{ title: t('tabs.squad'), tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="standings" options={{ title: t('tabs.standings'), tabBarIcon: icon('podium-outline') }} />
      <Tabs.Screen name="calendar" options={{ title: t('tabs.calendar'), tabBarIcon: icon('calendar-outline') }} />
      {/* pantallas dentro de las pestañas (sin botón propio): conservan la barra inferior */}
      <Tabs.Screen name="ranking" options={{ href: null, header: () => <TopBar back /> }} />
      <Tabs.Screen name="moves" options={{ href: null, header: () => <TopBar back /> }} />
      <Tabs.Screen name="rider/[riderId]" options={{ href: null, header: () => <TopBar back /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1, backgroundColor: colors.asphalt, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  icon: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: colors.jersey },
});
