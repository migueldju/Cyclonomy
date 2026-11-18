import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useLeague } from '../context/LeagueContext';
import { t } from '../i18n';
import { moneyShort } from '../lib/format';
import { SIDEBAR_WIDTH } from '../lib/layout';
import { colors, fonts, space, themed, type } from '../theme';
import { PositionJersey } from './PositionJersey';
import { Txt } from './Txt';

type IconName = keyof typeof Ionicons.glyphMap;
const ITEMS: { path: string; label: string; icon: IconName }[] = [
  { path: '/', label: 'tabs.home', icon: 'home-outline' },
  { path: '/market', label: 'tabs.market', icon: 'pricetags-outline' },
  { path: '/squad', label: 'tabs.squad', icon: 'people-outline' },
  { path: '/standings', label: 'tabs.standings', icon: 'podium-outline' },
  { path: '/calendar', label: 'tabs.calendar', icon: 'calendar-outline' },
];

/** Menú lateral de la web de escritorio: hace de barra de pestañas y de barra superior (equipo, puesto y dinero) */
export function SideBar() {
  const { me } = useLeague();
  const path = usePathname();
  const initials = (me?.display_name ?? me?.team_name ?? '?').trim().slice(0, 1).toUpperCase();

  return (
    <View style={styles.bar} accessibilityRole="menu">
      <Pressable onPress={() => router.navigate('/')} accessibilityRole="link" accessibilityLabel="Cyclonomy">
        <Image source={require('../../assets/logo-horizontal.png')} style={styles.logo} resizeMode="contain"
               tintColor={colors.onDark} />
      </Pressable>

      <View style={{ gap: 4 }}>
        {ITEMS.map((it) => {
          const on = it.path === '/' ? path === '/' : path.startsWith(it.path);
          return (
            <Pressable key={it.path} onPress={() => router.navigate(it.path)} accessibilityRole="menuitem"
                       accessibilityState={{ selected: on }}
                       style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
                         [styles.item, hovered && !on && styles.itemHover, on && styles.itemOn, pressed && { opacity: 0.8 }]}>
              <Ionicons name={(on ? it.icon.replace('-outline', '') : it.icon) as IconName} size={20}
                        color={on ? colors.jerseyInk : '#A9B4B9'} />
              <Txt style={[styles.label, on && { color: colors.jerseyInk }]}>{t(it.label as Parameters<typeof t>[0])}</Txt>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      {/* mi equipo: abre el perfil */}
      {me ? (
        <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel={t('topbar.profile')}
                   style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
                     [styles.me, hovered && styles.itemHover, pressed && { opacity: 0.8 }]}>
          <View style={styles.meTop}>
            {me.avatar_url ? <Image source={{ uri: me.avatar_url }} style={styles.avatar} /> : (
              <View style={[styles.avatar, styles.avatarEmpty]}><Txt style={styles.initials}>{initials}</Txt></View>
            )}
            <View style={{ flex: 1 }}>
              <Txt numberOfLines={1} style={styles.team}>{me.team_name}</Txt>
              <Txt numberOfLines={1} style={styles.league}>{me.league_name}</Txt>
            </View>
          </View>
          <View style={styles.meBottom}>
            <PositionJersey position={me.position} size={28} />
            <View style={styles.pill}>
              <Txt style={[styles.value, me.balance < 0 && { color: '#FF8A8A' }]} numberOfLines={1}>{moneyShort(me.balance)}</Txt>
            </View>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  bar: { width: SIDEBAR_WIDTH, backgroundColor: colors.asphalt, padding: space.l, gap: space.xl },
  logo: { width: 178, height: 30, marginTop: space.s, marginLeft: space.s },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.m, paddingVertical: 11, borderRadius: 12 },
  itemHover: { backgroundColor: colors.asphaltSoft },
  itemOn: { backgroundColor: colors.jersey },
  label: { fontFamily: fonts.bodyMedium, fontSize: type.body, color: colors.onDark },
  me: { borderRadius: 16, padding: space.m, gap: space.m, backgroundColor: 'rgba(255,255,255,0.05)' },
  meTop: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  meBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: colors.jersey },
  avatarEmpty: { backgroundColor: colors.asphaltSoft, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.bodyBold, color: colors.onDark, fontSize: type.small },
  team: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 0.6, color: colors.onDark },
  league: { fontFamily: fonts.body, fontSize: type.small, color: '#A9B4B9' },
  pill: { backgroundColor: colors.asphaltSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 1 },
  value: { fontFamily: fonts.number, fontSize: type.body, color: colors.jersey },
}));
