import { router } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { resetRedirectTo } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme';

/** Recuperar la contraseña: Supabase manda un enlace al email que abre la pantalla de contraseña nueva */
export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: resetRedirectTo });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <Screen padded>
      <Txt variant="display" style={{ marginTop: space.xxl * 2 }}>Recuperar la contraseña</Txt>
      {sent ? (
        <>
          <Txt style={{ marginVertical: space.l }}>
            Si hay una cuenta con {email.trim()}, te hemos enviado un enlace para poner una contraseña nueva. Ábrelo
            en este mismo dispositivo.
          </Txt>
          <Txt variant="small" style={{ marginBottom: space.l }}>
            Si entraste siempre con Google, no tienes contraseña: puedes seguir entrando con «Continuar con Google»,
            o usar el enlace para crear una.
          </Txt>
        </>
      ) : (
        <>
          <Txt style={{ marginVertical: space.l }}>
            Escribe el email de tu cuenta y te mandaremos un enlace para poner una contraseña nueva.
          </Txt>
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
                 autoComplete="email" textContentType="emailAddress" />
          <ErrorText error={error} />
          <Button label="Enviar el enlace" onPress={send} busy={busy} disabled={!email.includes('@')} />
        </>
      )}
      <Button label="Volver a entrar" kind="quiet" onPress={() => router.replace('/login')}
              style={{ marginTop: space.m, borderColor: colors.line }} />
    </Screen>
  );
}
