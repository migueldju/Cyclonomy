import { Image } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { t } from '@/i18n';
import { authErrorText, resetRedirectTo } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme';

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
    <Screen padded>
      <Image source={require('../assets/logo-horizontal.png')} style={{ width: 180, height: 30, marginTop: space.xxl * 2 }}
             resizeMode="contain" accessibilityLabel="Cyclonomy" />
      <Txt variant="display" style={{ marginTop: space.xl }}>{t('reset.title')}</Txt>
      <Txt style={{ marginVertical: space.l }}>
        {t('reset.intro')}
      </Txt>
      <Input label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
             autoComplete="email" textContentType="emailAddress" />
      <ErrorText error={error} />
      <Button label={t('reset.send')} onPress={send} busy={busy} disabled={!email.includes('@')} />
      <Button label={t('auth.backToLogin')} kind="quiet" onPress={() => router.replace('/login')}
              style={{ marginTop: space.m, borderColor: colors.line }} />
    </Screen>
  );
}
