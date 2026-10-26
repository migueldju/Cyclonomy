import { router } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { t } from '@/i18n';
import { redirectTo } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { space } from '@/theme';

export default function Registro() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function signUp() {
    if (password.length < 8) { setError(t('auth.passwordShort')); return; }
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (error) setError(error.message);
    else if (!data.session) setSent(true);      // el proyecto pide confirmar el email
  }

  if (sent) {
    return (
      <Screen padded>
        <Txt variant="display" style={{ marginTop: space.xxl * 2 }}>{t('signup.checkEmail')}</Txt>
        <Txt style={{ marginVertical: space.l }}>
          {t('signup.sent', { email })}
        </Txt>
        <Button label={t('auth.backToLogin')} onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  return (
    <Screen padded>
      <Txt variant="display" style={{ marginTop: space.xxl * 2, marginBottom: space.xl }}>{t('auth.createAccount')}</Txt>
      <Input label={t('auth.yourName')} value={name} onChangeText={setName} maxLength={40} autoComplete="name" />
      <Input label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
             autoComplete="email" />
      <Input label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry
             hint={t('auth.min8')} autoComplete="new-password" />
      <ErrorText error={error} />
      <Button label={t('auth.createAccount')} onPress={signUp} busy={busy} disabled={!name || !email || !password} />
      <Button label={t('signup.haveAccount')} kind="quiet" onPress={() => router.replace('/login')} style={{ marginTop: space.s }} />
    </Screen>
  );
}
