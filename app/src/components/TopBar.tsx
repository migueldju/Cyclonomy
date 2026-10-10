import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLeague } from '../context/LeagueContext';
import { t } from '../i18n';
import { moneyShort } from '../lib/format';
import { colors, fonts, space, type } from '../theme';
import { PositionJersey } from './PositionJersey';
import { Txt } from './Txt';

/** Barra superior común: foto (abre el perfil) · nombre del equipo · puesto y valor de la plantilla */
export function TopBar({ back }: { back?: boolean }) {
  const insets = useSafeAreaInsets();
  const { me } = useLeague();
  const initials = (me?.display_name ?? me?.team_name ?? '?').trim().slice(0, 1).toUpperCase();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + space.xs }]}>
      <View style={styles.left}>
        {back ? (
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.paper} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.push('/perfil')} accessibilityRole="button" accessibilityLabel={t('topbar.profile')}>
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
        <Txt style={styles.value} numberOfLines={1}>{me ? moneyShort(me.team_value) : ''}</Txt>
      </View>
    </View>
  );
}

// Si la pantalla se abrió sin nada detrás (enlace, recarga en la web), volver lleva a Inicio
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.asphalt, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space.l, paddingBottom: space.s, gap: space.m,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: space.s, minWidth: 92 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarEmpty: { backgroundColor: colors.asphaltSoft, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: type.small },
  team: { flex: 1, textAlign: 'center', fontFamily: fonts.display, fontSize: type.lead, color: colors.paper },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.s, minWidth: 92, justifyContent: 'flex-end' },
  value: { fontFamily: fonts.number, fontSize: type.body, color: colors.jersey },
});
