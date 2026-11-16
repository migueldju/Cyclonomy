import { Platform, Share } from 'react-native';
import { showToast } from '../components/Toast';
import { t } from '../i18n';

// En la web el enlace es el de la propia página (se abre en cualquier navegador); en la app, el que la abre
const inviteLink = (code: string) =>
  Platform.OS === 'web' ? `${window.location.origin}/join/${code}` : `cyclonomy://join/${code}`;

export function inviteMessage(league: string, code: string) {
  return t('invite.message', { league, code, link: inviteLink(code) });
}

/** Comparte la invitación; en los navegadores sin menú de compartir, la copia al portapapeles */
export async function shareInvite(league: string, code: string) {
  const message = inviteMessage(league, code);
  if (Platform.OS !== 'web') { await Share.share({ message }); return; }
  try {
    if (navigator.share) { await navigator.share({ text: message }); return; }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;     // cerró el menú sin compartir
  }
  try {
    await navigator.clipboard.writeText(message);
    showToast(t('invite.copied'));
  } catch {
    window.prompt(t('invite.copied'), message);         // sin permiso de portapapeles: se copia a mano
  }
}
