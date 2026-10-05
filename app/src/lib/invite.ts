import { t } from '../i18n';

export function inviteMessage(league: string, code: string) {
  return t('invite.message', { league, code, link: `cyclonomy://unirse/${code}` });
}
