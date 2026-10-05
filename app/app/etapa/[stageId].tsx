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
import { api } from '@/lib/api';
import { dateTime, dayMonth, points } from '@/lib/format';
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
            {st ? `${st.is_stage_race ? (st.number === 0 ? 'Prólogo' : `Etapa ${st.number}`) : 'Clásica'} · ${dayMonth(st.date)}` : ''}
          </Txt>
        </View>
        <View style={styles.segment} accessibilityRole="tablist">
          {(['scores', 'entries'] as View_[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}
                       style={[styles.segBtn, tab === t && styles.segOn]}>
              <Txt style={[styles.segText, tab === t && { color: colors.paper }]}>
                {t === 'scores' ? 'Puntuaciones' : 'Inscripciones'}
              </Txt>
            </Pressable>
          ))}
        </View>
      </View>
      <ErrorText error={scores.error ?? entries.error} />

      {tab === 'scores' ? (
        <>
          {!scored && st ? (
            <Txt style={{ paddingHorizontal: space.l }}>No hay clasificaciones disponibles todavía.</Txt>
          ) : null}
          <Section title="Equipos de la liga">
            {scores.data?.members.length ? scores.data.members.map((m, i) => {
              const isOpen = openTeam === m.member_id;
              const last = i === scores.data!.members.length - 1;
              return (
                <View key={m.member_id} style={!last && styles.line}>
                  {/* desplegable: los puntos de cada ciclista inscrito por el equipo */}
                  <Pressable onPress={() => setOpenTeam(isOpen ? null : m.member_id)} accessibilityRole="button"
                             accessibilityState={{ expanded: isOpen }}
                             style={({ pressed }) => [styles.teamRow, pressed && { backgroundColor: colors.road }]}>
                    <Txt variant="number" style={{ width: 36 }}>{i + 1}.º</Txt>
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
                      )) : <Txt variant="small">Sin ciclistas inscritos en esta carrera.</Txt>}
                    </View>
                  ) : null}
                </View>
              );
            }) : <Empty text={scores.loading ? 'Cargando…' : 'No hay equipos en la liga.'} />}
          </Section>
          <Section title="Puntuaciones">
            {scores.data?.riders.length ? scores.data.riders.map((r, i) => (
              <RiderRow key={r.rider_id} name={r.name} team={r.pro_team} photo={r.photo_url} nationality={r.nationality}
                        note={r.entered_by.length ? `inscrito por ${r.entered_by.join(', ')}`
                          : r.owner ? `de ${r.owner}, sin inscribir` : 'sin dueño en la liga'}
                        value={0} last={i === scores.data!.riders.length - 1} onPress={() => open(r.rider_id)}
                        right={<Txt variant="number">{points(r.points)}</Txt>} />
            )) : <Empty text={scores.loading ? 'Cargando…' : 'Todavía no hay resultados.'} />}
          </Section>
        </>
      ) : tab === 'entries' ? (
        <>
          {entries.data && !entries.data.visible ? (
            <Txt variant="small" style={{ paddingHorizontal: space.l }}>
              Las inscripciones de los demás equipos se verán cuando cierre la inscripción
              ({dateTime(entries.data.entries_close_at)}).
            </Txt>
          ) : null}
          {(entries.data?.teams ?? []).map((t) => (
            <Section key={t.member_id}
                     title={t.team_name}
                     action={<Txt variant="small">
                       {t.hidden ? 'oculta' : !t.entered ? 'sin inscripción'
                         : `${t.riders.length}/${entries.data!.max_entries}${t.auto ? ' · automática' : ''}`}
                     </Txt>}>
              {t.riders.length ? t.riders.map((r, i) => (
                <RiderRow key={r.rider_id} name={r.name} team={r.pro_team} photo={r.photo_url} nationality={r.nationality}
                          value={0} last={i === t.riders.length - 1} onPress={() => open(r.rider_id)} right={<View />} />
              )) : <Empty text={t.hidden ? 'Se verá al cerrar la inscripción.' : 'Ningún ciclista inscrito.'} />}
            </Section>
          ))}
          {/* lista de salida completa, por equipos reales, con los equipos de la liga que inscribieron a cada uno */}
          <Section title="Lista de salida">
            {entries.data?.startlist.length ? entries.data.startlist.map((g) => (
              <View key={g.team_name}>
                <View style={styles.teamHead}>
                  <Txt variant="label" style={{ flex: 1, color: colors.ink }} numberOfLines={1}>{g.team_name}</Txt>
                  <Txt variant="small">{g.riders.length}</Txt>
                </View>
                {g.riders.map((r, i) => (
                  <RiderRow key={`${g.team_name}-${r.bib ?? r.name}`} name={r.name} team={g.team_name} photo={r.photo_url}
                            nationality={r.nationality} value={0} last={i === g.riders.length - 1}
                            note={r.teams.length ? `inscrito por ${r.teams.join(', ')}` : r.rider_id ? undefined : 'no está en el juego'}
                            onPress={r.rider_id ? () => open(r.rider_id!) : undefined}
                            right={<Txt variant="number" style={{ color: colors.inkSoft }}>{r.bib ?? ''}</Txt>} />
                ))}
              </View>
            )) : <Empty text={entries.loading ? 'Cargando…' : 'La lista de salida aún no está publicada.'} />}
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
