import { router } from 'expo-router';
import { useState } from 'react';
import { AuthScreen } from '@/components/AuthCard';
import { Button } from '@/components/Button';
import { Input } from '@/components/Inputs';
import { ErrorText } from '@/components/Section';
import { t } from '@/i18n';
import { authErrorText, resetRedirectTo } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/** Recuperar la contraseña: Supabase manda un enlace al email que abre la pantalla de contraseña nueva */
export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: resetRedirectTo });
    setBusy(false);
    if (error) setError(authErrorText(error.message));
    // el código del correo se escribe en la pantalla de contraseña nueva (el enlace del correo también la abre)
    else router.push({ pathname: '/auth/new-password', params: { email: email.trim() } });
  }

  return (
    <AuthScreen title={t('reset.title')} subtitle={t('reset.intro')}
                footer={<Button label={t('auth.backToLogin')} kind="quiet" onPress={() => router.replace('/login')} />}>
      <Input label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
             autoComplete="email" textContentType="emailAddress" />
      <ErrorText error={error} />
      <Button label={t('reset.send')} onPress={send} busy={busy} disabled={!email.includes('@')} />
    </AuthScreen>
  );
}
