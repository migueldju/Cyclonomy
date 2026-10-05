import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { ClauseSheet } from '@/components/ClauseSheet';
import { ActionSheet } from '@/components/Modal';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Section } from '@/components/Section';
import { Flag } from '@/components/Flag';
import { RiderAvatar } from '@/components/RiderAvatar';
import { Txt } from '@/components/Txt';
import { ValueChart } from '@/components/ValueChart';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { api } from '@/lib/api';
import { dateRange, money, moneyShort, ordinal, points, todayISO } from '@/lib/format';
import { actionsFor } from '@/lib/rosterActions';
import type { RiderPhoto, RiderResult } from '@/lib/types';
import { categoryColor, colors, fonts, space, type } from '@/theme';

type Filter = 'recent' | 'top';
const PAGE = 5;

/** Resultados de un ciclista en una carrera (etapas y clasificaciones finales) */
interface RaceGroup {
  key: string;
  name: string;
  country: string | null;
  category: string;
  isStageRace: boolean;
  start: string;
  end: string;
  points: number;
  final: number | null;        // general final (vuelta) o puesto (clásica)
  live: boolean;               // carrera del juego aún en marcha y sin puesto final
  best: number;                // mejor puesto en cualquier resultado
  rows: RiderResult[];
}

/** Ficha de un ciclista: datos, dueño en la liga, evolución del valor y resultados por carrera */
export default function Ciclista() {
  const { riderId } = useLocalSearchParams<{ riderId: string }>();
  const { leagueId, me, refresh } = useLeague();
  const id = leagueId ?? '';
  const detail = useLoader(() => api.rider(id, Number(riderId)), [id, riderId], !!leagueId);
  const mine = !!detail.data?.owner?.is_mine;
  const roster = useLoader(() => api.roster(id), [id, mine], !!leagueId && mine);
  const [filter, setFilter] = useState<Filter>('recent');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [raising, setRaising] = useState(false);

  const d = detail.data;
  const rosterRow = mine ? roster.data?.find((r) => r.rider_id === Number(riderId)) : undefined;

  const groups = useMemo(() => {
    const all = groupByRace(d?.results ?? []);
    if (filter === 'recent') return all.sort((a, b) => b.start.localeCompare(a.start));
    // destacados: carreras con algún top 10, primero las que más puntos dieron
    return all.filter((g) => g.best <= 10)
      .sort((a, b) => b.points - a.points || (a.final ?? 999) - (b.final ?? 999) || b.start.localeCompare(a.start));
  }, [d, filter]);

  if (!d) {
    return <Screen><ErrorText error={detail.error} /><Empty text={detail.loading ? 'Cargando…' : 'No se pudo cargar el ciclista.'} /></Screen>;
  }
  const r = d.rider;
  const pickFilter = (f: Filter) => { setFilter(f); setShown(PAGE); setOpen(null); };

  return (
    <Screen onRefresh={detail.reload} refreshing={detail.loading}>
      <View style={styles.head}>
        <RiderAvatar url={r.photo?.url} name={r.name} team={r.pro_team} size={72} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <Txt variant="display" numberOfLines={2} style={{ flexShrink: 1 }}>{r.name}</Txt>
            <Flag code={r.nationality} height={15} />
          </View>
          <Txt variant="small">
            {[r.pro_team, r.age != null ? `${r.age} años` : null].filter(Boolean).join(' · ')}
          </Txt>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat label="Valor de mercado" value={moneyShort(r.market_value)} />
        <Stat label="Puntos esta temporada" value={points(r.season_points)} />
        <Stat label="Propietario" value={d.owner ? (d.owner.is_mine ? 'Tú' : d.owner.team_name) : 'Libre'} />
        {d.owner ? <Stat label="Cláusula" value={moneyShort(d.owner.clause)} /> : null}
      </View>

      <View style={{ paddingHorizontal: space.l }}>
        {mine ? (
          <Button kind="secondary" label="Gestionar ciclista" onPress={() => setManaging(true)} disabled={!rosterRow} />
        ) : d.owner ? (
          <Button kind="secondary" label={`Ver la plantilla de ${d.owner.team_name}`}
                  onPress={() => router.push(`/jugador/${d.owner!.member_id}`)} />
        ) : (
          <Txt variant="small">Está libre: puede aparecer en el mercado de la liga.</Txt>
        )}
      </View>

      <Section title="Valor de mercado">
        <ValueChart points={d.values} />
      </Section>

      <Section title="Resultados"
               action={
                 <View style={styles.segment} accessibilityRole="tablist">
                   {(['recent', 'top'] as Filter[]).map((f) => (
                     <Pressable key={f} onPress={() => pickFilter(f)} accessibilityRole="tab"
                                accessibilityState={{ selected: filter === f }}
                                style={[styles.segBtn, filter === f && styles.segOn]}>
                       <Txt style={[styles.segText, filter === f && { color: colors.paper }]}>
                         {f === 'recent' ? 'Recientes' : 'Destacados'}
                       </Txt>
                     </Pressable>
                   ))}
                 </View>
               }>
        {groups.length ? (
          <>
            {groups.slice(0, shown).map((g, i) => (
              <RaceItem key={g.key} g={g} open={open === g.key} last={i === Math.min(shown, groups.length) - 1}
                        onToggle={() => setOpen(open === g.key ? null : g.key)} />
            ))}
            {groups.length > shown ? (
              <Pressable onPress={() => setShown(groups.length)} accessibilityRole="button" style={styles.more}>
                <Txt variant="label" style={{ color: colors.ink }}>Ver más ({groups.length - shown})</Txt>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Empty text={d.results.length
            ? 'Todavía no tiene ningún top 10.'
            : 'Todavía no tiene resultados. Aparecerán aquí cuando corra.'} />
        )}
      </Section>
      <ErrorText error={detail.error} />

      {r.photo ? <Credit photo={r.photo} /> : null}

      {rosterRow ? (
        <ActionSheet
          visible={managing}
          onClose={() => setManaging(false)}
          title={r.name}
          subtitle={`Valor ${money(rosterRow.market_value)} · pagaste ${money(rosterRow.price_paid)} · cláusula ${money(rosterRow.clause)}`}
          actions={actionsFor(rosterRow, { onChangeClause: () => { setTimeout(() => setRaising(true), 350); } })}
          onDone={() => { detail.reload(); roster.reload(); refresh(); }}
        />
      ) : null}
      <ClauseSheet row={rosterRow ?? null} available={me?.available} visible={raising} onClose={() => setRaising(false)}
                   onDone={() => { detail.reload(); roster.reload(); refresh(); }} />
    </Screen>
  );
}

function groupByRace(results: RiderResult[]): RaceGroup[] {
  const today = todayISO();
  const map = new Map<string, RaceGroup>();
  for (const x of results) {
    let g = map.get(x.race_key);
    if (!g) {
      g = { key: x.race_key, name: x.race_name, country: x.country, category: x.category, isStageRace: x.is_stage_race,
            start: x.race_start, end: x.race_end, points: 0, final: null, live: false, best: 999, rows: [] };
      map.set(x.race_key, g);
    }
    g.rows.push(x);
    g.points += x.points;
    g.best = Math.min(g.best, x.position);
    if (g.isStageRace ? x.kind === 'gc' : x.kind === 'stage') g.final = x.position;
  }
  for (const g of map.values()) {
    // solo las carreras del juego pueden estar en marcha (las del historial ya terminaron)
    g.live = g.final == null && g.rows.some((x) => x.stage_id != null) && g.end >= today;
    // clasificaciones finales primero; después las etapas en orden
    const order = { gc: 0, points: 1, kom: 2, stage: 3 };
    g.rows.sort((a, b) => order[a.kind] - order[b.kind] || a.number - b.number);
  }
  return [...map.values()];
}

const KIND_LABEL = { gc: 'General', points: 'Puntos', kom: 'Montaña' };

function RaceItem({ g, open, last, onToggle }: { g: RaceGroup; open: boolean; last: boolean; onToggle: () => void }) {
  const year = g.start.slice(0, 4) !== todayISO().slice(0, 4) ? ` ${g.start.slice(0, 4)}` : '';
  const status = g.final != null ? ordinal(g.final) : g.live ? 'En marcha' : g.isStageRace ? 'No terminó' : '—';
  // una clásica tiene un solo resultado: sin desplegable (si es del juego, abre la etapa)
  const oneDay = !g.isStageRace;
  const stageId = oneDay ? g.rows[0]?.stage_id : null;
  const onPress = oneDay ? (stageId ? () => router.push(`/etapa/${stageId}`) : undefined) : onToggle;
  return (
    <View style={[!last && styles.line]}>
      <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button"
                 accessibilityState={oneDay ? undefined : { expanded: open }}
                 style={({ pressed }) => [styles.raceHead, pressed && { backgroundColor: colors.road }]}>
        <View style={[styles.swatch, { backgroundColor: categoryColor[g.category] ?? colors.line }]} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <Txt variant="lead" numberOfLines={1} style={{ flexShrink: 1 }}>{g.name}</Txt>
            <Flag code={g.country} />
          </View>
          <Txt variant="small">{dateRange(g.start, g.end)}{year}{g.points ? ` · ${points(g.points)}` : ''}</Txt>
        </View>
        <Txt variant={g.final != null ? 'number' : 'label'} style={g.live ? { color: colors.green } : undefined}>{status}</Txt>
        {oneDay ? <View style={{ width: 18 }} /> : (
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkSoft} />
        )}
      </Pressable>
      {open && !oneDay ? (
        <View style={styles.detail}>
          {g.rows.map((x) => {
            const what = x.kind !== 'stage' ? KIND_LABEL[x.kind]
              : !x.is_stage_race ? 'Resultado' : x.number === 0 ? 'Prólogo' : `Etapa ${x.number}`;
            return (
              <Pressable key={`${x.kind}-${x.number}`} disabled={!x.stage_id}
                         onPress={() => x.stage_id && router.push(`/etapa/${x.stage_id}`)} style={styles.detailLine}>
                <Txt style={{ flex: 1 }}>{what}</Txt>
                <Txt variant="number" style={{ width: 52, textAlign: 'right' }}>{ordinal(x.position)}</Txt>
                <Txt variant="small" style={{ width: 64, textAlign: 'right' }}>{x.points ? points(x.points) : ''}</Txt>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** Atribución que exigen las licencias de Commons: autor, licencia y enlace al archivo */
function Credit({ photo }: { photo: RiderPhoto }) {
  const open = (url: string | null) => () => { if (url) Linking.openURL(url); };
  return (
    <Txt variant="small" style={styles.credit}>
      Foto: <Txt variant="small" style={styles.link} onPress={open(photo.page_url)}>{photo.author}</Txt>
      {' · '}
      <Txt variant="small" style={styles.link} onPress={open(photo.license_url ?? photo.page_url)}>{photo.license}</Txt>
      {' · Wikimedia Commons'}
    </Txt>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Txt variant="small">{label}</Txt>
      <Txt variant="title" numberOfLines={1}>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, paddingTop: space.xl },
  stats: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.l, paddingBottom: space.l, rowGap: space.m },
  stat: { width: '50%', paddingRight: space.s },
  swatch: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  raceHead: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, paddingVertical: space.m },
  detail: { paddingLeft: space.l + 16, paddingRight: space.l, paddingBottom: space.m },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingVertical: 5 },
  more: { alignItems: 'center', paddingVertical: space.m, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  segment: { flexDirection: 'row', borderWidth: 1.5, borderColor: colors.line, borderRadius: 16, overflow: 'hidden' },
  segBtn: { paddingHorizontal: space.m, paddingVertical: 5, backgroundColor: colors.paper },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.bodyMedium, fontSize: type.small, color: colors.ink, letterSpacing: 0.2 },
  credit: { paddingHorizontal: space.l, paddingTop: space.l, fontSize: 11, lineHeight: 15 },
  link: { fontSize: 11, lineHeight: 15, textDecorationLine: 'underline' },
});
