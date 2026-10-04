import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { moneyShort } from '../lib/format';
import type { RiderStatus } from '../lib/types';
import { space } from '../theme';
import { Row } from './Section';
import { StatusDot } from './StatusDot';
import { Txt } from './Txt';

/** Fila de ciclista: nombre y equipo a la izquierda; valor y dato secundario a la derecha. */
export function RiderRow({ name, team, value, detail, status = 'ok', note, onPress, last, right }: {
  name: string; team?: string | null; value: number; detail?: string; status?: RiderStatus; note?: string;
  onPress?: () => void; last?: boolean; right?: ReactNode;
}) {
  return (
    <Row onPress={onPress} last={last}>
      <View style={styles.main}>
        <View style={styles.nameLine}>
          <Txt variant="lead" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Txt>
          <StatusDot status={status} />
        </View>
        <Txt variant="small" numberOfLines={1}>{[team, note].filter(Boolean).join(' · ')}</Txt>
      </View>
      {right ?? (
        <View style={styles.side}>
          <Txt variant="number">{moneyShort(value)}</Txt>
          {detail ? <Txt variant="small">{detail}</Txt> : null}
        </View>
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, gap: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  side: { alignItems: 'flex-end' },
});

export const riderStatusNote = (status: RiderStatus) =>
  status === 'incoming' ? 'llega el lunes' : status === 'leaving' ? 'se va el lunes' : undefined;

