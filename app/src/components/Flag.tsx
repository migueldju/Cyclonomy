import { Image, StyleSheet, View } from 'react-native';

/**
 * Bandera pequeña del país (código ISO de 2 letras, como lo da PCS). Imágenes de flagcdn.com (dominio público):
 * los emojis de bandera no se ven en Windows ni en algunos Android.
 * Cada bandera se ve entera (sin recortar) dentro de una caja fija de proporción 3:2, la más habitual: las más
 * alargadas (Palestina, Sáhara Occidental…) quedan algo más bajas, pero todas ocupan lo mismo y se alinean.
 */
export function Flag({ code, height = 12 }: { code: string | null | undefined; height?: number }) {
  const cc = (code ?? '').toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return null;
  const width = Math.round(height * 1.5);
  return (
    <View style={[styles.box, { width, height }]}>
      <Image source={{ uri: `https://flagcdn.com/w80/${cc}.png` }} accessibilityLabel={cc.toUpperCase()}
             style={{ width, height }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
