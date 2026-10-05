import type { ImageSourcePropType } from 'react-native';

// Equipación de cada equipo para los ciclistas sin foto: el minimaillot (render de la base de datos Omaiwo,
// en assets/jerseys) y dos colores aproximados para el casco del ciclista ficticio.
// Se busca por una palabra del nombre del equipo (en minúsculas), así aguanta cambios de copatrocinador.
// [palabra, color principal, color secundario, código del minimaillot]
const KITS: [string, string, string, string][] = [
  ['visma', '#FFD100', '#111111', 'tvl'],
  ['uae', '#F4F4F4', '#D71920', 'uad'],
  ['red bull', '#13294B', '#DB0A40', 'rbh'],
  ['soudal', '#005EB8', '#FFFFFF', 'soq'],
  ['alpecin', '#1C2C5B', '#FFFFFF', 'adc'],
  ['lidl', '#E2231A', '#1A2A5A', 'ltk'],
  ['ineos', '#F28C28', '#FFFFFF', 'igd'],
  ['bahrain', '#1C2541', '#C8102E', 'tbv'],
  ['decathlon', '#1B2A4A', '#E4002B', 'dat'],
  ['ef education', '#EC4E9C', '#FFFFFF', 'efe'],
  ['groupama', '#1D4F91', '#FFFFFF', 'gfc'],
  ['lotto', '#D6001C', '#FFFFFF', 'lot'],
  ['movistar', '#F4F4F4', '#0B5FB3', 'mov'],
  ['nsn', '#7FD3E6', '#F28C28', 'ipt'],
  ['jayco', '#5B2C91', '#FFFFFF', 'jay'],
  ['picnic', '#1B2A4A', '#F28C28', 'tpp'],
  ['uno-x', '#E10600', '#FFD200', 'uxm'],
  ['astana', '#3FB8C9', '#1B3A4B', 'xat'],
  ['bardiani', '#3FB8C9', '#FFFFFF', 'vbf'],
  ['burgos', '#F4F4F4', '#C2187A', 'bbh'],
  ['caja rural', '#F4F4F4', '#1E6B3A', 'cjr'],
  ['cofidis', '#8B1E3F', '#F2C230', 'cof'],
  ['euskaltel', '#F28C00', '#FFFFFF', 'eus'],
  ['mbh', '#1F3C88', '#3FB8A8', 'mbh'],
  ['modern adventure', '#6B1F2A', '#C9A15A', 'pec'],
  ['q36.5', '#1B2A4A', '#9B9B9B', 'q36'],
  ['solution tech', '#1E5BB8', '#F2C230', 'tft'],
  ['novo nordisk', '#1B2A4A', '#FFFFFF', 'tnn'],
  ['polti', '#F4F4F4', '#D52B1E', 'ptv'],
  ['tudor', '#1B1B1B', '#C8102E', 'tud'],
  ['unibet', '#3FB8C9', '#7A2BBF', 'urr'],
];

// Metro necesita cada require escrito tal cual
const JERSEYS: Record<string, ImageSourcePropType> = {
  tvl: require('../../assets/jerseys/tvl.png'), uad: require('../../assets/jerseys/uad.png'),
  rbh: require('../../assets/jerseys/rbh.png'), soq: require('../../assets/jerseys/soq.png'),
  adc: require('../../assets/jerseys/adc.png'), ltk: require('../../assets/jerseys/ltk.png'),
  igd: require('../../assets/jerseys/igd.png'), tbv: require('../../assets/jerseys/tbv.png'),
  dat: require('../../assets/jerseys/dat.png'), efe: require('../../assets/jerseys/efe.png'),
  gfc: require('../../assets/jerseys/gfc.png'), lot: require('../../assets/jerseys/lot.png'),
  mov: require('../../assets/jerseys/mov.png'), ipt: require('../../assets/jerseys/ipt.png'),
  jay: require('../../assets/jerseys/jay.png'), tpp: require('../../assets/jerseys/tpp.png'),
  uxm: require('../../assets/jerseys/uxm.png'), xat: require('../../assets/jerseys/xat.png'),
  vbf: require('../../assets/jerseys/vbf.png'), bbh: require('../../assets/jerseys/bbh.png'),
  cjr: require('../../assets/jerseys/cjr.png'), cof: require('../../assets/jerseys/cof.png'),
  eus: require('../../assets/jerseys/eus.png'), mbh: require('../../assets/jerseys/mbh.png'),
  pec: require('../../assets/jerseys/pec.png'), q36: require('../../assets/jerseys/q36.png'),
  tft: require('../../assets/jerseys/tft.png'), tnn: require('../../assets/jerseys/tnn.png'),
  ptv: require('../../assets/jerseys/ptv.png'), tud: require('../../assets/jerseys/tud.png'),
  urr: require('../../assets/jerseys/urr.png'),
};

const DEFAULT_KIT: [string, string] = ['#9AA5AA', '#FFFFFF'];

export interface TeamKit {
  main: string;
  second: string;
  jersey: ImageSourcePropType | null;      // minimaillot, si lo hay
}

export function teamKit(team: string | null | undefined): TeamKit {
  const t = (team ?? '').toLowerCase();
  const kit = KITS.find(([word]) => t.includes(word));
  return kit
    ? { main: kit[1], second: kit[2], jersey: JERSEYS[kit[3]] ?? null }
    : { main: DEFAULT_KIT[0], second: DEFAULT_KIT[1], jersey: null };
}
