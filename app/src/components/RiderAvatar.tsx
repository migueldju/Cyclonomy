import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { teamKit } from '../lib/teamKits';
import { colors } from '../theme';

/** Foto redonda de un ciclista; sin foto, el maillot de su equipo. */
export function RiderAvatar({ url, name, team, size = 40 }: {
  url: string | null | undefined; name: string; team?: string | null; size?: number;
}) {
  const [ratio, setRatio] = useState<number | null>(null);     // alto / ancho
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (url) Image.getSize(url, (w, h) => setRatio(h / w), () => setRatio(null));
  }, [url]);
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (!url || failed) {
    return (
      <View style={[styles.base, styles.kitBg, circle]} accessible accessibilityLabel={`${name}: sin foto`}>
        <Jersey team={team} size={size} />
      </View>
    );
  }
  // en los retratos la cara está arriba: se recorta sobre todo por abajo
  const tall = ratio != null && ratio > 1;
  const imgH = tall ? size * ratio! : size;
  return (
    <View style={[styles.base, circle]}>
      <Image source={{ uri: url }} accessibilityLabel={`Foto de ${name}`} resizeMode="cover" onError={() => setFailed(true)}
             style={{ width: size, height: imgH, top: tall ? -(imgH - size) * 0.15 : 0 }} />
    </View>
  );
}

/** Maillot de manga corta con los colores del equipo: cuerpo, mangas y franja en el pecho, cuello */
function Jersey({ team, size }: { team?: string | null; size: number }) {
  const [main, second] = teamKit(team);
  const outline = 'rgba(30,39,44,0.55)';
  return (
    <Svg width={size * 0.78} height={size * 0.78} viewBox="0 0 64 64">
      {/* cuerpo */}
      <Path d="M20 13 L26 9.5 Q32 14 38 9.5 L44 13 L44 56 L20 56 Z" fill={main} stroke={outline} strokeWidth={1.2}
            strokeLinejoin="round" />
      {/* franja del pecho */}
      <Rect x={20.6} y={29} width={22.8} height={6} fill={second} />
      {/* mangas */}
      <Path d="M20 13 L9 21 L14 30 L20 26.5 Z" fill={second} stroke={outline} strokeWidth={1.2} strokeLinejoin="round" />
      <Path d="M44 13 L55 21 L50 30 L44 26.5 Z" fill={second} stroke={outline} strokeWidth={1.2} strokeLinejoin="round" />
      {/* cuello */}
      <Path d="M26 9.5 Q32 15.5 38 9.5" fill="none" stroke={second} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', backgroundColor: colors.line },
  kitBg: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4E9E6' },
});
