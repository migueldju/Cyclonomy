import { ReactNode, useState } from 'react';
import { View } from 'react-native';
import { t } from '../i18n';
import { gameNow } from '../lib/format';
import type { LeagueSettings } from '../lib/types';
import { space } from '../theme';
import { Button } from './Button';
import { Input, Segmented, Stepper, Toggle } from './Inputs';
import { ScoringSystemPicker } from './ScoringSystems';
import { ErrorText } from './Section';
import { Txt } from './Txt';

// Funciones y no constantes: se evalúan en el idioma actual
export const depthOptions = () => [
  { value: 1, label: t('settings.depth1') },
  { value: 2, label: t('settings.depth2') },
  { value: 3, label: t('settings.depth3') },
  { value: 4, label: t('settings.depth4') },
];
export const depthHint = (n: number) =>
  ({ 1: t('settings.depth1Hint'), 2: t('settings.depth2Hint'), 3: t('settings.depth3Hint'), 4: t('settings.depth4Hint') } as Record<number, string>)[n];

export const DEFAULT_SETTINGS: Required<Pick<LeagueSettings,
  'max_riders' | 'calendar_depth' | 'market_size' | 'market_hour' | 'clauses_enabled' | 'scoring_system' |
  'wt_split'>> = {
  max_riders: 22, calendar_depth: 4, market_size: 18, market_hour: 8, clauses_enabled: true,
  // por defecto, el sistema de Cyclonomy con el WorldTour dividido
  scoring_system: 'cyclonomy', wt_split: true,
};

/** La hora actual en Madrid (la del mercado), redondeada a la hora más cercana: la hora del mercado por defecto */
export function currentMarketHour(): number {
  const now = new Date(gameNow() + 30 * 60 * 1000);
  try {
    const h = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Madrid' }).format(now);
    return Number(h) % 24;
  } catch {
    return now.getHours();
  }
}

/**
 * Parámetros de la liga: se usa al crearla y en la normativa (solo el administrador). El sistema de puntuación solo
 * se elige al crearla (`creating`)
 */
export function LeagueSettingsForm({ initial, initialName, submitLabel, onSubmit, children, creating }: {
  initial: typeof DEFAULT_SETTINGS; initialName: string; submitLabel: string;
  onSubmit: (name: string, s: typeof DEFAULT_SETTINGS) => Promise<void>; children?: ReactNode; creating?: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((prev) => ({ ...prev, [k]: v }));

  async function submit() {
    if (!name.trim()) { setError(t('settings.nameRequired')); return; }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name.trim(), s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Input label={t('settings.name')} value={name} onChangeText={setName} maxLength={60} />
      {children}
      {creating ? (
        <ScoringSystemPicker system={s.scoring_system} wtSplit={s.wt_split}
                             onChange={(system, split) => setS((prev) => ({ ...prev, scoring_system: system, wt_split: split }))} />
      ) : null}
      <Stepper label={t('settings.maxRiders')} value={s.max_riders} min={16} max={40}
               onChange={(v) => set('max_riders', v)} />
      <Segmented label={t('settings.depth')} options={depthOptions()} value={s.calendar_depth}
                 onChange={(v) => set('calendar_depth', v)} />
      <Txt variant="small" style={{ marginTop: -space.s, marginBottom: space.l }}>{depthHint(s.calendar_depth)}</Txt>
      <Stepper label={t('settings.marketSize')} value={s.market_size} min={1} max={30}
               onChange={(v) => set('market_size', v)} />
      <Stepper label={t('settings.marketHour')} value={s.market_hour} min={0} max={23}
               onChange={(v) => set('market_hour', v)} format={(v) => `${String(v).padStart(2, '0')}:00`} />
      <Toggle label={t('settings.clauses')} value={s.clauses_enabled} onChange={(v) => set('clauses_enabled', v)}
              hint={t('settings.clausesHint')} />
      <ErrorText error={error} />
      <Button label={submitLabel} onPress={submit} busy={busy} />
    </View>
  );
}
