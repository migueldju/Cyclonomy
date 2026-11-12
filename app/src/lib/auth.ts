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
  if (m.includes('invalid login credentials')) return t('login.wrong');
  if (m.includes('email not confirmed')) return t('auth.emailNotConfirmed');
  if (m.includes('already registered') || m.includes('already been registered')) return t('auth.alreadyRegistered');
  if (m.includes('token has expired') || m.includes('otp') || m.includes('invalid token')) return t('auth.invalidCode');
  if (m.includes('unable to validate email') || m.includes('invalid format') || m.includes('is invalid')) return t('auth.invalidEmail');
  if (m.includes('different from the old password')) return t('auth.samePassword');
  if (m.includes('password should be') || m.includes('weak')) return t('auth.passwordShort');
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

/** Seguridad de una contraseña, de 0 (débil) a 3 (fuerte): longitud y variedad de caracteres */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  if (password.length < 8) return 0;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if ((kinds >= 3 && password.length >= 12) || (kinds === 4 && password.length >= 10)) return 3;
  if (kinds >= 3 || password.length >= 12) return 2;
  return 1;
}
