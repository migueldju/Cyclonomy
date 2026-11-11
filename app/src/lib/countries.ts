import { getLang } from '../i18n';

// Países para el equipo de cada jugador: código ISO de 2 letras (como los de los ciclistas) y nombre en español
const ALL: [string, string][] = [
  ['af', 'Afganistán'], ['al', 'Albania'], ['de', 'Alemania'], ['ad', 'Andorra'], ['ao', 'Angola'], ['ai', 'Anguila'],
  ['ag', 'Antigua y Barbuda'], ['sa', 'Arabia Saudí'], ['dz', 'Argelia'], ['ar', 'Argentina'], ['am', 'Armenia'],
  ['aw', 'Aruba'], ['au', 'Australia'], ['at', 'Austria'], ['az', 'Azerbaiyán'], ['bs', 'Bahamas'],
  ['bd', 'Bangladés'], ['bb', 'Barbados'], ['bh', 'Baréin'], ['be', 'Bélgica'], ['bz', 'Belice'], ['bj', 'Benín'],
  ['bm', 'Bermudas'], ['by', 'Bielorrusia'], ['bo', 'Bolivia'], ['ba', 'Bosnia y Herzegovina'], ['bw', 'Botsuana'],
  ['br', 'Brasil'], ['bn', 'Brunéi'], ['bg', 'Bulgaria'], ['bf', 'Burkina Faso'], ['bi', 'Burundi'], ['bt', 'Bután'],
  ['cv', 'Cabo Verde'], ['kh', 'Camboya'], ['cm', 'Camerún'], ['ca', 'Canadá'], ['bq', 'Caribe neerlandés'],
  ['qa', 'Catar'], ['td', 'Chad'], ['cz', 'Chequia'], ['cl', 'Chile'], ['cn', 'China'], ['cy', 'Chipre'],
  ['co', 'Colombia'], ['km', 'Comoras'], ['cg', 'Congo'], ['kp', 'Corea del Norte'], ['kr', 'Corea del Sur'],
  ['ci', 'Costa de Marfil'], ['cr', 'Costa Rica'], ['hr', 'Croacia'], ['cu', 'Cuba'], ['cw', 'Curazao'],
  ['dk', 'Dinamarca'], ['dm', 'Dominica'], ['ec', 'Ecuador'], ['eg', 'Egipto'], ['sv', 'El Salvador'],
  ['ae', 'Emiratos Árabes Unidos'], ['er', 'Eritrea'], ['sk', 'Eslovaquia'], ['si', 'Eslovenia'], ['es', 'España'],
  ['us', 'Estados Unidos'], ['ee', 'Estonia'], ['sz', 'Esuatini'], ['et', 'Etiopía'], ['ph', 'Filipinas'],
  ['fi', 'Finlandia'], ['fj', 'Fiyi'], ['fr', 'Francia'], ['ga', 'Gabón'], ['gm', 'Gambia'], ['ge', 'Georgia'],
  ['gh', 'Ghana'], ['gi', 'Gibraltar'], ['gd', 'Granada'], ['gr', 'Grecia'], ['gl', 'Groenlandia'],
  ['gp', 'Guadalupe'], ['gu', 'Guam'], ['gt', 'Guatemala'], ['gf', 'Guayana Francesa'], ['gg', 'Guernesey'],
  ['gn', 'Guinea'], ['gq', 'Guinea Ecuatorial'], ['gw', 'Guinea-Bisáu'], ['gy', 'Guyana'], ['ht', 'Haití'],
  ['hn', 'Honduras'], ['hk', 'Hong Kong'], ['hu', 'Hungría'], ['in', 'India'], ['id', 'Indonesia'], ['iq', 'Irak'],
  ['ir', 'Irán'], ['ie', 'Irlanda'], ['im', 'Isla de Man'], ['cx', 'Isla de Navidad'], ['nf', 'Isla Norfolk'],
  ['is', 'Islandia'], ['ax', 'Islas Aland'], ['ky', 'Islas Caimán'], ['cc', 'Islas Cocos'], ['ck', 'Islas Cook'],
  ['fo', 'Islas Feroe'], ['fk', 'Islas Malvinas'], ['mp', 'Islas Marianas del Norte'], ['mh', 'Islas Marshall'],
  ['pn', 'Islas Pitcairn'], ['sb', 'Islas Salomón'], ['tc', 'Islas Turcas y Caicos'],
  ['vg', 'Islas Vírgenes Británicas'], ['vi', 'Islas Vírgenes de EE. UU.'], ['il', 'Israel'], ['it', 'Italia'],
  ['jm', 'Jamaica'], ['jp', 'Japón'], ['je', 'Jersey'], ['jo', 'Jordania'], ['kz', 'Kazajistán'], ['ke', 'Kenia'],
  ['kg', 'Kirguistán'], ['ki', 'Kiribati'], ['xk', 'Kosovo'], ['kw', 'Kuwait'], ['la', 'Laos'], ['ls', 'Lesoto'],
  ['lv', 'Letonia'], ['lb', 'Líbano'], ['lr', 'Liberia'], ['ly', 'Libia'], ['li', 'Liechtenstein'],
  ['lt', 'Lituania'], ['lu', 'Luxemburgo'], ['mk', 'Macedonia del Norte'], ['mg', 'Madagascar'], ['my', 'Malasia'],
  ['mw', 'Malaui'], ['mv', 'Maldivas'], ['ml', 'Mali'], ['mt', 'Malta'], ['ma', 'Marruecos'], ['mq', 'Martinica'],
  ['mu', 'Mauricio'], ['mr', 'Mauritania'], ['yt', 'Mayotte'], ['mx', 'México'], ['fm', 'Micronesia'],
  ['md', 'Moldavia'], ['mc', 'Mónaco'], ['mn', 'Mongolia'], ['me', 'Montenegro'], ['ms', 'Montserrat'],
  ['mz', 'Mozambique'], ['mm', 'Myanmar (Birmania)'], ['na', 'Namibia'], ['nr', 'Nauru'], ['np', 'Nepal'],
  ['ni', 'Nicaragua'], ['ne', 'Níger'], ['ng', 'Nigeria'], ['nu', 'Niue'], ['no', 'Noruega'],
  ['nc', 'Nueva Caledonia'], ['nz', 'Nueva Zelanda'], ['om', 'Omán'], ['nl', 'Países Bajos'], ['pk', 'Pakistán'],
  ['pw', 'Palaos'], ['ps', 'Palestina'], ['pa', 'Panamá'], ['pg', 'Papúa Nueva Guinea'], ['py', 'Paraguay'],
  ['pe', 'Perú'], ['pf', 'Polinesia Francesa'], ['pl', 'Polonia'], ['pt', 'Portugal'], ['pr', 'Puerto Rico'],
  ['mo', 'RAE de Macao (China)'], ['gb', 'Reino Unido'], ['cf', 'República Centroafricana'],
  ['cd', 'República Democrática del Congo'], ['do', 'República Dominicana'], ['re', 'Reunión'], ['rw', 'Ruanda'],
  ['ro', 'Rumanía'], ['ru', 'Rusia'], ['eh', 'Sáhara Occidental'], ['ws', 'Samoa'], ['as', 'Samoa Americana'],
  ['bl', 'San Bartolomé'], ['kn', 'San Cristóbal y Nieves'], ['sm', 'San Marino'], ['mf', 'San Martín'],
  ['pm', 'San Pedro y Miquelón'], ['vc', 'San Vicente y las Granadinas'], ['sh', 'Santa Elena'],
  ['lc', 'Santa Lucía'], ['st', 'Santo Tomé y Príncipe'], ['sn', 'Senegal'], ['rs', 'Serbia'], ['sc', 'Seychelles'],
  ['sl', 'Sierra Leona'], ['sg', 'Singapur'], ['sx', 'Sint Maarten'], ['sy', 'Siria'], ['so', 'Somalia'],
  ['lk', 'Sri Lanka'], ['za', 'Sudáfrica'], ['sd', 'Sudán'], ['ss', 'Sudán del Sur'], ['se', 'Suecia'],
  ['ch', 'Suiza'], ['sr', 'Surinam'], ['th', 'Tailandia'], ['tw', 'Taiwán'], ['tz', 'Tanzania'], ['tj', 'Tayikistán'],
  ['io', 'Territorio Británico del Océano Índico'], ['tl', 'Timor-Leste'], ['tg', 'Togo'], ['tk', 'Tokelau'],
  ['to', 'Tonga'], ['tt', 'Trinidad y Tobago'], ['tn', 'Túnez'], ['tm', 'Turkmenistán'], ['tr', 'Turquía'],
  ['tv', 'Tuvalu'], ['ua', 'Ucrania'], ['ug', 'Uganda'], ['uy', 'Uruguay'], ['uz', 'Uzbekistán'], ['vu', 'Vanuatu'],
  ['va', 'Vaticano'], ['ve', 'Venezuela'], ['vn', 'Vietnam'], ['wf', 'Wallis y Futuna'], ['ye', 'Yemen'],
  ['dj', 'Yibuti'], ['zm', 'Zambia'], ['zw', 'Zimbabue'],
];

// Primero, los 10 mejores países de la historia (puntos del ranking histórico de ciclistas de PCS, sumados por
// nacionalidad); después, todos en orden alfabético
const TOP = ['it', 'be', 'fr', 'es', 'nl', 'de', 'ch', 'au', 'gb', 'dk'];
export const COUNTRIES: [string, string][] = [
  ...TOP.map((code) => ALL.find(([c]) => c === code)!),
  ...ALL.filter(([c]) => !TOP.includes(c)),
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
