import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Input, Segmented } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { api } from '@/lib/api';
import { colors, space } from '@/theme';

const KINDS = [
  { value: 'stage', label: 'Etapa / clásica' }, { value: 'gc', label: 'General' }, { value: 'points', label: 'Puntos' },
  { value: 'kom', label: 'Montaña' }, { value: 'kom_leader', label: 'Líder montaña' },
];

const slugs = (t: string) => t.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);

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
      <Txt variant="hero" style={{ marginTop: space.l }}>Carga manual</Txt>
      <Txt variant="small" style={{ marginBottom: space.l }}>
        Usa los identificadores de PCS de cada ciclista (por ejemplo, tadej-pogacar), uno por línea y en orden.
      </Txt>
      {msg ? <Txt style={{ color: msg.ok ? colors.green : colors.red, marginBottom: space.m }}>{msg.text}</Txt> : null}

      <Section title="Lista de salida" style={{ marginHorizontal: -space.l }}>
        <View style={{ padding: space.l }}>
          <Input label="Número de carrera (id)" value={raceId} onChangeText={setRaceId} keyboardType="number-pad" />
          <Input label="Ciclistas" value={startlist} onChangeText={setStartlist} multiline style={{ minHeight: 120 }} autoCapitalize="none" />
          <Button label="Cargar lista de salida" busy={busy} disabled={!raceId || !startlist}
                  onPress={() => run(async () => `${await api.adminLoadStartlist(Number(raceId), slugs(startlist))} ciclistas cargados. Si la carrera ya empezó, se han hecho las alineaciones automáticas.`)} />
        </View>
      </Section>

      <Section title="Resultados" style={{ marginHorizontal: -space.l }}>
        <View style={{ padding: space.l }}>
          <Input label="Número de etapa (id)" value={stageId} onChangeText={setStageId} keyboardType="number-pad" />
          <Segmented label="Clasificación" options={KINDS} value={kind} onChange={setKind} />
          <Input label="Ciclistas en orden" value={results} onChangeText={setResults} multiline style={{ minHeight: 160 }} autoCapitalize="none" />
          <Button label="Cargar y recalcular puntos" busy={busy} disabled={!stageId || !results}
                  onPress={() => run(async () => `${await api.adminLoadResults(Number(stageId), kind, slugs(results))} posiciones cargadas y puntos recalculados.`)} />
        </View>
      </Section>
    </Screen>
  );
}
