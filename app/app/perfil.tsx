import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Input, Segmented } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { LANGUAGES, t, useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme';

export default function Perfil() {
  const { session } = useAuth();
  const { leagueId, me, refresh, selectLeague } = useLeague();
  const { lang, setLang } = useI18n();
  const userId = session?.user.id;
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [team, setTeam] = useState('');
  const [email, setEmail] = useState(session?.user.email ?? '');
  const [password, setPassword] = useState('');
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
    try { setMsg({ ok: true, text: await fn() }); refresh(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(null);
  }

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (res.canceled || !userId) return;
    const asset = res.assets[0];
    await run('photo', async () => {
      const body = await fetch(asset.uri).then((r) => r.arrayBuffer());
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

      <Input label={t('auth.yourName')} value={name} onChangeText={setName} maxLength={40} />
      <Button kind="secondary" label={t('profile.saveName')} busy={busy === 'name'}
              onPress={() => run('name', async () => { await api.updateProfile(name, null); return t('profile.nameSaved'); })} />

      <Section title={t('profile.language')} style={{ marginHorizontal: -space.l }}>
        <View style={{ padding: space.l, paddingBottom: 0 }}>
          <Segmented label={t('profile.languageHint')} value={lang} onChange={setLang}
                     options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))} />
        </View>
      </Section>

      {leagueId && me ? (
        <Section title={t('profile.teamIn', { league: me.league_name })} style={{ marginHorizontal: -space.l }}>
          <View style={{ padding: space.l }}>
            <Input label={t('profile.teamName')} value={team} onChangeText={setTeam} maxLength={40} />
            <Button kind="secondary" label={t('profile.saveTeamName')} busy={busy === 'team'}
                    onPress={() => run('team', async () => { await api.renameTeam(leagueId, team); return t('profile.teamNameSaved'); })} />
          </View>
        </Section>
      ) : null}

      <Section title={t('profile.account')} style={{ marginHorizontal: -space.l }}>
        <View style={{ padding: space.l }}>
          <Input label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Button kind="secondary" label={t('profile.changeEmail')} busy={busy === 'email'}
                  onPress={() => run('email', async () => {
                    const { error } = await supabase.auth.updateUser({ email: email.trim() });
                    if (error) throw new Error(error.message);
                    return t('profile.emailSent');
                  })} />
          <View style={{ height: space.l }} />
          <Input label={t('newpass.title')} value={password} onChangeText={setPassword} secureTextEntry hint={t('auth.min8')} />
          <Button kind="secondary" label={t('profile.changePassword')} busy={busy === 'password'} disabled={password.length < 8}
                  onPress={() => run('password', async () => {
                    const { error } = await supabase.auth.updateUser({ password });
                    if (error) throw new Error(error.message);
                    setPassword('');
                    return t('profile.passwordChanged');
                  })} />
        </View>
      </Section>

      <View style={{ gap: space.m, marginTop: space.xl }}>
        <Button kind="secondary" label={t('profile.switchLeague')} onPress={() => router.push('/ligas')} />
        {isAdmin ? <Button kind="secondary" label={t('profile.manualLoad')} onPress={() => router.push('/admin')} /> : null}
        <Button kind="danger" label={t('profile.signOut')}
                onPress={async () => { await selectLeague(null); await supabase.auth.signOut(); }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.l, marginTop: space.l, marginBottom: space.xl },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  noAvatar: { backgroundColor: colors.line },
});
