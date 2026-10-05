import { ReactNode, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { t } from '../i18n';
import { money, parseAmount } from '../lib/format';
import { colors, fonts, space, type } from '../theme';
import { Button } from './Button';
import { ErrorText } from './Section';
import { Txt } from './Txt';

/** Hoja inferior genérica */
export function Sheet({ visible, onClose, title, children }: {
  visible: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <KeyboardAvoidingView behavior="padding">
        <View style={styles.sheet}>
          <Txt variant="title" style={{ marginBottom: space.m }}>{title}</Txt>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export interface SheetAction {
  label: string;
  hint?: string;
  kind?: 'primary' | 'secondary' | 'danger';
  onPress: () => Promise<unknown> | void;
}

/** Lista de acciones; ejecuta la elegida y muestra el error del servidor si lo hay */
export function ActionSheet({ visible, onClose, title, subtitle, actions, onDone }: {
  visible: boolean; onClose: () => void; title: string; subtitle?: string; actions: SheetAction[]; onDone?: () => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) setError(null); }, [visible]);

  async function run(i: number) {
    setBusy(i);
    setError(null);
    try {
      await actions[i].onPress();
      onDone?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {subtitle ? <Txt variant="small" style={{ marginBottom: space.m }}>{subtitle}</Txt> : null}
      {actions.length === 0 ? <Txt variant="small">{t('sheet.noActions')}</Txt> : null}
      {actions.map((a, i) => (
        <View key={a.label} style={{ marginBottom: space.m }}>
          <Button label={a.label} kind={a.kind ?? 'secondary'} onPress={() => run(i)} busy={busy === i}
                  disabled={busy !== null && busy !== i} />
          {a.hint ? <Txt variant="small" style={{ marginTop: 4 }}>{a.hint}</Txt> : null}
        </View>
      ))}
      <ErrorText error={error} />
      <Button label={t('common.close')} kind="quiet" onPress={onClose} />
    </Sheet>
  );
}

/** Pide una cantidad en euros (pujas y ofertas) */
export function AmountSheet({ visible, onClose, title, subtitle, min, initial, confirmLabel, onConfirm, onDone }: {
  visible: boolean; onClose: () => void; title: string; subtitle?: string; min?: number; initial?: number;
  confirmLabel: string; onConfirm: (amount: number) => Promise<unknown>; onDone?: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) { setText(initial ? String(initial) : min ? String(min) : ''); setError(null); }
  }, [visible, initial, min]);

  const amount = parseAmount(text);
  const bump = (pct: number) => setText(String(Math.round(((amount ?? min ?? 0) * (1 + pct)) / 1000) * 1000));

  async function confirm() {
    if (amount == null) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(amount);
      onDone?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {subtitle ? <Txt variant="small" style={{ marginBottom: space.m }}>{subtitle}</Txt> : null}
      <TextInput
        value={amount != null ? money(amount).replace(' €', '') : ''}
        onChangeText={setText}
        keyboardType="number-pad"
        style={styles.amount}
        accessibilityLabel={t('sheet.amountLabel')}
        placeholder="0"
        placeholderTextColor={colors.inkSoft}
      />
      <View style={styles.quick}>
        {[0.05, 0.1, 0.25].map((p) => (
          <Button key={p} small kind="secondary" label={`+${p * 100} %`} onPress={() => bump(p)} />
        ))}
      </View>
      {min != null ? <Txt variant="small" style={{ marginBottom: space.m }}>{t('sheet.minimum', { amount: money(min) })}</Txt> : null}
      <ErrorText error={error} />
      <Button label={confirmLabel} onPress={confirm} busy={busy} disabled={amount == null || (min != null && amount < min)} />
      <Button label={t('common.cancel')} kind="quiet" onPress={onClose} style={{ marginTop: space.s }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,39,44,0.45)' },
  sheet: {
    backgroundColor: colors.paper, padding: space.xl, paddingBottom: space.xxl,
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
  },
  amount: {
    fontFamily: fonts.number, fontSize: type.hero, color: colors.ink, borderBottomWidth: 2,
    borderBottomColor: colors.ink, paddingVertical: space.s, marginBottom: space.m,
  },
  quick: { flexDirection: 'row', gap: space.s, marginBottom: space.m },
});
