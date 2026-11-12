import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { t } from '../i18n';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

// Supabase solo devuelve a la app si esta URL está en Authentication → URL Configuration → Redirect URLs.
// En la app instalada es cyclonomy://auth/callback; en Expo Go, exp://<IP del ordenador>:<puerto>/--/auth/callback,
// que cambia con la red: lo práctico es permitir los comodines  cyclonomy://**  y  exp://**
export const redirectTo = makeRedirectUri({ scheme: 'cyclonomy', path: 'auth/callback' });
if (__DEV__) console.log('[auth] URL de vuelta (debe estar permitida en Supabase):', redirectTo);

// Enlace del email de recuperación de contraseña: abre la pantalla para poner una nueva
export const resetRedirectTo = makeRedirectUri({ scheme: 'cyclonomy', path: 'auth/new-password' });

export async function exchangeFromUrl(url: string) {
  // el error puede venir en la consulta (?error=) o tras la almohadilla (#error=)
  const u = new URL(url);
  const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
  const failed = u.searchParams.get('error_description') ?? hash.get('error_description')
    ?? u.searchParams.get('error') ?? hash.get('error');
  if (failed) throw new Error(failed.replace(/\+/g, ' '));
  const code = u.searchParams.get('code');
  // sin código no hay sesión: antes se quedaba en la pantalla de acceso sin decir nada
  if (!code) throw new Error(t('auth.googleNoCode'));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw new Error(error.message);
}

/** Mensaje claro para los fallos del servidor al mandar correos (alta y recuperación de contraseña) */
export function authErrorText(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('rate limit') || m.includes('security purposes')) return t('auth.rateLimited');
  if (m.includes('error sending') || m.includes('not authorized') || m.includes('smtp')) return t('auth.emailSendFailed');
  return message;
}

/** Login con Google (OAuth con PKCE): abre el navegador y vuelve a la app con un código */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw new Error(error.message);
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return;                 // cerró el navegador, o Android ya abrió /auth/callback
  // en Android la vuelta puede llegar también por el enlace (auth/callback): si ya hay sesión, nada que canjear
  if ((await supabase.auth.getSession()).data.session) return;
  await exchangeFromUrl(res.url);
}
