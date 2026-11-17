import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { t } from '../i18n';
import { money, parseAmount } from '../lib/format';
import { useWide } from '../lib/layout';
import { colors, fonts, space, themed, type } from '../theme';
import { Button } from './Button';
import { showToast } from './Toast';
import { ErrorText } from './Section';
import { Txt } from './Txt';

/** Hoja inferior genérica */
export function Sheet({ visible, onClose, title, children, above, onTitlePress }: {
  visible: boolean; onClose: () => void; title: string; children: ReactNode;
  onTitlePress?: () => void;  // título pulsable (p. ej. ir a la ficha del ciclista): cierra la hoja y lo ejecuta
  above?: ReactNode;          // tarjeta flotante en el hueco libre, pegada encima de la hoja
}) {
  const wide = useWide();
  const title_ = onTitlePress ? (
    <Pressable onPress={() => { onClose(); onTitlePress(); }} accessibilityRole="link" accessibilityLabel={title}
               style={({ pressed }) => [styles.titleLink, pressed && { opacity: 0.6 }]}>
      <Txt variant="title" style={{ flexShrink: 1 }}>{title}</Txt>
      <Ionicons name="eye-outline" size={20} color={colors.ink} />
    </Pressable>
  ) : <Txt variant="title" style={{ marginBottom: space.m }}>{title}</Txt>;

  // web de escritorio: diálogo centrado, con la tarjeta flotante (`above`) encima
  if (wide) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.center}>
          <Pressable style={[styles.backdrop, StyleSheet.absoluteFill]} onPress={onClose} accessibilityLabel={t('common.close')} />
          {above ? <View style={styles.dialogAbove} pointerEvents="box-none">{above}</View> : null}
          <View style={styles.dialog}>
            {title_}
            {children}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={[styles.backdrop, StyleSheet.absoluteFill]} onPress={onClose} accessibilityLabel={t('common.close')} />
        {above ? <View style={styles.above} pointerEvents="box-none">{above}</View> : null}
      </View>
      <KeyboardAvoidingView behavior="padding">
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {title_}
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
  /** con icono, la acción se muestra como fila compacta: icono, nombre y `detail` (un dato corto) */
  icon?: ComponentProps<typeof Ionicons>['name'];
  detail?: string;
  /** aviso momentáneo al terminar bien */
  done?: string;
}

