import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

// Añade esta URL en Supabase → Authentication → URL Configuration → Redirect URLs
// (y la de Expo Go, exp://..., mientras desarrollas)
export const redirectTo = makeRedirectUri({ scheme: 'cyclonomy', path: 'auth/callback' });

// Enlace del email de recuperación de contraseña: abre la pantalla para poner una nueva
export const resetRedirectTo = makeRedirectUri({ scheme: 'cyclonomy', path: 'auth/nueva-contrasena' });

export async function exchangeFromUrl(url: string) {
  const code = new URL(url).searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new Error(error.message);
  }
}

/** Login con Google (OAuth con PKCE): abre el navegador y vuelve a la app con un código */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw new Error(error.message);
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type === 'success') await exchangeFromUrl(res.url);
}
