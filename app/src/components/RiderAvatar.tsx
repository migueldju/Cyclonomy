import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { t } from '../i18n';
import { teamKit } from '../lib/teamKits';
import { colors } from '../theme';

/** Foto redonda de un ciclista; sin foto, un ciclista ficticio con el maillot de su equipo. */
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
      <View style={[styles.base, styles.figureBg, circle]} accessible accessibilityLabel={t('avatar.noPhoto', { name })}>
        <Cyclist team={team} name={name} size={size} />
      </View>
    );
  }
  // en los retratos la cara está arriba: se recorta sobre todo por abajo
  const tall = ratio != null && ratio > 1;
  const imgH = tall ? size * ratio! : size;
  return (
    <View style={[styles.base, circle]}>
      <Image source={{ uri: url }} accessibilityLabel={t('avatar.photo', { name })} resizeMode="cover" onError={() => setFailed(true)}
             style={{ width: size, height: imgH, top: tall ? -(imgH - size) * 0.15 : 0 }} />
    </View>
  );
}

// Rasgos del ciclista ficticio. Todo sale del nombre: el mismo ciclista se ve siempre igual.
// Un solo tono de piel (no sabemos el de cada ciclista: mejor no inventarlo); varían pelo, ojos y barba
const SKIN = '#EAC4A3';
const SHADE = '#D2A27E';
const HAIR = ['#2A211C', '#3B2A20', '#5A3A24', '#7A5032', '#B38B55', '#8E4A26'];   // de negro a rubio y pelirrojo
const IRIS = ['#3B2A20', '#5A3A24', '#4F6E86', '#5E7A4C'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

// Peinados (caja de 100 × 100, cabeza de x 35 a 65, de y 9 a 51)
const HAIRSTYLES = [
  // corto con flequillo
  'M34.5 29 C33 12 42 5.5 51 6 C60 6.5 67 12 65.5 29 C64.5 22 61.5 17.5 56 17 C51 19 43 19 38.5 17.5 C36.3 20.5 35.2 24.5 34.5 29 Z',
  // raya al lado
  'M34.5 28 C33.5 11 43 5 52 6 C61 7 67 13 65.5 28 C64 20 61.5 15.5 57 14.5 C51 17 44 19 39 19.5 C36.6 21.5 35.3 24.5 34.5 28 Z',
  // rapado
  'M35.4 26 C35.4 13 42 8.4 50 8.4 C58 8.4 64.6 13 64.6 26 C61.5 19 56 15.8 50 15.8 C44 15.8 38.5 19 35.4 26 Z',
  // ondulado / más volumen
  'M33.8 30 C31 16 37 6 46 5 C50 3.8 55 4.2 58.5 6 C64.5 8.5 68.5 16 66.2 30 C65.2 23 62.5 18.6 58.5 17.2 C56.5 19 53 19.6 50 18.8 C47 19.8 43 19.5 40.5 17.8 C37 19.5 34.8 24 33.8 30 Z',
];

/**
 * Ciclista ficticio: el minimaillot del equipo como torso y una cabeza ilustrada encima (sin casco ni gafas).
 * Coordenadas en una caja de 100 × 100 que se escala al tamaño del avatar. Sin degradados: con muchos avatares
 * en pantalla los ids de los degradados chocarían en la web.
 */
function Cyclist({ team, name, size }: { team?: string | null; name: string; size: number }) {
  const kit = teamKit(team);
  const h = hash(name);
  const skin = SKIN;
  const shade = SHADE;
  const hair = HAIR[(h >>> 4) % HAIR.length];
  const style = HAIRSTYLES[(h >>> 8) % HAIRSTYLES.length];
  const iris = IRIS[(h >>> 12) % IRIS.length];
  const stubble = (h >>> 16) % 3 === 0;
  const u = size / 100;
  const layer = { position: 'absolute' as const, left: 0, top: 0 };
  return (
    <>
      {/* torso: minimaillot del equipo o, si no hay, un maillot dibujado con sus colores */}
      {kit.jersey ? (
        <Image source={kit.jersey} resizeMode="contain"
               style={{ position: 'absolute', width: 112 * u, height: 112 * u, left: -6 * u, top: 52 * u }} />
      ) : (
        <Svg width={size} height={size} viewBox="0 0 100 100" style={layer}>
          <Path d="M14 74 Q28 62 41 60 Q50 66 59 60 Q72 62 86 74 L94 100 L6 100 Z" fill={kit.main}
                stroke="rgba(30,39,44,0.35)" strokeWidth={1.2} />
          <Path d="M41 60 Q50 68 59 60" fill="none" stroke={kit.second} strokeWidth={3} />
        </Svg>
      )}
      {/* cabeza */}
      <Svg width={size} height={size} viewBox="0 0 100 100" style={layer}>
        {/* cuello: delante del maillot y cortado en el borde delantero de su cuello (medido en los renders:
            hueco de x 37 a 64, borde que baja de y 58.6 en los lados a 62.5 en el centro) */}
        <Path d="M43.5 44 L56.5 44 L60 58.4 Q50 66.6 40 58.4 Z" fill={skin} />
        <Path d="M43.5 47 Q50 55 56.5 47 L57.6 52 Q50 59 42.4 52 Z" fill={shade} opacity={0.75} />
        <Path d="M40.6 58.6 Q50 65.6 59.4 58.6" fill="none" stroke="rgba(40,25,20,0.35)" strokeWidth={1.2} />
        <G transform="translate(0 4) translate(50 51) scale(1.12) translate(-50 -51)">
          {/* orejas */}
          <Path d="M35.6 29 C31.8 28 31 33 32.3 36 C33.2 38.3 34.8 39 36 38.6 Z" fill={skin} />
          <Path d="M64.4 29 C68.2 28 69 33 67.7 36 C66.8 38.3 65.2 39 64 38.6 Z" fill={skin} />
          <Path d="M34.6 31.5 C33.4 32 33.3 34.5 34.6 36" fill="none" stroke={shade} strokeWidth={0.9} />
          <Path d="M65.4 31.5 C66.6 32 66.7 34.5 65.4 36" fill="none" stroke={shade} strokeWidth={0.9} />
          {/* cara: mandíbula y barbilla */}
          <Path d="M35 28 C35 15 41.5 9 50 9 C58.5 9 65 15 65 28 L65 33 C65 43 58 50.5 50 50.5 C42 50.5 35 43 35 33 Z"
                fill={skin} />
          {/* sombra de los lados y bajo los pómulos */}
          <Path d="M35 31 C35.5 42 41 49 46 50.2 C40.5 46 37.6 39.5 37.4 31 Z" fill={shade} opacity={0.55} />
          <Path d="M65 31 C64.5 42 59 49 54 50.2 C59.5 46 62.4 39.5 62.6 31 Z" fill={shade} opacity={0.55} />
          {/* barba de pocos días */}
          {stubble ? (
            <Path d="M36.5 35 C37.5 45 44 50.5 50 50.5 C56 50.5 62.5 45 63.5 35 C61.5 41 58 43.5 54.5 43 C52 42.6 48 42.6 45.5 43 C42 43.5 38.5 41 36.5 35 Z"
                  fill={hair} opacity={0.32} />
          ) : null}
          {/* cejas */}
          <Path d="M39.4 26.6 C41.5 25 44.6 24.8 47 25.9" fill="none" stroke={hair} strokeWidth={1.6} strokeLinecap="round" />
          <Path d="M60.6 26.6 C58.5 25 55.4 24.8 53 25.9" fill="none" stroke={hair} strokeWidth={1.6} strokeLinecap="round" />
          {/* ojos: blanco, iris, pupila, brillo y párpado */}
          <Path d="M40 30.6 C41.5 28.6 45.2 28.5 46.8 30.6 C45.2 32.3 41.6 32.4 40 30.6 Z" fill="#F7F4F0" />
          <Path d="M53.2 30.6 C54.8 28.5 58.5 28.6 60 30.6 C58.4 32.4 54.8 32.3 53.2 30.6 Z" fill="#F7F4F0" />
          <Ellipse cx={43.4} cy={30.5} rx={1.65} ry={1.75} fill={iris} />
          <Ellipse cx={56.6} cy={30.5} rx={1.65} ry={1.75} fill={iris} />
          <Ellipse cx={43.4} cy={30.5} rx={0.75} ry={0.8} fill="#141414" />
          <Ellipse cx={56.6} cy={30.5} rx={0.75} ry={0.8} fill="#141414" />
          <Ellipse cx={43.9} cy={29.9} rx={0.4} ry={0.4} fill="#FFFFFF" />
          <Ellipse cx={57.1} cy={29.9} rx={0.4} ry={0.4} fill="#FFFFFF" />
          <Path d="M39.8 30.5 C41.4 28.3 45.3 28.2 47 30.4" fill="none" stroke="rgba(40,25,20,0.75)" strokeWidth={0.8} />
          <Path d="M53 30.4 C54.7 28.2 58.6 28.3 60.2 30.5" fill="none" stroke="rgba(40,25,20,0.75)" strokeWidth={0.8} />
          {/* nariz */}
          <Path d="M50.6 31.5 C50.9 34.5 52.4 37 51.9 38.3 C51.3 39.4 49.6 39.5 48.4 38.8" fill="none" stroke={shade}
                strokeWidth={1.2} strokeLinecap="round" />
          {/* boca */}
          <Path d="M45.6 43.2 C47.6 42.3 49 42.6 50 42.9 C51 42.6 52.4 42.3 54.4 43.2 C52.6 44.1 51.3 44.3 50 44.3 C48.7 44.3 47.4 44.1 45.6 43.2 Z"
                fill="#A8655C" opacity={0.85} />
          <Path d="M46.5 44 C48.3 45.9 51.7 45.9 53.5 44" fill="none" stroke={shade} strokeWidth={0.9} strokeLinecap="round" />
          {/* pelo */}
          <Path d={style} fill={hair} />
        </G>
      </Svg>
    </>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', backgroundColor: colors.line },
  figureBg: { backgroundColor: '#DCE3DF' },
});
