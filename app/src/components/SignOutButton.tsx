import type { ViewStyle } from 'react-native';
import { useLeague } from '../context/LeagueContext';
import { t } from '../i18n';
import { supabase } from '../lib/supabase';
import { Button } from './Button';

/** Cerrar sesión: siempre a mano en las pantallas previas a tener liga (recién creada la cuenta) */
export function SignOutButton({ style }: { style?: ViewStyle }) {
  const { selectLeague } = useLeague();
  return (
    <Button kind="quiet" label={t('profile.signOut')} style={style}
            onPress={async () => { await selectLeague(null); await supabase.auth.signOut(); }} />
  );
}
