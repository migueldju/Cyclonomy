import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { AuthScreen, Divider } from '@/components/AuthCard';
import { PasswordInput } from '@/components/AuthInputs';
import { Button } from '@/components/Button';
import { Input } from '@/components/Inputs';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { t } from '@/i18n';
import { authErrorText, redirectTo, signInWithGoogle } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/theme';

export default function Login() {
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
    <AuthScreen
      footer={<Button label={t('auth.createAccount')} kind="quiet" onPress={() => router.push('/signup')} />}>
      <Txt style={styles.tagline}>{t('login.tagline')}</Txt>
      <Input label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
             autoComplete="email" textContentType="emailAddress" />
      <PasswordInput label={t('auth.password')} value={password} onChangeText={setPassword}
                     autoComplete="current-password" textContentType="password" onSubmitEditing={withEmail} />
      <Link href="/reset-password" style={styles.forgot}><Txt variant="small" style={styles.link}>{t('login.forgot')}</Txt></Link>
      <ErrorText error={error} />
      <Button label={t('login.signIn')} onPress={withEmail} busy={busy === 'email'} disabled={!email || !password} />
      <Divider />
      <Button label={t('login.google')} kind="secondary" leftIcon="logo-google" onPress={withGoogle} busy={busy === 'google'} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  tagline: { fontFamily: fonts.bodyMedium, textAlign: 'center', color: colors.inkSoft, marginBottom: space.xl },
  link: { fontFamily: fonts.bodyBold, color: colors.ink, textDecorationLine: 'underline' },
  forgot: { alignSelf: 'flex-end', marginTop: -space.s, marginBottom: space.m },
});
