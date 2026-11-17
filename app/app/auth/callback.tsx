import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { space } from '@/theme';

/**
 * Vuelta del login con Google cuando el sistema abre la app por el enlace (sobre todo en Android).
 * Canjea el código por la sesión; la redirección la hace el Gate de _layout al detectar la sesión.
 */
export default function AuthCallback() {
  const { code, error: failed, error_description: why } =
    useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const hasSession = async () => !!(await supabase.auth.getSession()).data.session;
      if (await hasSession()) return;
      // Google o Supabase han devuelto un error: se enseña, en vez de quedarse en «Entrando…»
      if (failed || why) { setError(String(why ?? failed).replace(/\+/g, ' ')); return; }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(String(code));
        if (error && !(await hasSession())) setError(error.message);
        return;
      }
      // sin código: se da un momento por si la sesión llega por otro lado (en el móvil la canjea quien abrió el navegador)
      await new Promise((r) => setTimeout(r, 2000));
      if (!(await hasSession())) setError(t('auth.googleNoCode'));
    })();
  }, [code, failed, why]);

  return (
    <Screen padded>
      <Txt style={{ marginTop: space.xxl * 2 }}>{error ? t('callback.failed') : t('callback.entering')}</Txt>
      <ErrorText error={error} />
      {error ? <Button label={t('auth.backToLogin')} onPress={() => router.replace('/login')} /> : null}
    </Screen>
  );
}
