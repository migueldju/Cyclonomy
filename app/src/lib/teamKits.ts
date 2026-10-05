// Colores aproximados del maillot de cada equipo, para el dibujo de los ciclistas sin foto.
// Se busca por una palabra del nombre del equipo (en minúsculas), así aguanta cambios de copatrocinador.
// [palabra, color principal, color secundario (mangas y franja)]
const KITS: [string, string, string][] = [
  ['visma', '#FFD100', '#111111'],
  ['uae', '#F4F4F4', '#D71920'],
  ['red bull', '#13294B', '#DB0A40'],
  ['soudal', '#005EB8', '#FFFFFF'],
  ['alpecin', '#1C2C5B', '#FFFFFF'],
  ['lidl', '#E2231A', '#1A2A5A'],
  ['ineos', '#7A1F3D', '#1B1B1B'],
  ['bahrain', '#C8102E', '#D4AF37'],
  ['decathlon', '#0082C3', '#1B2A4A'],
  ['ef education', '#EC4E9C', '#1C3F94'],
  ['groupama', '#1D4F91', '#FFFFFF'],
  ['lotto', '#D6001C', '#FFFFFF'],
  ['movistar', '#00205B', '#8DC63F'],
  ['nsn', '#00A3E0', '#FFFFFF'],
  ['jayco', '#0072CE', '#FF6A13'],
  ['picnic', '#111111', '#E4002B'],
  ['uno-x', '#E10600', '#FFD200'],
  ['astana', '#00A5DF', '#FFD200'],
  ['bardiani', '#00A859', '#FFFFFF'],
  ['burgos', '#7B2A80', '#FFFFFF'],
  ['caja rural', '#008D3F', '#FFFFFF'],
  ['cofidis', '#E30613', '#FFFFFF'],
  ['euskaltel', '#F28C00', '#FFFFFF'],
  ['mbh', '#1F3C88', '#E30613'],
  ['modern adventure', '#3A3A3A', '#F2A900'],
  ['q36.5', '#2B2B2B', '#9B9B9B'],
  ['solution tech', '#D52B1E', '#FFFFFF'],
  ['novo nordisk', '#0055B8', '#FFFFFF'],
  ['polti', '#C8102E', '#111111'],
  ['tudor', '#B5121B', '#111111'],
  ['unibet', '#147B45', '#111111'],
];

const DEFAULT_KIT: [string, string] = ['#9AA5AA', '#FFFFFF'];

export function teamKit(team: string | null | undefined): [string, string] {
  const t = (team ?? '').toLowerCase();
  const kit = KITS.find(([word]) => t.includes(word));
  return kit ? [kit[1], kit[2]] : DEFAULT_KIT;
}
