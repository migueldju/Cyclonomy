import { Image, StyleSheet } from 'react-native';
import { colors } from '../theme';

/**
 * Bandera pequeña del país (código ISO de 2 letras, como lo da PCS). Imágenes de flagcdn.com (dominio público):
 * los emojis de bandera no se ven en Windows ni en algunos Android.
 */
export function Flag({ code, height = 12 }: { code: string | null | undefined; height?: number }) {
  const cc = (code ?? '').toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return null;
  return (
    <Image source={{ uri: `https://flagcdn.com/w40/${cc}.png` }} accessibilityLabel={cc.toUpperCase()}
           style={[styles.flag, { height, width: Math.round(height * 4 / 3) }]} resizeMode="cover" />
  );
}

const styles = StyleSheet.create({
  flag: { borderRadius: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
});
