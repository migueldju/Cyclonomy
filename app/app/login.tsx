import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PasswordInput } from '@/components/AuthInputs';
import { Button } from '@/components/Button';
import { Input } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { t } from '@/i18n';
import { authErrorText, redirectTo, signInWithGoogle } from '@/lib/auth';
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
    if (error?.message.toLowerCase().includes('email not confirmed')) {
      // cuenta sin confirmar: se manda otro código y se pasa a escribirlo
      await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectTo } });
      router.push({ pathname: '/auth/verify', params: { email: email.trim() } });
    } else if (error) setError(authErrorText(error.message));
    setBusy(null);
  }

  async function withGoogle() {
    setBusy('google');
    setError(null);
    try { await signInWithGoogle(); } catch (e) { setError(authErrorText((e as Error).message)); }
    setBusy(null);
  }

  return (
    <Screen padded>
      <View style={[styles.hero, { marginTop: insets.top + space.xl }]}>
        <Image source={require('../assets/logo-horizontal.png')} style={styles.logo} resizeMode="contain"
               accessibilityLabel="Cyclonomy" />
        <Txt variant="small">{t('login.tagline')}</Txt>
      </View>
      <Input label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
             autoComplete="email" textContentType="emailAddress" />
      <PasswordInput label={t('auth.password')} value={password} onChangeText={setPassword}
                     autoComplete="current-password" textContentType="password" onSubmitEditing={withEmail} />
      <Link href="/reset-password" style={styles.forgot}><Txt variant="small" style={styles.link}>{t('login.forgot')}</Txt></Link>
      <ErrorText error={error} />
      <Button label={t('login.signIn')} onPress={withEmail} busy={busy === 'email'} disabled={!email || !password} />
      <Button label={t('login.google')} kind="secondary" onPress={withGoogle} busy={busy === 'google'}
              style={{ marginTop: space.m }} />
      <View style={styles.footer}>
        <Txt variant="small">{t('login.noAccount')} </Txt>
        <Link href="/signup"><Txt style={styles.link}>{t('auth.createAccount')}</Txt></Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'flex-start', gap: space.m, marginBottom: space.xxl },
  logo: { width: 232, height: 39 },          // 1200 × 202
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: space.xl },
  link: { color: colors.ink, textDecorationLine: 'underline' },
  forgot: { alignSelf: 'flex-end', marginTop: -space.s, marginBottom: space.m },
});
