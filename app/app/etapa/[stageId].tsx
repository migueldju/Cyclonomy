import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { dateTime, dayMonth, ordinal, points } from '@/lib/format';
import { colors, fonts, space, type } from '@/theme';

type View_ = 'scores' | 'entries';

/**
 * Etapa (o clásica) de una carrera: puntuaciones (equipos de la liga y ciclistas) e inscripciones (de cada
 * equipo y en total). Sin puntuaciones aún, se abre en las inscripciones.
 */
export default function Etapa() {
  const { stageId } = useLocalSearchParams<{ stageId: string }>();
  const { leagueId } = useLeague();
  const id = leagueId ?? '';
  const scores = useLoader(() => api.stageScores(id, Number(stageId)), [id, stageId], !!leagueId);
  const entries = useLoader(() => api.raceEntries(id, Number(stageId)), [id, stageId], !!leagueId);
  const [tab, setTab] = useState<View_ | null>(null);
  const [openTeam, setOpenTeam] = useState<string | null>(null);

  const st = scores.data?.stage;
  const scored = st?.status === 'scored';
  // la pestaña por defecto depende de si ya hay puntos (solo la primera vez: después manda el usuario)
  useEffect(() => { if (st && tab == null) setTab(scored ? 'scores' : 'entries'); }, [st, scored, tab]);
  const reload = () => { scores.reload(); entries.reload(); };
  const open = (riderId: number) => router.push(`/ciclista/${riderId}`);

  return (
    <Screen onRefresh={reload} refreshing={scores.loading || entries.loading}>
      <View style={{ padding: space.l, paddingTop: space.xl, gap: space.m }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <Txt variant="hero" style={{ flexShrink: 1 }}>{st?.race_name ?? ''}</Txt>
            <Flag code={st?.country} height={16} />
          </View>
          <Txt variant="small">
            {st ? `${st.is_stage_race ? (st.number === 0 ? t('race.prologue') : t('race.stageN', { n: st.number })) : t('race.oneDay')} · ${dayMonth(st.date)}` : ''}
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

      {tab === 'scores' ? (
        <>
          {!scored && st ? (
            <Txt style={{ paddingHorizontal: space.l }}>{t('stage.noResultsYet')}</Txt>
          ) : null}
          <Section title={t('stage.leagueTeams')}>
            {scores.data?.members.length ? scores.data.members.map((m, i) => {
              const isOpen = openTeam === m.member_id;
              const last = i === scores.data!.members.length - 1;
              return (
                <View key={m.member_id} style={!last && styles.line}>
                  {/* desplegable: los puntos de cada ciclista inscrito por el equipo */}
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
            }) : <Empty text={scores.loading ? t('common.loading') : t('stage.noTeams')} />}
          </Section>
          <Section title={t('stage.scores')}>
            {scores.data?.riders.length ? scores.data.riders.map((r, i) => (
              <RiderRow key={r.rider_id} name={r.name} team={r.pro_team} photo={r.photo_url} nationality={r.nationality}
                        note={r.entered_by.length ? t('stage.enteredBy', { teams: r.entered_by.join(', ') })
                          : r.owner ? t('stage.ownedNotEntered', { team: r.owner }) : t('stage.noOwner')}
                        value={0} last={i === scores.data!.riders.length - 1} onPress={() => open(r.rider_id)}
                        right={<Txt variant="number">{points(r.points)}</Txt>} />
            )) : <Empty text={scores.loading ? t('common.loading') : t('stage.noResults')} />}
          </Section>
        </>
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

const styles = StyleSheet.create({
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
