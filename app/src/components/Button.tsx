import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors, fonts, type } from '../theme';
import { Txt } from './Txt';

type Kind = 'primary' | 'secondary' | 'dark' | 'danger' | 'quiet';

export function Button({
  label, onPress, kind = 'primary', disabled, busy, style, small, icon,
}: {
  label: string; onPress: () => void; kind?: Kind; disabled?: boolean; busy?: boolean; style?: ViewStyle; small?: boolean;
  /** solo el icono (el texto queda para los lectores de pantalla) */
  icon?: ComponentProps<typeof Ionicons>['name'];
}) {
  const k = kinds[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.base, small && styles.small, icon && (small ? styles.iconSmall : styles.icon),
        { backgroundColor: k.bg, borderColor: k.border },
        kind === 'dark' && !(disabled || busy) && styles.raised,
        pressed && { opacity: 0.8 }, (disabled || busy) && styles.disabled, style,
      ]}>
      {busy ? <ActivityIndicator color={k.fg} /> : icon ? (
        <Ionicons name={icon} size={small ? 18 : 22} color={k.fg} />
      ) : (
        <Txt style={{ fontFamily: fonts.bodyBold, fontSize: small ? type.small : type.body, color: k.fg, letterSpacing: 0.3 }}>{label}</Txt>
      )}
    </Pressable>
  );
}

const kinds: Record<Kind, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.jersey, fg: colors.jerseyInk, border: colors.jersey },
  secondary: { bg: colors.paper, fg: colors.ink, border: colors.ink },
  dark: { bg: colors.ink, fg: colors.paper, border: colors.ink },              // llamativo: negro, letra blanca
  danger: { bg: colors.paper, fg: colors.red, border: colors.red },
  quiet: { bg: 'transparent', fg: colors.ink, border: 'transparent' },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 46, paddingHorizontal: 18, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  small: { minHeight: 34, paddingHorizontal: 12 },
  icon: { width: 46, paddingHorizontal: 0 },
  iconSmall: { width: 40, paddingHorizontal: 0 },
  // el oscuro resalta con una sombra corta bajo el botón
  raised: {
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  disabled: { opacity: 0.45 },
});
