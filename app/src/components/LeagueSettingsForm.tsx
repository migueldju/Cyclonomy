import { ReactNode, useState } from 'react';
import { View } from 'react-native';
import { money, parseAmount } from '../lib/format';
import type { LeagueSettings, PayoutMode } from '../lib/types';
import { space } from '../theme';
import { Button } from './Button';
import { Input, Segmented, Stepper, Toggle } from './Inputs';
import { ErrorText } from './Section';
import { Txt } from './Txt';

export const DEPTH_OPTIONS = [
  { value: 1, label: 'WT de primer nivel' },
  { value: 2, label: 'WT completo' },
  { value: 3, label: 'Hasta .Pro' },
  { value: 4, label: 'Hasta .1' },
];
export const DEPTH_HINT: Record<number, string> = {
  1: 'Tour, Giro, Vuelta, Monumentos, WT principal y Mundial.',
  2: 'Todo el WorldTour, más campeonatos continentales y nacionales.',
  3: 'Lo anterior más las carreras .Pro.',
  4: 'Todo el calendario hasta las carreras .1.',
};
export const PAYOUT_OPTIONS: { value: PayoutMode; label: string }[] = [
  { value: 'per_point', label: 'Por puntos' },
  { value: 'by_position', label: 'Por puesto semanal' },
  { value: 'mixed', label: 'Mixto' },
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
    if (!name.trim()) { setError('Ponle un nombre a la liga.'); return; }
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
      <Input label="Nombre de la liga" value={name} onChangeText={setName} maxLength={60} />
      {children}
      <Stepper label="Máximo de ciclistas por equipo" value={s.max_riders} min={16} max={40}
               onChange={(v) => set('max_riders', v)} />
      <Segmented label="Profundidad del calendario" options={DEPTH_OPTIONS} value={s.calendar_depth}
                 onChange={(v) => set('calendar_depth', v)} />
      <Txt variant="small" style={{ marginTop: -space.s, marginBottom: space.l }}>{DEPTH_HINT[s.calendar_depth]}</Txt>
      <Stepper label="Ciclistas nuevos en el mercado cada día" value={s.market_size} min={1} max={30}
               onChange={(v) => set('market_size', v)} />
      <Stepper label="Hora de actualización del mercado" value={s.market_hour} min={0} max={23}
               onChange={(v) => set('market_hour', v)} format={(v) => `${String(v).padStart(2, '0')}:00`} />
      <Toggle label="Clausulazos" value={s.clauses_enabled} onChange={(v) => set('clauses_enabled', v)}
              hint="Pagar la cláusula de un ciclista de otro jugador para quedárselo. Bloqueados los domingos de 21:00 a 24:00." />
      <Segmented label="Reparto de dinero" options={PAYOUT_OPTIONS} value={s.payout_mode}
                 onChange={(v) => set('payout_mode', v)} />

      {s.payout_mode !== 'by_position' ? (
        <Input label="Euros por cada punto" keyboardType="number-pad" value={String(s.payout_per_point)}
               onChangeText={(t) => set('payout_per_point', parseAmount(t) ?? 0)}
               hint="Se paga cada lunes por los puntos de la semana anterior." />
      ) : null}

      {s.payout_mode !== 'per_point' ? (
        <View style={{ marginBottom: space.l }}>
          <Txt variant="label" style={{ marginBottom: 6 }}>Premio por puesto en la semana</Txt>
          {prizes.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <Txt variant="number" style={{ width: 36 }}>{i + 1}.º</Txt>
              <View style={{ flex: 1 }}>
                <Input label={`Premio del ${i + 1}.º`} keyboardType="number-pad" value={String(p)}
                       onChangeText={(t) => set('payout_by_position', prizes.map((x, j) => (j === i ? parseAmount(t) ?? 0 : x)))}
                       hint={money(p)} />
              </View>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <Button small kind="secondary" label="Añadir puesto"
                    onPress={() => set('payout_by_position', [...prizes, 0])} />
            {prizes.length > 0 ? (
              <Button small kind="quiet" label="Quitar el último"
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
