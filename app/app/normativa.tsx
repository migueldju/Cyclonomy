import { useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import { Button } from '@/components/Button';
import { DEFAULT_SETTINGS, DEPTH_HINT, DEPTH_OPTIONS, LeagueSettingsForm, PAYOUT_OPTIONS } from '@/components/LeagueSettingsForm';
import { Screen } from '@/components/Screen';
import { ErrorText, Row, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { inviteMessage } from '@/lib/invite';
import type { Category, League, ScoringRule } from '@/lib/types';
import { space } from '@/theme';

const RULES = [
  'Empiezas con 8.000.000 € y 16 ciclistas al azar que suman unos 4.000.000 €.',
  'Puedes endeudarte hasta el 20 % del valor de tu plantilla. Si el lunes a las 00:00 tu saldo es negativo, no puntúas en toda la semana.',
  'Cada día salen ciclistas nuevos al mercado. La puja es a ciegas: gana la más alta y, si empatan, la que se hizo antes.',
  'Los fichajes llegan con punto naranja: se pueden inscribir a partir del lunes siguiente.',
  'Al fichar, la cláusula es el 150 % del precio. Puedes cambiarla en escalones de 50 puntos entre el 150 % y el 500 % del precio: subirla cuesta la mitad de lo que sube y bajarla te devuelve un cuarto de lo que baja.',
  'Un clausulazo se paga al dueño del ciclista. El ciclista se queda con él (punto rojo) hasta el lunes y sigue puntuando para él en las carreras donde ya estaba inscrito.',
  'Los clausulazos están bloqueados los domingos de 21:00 a 24:00.',
  'Si pones un ciclista a la venta, sale al mercado durante 48 horas y los demás pueden pujar a ciegas (mínimo, su valor). 12 horas antes del cierre el juego te ofrece su valor ±10 %, que puedes aceptar hasta el cierre. Si hay pujas, gana la más alta y el ciclista cambia de dueño el lunes; si no, sigue siendo tuyo.',
  'Cada carrera tiene su inscripción, que cierra al empezar la 1.ª etapa. Si no te inscribes, el sistema elige por ti entre tus ciclistas de la lista de salida.',
];

export default function Normativa() {
  const { leagueId, me, refresh } = useLeague();
  const id = leagueId ?? '';
  const league = useLoader(() => api.league(id), [id], !!leagueId);
  const cats = useLoader(() => api.categories());
  const scoring = useLoader(() => api.scoring());
  const [editing, setEditing] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const lg = league.data;

  return (
    <Screen onRefresh={league.reload} refreshing={league.loading}>
      <View style={{ padding: space.l, paddingTop: space.xl }}>
        <Txt variant="hero">Normativa</Txt>
        <Txt variant="small">{lg?.name ?? ''}</Txt>
      </View>
      <ErrorText error={league.error} />

      {lg && editing ? (
        <Section title="Editar parámetros">
          <View style={{ padding: space.l }}>
            <LeagueSettingsForm
              initial={{ ...DEFAULT_SETTINGS, ...pick(lg) }}
              initialName={lg.name}
              submitLabel="Guardar cambios"
              onSubmit={async (name, s) => {
                await api.updateLeague(id, { ...s, name });
                setEditing(false);
                league.reload();
                refresh();
              }}
            />
            <Button kind="quiet" label="Cancelar" onPress={() => setEditing(false)} style={{ marginTop: space.s }} />
          </View>
        </Section>
      ) : lg ? (
        <Section title="Parámetros de la liga"
                 action={me?.is_admin ? <Button small kind="secondary" label="Editar" onPress={() => setEditing(true)} /> : undefined}>
          <Param label="Máximo de ciclistas por equipo" value={String(lg.max_riders)} />
          <Param label="Calendario" value={DEPTH_OPTIONS.find((o) => o.value === lg.calendar_depth)?.label ?? ''}
                 hint={DEPTH_HINT[lg.calendar_depth]} />
          <Param label="Mercado" value={`${lg.market_size} ciclistas al día, a las ${String(lg.market_hour).padStart(2, '0')}:00`} />
          <Param label="Clausulazos" value={lg.clauses_enabled ? 'Activados' : 'Desactivados'} />
          <Param label="Reparto de dinero" value={PAYOUT_OPTIONS.find((o) => o.value === lg.payout_mode)?.label ?? ''}
                 hint={payoutHint(lg)} last />
        </Section>
      ) : null}

      {me?.is_admin && lg ? (
        <Section title="Invitación">
          <View style={{ padding: space.l, gap: space.m }}>
            <Txt>Código: <Txt variant="number">{lg.invite_code}</Txt></Txt>
            <Button kind="secondary" label="Compartir invitación"
                    onPress={() => Share.share({ message: inviteMessage(lg.name, lg.invite_code) })} />
            <Button kind="quiet" label="Generar un código nuevo"
                    onPress={async () => {
                      setCodeError(null);
                      try { await api.regenerateCode(id); league.reload(); } catch (e) { setCodeError((e as Error).message); }
                    }} />
            <ErrorText error={codeError} />
          </View>
        </Section>
      ) : null}

      <Section title="Reglas">
        {RULES.map((r, i) => (
          <Row key={i} last={i === RULES.length - 1}><Txt style={{ flex: 1 }}>{r}</Txt></Row>
        ))}
      </Section>

      <Section title="Puntos por categoría">
        <ScoringTable cats={(cats.data ?? []).filter((c) => !lg || c.depth_level <= lg.calendar_depth)} rules={scoring.data ?? []} />
      </Section>
    </Screen>
  );
}

function pick(lg: League) {
  const { max_riders, calendar_depth, market_size, market_hour, clauses_enabled, payout_mode, payout_per_point, payout_by_position } = lg;
  return { max_riders, calendar_depth, market_size, market_hour, clauses_enabled, payout_mode, payout_per_point, payout_by_position };
}

function payoutHint(lg: League) {
  const perPoint = `${money(lg.payout_per_point)} por punto`;
  const prizes = lg.payout_by_position.length
    ? lg.payout_by_position.map((p, i) => `${i + 1}.º ${money(p)}`).join(', ') : 'sin premios definidos';
  const text = lg.payout_mode === 'per_point' ? perPoint : lg.payout_mode === 'by_position' ? prizes : `${perPoint}; además, ${prizes}`;
  return `${text}. Se paga cada lunes por la semana anterior.`;
}

function Param({ label, value, hint, last }: { label: string; value: string; hint?: string; last?: boolean }) {
  return (
    <Row last={last}>
      <View style={{ flex: 1 }}>
        <Txt variant="small">{label}</Txt>
        <Txt variant="lead">{value}</Txt>
        {hint ? <Txt variant="small">{hint}</Txt> : null}
      </View>
    </Row>
  );
}

const KIND_LABEL: Record<string, string> = {
  oneday: 'Clásica', gc: 'General final', stage: 'Etapa', points_final: 'Clasif. puntos', kom_final: 'Clasif. montaña',
  kom_jersey: 'Maillot montaña/día',
};

function ScoringTable({ cats, rules }: { cats: Category[]; rules: ScoringRule[] }) {
  const byCat = useMemo(() => {
    const m = new Map<string, Map<string, ScoringRule[]>>();
    rules.forEach((r) => {
      if (!m.has(r.category)) m.set(r.category, new Map());
      const k = m.get(r.category)!;
      k.set(r.kind, [...(k.get(r.kind) ?? []), r]);
    });
    return m;
  }, [rules]);

  return (
    <>
      {cats.map((c, i) => {
        const kinds = [...(byCat.get(c.code)?.entries() ?? [])];
        return (
          <Row key={c.code} last={i === cats.length - 1}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="lead">{c.name}</Txt>
              <Txt variant="small">Hasta {c.max_entries} inscritos</Txt>
              {kinds.map(([kind, rs]) => (
                <Txt key={kind} variant="small">
                  {KIND_LABEL[kind] ?? kind}: {rs.slice(0, 5).map((r) => r.points).join(' · ')}
                  {rs.length > 5 ? ` … hasta el ${rs.length}.º` : ''}
                </Txt>
              ))}
            </View>
          </Row>
        );
      })}
    </>
  );
}
