import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Flag } from '@/components/Flag';
import { RiderRow } from '@/components/RiderRow';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { course, dateRange, dateTime, dayMonth, ordinal, points } from '@/lib/format';
import type { RaceDetail, StageScores } from '@/lib/types';
import { colors, fonts, space, type } from '@/theme';

type View_ = 'scores' | 'entries';

/**
 * Carrera de una etapa: puntuaciones e inscripciones. En una clásica, sus puntos (equipos de la liga y ciclistas); en
 * una vuelta, el total de cada equipo en la carrera y un desplegable por cada etapa ya puntuada. Sin puntuaciones aún,
 * se abre en las inscripciones.
 */
export default function Etapa() {
  const { stageId } = useLocalSearchParams<{ stageId: string }>();
  const { leagueId } = useLeague();
  const id = leagueId ?? '';
  const scores = useLoader(() => api.stageScores(id, Number(stageId)), [id, stageId], !!leagueId);
  const entries = useLoader(() => api.raceEntries(id, Number(stageId)), [id, stageId], !!leagueId);
  const [tab, setTab] = useState<View_ | null>(null);

  const st = scores.data?.stage;
  const race = useLoader(() => api.raceDetail(id, st!.race_id), [id, st?.race_id], !!leagueId && !!st?.is_stage_race);
  const scored = st?.is_stage_race ? !!race.data?.stages.some((x) => x.status === 'scored') : st?.status === 'scored';
  const ready = st && (!st.is_stage_race || race.data);
  // la pestaña por defecto depende de si ya hay puntos (solo la primera vez: después manda el usuario)
  useEffect(() => { if (ready && tab == null) setTab(scored ? 'scores' : 'entries'); }, [ready, scored, tab]);
  const reload = () => { scores.reload(); entries.reload(); race.reload(); };
  const open = (riderId: number) => router.push(`/rider/${riderId}`);

  return (
    <Screen onRefresh={reload} refreshing={scores.loading || entries.loading}>
      <View style={{ padding: space.l, paddingTop: space.xl, gap: space.m }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <Txt variant="hero" style={{ flexShrink: 1 }}>{st?.race_name ?? ''}</Txt>
            <Flag code={st?.country} height={16} />
          </View>
          <Txt variant="small">
            {!st ? '' : !st.is_stage_race ? `${t('race.oneDay')} · ${dayMonth(st.date)}`
              : race.data?.stages.length
                ? dateRange(race.data.stages[0].date, race.data.stages[race.data.stages.length - 1].date) : ''}
          </Txt>
        </View>
        <View style={styles.segment} accessibilityRole="tablist">
          {(['scores', 'entries'] as View_[]).map((v) => (
            <Pressable key={v} onPress={() => setTab(v)} accessibilityRole="tab" accessibilityState={{ selected: tab === v }}
                       style={[styles.segBtn, tab === v && styles.segOn]}>
              <Txt style={[styles.segText, tab === v && { color: colors.paper }]}>
                {v === 'scores' ? t('stage.scores') : t('stage.entries')}
              </Txt>
            </Pressable>
          ))}
        </View>
      </View>
      <ErrorText error={scores.error ?? entries.error} />

      {tab === 'scores' && scores.data ? (
        st?.is_stage_race ? (
          <RaceScores leagueId={id} race={race.data} loading={race.loading} members={scores.data.members} open={open}
                     initialStage={st.id} />
        ) : (
          <>
            {!scored ? <Txt style={{ paddingHorizontal: space.l }}>{t('stage.noResultsYet')}</Txt> : null}
            <StageScoresBody data={scores.data} open={open} />
          </>
        )
      ) : tab === 'entries' ? (
        <>
          {entries.data && !entries.data.visible ? (
            <Txt variant="small" style={{ paddingHorizontal: space.l }}>
              {t('stage.hiddenUntil', { when: dateTime(entries.data.entries_close_at) })}
            </Txt>
          ) : null}
          {(entries.data?.teams ?? []).map((tm) => (
            <Section key={tm.member_id}
                     title={tm.team_name}
                     action={<Txt variant="small">
                       {tm.hidden ? t('stage.hidden') : !tm.entered ? t('race.notEntered')
                         : `${tm.riders.length}/${entries.data!.max_entries}${tm.auto ? ` · ${t('stage.auto')}` : ''}`}
                     </Txt>}>
              {tm.riders.length ? tm.riders.map((r, i) => (
                <RiderRow key={r.rider_id} name={r.name} team={r.pro_team} photo={r.photo_url} nationality={r.nationality}
                          value={0} last={i === tm.riders.length - 1} onPress={() => open(r.rider_id)} right={<View />} />
              )) : <Empty text={tm.hidden ? t('stage.hiddenShort') : t('stage.noRiderEntered')} />}
            </Section>
          ))}
          {/* lista de salida completa, por equipos reales, con los equipos de la liga que inscribieron a cada uno */}
          <Section title={t('stage.startlist')}>
            {entries.data?.startlist.length ? entries.data.startlist.map((g) => (
              <View key={g.team_name}>
                <View style={styles.teamHead}>
                  <Txt variant="label" style={{ flex: 1, color: colors.ink }} numberOfLines={1}>{g.team_name}</Txt>
                  <Txt variant="small">{g.riders.length}</Txt>
                </View>
                {g.riders.map((r, i) => (
                  <RiderRow key={`${g.team_name}-${r.bib ?? r.name}`} name={r.name} team={g.team_name} photo={r.photo_url}
                            nationality={r.nationality} value={0} last={i === g.riders.length - 1}
                            note={r.teams.length ? t('stage.enteredBy', { teams: r.teams.join(', ') }) : r.rider_id ? undefined : t('stage.notInGame')}
                            onPress={r.rider_id ? () => open(r.rider_id!) : undefined}
                            right={<Txt variant="number" style={{ color: colors.inkSoft }}>{r.bib ?? ''}</Txt>} />
                ))}
              </View>
            )) : <Empty text={entries.loading ? t('common.loading') : t('stage.noStartlist')} />}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

/**
 * Total de cada equipo en la vuelta; después, cada etapa con su desplegable y, al final, la general (lo que dan las
 * clasificaciones finales), aparte de la última etapa
 */
function RaceScores({ leagueId, race, loading, members, open, initialStage }: {
  leagueId: string; race: RaceDetail | null; loading: boolean; members: StageScores['members'];
  open: (riderId: number) => void; initialStage?: number;
}) {
  // se abre ya desplegada la etapa desde la que se llega
  const [openStage, setOpenStage] = useState<string | null>(initialStage != null ? String(initialStage) : null);
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const totals = new Map((race?.league_total ?? []).map((x) => [x.member_id, x.points]));
  const teams = members.map((m) => ({ ...m, total: totals.get(m.member_id) ?? 0 })).sort((a, b) => b.total - a.total);
  const allStages = race?.stages ?? [];
  const lastStage = allStages[allStages.length - 1];
  // la última etapa sale solo con lo suyo; sus clasificaciones finales van aparte, en «General»
  const parts: StagePart[] = allStages.flatMap((x) => x === lastStage
    ? [{ key: String(x.stage_id), stage: x, part: 'stage' as const, winner: x.winner },
       ...(x.status === 'scored' ? [{ key: 'final', stage: x, part: 'final' as const, winner: race?.gc[0] ?? null }] : [])]
    : [{ key: String(x.stage_id), stage: x, winner: x.winner }]);
  const scoredParts = parts.filter((x) => x.stage.status === 'scored');
  // puntos de cada parte puntuada (para ver cada equipo etapa a etapa); se piden al abrir el primer equipo
  const ids = scoredParts.map((x) => x.key).join(',');
  const byStage = useLoader(() => Promise.all(scoredParts.map((x) => api.stageScores(leagueId, x.stage.stage_id, x.part))),
                            [leagueId, ids, openTeam != null], openTeam != null && scoredParts.length > 0);
  return (
    <>
      <Section title={t('stage.leagueTeams')}>
        {teams.length ? teams.map((m, i) => {
          const isOpen = openTeam === m.member_id;
          return (
            <View key={m.member_id} style={i < teams.length - 1 && styles.line}>
              <Pressable onPress={() => setOpenTeam(isOpen ? null : m.member_id)} accessibilityRole="button"
                         accessibilityState={{ expanded: isOpen }}
                         style={({ pressed }) => [styles.teamRow, pressed && { backgroundColor: colors.road }]}>
                <Txt variant="number" style={{ width: 36 }}>{ordinal(i + 1)}</Txt>
                <View style={{ width: 18 }}><Flag code={m.country} /></View>
                <Txt style={[{ flex: 1 }, m.is_mine && styles.mine]} numberOfLines={1}>{m.team_name}</Txt>
                <Txt variant="number">{points(m.total)}</Txt>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkSoft} />
              </Pressable>
              {/* desplegable: los puntos del equipo etapa a etapa, con los ciclistas que puntuaron */}
              {isOpen ? (
                <View style={styles.teamRiders}>
                  {!scoredParts.length ? <Txt variant="small">{t('stage.noResultsYet')}</Txt>
                    : !byStage.data ? <Txt variant="small">{t('common.loading')}</Txt>
                    : scoredParts.map((x, k) => {
                      const mm = byStage.data![k]?.members.find((y) => y.member_id === m.member_id);
                      return (
                        <View key={x.key} style={{ paddingVertical: 4 }}>
                          <View style={styles.teamRider}>
                            <Txt style={{ flex: 1 }} numberOfLines={1}>{partTitle(x)}</Txt>
                            <Txt variant="number">{points(mm?.points ?? 0)}</Txt>
                          </View>
                          {(mm?.riders ?? []).filter((r) => r.points > 0).map((r) => (
                            <Pressable key={r.rider_id} onPress={() => open(r.rider_id)} style={[styles.teamRider, { paddingLeft: space.m }]}>
                              <Txt variant="small" style={{ flex: 1 }} numberOfLines={1}>{r.name}</Txt>
                              <Txt variant="small">{points(r.points)}</Txt>
                            </Pressable>
                          ))}
                        </View>
                      );
                    })}
                </View>
              ) : null}
            </View>
          );
        }) : <Empty text={t('stage.noTeams')} />}
      </Section>
      <Section title={t('calendar.stagesTitle')}>
        {parts.length ? parts.map((x, i) => (
          <StageItem key={x.key} leagueId={leagueId} item={x} last={i === parts.length - 1} open={open}
                     isOpen={openStage === x.key} onToggle={() => setOpenStage(openStage === x.key ? null : x.key)} />
        )) : <Empty text={loading ? t('common.loading') : t('stage.noResultsYet')} />}
      </Section>
    </>
  );
}

/** Etapa de una vuelta: si ya tiene resultados, al abrirla se cargan su top 10 y sus puntos; si no, solo se lista */
type StagePart = {
  key: string; stage: RaceDetail['stages'][number]; part?: 'stage' | 'final';
  winner: { name: string; nationality: string | null; team: string | null } | null;   // de la etapa o, en la general, el de la general
};

const partTitle = (x: StagePart) => x.part === 'final' ? t('kind.gc')
  : `${x.stage.number === 0 ? t('race.prologue') : t('race.stageN', { n: x.stage.number })} · ${dayMonth(x.stage.date)}`;

function StageItem({ leagueId, item, isOpen, onToggle, last, open }: {
  leagueId: string; item: StagePart; isOpen: boolean; onToggle: () => void; last: boolean;
  open: (riderId: number) => void;
}) {
  const { stage, part, winner } = item;
  const scored = stage.status === 'scored';
  const expanded = isOpen && scored;
  const data = useLoader(() => api.stageScores(leagueId, stage.stage_id, part), [leagueId, stage.stage_id, part, expanded], expanded);
  return (
    <View style={!last && styles.line}>
      <Pressable onPress={onToggle} disabled={!scored} accessibilityRole="button" accessibilityState={{ expanded }}
                 style={({ pressed }) => [styles.teamRow, expanded && styles.stageOpen,
                                          pressed && { backgroundColor: expanded ? colors.asphaltSoft : colors.road }]}>
        <View style={{ flex: 1 }}>
          <Txt variant="lead" style={expanded && { color: colors.paper }}>
            {part === 'final' ? t('kind.gc') : stage.number === 0 ? t('race.prologue') : t('race.stageN', { n: stage.number })}
          </Txt>
          {part === 'final' ? null : (
            <Txt variant="small" numberOfLines={2} style={expanded && { color: colors.line }}>
              {[dayMonth(stage.date), course(stage.distance_km, stage.vertical_m)].filter(Boolean).join(' · ')}
            </Txt>
          )}
        </View>
        {/* a la derecha: el ganador, con su bandera, y su equipo debajo */}
        {winner ? (
          <View style={styles.winner}>
            <View style={styles.winnerName}>
              <Ionicons name="trophy" size={13} color={colors.jersey} />
              <Flag code={winner.nationality} />
              <Txt numberOfLines={1} style={[styles.winnerText, expanded && { color: colors.paper }]}>{winner.name}</Txt>
            </View>
            {winner.team ? (
              <Txt variant="small" numberOfLines={1} style={[{ textAlign: 'right' }, expanded && { color: colors.line }]}>
                {winner.team}
              </Txt>
            ) : null}
          </View>
        ) : null}
        {scored ? (
          <Txt variant="number" style={[styles.myPoints, expanded && { color: colors.jersey }]}>
            {points(part === 'final' ? stage.my_final_points
              : part === 'stage' ? stage.my_points - stage.my_final_points : stage.my_points)}
          </Txt>
        ) : null}
        {scored ? <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={expanded ? colors.jersey : colors.inkSoft} />
          : <Txt variant="small">{t('calendar.pending')}</Txt>}
      </Pressable>
      {expanded ? (
        <View style={styles.stagePanel}>
          {data.data ? <StageScoresBody data={data.data} open={open} compact ridersOnly />
            : <Txt variant="small">{t('common.loading')}</Txt>}
        </View>
      ) : null}
    </View>
  );
}

/** Puntos de una etapa: equipos de la liga (desplegable con sus inscritos) y lo que puntuó cada ciclista */
function StageScoresBody({ data, open, compact, ridersOnly }: {
  data: StageScores; open: (riderId: number) => void; compact?: boolean; ridersOnly?: boolean;
}) {
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const sectionStyle = compact ? { marginTop: space.s } : undefined;
  const riderRows = <StageRiders data={data} open={open} />;
  return (
    <>
      {ridersOnly ? null : <Section title={compact ? undefined : t('stage.leagueTeams')} style={sectionStyle}>
        {data.members.length ? data.members.map((m, i) => {
          const isOpen = openTeam === m.member_id;
          const last = i === data.members.length - 1;
          return (
            <View key={m.member_id} style={!last && styles.line}>
              <Pressable onPress={() => setOpenTeam(isOpen ? null : m.member_id)} accessibilityRole="button"
                         accessibilityState={{ expanded: isOpen }}
                         style={({ pressed }) => [styles.teamRow, pressed && { backgroundColor: colors.road }]}>
                <Txt variant="number" style={{ width: 36 }}>{ordinal(i + 1)}</Txt>
                <View style={{ width: 18 }}><Flag code={m.country} /></View>
                <Txt style={[{ flex: 1 }, m.is_mine && styles.mine]} numberOfLines={1}>{m.team_name}</Txt>
                <Txt variant="number">{points(m.points)}</Txt>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkSoft} />
              </Pressable>
              {isOpen ? (
                <View style={styles.teamRiders}>
                  {m.riders.length ? m.riders.map((r) => (
                    <Pressable key={r.rider_id} onPress={() => open(r.rider_id)} style={styles.teamRider}>
                      <Txt style={{ flex: 1 }} numberOfLines={1}>{r.name}</Txt>
                      <Txt variant="number" style={!r.points ? { color: colors.inkSoft } : undefined}>{points(r.points)}</Txt>
                    </Pressable>
                  )) : <Txt variant="small">{t('stage.noEntry')}</Txt>}
                </View>
              ) : null}
            </View>
          );
        }) : <Empty text={t('stage.noTeams')} />}
      </Section>}
      {ridersOnly ? (
        <Panel title={t('stage.scores')} tint={TINT.scores}>
          {data.riders.length ? riderRows : <Empty text={t('stage.noScorers')} />}
        </Panel>
      ) : <Section title={t('stage.scores')} style={sectionStyle}>{riderRows}</Section>}
    </>
  );
}

// color de la cabecera de los puntos de una etapa abierta
const TINT = {
  scores: { bg: '#DDF0E4', bar: colors.green, ink: '#0E4F2C' },
};

/** Tarjeta de un bloque dentro de una etapa abierta, con la cabecera de su color */
function Panel({ title, tint, children }: { title: string; tint: (typeof TINT)['scores']; children: ReactNode }) {
  return (
    <View style={styles.panel}>
      <View style={[styles.panelHead, { backgroundColor: tint.bg, borderLeftColor: tint.bar }]}>
        <Txt variant="label" style={{ color: tint.ink }}>{title}</Txt>
      </View>
      {children}
    </View>
  );
}

function StageRiders({ data, open }: { data: StageScores; open: (riderId: number) => void }) {
  return (
    <>
        {data.riders.length ? data.riders.map((r, i) => (
          <RiderRow key={r.rider_id} name={r.name} team={r.pro_team} photo={r.photo_url} nationality={r.nationality}
                    note={r.entered_by.length ? t('stage.enteredBy', { teams: r.entered_by.join(', ') })
                      : r.owner ? t('stage.ownedNotEntered', { team: r.owner }) : t('stage.noOwner')}
                    value={0} last={i === data.riders.length - 1} onPress={() => open(r.rider_id)}
                    right={<Txt variant="number">{points(r.points)}</Txt>} />
        )) : <Empty text={t('stage.noResults')} />}
    </>
  );
}

const styles = StyleSheet.create({
  winner: { alignItems: 'flex-end', maxWidth: '42%', gap: 2 },
  myPoints: { minWidth: 48, textAlign: 'right' },
  winnerName: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  winnerText: { flexShrink: 1, fontFamily: fonts.bodyMedium },
  stageOpen: { backgroundColor: colors.asphalt },
  stagePanel: { backgroundColor: colors.road, padding: space.m, gap: space.m },
  panel: { backgroundColor: colors.paper, borderRadius: 8, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  panelHead: { paddingHorizontal: space.l, paddingVertical: 8, borderLeftWidth: 4 },
  segment: {
    flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1.5, borderColor: colors.line, borderRadius: 16,
    overflow: 'hidden',
  },
  segBtn: { paddingHorizontal: space.l, paddingVertical: 6, backgroundColor: colors.paper },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.bodyMedium, fontSize: type.small, color: colors.ink, letterSpacing: 0.2 },
  mine: { fontFamily: fonts.bodyBold },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, paddingVertical: space.m },
  teamRiders: { paddingLeft: space.l + 36 + 18 + 2 * space.m, paddingRight: space.l + 18 + space.m, paddingBottom: space.m },
  teamRider: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingVertical: 5 },
  teamHead: {
    flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.l, paddingVertical: space.s,
    backgroundColor: colors.road, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
});
