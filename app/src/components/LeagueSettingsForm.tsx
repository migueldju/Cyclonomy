import { ReactNode, useState } from 'react';
import { View } from 'react-native';
import { t } from '../i18n';
import { money, parseAmount } from '../lib/format';
import type { LeagueSettings, PayoutMode } from '../lib/types';
import { space } from '../theme';
import { Button } from './Button';
import { Input, Segmented, Stepper, Toggle } from './Inputs';
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
export const payoutOptions = (): { value: PayoutMode; label: string }[] => [
  { value: 'per_point', label: t('settings.payoutPoints') },
  { value: 'by_position', label: t('settings.payoutPosition') },
  { value: 'mixed', label: t('settings.payoutMixed') },
];

export const DEFAULT_SETTINGS: Required<Pick<LeagueSettings,
  'max_riders' | 'calendar_depth' | 'market_size' | 'market_hour' | 'clauses_enabled' | 'payout_mode' |
  'payout_per_point' | 'payout_by_position'>> = {
  max_riders: 22, calendar_depth: 2, market_size: 10, market_hour: 8, clauses_enabled: true,
  payout_mode: 'per_point', payout_per_point: 100, payout_by_position: [500000, 300000, 150000],
};

/** Parámetros de la liga: se usa al crearla y en la normativa (solo el administrador) */
export function LeagueSettingsForm({ initial, initialName, submitLabel, onSubmit, children }: {
  initial: typeof DEFAULT_SETTINGS; initialName: string; submitLabel: string;
  onSubmit: (name: string, s: typeof DEFAULT_SETTINGS) => Promise<void>; children?: ReactNode;
}) {
  const [name, setName] = useState(initialName);
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((prev) => ({ ...prev, [k]: v }));
  const prizes = s.payout_by_position;

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
      <Segmented label={t('settings.payout')} options={payoutOptions()} value={s.payout_mode}
                 onChange={(v) => set('payout_mode', v)} />

      {s.payout_mode !== 'by_position' ? (
        <Input label={t('settings.perPoint')} keyboardType="number-pad" value={String(s.payout_per_point)}
               onChangeText={(v) => set('payout_per_point', parseAmount(v) ?? 0)}
               hint={t('settings.perPointHint')} />
      ) : null}

      {s.payout_mode !== 'per_point' ? (
        <View style={{ marginBottom: space.l }}>
          <Txt variant="label" style={{ marginBottom: 6 }}>{t('settings.prizes')}</Txt>
          {prizes.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <Txt variant="number" style={{ width: 36 }}>{t('fmt.ordinal', { n: i + 1 })}</Txt>
              <View style={{ flex: 1 }}>
                <Input label={t('settings.prizeFor', { n: i + 1 })} keyboardType="number-pad" value={String(p)}
                       onChangeText={(v) => set('payout_by_position', prizes.map((x, j) => (j === i ? parseAmount(v) ?? 0 : x)))}
                       hint={money(p)} />
              </View>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <Button small kind="secondary" label={t('settings.addPrize')}
                    onPress={() => set('payout_by_position', [...prizes, 0])} />
            {prizes.length > 0 ? (
              <Button small kind="quiet" label={t('settings.removePrize')}
                      onPress={() => set('payout_by_position', prizes.slice(0, -1))} />
            ) : null}
          </View>
        </View>
      ) : null}

      <ErrorText error={error} />
      <Button label={submitLabel} onPress={submit} busy={busy} />
    </View>
  );
}
