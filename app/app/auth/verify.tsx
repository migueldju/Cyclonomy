import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AuthScreen } from '@/components/AuthCard';
import { CodeInput, ResendButton } from '@/components/AuthInputs';
import { Button } from '@/components/Button';
import { ErrorText } from '@/components/Section';
import { showToast } from '@/components/Toast';
import { t } from '@/i18n';
import { authErrorText, redirectTo } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/**
 * Confirmar el correo tras crear la cuenta: se escribe el código del email (o se abre su enlace). Al verificar hay
 * sesión y el Gate de _layout lleva a la app.
 */
export default function Verificar() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const address = String(email ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: address, token: code, type: 'signup' });
    setBusy(false);
    if (error) setError(authErrorText(error.message));
  }

  async function resend() {
    setError(null);
    const { error } = await supabase.auth.resend({ type: 'signup', email: address, options: { emailRedirectTo: redirectTo } });
    if (error) setError(authErrorText(error.message));
    else showToast(t('auth.codeSent'));
  }

  return (
    <AuthScreen title={t('signup.checkEmail')} subtitle={t('auth.codeHint', { email: address })}
                footer={<Button label={t('auth.backToLogin')} kind="quiet" onPress={() => router.replace('/login')} />}>
      <CodeInput label={t('auth.code')} value={code} onChange={setCode} />
      <ErrorText error={error} />
      <Button label={t('auth.verify')} onPress={verify} busy={busy} disabled={code.length < 6} />
      <ResendButton onResend={resend} />
    </AuthScreen>
  );
}
