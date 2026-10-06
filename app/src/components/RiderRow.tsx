import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { t } from '../i18n';
import { moneyShort } from '../lib/format';
import type { RiderStatus } from '../lib/types';
import { colors, space } from '../theme';
import { Flag } from './Flag';
import { RiderAvatar } from './RiderAvatar';
import { StatusDot } from './StatusDot';
import { Txt } from './Txt';

/** Fila de ciclista: foto, nombre con bandera y equipo a la izquierda; valor y dato secundario a la derecha. */
export function RiderRow({ name, team, value, detail, status = 'ok', note, onPress, last, right, photo, nationality }: {
  name: string; team?: string | null; value: number; detail?: string; status?: RiderStatus; note?: string;
  onPress?: () => void; last?: boolean; right?: ReactNode; photo?: string | null; nationality?: string | null;
}) {
  const content = (
    <>
      <View style={styles.row}>
        <RiderAvatar url={photo} name={name} team={team} />
        <View style={styles.main}>
          <View style={styles.nameLine}>
            <Txt variant="lead" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Txt>
            <Flag code={nationality} />
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
      </View>
      {!last ? <View style={styles.line} /> : null}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: colors.road }}>{content}</Pressable>
  ) : <View>{content}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, paddingVertical: space.m, gap: space.m },
  main: { flex: 1, gap: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  side: { alignItems: 'flex-end' },
  line: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
});

export const riderStatusNote = (status: RiderStatus) =>
  status === 'incoming' ? t('status.incoming') : status === 'leaving' ? t('status.leaving') : undefined;
