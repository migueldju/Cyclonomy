import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { t } from '../i18n';
import { api } from '../lib/api';
import { dayMonth, money, todayISO } from '../lib/format';
import type { RosterRow } from '../lib/types';
import { colors, space } from '../theme';
import { Button } from './Button';
import { showToast } from './Toast';
import { Sheet } from './Modal';
import { ErrorText } from './Section';
import { Txt } from './Txt';

/** 'YYYY-MM-DD' del lunes siguiente a hoy (fecha del juego) más `weeks` semanas */
function nextMonday(weeks = 0): string {
  const d = new Date(`${todayISO()}T12:00:00`);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7) + weeks * 7);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Confirmación para blindar un ciclista la semana que viene: qué protege, qué semana y cuánto cuesta */
export function LockSheet({ row, available, visible, onClose, onDone }: {
  row: RosterRow | null; available: number | null | undefined; visible: boolean; onClose: () => void; onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) setError(null); }, [visible]);
  if (!row) return null;

  const from = nextMonday();
  const sunday = new Date(`${from}T12:00:00`);
  sunday.setDate(sunday.getDate() + 6);
  const to = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
  const after = nextMonday(1);
  const short = available != null && available < row.lock_cost;

  async function confirm() {
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      await api.lockRider(row.ownership_id);
      showToast(t('toast.locked', { name: row.rider_name }));
      onDone?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('lock.title', { name: row.rider_name })}>
      <View style={styles.week}>
        <Ionicons name="lock-closed" size={20} color={colors.ink} />
        <Txt variant="lead">{t('lock.week', { from: dayMonth(from), to: dayMonth(to) })}</Txt>
      </View>
      <Txt style={{ marginBottom: space.s }}>{t('lock.explain', { name: row.rider_name, after: dayMonth(after) })}</Txt>
      <Txt variant="small" style={{ marginBottom: space.l }}>{t('lock.money')}</Txt>
      {short ? <Txt style={{ color: colors.red, marginBottom: space.s }}>{t('lock.noMoney')}</Txt> : null}
      <ErrorText error={error} />
      <Button label={t('lock.confirm', { amount: money(row.lock_cost) })} onPress={confirm} busy={busy} disabled={short} />
      <Button label={t('common.cancel')} kind="quiet" onPress={onClose} style={{ marginTop: space.s }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  week: {
    flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.road, borderRadius: 12,
    padding: space.m, marginBottom: space.m,
  },
});
