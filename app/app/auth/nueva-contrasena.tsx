import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { ErrorText } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme';

/**
 * Se abre desde el enlace del email de recuperación: canjea el código por una sesión y deja poner una
 * contraseña nueva. El Gate de _layout no saca de aquí aunque ya haya sesión.
 */
export default function NuevaContrasena() {
  const { code } = useLocalSearchParams<{ code?: string }>();
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
          setError('El enlace ha caducado o ya se ha usado. Pide otro desde «¿Has olvidado la contraseña?».');
          return;
        }
      } else if (!(await supabase.auth.getSession()).data.session) {
        setError('Abre esta pantalla desde el enlace del email de recuperación.');
        return;
      }
      setReady(true);
    })();
  }, [code]);

  async function save() {
    if (password.length < 8) { setError('La contraseña necesita al menos 8 caracteres.'); return; }
    if (password !== repeat) { setError('Las dos contraseñas no coinciden.'); return; }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else setDone(true);
  }

  return (
    <Screen padded>
      <Txt variant="display" style={{ marginTop: space.xxl * 2, marginBottom: space.l }}>Contraseña nueva</Txt>
      {done ? (
        <>
          <Txt style={{ marginBottom: space.l, color: colors.green }}>Contraseña guardada. Ya puedes entrar con ella.</Txt>
          <Button label="Ir a la app" onPress={() => router.replace('/')} />
        </>
      ) : ready ? (
        <>
          <Input label="Contraseña nueva" value={password} onChangeText={setPassword} secureTextEntry
                 autoComplete="new-password" textContentType="newPassword" />
          <Input label="Repite la contraseña" value={repeat} onChangeText={setRepeat} secureTextEntry
                 autoComplete="new-password" textContentType="newPassword" />
          <ErrorText error={error} />
          <Button label="Guardar la contraseña" onPress={save} busy={busy} disabled={!password || !repeat} />
        </>
      ) : (
        <>
          {error ? null : <Txt>Comprobando el enlace…</Txt>}
          <ErrorText error={error} />
          {error ? <Button label="Volver a entrar" onPress={() => router.replace('/login')} /> : null}
        </>
      )}
    </Screen>
  );
}
