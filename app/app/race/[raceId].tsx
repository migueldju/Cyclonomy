import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Flag } from '@/components/Flag';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Section } from '@/components/Section';
import { StatusDot } from '@/components/StatusDot';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { dateRange, dateTime, moneyShort, points } from '@/lib/format';
import { categoryName, colors, space } from '@/theme';

/** Inscripción de una carrera: hasta el máximo de su categoría, hasta la salida de la 1.ª etapa */
export default function Inscripcion() {
  const { raceId } = useLocalSearchParams<{ raceId: string }>();
  const { leagueId, refresh } = useLeague();
  const id = leagueId ?? '';
  const { data, error, loading, reload } = useLoader(() => api.entry(id, Number(raceId)), [id, raceId], !!leagueId);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // solo los inscritos que siguen siendo míos y disponibles (un vendido no debe bloquear el guardado)
  useEffect(() => {
    if (data) setChosen(new Set(data.entered.filter((rid) => data.riders.some((r) => r.rider_id === rid && r.available))));
  }, [data]);

  // primero los inscritos (según lo guardado, para que la lista no salte al marcar), luego el resto
  const riders = useMemo(() => {
    if (!data) return [];
    const entered = new Set(data.entered);
    return [...data.riders].sort((a, b) => Number(entered.has(b.rider_id)) - Number(entered.has(a.rider_id)));
  }, [data]);

  if (!data) {
    return <Screen><ErrorText error={error} /><Empty text={loading ? t('common.loading') : t('entry.loadError')} /></Screen>;
  }
  const max = data.max_entries;

  function toggle(riderId: number) {
    setSaved(false);
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(riderId)) next.delete(riderId);
      else if (next.size < max) next.add(riderId);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setSaveError(null);
    try {
      await api.saveEntry(id, Number(raceId), [...chosen]);
      setSaved(true);
      reload();
      refresh();
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <View style={{ padding: space.l, paddingTop: space.xl, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <Txt variant="hero" style={{ flexShrink: 1 }}>{data.race.name}</Txt>
          <Flag code={data.race.country} height={16} />
        </View>
        <Txt variant="small">{categoryName(data.race.category)} · {dateRange(data.race.start_date, data.race.end_date)}</Txt>
        <Txt>
          {data.open ? t('entry.open', { max, when: dateTime(data.race.entries_close_at) }) : t('entry.closed')}
          {data.auto ? ` ${t('entry.auto')}` : ''}
        </Txt>
        {data.open ? (
          <Txt variant="small">
            {t('entry.autoHint')}
          </Txt>
        ) : null}
      </View>

      <Section title={t('entry.yourRiders', { n: chosen.size, max })}>
        {riders.length ? riders.map((r, i) => {
          const on = chosen.has(r.rider_id);
          const disabled = !data.open || (!on && (!r.available || chosen.size >= max));
          return (
            <Pressable key={r.rider_id} onPress={() => toggle(r.rider_id)} disabled={disabled}
                       accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled }}
                       style={[styles.row, i < riders.length - 1 && styles.line, disabled && !on && { opacity: 0.5 }]}>
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? colors.ink : colors.inkSoft} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                  <Txt variant="lead" numberOfLines={1} style={{ flexShrink: 1 }}>{r.name}</Txt>
                  <StatusDot status={r.status} />
                </View>
                <Txt variant="small">
                  {[r.pro_team, `${points(r.season_points)}`,
                    data.has_startlist ? (r.on_startlist ? t('entry.onStartlist') : t('entry.notOnStartlist')) : null,
                    !r.available ? (r.status === 'leaving' ? t('status.leaving') : t('entry.fromMonday')) : null]
                    .filter(Boolean).join(' · ')}
                </Txt>
              </View>
              <Txt variant="number">{moneyShort(r.market_value)}</Txt>
            </Pressable>
          );
        }) : <Empty text={t('entry.noRiders')} />}
      </Section>

      {data.open ? (
        <View style={{ padding: space.l }}>
          <ErrorText error={saveError} />
          {saved ? <Txt style={{ color: colors.green, marginBottom: space.s }}>{t('entry.saved')}</Txt> : null}
          <Button label={t('entry.save', { n: chosen.size, max })} onPress={save} busy={busy} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, paddingVertical: space.m },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
