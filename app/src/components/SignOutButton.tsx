import type { ViewStyle } from 'react-native';
import { useLeague } from '../context/LeagueContext';
import { t } from '../i18n';
import { supabase } from '../lib/supabase';
import { Button } from './Button';

/**
 * Salir de la cuenta: siempre a mano en las pantallas previas a tener liga. Sin liga abierta (recién creada la cuenta)
 * se llama «Cancelar», porque es abandonar el alta; con liga, «Cerrar sesión».
 */
export function SignOutButton({ style }: { style?: ViewStyle }) {
  const { selectLeague, leagueId } = useLeague();
  return (
    <Button kind="quiet" label={t(leagueId ? 'profile.signOut' : 'common.cancel')} style={style}
            onPress={async () => { await selectLeague(null); await supabase.auth.signOut(); }} />
  );
}
