import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Input, Segmented } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { colors, space } from '@/theme';

const kinds = () => [
  { value: 'stage', label: t('admin.kindStage') }, { value: 'gc', label: t('kind.gc') }, { value: 'points', label: t('kind.points') },
  { value: 'kom', label: t('kind.kom') }, { value: 'kom_leader', label: t('admin.kindKomLeader') },
];

const slugs = (text: string) => text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);

/** Plan B si PCS falla: cargar a mano listas de salida y resultados (slugs de PCS, uno por línea, en orden) */
export default function Admin() {
  const [raceId, setRaceId] = useState('');
  const [startlist, setStartlist] = useState('');
  const [stageId, setStageId] = useState('');
  const [kind, setKind] = useState('stage');
  const [results, setResults] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setMsg(null);
    try { setMsg({ ok: true, text: await fn() }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(false);
  }

  return (
    <Screen padded>
      <Txt variant="hero" style={{ marginTop: space.l }}>{t('admin.title')}</Txt>
      <Txt variant="small" style={{ marginBottom: space.l }}>
        {t('admin.intro')}
      </Txt>
      {msg ? <Txt style={{ color: msg.ok ? colors.green : colors.red, marginBottom: space.m }}>{msg.text}</Txt> : null}

      <Section title={t('stage.startlist')} style={{ marginHorizontal: -space.l }}>
        <View style={{ padding: space.l }}>
          <Input label={t('admin.raceId')} value={raceId} onChangeText={setRaceId} keyboardType="number-pad" />
          <Input label={t('admin.riders')} value={startlist} onChangeText={setStartlist} multiline style={{ minHeight: 120 }} autoCapitalize="none" />
          <Button label={t('admin.loadStartlist')} busy={busy} disabled={!raceId || !startlist}
                  onPress={() => run(async () => t('admin.startlistLoaded', { n: await api.adminLoadStartlist(Number(raceId), slugs(startlist)) }))} />
        </View>
      </Section>

      <Section title={t('admin.results')} style={{ marginHorizontal: -space.l }}>
        <View style={{ padding: space.l }}>
          <Input label={t('admin.stageId')} value={stageId} onChangeText={setStageId} keyboardType="number-pad" />
          <Segmented label={t('admin.classification')} options={kinds()} value={kind} onChange={setKind} />
          <Input label={t('admin.ridersInOrder')} value={results} onChangeText={setResults} multiline style={{ minHeight: 160 }} autoCapitalize="none" />
          <Button label={t('admin.loadResults')} busy={busy} disabled={!stageId || !results}
                  onPress={() => run(async () => t('admin.resultsLoaded', { n: await api.adminLoadResults(Number(stageId), kind, slugs(results)) }))} />
        </View>
      </Section>
    </Screen>
  );
}
