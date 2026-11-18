import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { t } from '../i18n';
import { authErrorText, redirectTo, signInWithGoogle } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { colors, fonts, space, themed } from '../theme';
import { Divider } from './AuthCard';
import { PasswordInput } from './AuthInputs';
import { Button } from './Button';
import { Input } from './Inputs';
import { ErrorText } from './Section';
import { Txt } from './Txt';

/** Formulario de entrar (correo y contraseña, o Google): la pantalla de acceso y el desplegable de la portada */
export function LoginForm() {
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
    <>
      <Input label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
             autoComplete="email" textContentType="emailAddress" />
      <PasswordInput label={t('auth.password')} value={password} onChangeText={setPassword}
                     autoComplete="current-password" textContentType="password" onSubmitEditing={withEmail} />
      <Link href="/reset-password" style={styles.forgot}><Txt variant="small" style={styles.link}>{t('login.forgot')}</Txt></Link>
      <ErrorText error={error} />
      <Button label={t('login.signIn')} onPress={withEmail} busy={busy === 'email'} disabled={!email || !password} />
      <Divider />
      <Button label={t('login.google')} kind="secondary" leftIcon="logo-google" onPress={withGoogle} busy={busy === 'google'} />
    </>
  );
}

/** Formulario de crear cuenta: la pantalla de alta y el desplegable de la portada */
export function SignupForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signUp() {
    if (password.length < 8) { setError(t('auth.passwordShort')); return; }
    setBusy('email');
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: redirectTo },
    });
    setBusy(null);
    if (error) setError(authErrorText(error.message));
    // con un correo ya registrado Supabase no da error (para no revelar cuentas): devuelve un usuario sin identidades
    else if (data.user && data.user.identities?.length === 0) setError(t('auth.alreadyRegistered'));
    // el proyecto pide confirmar el correo: se escribe el código que llega (o se abre el enlace)
    else if (!data.session) router.push({ pathname: '/auth/verify', params: { email: email.trim() } });
  }

  async function withGoogle() {
    setBusy('google');
    setError(null);
    try { await signInWithGoogle(); } catch (e) { setError(authErrorText((e as Error).message)); }
    setBusy(null);
  }

  return (
    <>
      <Input label={t('auth.yourName')} value={name} onChangeText={setName} maxLength={40} autoComplete="name" />
      <Input label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
             autoComplete="email" />
      <PasswordInput label={t('auth.password')} value={password} onChangeText={setPassword} meter
                     placeholder={t('auth.min8')} autoComplete="new-password" textContentType="newPassword" />
      <ErrorText error={error} />
      <Button label={t('auth.createAccount')} onPress={signUp} busy={busy === 'email'}
              disabled={!name.trim() || !email.includes('@') || !password} />
      <Divider />
      <Button label={t('login.google')} kind="secondary" leftIcon="logo-google" onPress={withGoogle} busy={busy === 'google'} />
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  link: { fontFamily: fonts.bodyBold, color: colors.ink, textDecorationLine: 'underline' },
  forgot: { alignSelf: 'flex-end', marginTop: -space.s, marginBottom: space.m },
}));
