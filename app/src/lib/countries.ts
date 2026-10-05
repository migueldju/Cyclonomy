import { getLang } from '../i18n';

// Países para el equipo de cada jugador: código ISO de 2 letras (como los de los ciclistas) y nombre en español
export const COUNTRIES: [string, string][] = [
  ['af', 'Afganistán'], ['al', 'Albania'], ['de', 'Alemania'], ['ad', 'Andorra'], ['ao', 'Angola'],
  ['sa', 'Arabia Saudí'], ['dz', 'Argelia'], ['ar', 'Argentina'], ['am', 'Armenia'], ['au', 'Australia'],
  ['at', 'Austria'], ['az', 'Azerbaiyán'], ['bh', 'Baréin'], ['bd', 'Bangladés'], ['be', 'Bélgica'],
  ['bz', 'Belice'], ['by', 'Bielorrusia'], ['bo', 'Bolivia'], ['ba', 'Bosnia y Herzegovina'], ['bw', 'Botsuana'],
  ['br', 'Brasil'], ['bg', 'Bulgaria'], ['bf', 'Burkina Faso'], ['cv', 'Cabo Verde'], ['kh', 'Camboya'],
  ['cm', 'Camerún'], ['ca', 'Canadá'], ['qa', 'Catar'], ['td', 'Chad'], ['cz', 'Chequia'], ['cl', 'Chile'],
  ['cn', 'China'], ['cy', 'Chipre'], ['co', 'Colombia'], ['kr', 'Corea del Sur'], ['ci', 'Costa de Marfil'],
  ['cr', 'Costa Rica'], ['hr', 'Croacia'], ['cu', 'Cuba'], ['dk', 'Dinamarca'], ['ec', 'Ecuador'], ['eg', 'Egipto'],
  ['sv', 'El Salvador'], ['ae', 'Emiratos Árabes Unidos'], ['er', 'Eritrea'], ['sk', 'Eslovaquia'],
  ['si', 'Eslovenia'], ['es', 'España'], ['us', 'Estados Unidos'], ['ee', 'Estonia'], ['et', 'Etiopía'],
  ['ph', 'Filipinas'], ['fi', 'Finlandia'], ['fr', 'Francia'], ['ga', 'Gabón'], ['ge', 'Georgia'], ['gh', 'Ghana'],
  ['gr', 'Grecia'], ['gt', 'Guatemala'], ['hn', 'Honduras'], ['hk', 'Hong Kong'], ['hu', 'Hungría'], ['in', 'India'],
  ['id', 'Indonesia'], ['ir', 'Irán'], ['iq', 'Irak'], ['ie', 'Irlanda'], ['is', 'Islandia'], ['il', 'Israel'],
  ['it', 'Italia'], ['jm', 'Jamaica'], ['jp', 'Japón'], ['jo', 'Jordania'], ['kz', 'Kazajistán'], ['ke', 'Kenia'],
  ['kg', 'Kirguistán'], ['xk', 'Kosovo'], ['kw', 'Kuwait'], ['lv', 'Letonia'], ['lb', 'Líbano'],
  ['li', 'Liechtenstein'], ['lt', 'Lituania'], ['lu', 'Luxemburgo'], ['mk', 'Macedonia del Norte'],
  ['my', 'Malasia'], ['mt', 'Malta'], ['ma', 'Marruecos'], ['mu', 'Mauricio'], ['mx', 'México'], ['md', 'Moldavia'],
  ['mc', 'Mónaco'], ['mn', 'Mongolia'], ['me', 'Montenegro'], ['na', 'Namibia'], ['ni', 'Nicaragua'],
  ['ng', 'Nigeria'], ['no', 'Noruega'], ['nz', 'Nueva Zelanda'], ['om', 'Omán'], ['nl', 'Países Bajos'],
  ['pk', 'Pakistán'], ['ps', 'Palestina'], ['pa', 'Panamá'], ['py', 'Paraguay'], ['pe', 'Perú'], ['pl', 'Polonia'], ['pt', 'Portugal'],
  ['pr', 'Puerto Rico'], ['gb', 'Reino Unido'], ['do', 'República Dominicana'], ['rw', 'Ruanda'], ['ro', 'Rumanía'],
  ['ru', 'Rusia'], ['sm', 'San Marino'], ['sn', 'Senegal'], ['rs', 'Serbia'], ['eh', 'Sáhara Occidental'], ['sg', 'Singapur'],
  ['za', 'Sudáfrica'], ['se', 'Suecia'], ['ch', 'Suiza'], ['th', 'Tailandia'], ['tw', 'Taiwán'],
  ['tz', 'Tanzania'], ['tt', 'Trinidad y Tobago'], ['tn', 'Túnez'], ['tr', 'Turquía'], ['ua', 'Ucrania'],
  ['ug', 'Uganda'], ['uy', 'Uruguay'], ['uz', 'Uzbekistán'], ['ve', 'Venezuela'], ['vn', 'Vietnam'],
  ['zw', 'Zimbabue'],
];

const spanish = (code: string | null | undefined) => COUNTRIES.find(([c]) => c === code)?.[1] ?? null;

let names: { lang: string; dn: { of: (c: string) => string | undefined } | null } | null = null;

/** Nombre del país en el idioma de la app (con Intl.DisplayNames si existe: no en todos los móviles); si no, en español */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  if (getLang() === 'es') return spanish(code);
  try {
    if (!names || names.lang !== getLang()) {
      const DN = (Intl as unknown as { DisplayNames?: new (l: string[], o: { type: string }) => { of: (c: string) => string } }).DisplayNames;
      names = { lang: getLang(), dn: DN ? new DN([getLang()], { type: 'region' }) : null };
    }
    return names.dn?.of(code.toUpperCase()) ?? spanish(code);
  } catch {
    return spanish(code);
  }
}
