import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { t } from '../i18n';
import { passwordStrength } from '../lib/auth';
import { colors, fonts, space, type } from '../theme';
import { Button } from './Button';
import { Txt } from './Txt';

const METER = [colors.red, colors.orange, '#C9A12A', colors.green];

/** Campo de contraseña con el ojo para verla y, si se pide, el medidor de seguridad */
export function PasswordInput({ label, hint, meter, ...rest }: TextInputProps & { label: string; hint?: string; meter?: boolean }) {
  const [visible, setVisible] = useState(false);
  const value = String(rest.value ?? '');
  const level = passwordStrength(value);
  return (
    <View style={{ marginBottom: space.l }}>
      <Txt variant="label" style={{ marginBottom: 4 }}>{label}</Txt>
      <View style={styles.box}>
        <TextInput {...rest} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} accessibilityLabel={label}
                   placeholderTextColor={colors.inkSoft} style={styles.input} />
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8} accessibilityRole="button"
                   accessibilityLabel={visible ? t('auth.hidePassword') : t('auth.showPassword')} style={styles.eye}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.inkSoft} />
        </Pressable>
      </View>
      {meter && value ? (
        <View style={styles.meter} accessibilityLabel={t(`auth.strength.${level}`)}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.bar, { backgroundColor: i <= level ? METER[level] : colors.line }]} />
          ))}
          <Txt variant="small" style={{ width: 76, textAlign: 'right', color: METER[level] }}>{t(`auth.strength.${level}`)}</Txt>
        </View>
      ) : null}
      {hint ? <Txt variant="small" style={{ marginTop: 4 }}>{hint}</Txt> : null}
    </View>
  );
}

/** Código de verificación del correo: solo cifras, grandes y separadas */
export function CodeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <View style={{ marginBottom: space.l }}>
      <Txt variant="label" style={{ marginBottom: 4 }}>{label}</Txt>
      <TextInput value={value} onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad"
                 autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={8} accessibilityLabel={label}
                 placeholder="······" placeholderTextColor={colors.line} style={styles.code} />
    </View>
  );
}

/** Botón de reenviar con cuenta atrás, para no pedir correos seguidos */
export function ResendButton({ onResend, seconds = 60 }: { onResend: () => Promise<void>; seconds?: number }) {
  const [left, setLeft] = useState(seconds);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return (
    <Button kind="quiet" busy={busy} disabled={left > 0}
            label={left > 0 ? t('auth.resendIn', { s: left }) : t('auth.resend')}
            onPress={async () => { setBusy(true); try { await onResend(); setLeft(seconds); } finally { setBusy(false); } }} />
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line,
    borderRadius: 12,
  },
  input: {
    flex: 1, paddingHorizontal: space.m, paddingVertical: 12, fontFamily: fonts.body, fontSize: type.body, color: colors.ink,
  },
  eye: { paddingHorizontal: space.m, paddingVertical: 10 },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  code: {
    backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingVertical: 12,
    textAlign: 'center', fontFamily: fonts.number, fontSize: 30, letterSpacing: 10, color: colors.ink,
  },
});
