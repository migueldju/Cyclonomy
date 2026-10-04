import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { supabase } from '@/lib/supabase';
import { space } from '@/theme';

/**
 * Vuelta del login con Google cuando el sistema abre la app por el enlace (sobre todo en Android).
 * Canjea el código por la sesión; la redirección la hace el Gate de _layout al detectar la sesión.
 */
export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session && code) {
        const { error } = await supabase.auth.exchangeCodeForSession(String(code));
        if (error) setError(error.message);
      }
    })();
  }, [code]);

  return (
    <Screen padded>
      <Txt style={{ marginTop: space.xxl * 2 }}>{error ? 'No se pudo completar el acceso con Google.' : 'Entrando…'}</Txt>
      <ErrorText error={error} />
      {error ? <Button label="Volver a entrar" onPress={() => router.replace('/login')} /> : null}
    </Screen>
  );
}
