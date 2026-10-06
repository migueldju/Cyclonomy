import { StyleSheet, View } from 'react-native';
import type { RiderStatus } from '../lib/types';
import { t } from '../i18n';
import { colors } from '../theme';

/** Naranja: llega el lunes (no se puede inscribir aún). Rojo: se va el lunes. */
export function StatusDot({ status }: { status: RiderStatus }) {
  if (status === 'ok') return null;
  return (
    <View
      accessibilityLabel={status === 'incoming' ? t('status.incomingA11y') : t('status.leavingA11y')}
      style={[styles.dot, { backgroundColor: status === 'incoming' ? colors.orange : colors.red }]}
    />
  );
}

const styles = StyleSheet.create({ dot: { width: 10, height: 10, borderRadius: 5 } });
