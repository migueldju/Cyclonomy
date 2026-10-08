import { Image, StyleSheet, View } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { t } from '../i18n';
import { RIDER_LOOKS } from '../lib/riderLooks';
import { teamKit } from '../lib/teamKits';
import { colors } from '../theme';

/** Ciclista ilustrado con el maillot de su equipo y sus rasgos (de su foto si la tenemos; si no, al azar). */
export function RiderAvatar({ name, team, size = 40 }: {
  url?: string | null; name: string; team?: string | null; size?: number;
}) {
  const circle = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.base, styles.figureBg, circle]} accessible accessibilityLabel={name}>
      <Cyclist team={team} name={name} size={size} />
    </View>
  );
}

// Rasgos del ciclista ficticio. Todo sale del nombre: el mismo ciclista se ve siempre igual.
// Tonos de piel (de muy clara a oscura) con su sombra. Se usa el de la foto del ciclista; sin foto, el claro
const SKINS = ['#F3D6C1', '#EAC4A3', '#DDAE88', '#C68E63', '#9A6440', '#6B4229'];
const SHADES = ['#DDB59A', '#D2A27E', '#C48F68', '#AA7248', '#7E4D2F', '#53321E'];
const HAIR = ['#2A211C', '#3B2A20', '#5A3A24', '#7A5032', '#B38B55', '#8E4A26'];   // de negro a rubio y pelirrojo
const IRIS = ['#3B2A20', '#5A3A24', '#4F6E86', '#5E7A4C'];

// Rasgos sacados de su foto, para los ciclistas que tienen un dibujo propio (por nombre)
type Portrait = {
  hair?: string; style?: string; iris?: string; stubble?: boolean; skin?: number;
  highlight?: string;           // mechones más claros en lo alto
  smile?: boolean;              // sonrisa abierta, con dientes
  blush?: boolean;              // mejillas sonrosadas
  earring?: 'left' | 'right';   // aro, en la oreja de ese lado del ciclista
  beard?: boolean;              // barba poblada (con bigote)
  mustache?: boolean;
  goatee?: boolean;             // perilla
  glasses?: boolean;
  longHair?: boolean;           // pelo largo (se dibuja por detrás de la cabeza)
};
// tupé: lados cortos y volumen arriba, peinado hacia atrás
const QUIFF = 'M34.8 26 C34 17 36.5 9.5 41.5 6.4 C43.5 4.2 46.5 3.8 48.5 4.4 C50.5 2.8 54 2.6 56.5 4 C59.5 4.6 62 6.5 63.6 9.5 C65.8 13 66.2 19 65.4 26 C64.6 21 63.4 17.4 61.2 15.2 C59 14 56.6 13.6 54.6 14.2 C52.4 12.8 49.6 12.8 47.4 13.8 C44.6 13.2 41.8 13.8 39.6 15.6 C37.2 17.8 35.6 21.4 34.8 26 Z';
// afro y calvo (solo pelo en los lados)
// pelo largo: por detrás de la cabeza, pegado a ella y cortado recto a la altura de las orejas
const LONG_BACK = 'M32.2 30 C31 15.5 38.6 4.8 50 4.8 C61.4 4.8 69 15.5 67.8 30 L68.2 37.2 C67 38 65.6 37.6 64.6 36.8 L35.4 36.8 C34.4 37.6 33 38 31.8 37.2 Z';
const AFRO = 'M31 30 C26 14 36 1 50 1 C64 1 74 14 69 30 C67 24 63.5 19.5 58 18.5 C53 20 47 20 42 18.5 C36.5 19.5 33 24 31 30 Z';
const BALD = 'M34.8 31 C34.5 26.5 35.2 22.5 36.6 19.8 C37 23.5 37.2 27 37.3 31 Z M65.2 31 C65.5 26.5 64.8 22.5 63.4 19.8 C63 23.5 62.8 27 62.7 31 Z';
const IRIS_BY_CODE: Record<string, string> = { b: '#5E86A8', g: '#5E7A4C', d: '#4A2F22' };

/** Rasgos de un ciclista a partir de su código en RIDER_LOOKS (ver riderLooks.ts). */
function fromLook(code: string | undefined): Portrait {
  if (!code) return {};
  const [main, tone] = code.split('/');
  const [c, hex] = main.split('#');
  return {
    // vello: 0 nada, 1 de pocos días, 2 barba, 3 bigote, 4 perilla, 5 bigote y perilla, 6 bigote y de pocos días
    style: styleByCode(c[0]), longHair: c[0] === 'L', stubble: c[1] === '1' || c[1] === '6', beard: c[1] === '2',
    mustache: c[1] === '3' || c[1] === '5' || c[1] === '6', goatee: c[1] === '4' || c[1] === '5', smile: c[2] === '1',
    iris: IRIS_BY_CODE[c[3]], earring: c.includes('e') ? 'left' : undefined, glasses: c.includes('x'),
    hair: hex ? `#${hex}` : undefined, skin: tone ? Number(tone) : undefined,
  };
}

