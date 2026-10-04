import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Input } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme';

export default function Perfil() {
  const { session } = useAuth();
  const { leagueId, me, refresh, selectLeague } = useLeague();
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
      return 'Foto actualizada.';
    });
  }

  return (
    <Screen padded>
      <View style={styles.head}>
        <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Cambiar foto">
          {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={[styles.avatar, styles.noAvatar]} />}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt variant="title">{name || 'Tu perfil'}</Txt>
          <Button small kind="quiet" label="Cambiar foto" onPress={pickPhoto} busy={busy === 'photo'} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
        </View>
      </View>
      {msg ? <Txt style={{ color: msg.ok ? colors.green : colors.red, marginBottom: space.m }}>{msg.text}</Txt> : null}

      <Input label="Tu nombre" value={name} onChangeText={setName} maxLength={40} />
      <Button kind="secondary" label="Guardar nombre" busy={busy === 'name'}
              onPress={() => run('name', async () => { await api.updateProfile(name, null); return 'Nombre guardado.'; })} />

      {leagueId && me ? (
        <Section title={`Tu equipo en ${me.league_name}`} style={{ marginHorizontal: -space.l }}>
          <View style={{ padding: space.l }}>
            <Input label="Nombre del equipo" value={team} onChangeText={setTeam} maxLength={40} />
            <Button kind="secondary" label="Guardar nombre del equipo" busy={busy === 'team'}
                    onPress={() => run('team', async () => { await api.renameTeam(leagueId, team); return 'Nombre del equipo guardado.'; })} />
          </View>
        </Section>
      ) : null}

      <Section title="Cuenta" style={{ marginHorizontal: -space.l }}>
        <View style={{ padding: space.l }}>
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Button kind="secondary" label="Cambiar email" busy={busy === 'email'}
                  onPress={() => run('email', async () => {
                    const { error } = await supabase.auth.updateUser({ email: email.trim() });
                    if (error) throw new Error(error.message);
                    return 'Te hemos enviado un correo para confirmar el nuevo email.';
                  })} />
          <View style={{ height: space.l }} />
          <Input label="Nueva contraseña" value={password} onChangeText={setPassword} secureTextEntry hint="Al menos 8 caracteres." />
          <Button kind="secondary" label="Cambiar contraseña" busy={busy === 'password'} disabled={password.length < 8}
                  onPress={() => run('password', async () => {
                    const { error } = await supabase.auth.updateUser({ password });
                    if (error) throw new Error(error.message);
                    setPassword('');
                    return 'Contraseña cambiada.';
                  })} />
        </View>
      </Section>

      <View style={{ gap: space.m, marginTop: space.xl }}>
        <Button kind="secondary" label="Cambiar de liga" onPress={() => router.push('/ligas')} />
        {isAdmin ? <Button kind="secondary" label="Carga manual de datos" onPress={() => router.push('/admin')} /> : null}
        <Button kind="danger" label="Cerrar sesión"
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
