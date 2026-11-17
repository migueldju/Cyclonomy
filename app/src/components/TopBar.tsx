import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLeague } from '../context/LeagueContext';
import { t } from '../i18n';
import { moneyShort } from '../lib/format';
import { useWide } from '../lib/layout';
import { colors, fonts, space, themed, type } from '../theme';
import { PositionJersey } from './PositionJersey';
import { Txt } from './Txt';

/** Barra superior común: foto (abre el perfil) · nombre del equipo · puesto y valor de la plantilla */
export function TopBar({ back }: { back?: boolean }) {
  const insets = useSafeAreaInsets();
  const { me } = useLeague();
  const initials = (me?.display_name ?? me?.team_name ?? '?').trim().slice(0, 1).toUpperCase();
  const wide = useWide();

  // en la web de escritorio el equipo, el puesto y el dinero van en el menú lateral: aquí queda solo «volver»
  if (wide) {
    return back ? (
      <View style={styles.wideBar}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t('common.back')}
                   style={({ pressed }) => [styles.wideBack, pressed && { opacity: 0.7 }]}>
          <Ionicons name="chevron-back" size={18} color={colors.ink} />
          <Txt style={styles.wideBackText}>{t('common.back')}</Txt>
        </Pressable>
      </View>
    ) : null;
  }

  return (
    <View style={styles.wrap}>
    <View style={[styles.bar, { paddingTop: insets.top + space.s }]}>
      <View style={styles.left}>
        {back ? (
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.onDark} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel={t('topbar.profile')}>
          {me?.avatar_url ? (
            <Image source={{ uri: me.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Txt style={styles.initials}>{initials}</Txt>
            </View>
          )}
        </Pressable>
      </View>

      <Txt numberOfLines={1} style={styles.team}>{me?.team_name ?? ''}</Txt>

      <View style={styles.right}>
        <PositionJersey position={me?.position} size={28} />
        {/* el dinero del jugador (en rojo si está en negativo) */}
        {me ? (
          <View style={styles.pill}>
            <Txt style={[styles.value, me.balance < 0 && { color: '#FF8A8A' }]} numberOfLines={1}>{moneyShort(me.balance)}</Txt>
          </View>
        ) : null}
      </View>
    </View>
    </View>
  );
}

// Si la pantalla se abrió sin nada detrás (enlace, recarga en la web), volver lleva a Inicio
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

const styles = themed(() => StyleSheet.create({
  wrap: { backgroundColor: colors.road },      // lo que asoma tras las esquinas redondeadas
  bar: {
    backgroundColor: colors.asphalt, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space.l, paddingBottom: space.m, gap: space.m,
    borderBottomLeftRadius: 22, borderBottomRightRadius: 22,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: space.s, minWidth: 92 },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.jersey },
  avatarEmpty: { backgroundColor: colors.asphaltSoft, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.bodyBold, color: colors.onDark, fontSize: type.small },
  team: { flex: 1, textAlign: 'center', fontFamily: fonts.display, fontSize: 22, letterSpacing: 0.8, color: colors.onDark },
  pill: { backgroundColor: colors.asphaltSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.s, minWidth: 92, justifyContent: 'flex-end' },
  value: { fontFamily: fonts.number, fontSize: type.body, color: colors.jersey },
  wideBar: { backgroundColor: colors.road, paddingHorizontal: space.xl, paddingTop: space.l },
  wideBack: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.paper,
    borderRadius: 999, paddingLeft: 10, paddingRight: 16, paddingVertical: 8,
  },
  wideBackText: { fontFamily: fonts.bodyMedium, fontSize: type.small, color: colors.ink },
}));
