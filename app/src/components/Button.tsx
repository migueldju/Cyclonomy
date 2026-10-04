import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors, fonts, type } from '../theme';
import { Txt } from './Txt';

type Kind = 'primary' | 'secondary' | 'danger' | 'quiet';

export function Button({
  label, onPress, kind = 'primary', disabled, busy, style, small,
}: {
  label: string; onPress: () => void; kind?: Kind; disabled?: boolean; busy?: boolean; style?: ViewStyle; small?: boolean;
}) {
  const k = kinds[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.base, small && styles.small, { backgroundColor: k.bg, borderColor: k.border },
        pressed && { opacity: 0.8 }, (disabled || busy) && styles.disabled, style,
      ]}>
      {busy ? <ActivityIndicator color={k.fg} /> : (
        <Txt style={{ fontFamily: fonts.bodyBold, fontSize: small ? type.small : type.body, color: k.fg }}>{label}</Txt>
      )}
    </Pressable>
  );
}

const kinds: Record<Kind, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.jersey, fg: colors.jerseyInk, border: colors.jersey },
  secondary: { bg: colors.paper, fg: colors.ink, border: colors.ink },
  danger: { bg: colors.paper, fg: colors.red, border: colors.red },
  quiet: { bg: 'transparent', fg: colors.ink, border: 'transparent' },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 46, paddingHorizontal: 18, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  small: { minHeight: 34, paddingHorizontal: 12 },
  disabled: { opacity: 0.45 },
});
