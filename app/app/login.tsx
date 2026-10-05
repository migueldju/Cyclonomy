import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bib } from '@/components/Bib';
import { Button } from '@/components/Button';
import { Input } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { signInWithGoogle } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme';

export default function Login() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function withEmail() {
    setBusy('email');
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message);
    setBusy(null);
  }

  async function withGoogle() {
    setBusy('google');
    setError(null);
    try { await signInWithGoogle(); } catch (e) { setError((e as Error).message); }
    setBusy(null);
  }

  return (
    <Screen padded>
      <View style={[styles.hero, { marginTop: insets.top + space.xl }]}>
        <Bib value="1" size="l" />
        <Txt variant="hero" style={styles.title}>Cyclonomy</Txt>
        <Txt variant="small">Ficha, inscribe y suma con los resultados reales.</Txt>
      </View>
      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
             autoComplete="email" textContentType="emailAddress" />
      <Input label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry
             autoComplete="password" textContentType="password" />
      <Link href="/recuperar" style={styles.forgot}><Txt variant="small" style={styles.link}>¿Has olvidado la contraseña?</Txt></Link>
      <ErrorText error={error} />
      <Button label="Entrar" onPress={withEmail} busy={busy === 'email'} disabled={!email || !password} />
      <Button label="Continuar con Google" kind="secondary" onPress={withGoogle} busy={busy === 'google'}
              style={{ marginTop: space.m }} />
      <View style={styles.footer}>
        <Txt variant="small">¿No tienes cuenta? </Txt>
        <Link href="/registro"><Txt style={styles.link}>Crear cuenta</Txt></Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'flex-start', gap: space.m, marginBottom: space.xxl },
  title: { marginTop: space.s },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: space.xl },
  link: { color: colors.ink, textDecorationLine: 'underline' },
  forgot: { alignSelf: 'flex-end', marginTop: -space.s, marginBottom: space.m },
});
