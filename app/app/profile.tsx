import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Button } from '@/components/Button';
import { Input, Segmented } from '@/components/Inputs';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { showToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { useTheme } from '@/context/ThemeContext';
import { LANGUAGES, t, useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { cardShadow, colors, space, themed } from '@/theme';

// redes de Cyclonomy
const SOCIAL = [
  { icon: 'logo-instagram', name: 'Instagram', handle: '@cyclonomy', url: 'https://www.instagram.com/cyclonomy' },
  { icon: 'logo-x', name: 'X', handle: '@cyclonomy_game', url: 'https://x.com/cyclonomy_game' },
] as const;

/** Fondo del logo de Instagram: su degradado (amarillo abajo a la izquierda → naranja → rosa → morado → azul) */
function InstagramDisc() {
  return (
    <Svg width={40} height={40} style={{ position: 'absolute' }}>
      <Defs>
        <RadialGradient id="ig" cx="30%" cy="107%" r="150%">
          <Stop offset="0" stopColor="#FDF497" />
          <Stop offset="0.05" stopColor="#FDF497" />
          <Stop offset="0.45" stopColor="#FD5949" />
          <Stop offset="0.6" stopColor="#D6249F" />
          <Stop offset="0.9" stopColor="#285AEB" />
        </RadialGradient>
      </Defs>
      <Circle cx={20} cy={20} r={20} fill="url(#ig)" />
    </Svg>
  );
}

export default function Perfil() {
  const { session } = useAuth();
  const { leagueId, me, refresh, selectLeague } = useLeague();
  const { lang, setLang } = useI18n();
  const { pref, setPref } = useTheme();
  const userId = session?.user.id;
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [team, setTeam] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from('profile').select('display_name, avatar_url').eq('user_id', userId).single()
      .then(({ data }) => { if (data) { setName(data.display_name); setAvatar(data.avatar_url); } });
    api.isAppAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
  }, [userId]);
  // el nombre del equipo se toma una vez; recargar 'me' no debe borrar lo que estés escribiendo
  useEffect(() => { if (me && !team) setTeam(me.team_name); }, [me, team]);

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setMsg(null);
    try { showToast(await fn()); refresh(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(null);
  }

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true });
    if (res.canceled || !userId) return;
    const asset = res.assets[0];
    await run('photo', async () => {
      // En Android, fetch(uri).arrayBuffer() devuelve un fichero vacío: se usan los bytes en base64 del selector
      const body = asset.base64
        ? Uint8Array.from(atob(asset.base64), (ch) => ch.charCodeAt(0)).buffer
        : await fetch(asset.uri).then((r) => r.arrayBuffer());
      if (body.byteLength < 100) throw new Error(t('profile.photoError'));
      const ext = (asset.mimeType ?? 'image/jpeg').split('/')[1] ?? 'jpg';
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, body, {
        contentType: asset.mimeType ?? 'image/jpeg',          // ruta única: no hace falta sobrescribir
      });
      if (error) throw new Error(error.message);
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      await api.updateProfile(null, url);
      setAvatar(url);
      return t('profile.photoUpdated');
    });
  }

  return (
    <Screen padded>
      <View style={styles.head}>
        <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel={t('profile.changePhoto')}>
          {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={[styles.avatar, styles.noAvatar]} />}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt variant="title">{name || t('profile.title')}</Txt>
          <Button small kind="quiet" label={t('profile.changePhoto')} onPress={pickPhoto} busy={busy === 'photo'} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
        </View>
      </View>
      {msg ? <Txt style={{ color: msg.ok ? colors.green : colors.red, marginBottom: space.m }}>{msg.text}</Txt> : null}

      <View style={styles.inline}>
        <View style={{ flex: 1 }}><Input label={t('auth.yourName')} value={name} onChangeText={setName} maxLength={40} /></View>
        <Button kind="secondary" label={t('common.save')} busy={busy === 'name'} style={styles.save}
                onPress={() => run('name', async () => { await api.updateProfile(name, null); return t('profile.nameSaved'); })} />
      </View>

      {leagueId && me ? (
        <Section title={t('profile.teamIn', { league: me.league_name })} style={{ marginHorizontal: -space.l }}>
          <View style={[styles.inline, { padding: space.l, paddingBottom: 0 }]}>
            <View style={{ flex: 1 }}><Input label={t('profile.teamName')} value={team} onChangeText={setTeam} maxLength={40} /></View>
            <Button kind="secondary" label={t('common.save')} busy={busy === 'team'} style={styles.save}
                    onPress={() => run('team', async () => { await api.renameTeam(leagueId, team); return t('profile.teamNameSaved'); })} />
          </View>
        </Section>
      ) : null}

      <Section title={t('profile.language')} style={{ marginHorizontal: -space.l }}>
        <View style={{ padding: space.l, paddingBottom: 0 }}>
          <LanguagePicker label={t('profile.languageHint')} hideLabel languages={LANGUAGES} value={lang} onChange={setLang} />
        </View>
      </Section>

      <Section title={t('profile.theme')} style={{ marginHorizontal: -space.l }}>
        <View style={{ padding: space.l, paddingBottom: 0 }}>
          <Segmented label={t('profile.themeHint')} value={pref} onChange={setPref}
                     options={[{ value: 'system', label: t('theme.system') }, { value: 'light', label: t('theme.light') },
                               { value: 'dark', label: t('theme.dark') }]} />
        </View>
      </Section>

      <View style={{ gap: space.m, marginTop: space.xl }}>
        <Button kind="secondary" label={t('account.title')} onPress={() => router.push('/security')} />
        <Button kind="secondary" label={t('profile.switchLeague')} onPress={() => router.push('/leagues')} />
        {isAdmin ? <Button kind="secondary" label={t('profile.manualLoad')} onPress={() => router.push('/admin')} /> : null}
        <Button kind="danger" label={t('profile.signOut')}
                onPress={async () => { await selectLeague(null); await supabase.auth.signOut(); }} />
      </View>

      <View style={styles.social}>
        {SOCIAL.map((n) => (
          <Pressable key={n.name} onPress={() => Linking.openURL(n.url)} accessibilityRole="link"
                     accessibilityLabel={`${n.name} ${n.handle}`}
                     style={({ pressed }) => [styles.socialCard, pressed && { opacity: 0.7 }]}>
            <View style={styles.socialIcon}>
              {n.name === 'Instagram' ? <InstagramDisc /> : null}
              <Ionicons name={n.icon} size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="lead">{n.name}</Txt>
              <Txt variant="small" numberOfLines={1}>{n.handle}</Txt>
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  head: {
    flexDirection: 'row', alignItems: 'center', gap: space.l, marginBottom: space.xl, backgroundColor: colors.paper,
    borderRadius: 20, padding: space.l, ...cardShadow,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: colors.jersey },
  // campo con su botón de guardar al lado, a la altura del campo
  inline: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s },
  save: { marginBottom: space.l, minHeight: 44 },
  noAvatar: { backgroundColor: colors.line },
  social: { flexDirection: 'row', gap: space.m, marginTop: space.xl },
  socialCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.m, backgroundColor: colors.paper, borderRadius: 16,
    padding: space.m, ...cardShadow,
  },
  socialIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#000000', overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
}));