const PORTRAITS: Record<string, Portrait> = {
  'Abel Balderstone': { hair: '#B5672F', highlight: '#D99A5B', style: QUIFF, iris: '#6F98BC', stubble: false, smile: true,
                        blush: true, earring: 'left' },
};

// los cuatro peinados básicos están en HAIRSTYLES (más abajo): se busca al usarlos
function styleByCode(k: string): string | undefined {
  return ({ C: HAIRSTYLES[0], P: HAIRSTYLES[1], R: HAIRSTYLES[2], O: HAIRSTYLES[3], Q: QUIFF, L: HAIRSTYLES[3], A: AFRO, B: BALD } as
    Record<string, string>)[k];
}

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
  const p: Portrait = { ...fromLook(RIDER_LOOKS[name]), ...PORTRAITS[name] };
  const skin = SKINS[p.skin ?? 1];
  const shade = SHADES[p.skin ?? 1];
  const hair = p.hair ?? HAIR[(h >>> 4) % HAIR.length];
  const style = p.style ?? HAIRSTYLES[(h >>> 8) % HAIRSTYLES.length];
  const iris = p.iris ?? IRIS[(h >>> 12) % IRIS.length];
  const stubble = p.stubble ?? (h >>> 16) % 3 === 0;
  const beard = p.beard ?? false;
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
          {p.longHair ? <Path d={LONG_BACK} fill={hair} /> : null}
          {/* orejas */}
          <Path d="M35.6 29 C31.8 28 31 33 32.3 36 C33.2 38.3 34.8 39 36 38.6 Z" fill={skin} />
          <Path d="M64.4 29 C68.2 28 69 33 67.7 36 C66.8 38.3 65.2 39 64 38.6 Z" fill={skin} />
          <Path d="M34.6 31.5 C33.4 32 33.3 34.5 34.6 36" fill="none" stroke={shade} strokeWidth={0.9} />
          <Path d="M65.4 31.5 C66.6 32 66.7 34.5 65.4 36" fill="none" stroke={shade} strokeWidth={0.9} />
          {/* cara: mandíbula y barbilla */}
          <Path d="M35 28 C35 15 41.5 9 50 9 C58.5 9 65 15 65 28 L65 33 C65 43 58 50.5 50 50.5 C42 50.5 35 43 35 33 Z"
                fill={skin} />
          {/* mejillas sonrosadas */}
          {p.blush ? (
            <>
              <Ellipse cx={40.6} cy={37.2} rx={3.6} ry={2.4} fill="#E58E7E" opacity={0.35} />
              <Ellipse cx={59.4} cy={37.2} rx={3.6} ry={2.4} fill="#E58E7E" opacity={0.35} />
            </>
          ) : null}
          {/* sombra de los lados y bajo los pómulos */}
          <Path d="M35 31 C35.5 42 41 49 46 50.2 C40.5 46 37.6 39.5 37.4 31 Z" fill={shade} opacity={0.55} />
          <Path d="M65 31 C64.5 42 59 49 54 50.2 C59.5 46 62.4 39.5 62.6 31 Z" fill={shade} opacity={0.55} />
          {/* barba de pocos días */}
          {beard ? (
            <>
              <Path d="M35.6 31 C35.8 44 42.5 52.5 50 52.5 C57.5 52.5 64.2 44 64.4 31 C63 38 60 41.8 55.5 42.4 C52.5 41.6 47.5 41.6 44.5 42.4 C40 41.8 37 38 35.6 31 Z"
                    fill={hair} opacity={0.88} />
              <Path d="M44.6 41.6 C46.8 39.9 48.9 40.2 50 40.9 C51.1 40.2 53.2 39.9 55.4 41.6 C53.6 42.6 51.6 42.4 50 42 C48.4 42.4 46.4 42.6 44.6 41.6 Z"
                    fill={hair} />
            </>
          ) : stubble ? (
            <Path d="M36.5 35 C37.5 45 44 50.5 50 50.5 C56 50.5 62.5 45 63.5 35 C61.5 41 58 43.5 54.5 43 C52 42.6 48 42.6 45.5 43 C42 43.5 38.5 41 36.5 35 Z"
                  fill={hair} opacity={0.32} />
          ) : null}
          {/* bigote y perilla (sueltos, sin barba entera) */}
          {p.mustache && !beard ? (
            <Path d="M44.4 41.7 C46.6 39.6 48.9 39.9 50 40.7 C51.1 39.9 53.4 39.6 55.6 41.7 C54 42.6 51.8 42.4 50 41.9 C48.2 42.4 46 42.6 44.4 41.7 Z"
                  fill={hair} transform={p.smile ? 'translate(0 -1.1)' : undefined} />
          ) : null}
          {p.goatee && !beard ? (
            <Path d="M46.6 46.4 C47.3 49.6 48.6 50.9 50 50.9 C51.4 50.9 52.7 49.6 53.4 46.4 C52.2 47.2 47.8 47.2 46.6 46.4 Z"
                  fill={hair} opacity={0.9} />
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
          {/* boca: cerrada o sonrisa abierta con dientes y hoyuelos */}
          {p.smile ? (
            <>
              <Path d="M44.4 41.8 C47.4 43.2 52.6 43.2 55.6 41.8 C54.8 45.6 52.6 47.4 50 47.4 C47.4 47.4 45.2 45.6 44.4 41.8 Z"
                    fill="#8E3F3A" />
              <Path d="M45.2 42.4 C48 43.6 52 43.6 54.8 42.4 C54.5 43.9 52.6 44.7 50 44.7 C47.4 44.7 45.5 43.9 45.2 42.4 Z"
                    fill="#FBF8F4" />
              <Path d="M43.6 41 C43.1 41.8 43.3 42.8 43.9 43.4" fill="none" stroke={shade} strokeWidth={0.9} strokeLinecap="round" />
              <Path d="M56.4 41 C56.9 41.8 56.7 42.8 56.1 43.4" fill="none" stroke={shade} strokeWidth={0.9} strokeLinecap="round" />
            </>
          ) : (
            <>
              <Path d="M45.6 43.2 C47.6 42.3 49 42.6 50 42.9 C51 42.6 52.4 42.3 54.4 43.2 C52.6 44.1 51.3 44.3 50 44.3 C48.7 44.3 47.4 44.1 45.6 43.2 Z"
                    fill="#A8655C" opacity={0.85} />
              <Path d="M46.5 44 C48.3 45.9 51.7 45.9 53.5 44" fill="none" stroke={shade} strokeWidth={0.9} strokeLinecap="round" />
            </>
          )}
          {/* aro en la oreja (su izquierda queda a la derecha de la imagen) */}
          {p.earring ? (
            <G transform={p.earring === 'left' ? undefined : 'translate(100 0) scale(-1 1)'}>
              <Ellipse cx={66.2} cy={38.4} rx={0.55} ry={0.55} fill="#C9CED4" />
              <Path d="M66.2 38.9 C65.1 39.4 65.1 41.4 66.2 41.7 C67.3 41.4 67.3 39.4 66.2 38.9" fill="none"
                    stroke="#B9BEC5" strokeWidth={0.7} />
            </G>
          ) : null}
          {/* pelo */}
          <Path d={style} fill={hair} />
          {p.glasses ? (
            <G fill="none" stroke="#2B2B2B" strokeWidth={0.9}>
              <Path d="M38.6 28.2 C38.6 26.6 47.8 26.6 47.8 28.2 L47.4 32.4 C47.2 34.4 39.2 34.4 39 32.4 Z" />
              <Path d="M52.2 28.2 C52.2 26.6 61.4 26.6 61.4 28.2 L61 32.4 C60.8 34.4 52.8 34.4 52.6 32.4 Z" />
              <Path d="M47.8 29 C49 28.2 51 28.2 52.2 29 M38.6 28.6 L35.4 29.4 M61.4 28.6 L64.6 29.4" />
            </G>
          ) : null}
          {p.highlight ? (
            <>
              <Path d="M41.5 9 C45.5 6.2 51.5 5.4 57.5 7" fill="none" stroke={p.highlight} strokeWidth={1.4} strokeLinecap="round" />
              <Path d="M43 12.2 C47 10.2 52.5 9.8 58.5 11.6" fill="none" stroke={p.highlight} strokeWidth={1.1} strokeLinecap="round" opacity={0.8} />
              <Path d="M49.5 4.6 C52 5.6 54.5 7.6 55.5 10" fill="none" stroke={p.highlight} strokeWidth={0.9} strokeLinecap="round" opacity={0.7} />
            </>
          ) : null}
        </G>
      </Svg>
    </>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', backgroundColor: colors.line },
  figureBg: { backgroundColor: '#DCE3DF' },
});
