import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { CodeInput, PasswordInput } from '@/components/AuthInputs';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { t } from '@/i18n';
import { authErrorText } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme';

/**
 * Se abre desde el enlace del email de recuperación: canjea el código por una sesión y deja poner una
 * contraseña nueva. El Gate de _layout no saca de aquí aunque ya haya sesión.
 */
export default function NuevaContrasena() {
  const { code, email } = useLocalSearchParams<{ code?: string; email?: string }>();
  const byCode = !code && !!email;            // viene de «Recuperar la contraseña»: falta el código del correo
  const [otp, setOtp] = useState('');
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(String(code));
        // un código ya usado (p. ej. al recargar) falla, pero si ya hay sesión se puede seguir
        if (error && !(await supabase.auth.getSession()).data.session) {
          setError(t('newpass.expired'));
          return;
        }
      } else if (!byCode && !(await supabase.auth.getSession()).data.session) {
        setError(t('newpass.openFromEmail'));
        return;
      }
      setReady(true);
    })();
  }, [code, byCode]);

  async function save() {
    if (password.length < 8) { setError(t('auth.passwordShort')); return; }
    if (password !== repeat) { setError(t('newpass.mismatch')); return; }
    setBusy(true);
    setError(null);
    if (byCode && !(await supabase.auth.getSession()).data.session) {
      const { error } = await supabase.auth.verifyOtp({ email: String(email), token: otp, type: 'recovery' });
      if (error) { setBusy(false); setError(authErrorText(error.message)); return; }
    }
    const { error } = await supabase.auth.updateUser({ password, data: { has_password: true } });
    setBusy(false);
    if (error) setError(authErrorText(error.message));
    else setDone(true);
  }

  return (
    <Screen padded>
      <Txt variant="display" style={{ marginTop: space.xxl * 2, marginBottom: space.l }}>{t('newpass.title')}</Txt>
      {done ? (
        <>
          <Txt style={{ marginBottom: space.l, color: colors.green }}>{t('newpass.saved')}</Txt>
          <Button label={t('newpass.goToApp')} onPress={() => router.replace('/')} />
        </>
      ) : ready ? (
        <>
          {byCode ? (
            <>
              <Txt style={{ marginBottom: space.l }}>{t('auth.codeHint', { email: String(email) })}</Txt>
              <CodeInput label={t('auth.code')} value={otp} onChange={setOtp} />
            </>
          ) : null}
          <PasswordInput label={t('newpass.title')} value={password} onChangeText={setPassword} meter
                         autoComplete="new-password" textContentType="newPassword" />
          <PasswordInput label={t('newpass.repeat')} value={repeat} onChangeText={setRepeat}
                         autoComplete="new-password" textContentType="newPassword" />
          <ErrorText error={error} />
          <Button label={t('newpass.save')} onPress={save} busy={busy}
                  disabled={!password || !repeat || (byCode && otp.length < 6)} />
          {byCode ? <Button label={t('auth.backToLogin')} kind="quiet" onPress={() => router.replace('/login')} /> : null}
        </>
      ) : (
        <>
          {error ? null : <Txt>{t('newpass.checking')}</Txt>}
          <ErrorText error={error} />
          {error ? <Button label={t('auth.backToLogin')} onPress={() => router.replace('/login')} /> : null}
        </>
      )}
    </Screen>
  );
}
