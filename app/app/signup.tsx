import { router } from 'expo-router';
import { useState } from 'react';
import { AuthScreen } from '@/components/AuthCard';
import { PasswordInput } from '@/components/AuthInputs';
import { Button } from '@/components/Button';
import { Input } from '@/components/Inputs';
import { ErrorText } from '@/components/Section';
import { t } from '@/i18n';
import { authErrorText, redirectTo } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function Registro() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signUp() {
    if (password.length < 8) { setError(t('auth.passwordShort')); return; }
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (error) setError(authErrorText(error.message));
    // con un correo ya registrado Supabase no da error (para no revelar cuentas): devuelve un usuario sin identidades
    else if (data.user && data.user.identities?.length === 0) setError(t('auth.alreadyRegistered'));
    // el proyecto pide confirmar el correo: se escribe el código que llega (o se abre el enlace)
    else if (!data.session) router.push({ pathname: '/auth/verify', params: { email: email.trim() } });
  }

  return (
    <AuthScreen title={t('auth.createAccount')}
                footer={<Button label={t('signup.haveAccount')} kind="quiet" onPress={() => router.replace('/login')} />}>
      <Input label={t('auth.yourName')} value={name} onChangeText={setName} maxLength={40} autoComplete="name" />
      <Input label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
             autoComplete="email" />
      <PasswordInput label={t('auth.password')} value={password} onChangeText={setPassword} meter
                     placeholder={t('auth.min8')} autoComplete="new-password" textContentType="newPassword" />
      <ErrorText error={error} />
      <Button label={t('auth.createAccount')} onPress={signUp} busy={busy} disabled={!name.trim() || !email.includes('@') || !password} />
    </AuthScreen>
  );
}