/** Lista de acciones; ejecuta la elegida y muestra el error del servidor si lo hay */
export function ActionSheet({ visible, onClose, title, subtitle, actions, onDone, header, footer, above, onTitlePress }: {
  onTitlePress?: () => void;  // ver Sheet
  above?: ReactNode;          // ver Sheet
  visible: boolean; onClose: () => void; title: string; subtitle?: string; actions: SheetAction[]; onDone?: () => void;
  /** contenido propio sobre las acciones (cifras) y junto a «Cerrar» (botón de información) */
  header?: ReactNode; footer?: ReactNode;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) setError(null); }, [visible]);

  async function run(i: number) {
    setBusy(i);
    setError(null);
    try {
      await actions[i].onPress();
      if (actions[i].done) showToast(actions[i].done!);
      onDone?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={title} above={above} onTitlePress={onTitlePress}>
      {subtitle ? <Txt variant="small" style={{ marginBottom: space.m }}>{subtitle}</Txt> : null}
      {header}
      {actions.length === 0 && !subtitle ? <Txt variant="small">{t('sheet.noActions')}</Txt> : null}
      {actions.map((a, i) => a.icon ? (
        <Pressable key={a.label} onPress={() => run(i)} disabled={busy !== null} accessibilityRole="button"
                   accessibilityLabel={a.label}
                   style={({ pressed }) => [styles.action, a.kind === 'primary' && styles.actionPrimary,
                                            pressed && { opacity: 0.75 }, busy !== null && busy !== i && { opacity: 0.45 }]}>
          <View style={[styles.actionIcon, a.kind === 'primary' && { backgroundColor: colors.paper }]}>
            <Ionicons name={a.icon} size={20} color={a.kind === 'danger' ? colors.red : colors.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt style={styles.actionLabel}>{a.label}</Txt>
            {a.detail ? <Txt variant="small" style={a.kind === 'primary' ? { color: colors.jerseyInk } : undefined}>{a.detail}</Txt> : null}
          </View>
          {busy === i ? <ActivityIndicator color={colors.ink} />
            : <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />}
        </Pressable>
      ) : (
        <View key={a.label} style={{ marginBottom: space.m }}>
          <Button label={a.label} kind={a.kind ?? 'secondary'} onPress={() => run(i)} busy={busy === i}
                  disabled={busy !== null && busy !== i} />
          {a.hint ? <Txt variant="small" style={{ marginTop: 4 }}>{a.hint}</Txt> : null}
        </View>
      ))}
      <ErrorText error={error} />
      {footer ? (
        <View style={styles.foot}>
          {footer}
          <Button label={t('common.close')} kind="quiet" onPress={onClose} />
        </View>
      ) : <Button label={t('common.close')} kind="quiet" onPress={onClose} />}
    </Sheet>
  );
}

/** Pide una cantidad en euros (pujas y ofertas) */
export function AmountSheet({ visible, onClose, title, subtitle, chips, min, initial, confirmLabel, onConfirm, onDone, done, quick = true, onTitlePress }: {
  onTitlePress?: () => void;  // ver Sheet
  quick?: boolean;            // atajos +5 %, +10 % y +25 %
  visible: boolean; onClose: () => void; title: string; subtitle?: string; min?: number; initial?: number;
  /** datos cortos con icono (equipo, cierre…), en vez de una frase */
  chips?: { icon: ComponentProps<typeof Ionicons>['name']; text: string }[];
  confirmLabel: string; onConfirm: (amount: number) => Promise<unknown>; onDone?: () => void;
  done?: (amount: number) => string;          // aviso momentáneo al terminar bien
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
      if (done) showToast(done(amount));
      onDone?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={title} onTitlePress={onTitlePress}>
      {subtitle ? <Txt variant="small" style={{ marginBottom: space.m }}>{subtitle}</Txt> : null}
      {chips?.length ? (
        <View style={styles.chips}>
          {chips.map((c) => (
            <View key={c.text} style={styles.chip}>
              <Ionicons name={c.icon} size={14} color={colors.inkSoft} />
              <Txt variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>{c.text}</Txt>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.amountBox}>
        <TextInput
          value={amount != null ? money(amount).replace(' €', '') : ''}
          onChangeText={setText}
          keyboardType="number-pad"
          style={styles.amount}
          accessibilityLabel={t('sheet.amountLabel')}
          placeholder="0"
          placeholderTextColor={colors.inkSoft}
        />
        <Txt style={styles.euro}>€</Txt>
      </View>
      {min != null ? (
        <Txt variant="small" style={[{ textAlign: 'center', marginBottom: space.m }, amount != null && amount < min && { color: colors.red }]}>
          {t('sheet.minimum', { amount: money(min) })}
        </Txt>
      ) : null}
      {quick ? <View style={styles.quick}>
        {[0.05, 0.1, 0.25].map((p) => (
          <Pressable key={p} onPress={() => bump(p)} accessibilityRole="button" accessibilityLabel={`+${p * 100} %`}
                     style={({ pressed }) => [styles.bump, pressed && { opacity: 0.7 }]}>
            <Txt style={styles.bumpText}>+{p * 100} %</Txt>
          </Pressable>
        ))}
      </View> : null}
      <ErrorText error={error} />
      <Button label={confirmLabel} onPress={confirm} busy={busy} disabled={amount == null || (min != null && amount < min)} />
      <Button label={t('common.cancel')} kind="quiet" onPress={onClose} style={{ marginTop: space.s }} />
    </Sheet>
  );
}

const styles = themed(() => StyleSheet.create({
  action: {
    flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.m, paddingHorizontal: space.m,
    borderRadius: 14, backgroundColor: colors.road, marginBottom: space.s,
  },
  actionPrimary: { backgroundColor: colors.jersey },
  actionIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.ink },
  backdrop: { flex: 1, backgroundColor: 'rgba(30,39,44,0.45)' },
  titleLink: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%', marginBottom: space.m },
  above: { flex: 1, justifyContent: 'flex-end', padding: space.l, width: '100%', maxWidth: 720, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.m },
  dialog: { width: '100%', maxWidth: 520, maxHeight: '90%', backgroundColor: colors.paper, borderRadius: 24, padding: space.xl,
            overflow: 'auto' as 'scroll' },      // en la web, barra de desplazamiento solo si no cabe
  dialogAbove: { width: '100%', maxWidth: 520 },
  sheet: {
    width: '100%', maxWidth: 720, alignSelf: 'center',
    backgroundColor: colors.paper, padding: space.xl, paddingTop: space.m, paddingBottom: space.xxl,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: space.l },
  amountBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s, backgroundColor: colors.road,
    borderRadius: 18, paddingHorizontal: space.l, paddingVertical: space.m, marginBottom: space.s,
  },
  amount: {
    flexShrink: 1, minWidth: 60, textAlign: 'center', fontFamily: fonts.number, fontSize: type.hero, color: colors.ink,
    paddingVertical: 0,
  },
  euro: { fontFamily: fonts.number, fontSize: type.title, color: colors.inkSoft },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginBottom: space.m },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', backgroundColor: colors.road, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  quick: { flexDirection: 'row', gap: space.s, marginBottom: space.l },
  bump: { flex: 1, alignItems: 'center', backgroundColor: colors.road, borderRadius: 999, paddingVertical: 9 },
  bumpText: { fontFamily: fonts.bodyBold, fontSize: type.small, color: colors.ink },
}));
