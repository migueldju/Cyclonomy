import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLoader } from '../hooks/useLoader';
import { t } from '../i18n';
import { api } from '../lib/api';
import type { Category, ScoringScheme, ScoringSystem } from '../lib/types';
import { categoryLabel, categoryName, colors, fonts, space } from '../theme';
import { Button } from './Button';
import { Sheet } from './Modal';
import { Row } from './Section';
import { Txt } from './Txt';

/** Sistema de una liga: 'cyc' (Cyclonomy, WT en A y B), 'cyc_wt' (Cyclonomy, WT junto) o 'uci' */
export const schemeOf = (system: ScoringSystem, wtSplit: boolean): ScoringScheme =>
  system === 'uci' ? 'uci' : wtSplit ? 'cyc' : 'cyc_wt';

export const schemeLabel = (system: ScoringSystem, wtSplit: boolean) =>
  system === 'uci' ? t('scoring.uci') : `${t('scoring.cyclonomy')} · ${wtSplit ? t('scoring.splitShort') : t('scoring.joinedShort')}`;

// grupos del baremo UCI: los que coinciden con una categoría del juego llevan su nombre
const UCI_AS_CATEGORY: Record<string, string> = {
  'GT.A': 'TDF', 'GT.B': 'GT', Monument: 'MON', WO: 'WC', 'WO.TT': 'WC_ITT', CC: 'CC', 'CC.TT': 'CC_ITT', NC: 'NC',
  'NC.TT': 'NC_ITT', Pro: 'PRO', 1: 'C1',
};
const groupName = (scheme: ScoringScheme, grp: string) => scheme !== 'uci' ? categoryName(grp)
  : grp === 'C1' ? 'WorldTour 1' : grp === 'C2' ? 'WorldTour 2' : categoryName(UCI_AS_CATEGORY[grp] ?? grp);

/** Nombre corto del tipo de carrera para la esquina de la tabla: TDF, GV, 1.MWT / 2.MWT, 1.Pro / 2.Pro… */
const groupShort = (scheme: ScoringScheme, grp: string, stageRace: boolean) => scheme !== 'uci' ? categoryLabel(grp, stageRace)
  : grp === 'C1' || grp === 'C2' ? `${stageRace ? 2 : 1}.WT${grp.slice(1)}` : categoryLabel(UCI_AS_CATEGORY[grp] ?? grp, stageRace);

const KIND_ORDER = ['oneday', 'gc', 'stage', 'leader', 'points_jersey', 'kom_jersey', 'points_final', 'kom_final'];
const kindLabel = (k: string) => {
  const key = `scoring.${k}` as 'scoring.oneday';
  const s = t(key);
  return s === key ? k : s;
};

/**
 * Tablas de un sistema: por cada grupo (categoría), sus carreras de la temporada (desplegable) y los puntos de cada
 * tipo de resultado. Con `cats` y `depth`, solo las categorías que entran en la liga y su máximo de inscritos.
 * Con `races={false}` no se listan las carreras (en la normativa de la liga).
 */
export function ScoringGroups({ scheme, cats, depth, races = true }: {
  scheme: ScoringScheme; cats?: Category[]; depth?: number; races?: boolean;
}) {
  const data = useLoader(() => api.scoringSystems());
  const [open, setOpen] = useState<string | null>(null);
  const cat = new Map((cats ?? []).map((c) => [c.code, c]));
  const visible = (data.data?.[scheme] ?? []).filter((g) => scheme === 'uci' || depth == null || !cat.get(g.grp)
    || cat.get(g.grp)!.depth_level <= depth);
  // el Mundial CRI se muestra dentro del Mundial, como una tabla más del mismo nivel
  const [worlds, worldsTT] = scheme === 'uci' ? ['WO', 'WO.TT'] : ['WC', 'WC_ITT'];
  const tt = visible.some((g) => g.grp === worlds) ? visible.find((g) => g.grp === worldsTT) : undefined;
  const groups = tt ? visible.filter((g) => g !== tt) : visible;
  if (!data.data) return <Txt variant="small" style={{ padding: space.l }}>{t('common.loading')}</Txt>;
  return (
    <>
      {scheme !== 'uci' ? <Txt variant="small" style={{ padding: space.l, paddingBottom: 0 }}>{t('scoring.teamBonus')}</Txt> : null}
      {groups.map((g, i) => {
        const isOpen = open === g.grp;
        const kinds = kindsOf(g);
        return (
          <Row key={g.grp} last={i === groups.length - 1}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="lead">{groupName(scheme, g.grp)}</Txt>
              {cat.get(g.grp) && scheme !== 'uci' ? (
                <Txt variant="small">{t('rules.maxEntries', { n: cat.get(g.grp)!.max_entries })}</Txt>
              ) : null}
              {/* clásicas y vueltas por etapas, cada una en su tabla aunque compartan categoría */}
              {kinds.some(([k]) => k === 'oneday') ? (
                <PointsTable kinds={kinds.filter(([k]) => k === 'oneday')} corner={groupShort(scheme, g.grp, false)} />
              ) : null}
              {kinds.some(([k]) => k !== 'oneday') ? (
                <PointsTable kinds={kinds.filter(([k]) => k !== 'oneday')} corner={groupShort(scheme, g.grp, true)} />
              ) : null}
              {tt && g.grp === worlds ? (
                <PointsTable kinds={kindsOf(tt).filter(([k]) => k === 'oneday')} corner={groupShort(scheme, tt.grp, false)} />
              ) : null}
              {races && g.races.length ? (
                <Pressable onPress={() => setOpen(isOpen ? null : g.grp)} accessibilityRole="button"
                           accessibilityState={{ expanded: isOpen }}>
                  <Txt variant="small" style={styles.link}>
                    {t('scoring.races', { n: g.races.length })} {isOpen ? '▴' : '▾'}
                  </Txt>
                </Pressable>
              ) : null}
              {isOpen ? <Txt variant="small">{g.races.join(' · ')}</Txt> : null}
            </View>
          </Row>
        );
      })}
    </>
  );
}

const ONLY_STAGES = ['TDF', 'GT', 'GT.A', 'GT.B'];        // grandes vueltas: nunca son clásicas

/** Tipos de resultado de un grupo que tiene sentido mostrar, en orden */
function kindsOf(g: { grp: string; rules?: Record<string, number[]> | null }): [string, number[]][] {
  const rules = g.rules ?? {};
  return Object.entries(rules)
    // sin etapas (solo clásicas), la general no aplica (en la UCI repite la tabla de la clásica)
    .filter(([k]) => !(k === 'gc' && !('stage' in rules)))
    // el baremo UCI trae tabla de clásica también para Tour, Giro y Vuelta: no aplica
    .filter(([k]) => !(k === 'oneday' && ONLY_STAGES.includes(g.grp)))
    .sort(([a], [b]) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));
}

const PER_DAY = ['leader', 'points_jersey', 'kom_jersey'];        // un solo valor, por día: fuera de la tabla
const LABEL_W = 122;
const CELL_W = 42;

/**
 * Puntos de un grupo en tabla: una fila por tipo de resultado y una columna por puesto (se desliza a los lados; la
 * columna de nombres queda fija). Los premios por día (líder, maillots) van debajo, en pastillas.
 */
export function PointsTable({ kinds, corner = '#' }: { kinds: [string, number[]][]; corner?: string }) {
  const rows = kinds.filter(([k]) => !PER_DAY.includes(k));
  const daily = kinds.filter(([k]) => PER_DAY.includes(k));
  const cols = Math.max(0, ...rows.map(([, pts]) => pts.length));
  return (
    <View style={{ gap: space.s, marginTop: space.xs }}>
      {rows.length ? (
        <View style={styles.table}>
          <View style={{ width: LABEL_W }}>
            <View style={[styles.cell, styles.head]}><Txt numberOfLines={1} style={[styles.headText, { color: colors.ink }]}>{corner}</Txt></View>
            {rows.map(([kind], i) => (
              <View key={kind} style={[styles.cell, i % 2 === 1 && styles.zebra]}>
                <Txt variant="small" numberOfLines={1} style={styles.rowLabel}>{kindLabel(kind)}</Txt>
              </View>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View>
              <View style={[styles.row, styles.head]}>
                {Array.from({ length: cols }, (_, n) => (
                  <View key={n} style={styles.num}><Txt style={styles.headText}>{n + 1}</Txt></View>
                ))}
              </View>
              {rows.map(([kind, pts], i) => (
                <View key={kind} style={[styles.row, i % 2 === 1 && styles.zebra]}>
                  {Array.from({ length: cols }, (_, n) => (
                    <View key={n} style={styles.num}>
                      <Txt style={[styles.numText, n === 0 && { fontFamily: fonts.bodyBold }]}>{pts[n] ?? ''}</Txt>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}
      {daily.length ? (
        <View style={styles.daily}>
          {daily.map(([kind, pts]) => (
            <View key={kind} style={styles.dailyChip}>
              <Txt variant="small" style={{ flexShrink: 1 }}>{kindLabel(kind)}</Txt>
              <Txt style={styles.dailyPts}>{pts[0]}</Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Elección del sistema de puntuación al crear la liga: Cyclonomy (con o sin el WT dividido) o UCI */
export function ScoringSystemPicker({ system, wtSplit, onChange }: {
  system: ScoringSystem; wtSplit: boolean; onChange: (system: ScoringSystem, wtSplit: boolean) => void;
}) {
  const [how, setHow] = useState<ScoringScheme | null>(null);
  // el texto de cada sistema queda para los lectores de pantalla; a la vista, el nombre y el botón de «cómo puntúa»
  const option = (value: ScoringSystem, title: string, hint: string) => {
    const on = system === value;
    return (
      <Pressable onPress={() => onChange(value, wtSplit)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                 accessibilityLabel={title} accessibilityHint={hint} style={[styles.card, on && styles.cardOn]}>
        <Txt numberOfLines={1} adjustsFontSizeToFit style={styles.cardTitle}>{title}</Txt>
        <Pressable onPress={() => setHow(value === 'uci' ? 'uci' : schemeOf('cyclonomy', wtSplit))} hitSlop={8}
                   accessibilityRole="button" accessibilityLabel={`${t('scoring.how')}: ${title}`} style={styles.how}>
          <Ionicons name="information-circle-outline" size={20} color={colors.ink} />
        </Pressable>
      </Pressable>
    );
  };
  return (
    <View style={{ marginBottom: space.l }}>
      <Txt variant="label" style={{ marginBottom: space.xs }}>{t('scoring.title')}</Txt>
      <View style={{ flexDirection: 'row', gap: space.s }}>
        {option('cyclonomy', t('scoring.cyclonomy'), t('scoring.cyclonomyHint'))}
        {option('uci', t('scoring.uci'), t('scoring.uciHint'))}
      </View>

      <Sheet visible={how != null} onClose={() => setHow(null)}
             title={how === 'uci' ? t('scoring.uci') : t('scoring.cyclonomy')}>
        <ScrollView style={{ maxHeight: 480 }}>
          {how ? <ScoringGroups scheme={how} /> : null}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s, borderWidth: 1.5, borderColor: colors.line,
    borderRadius: 16, backgroundColor: colors.paper, paddingLeft: space.m, paddingRight: space.s, paddingVertical: space.s,
  },
  // la elegida se distingue por el fondo amarillo y el borde: sin círculo, el nombre cabe entero
  cardTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  how: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.road, alignItems: 'center', justifyContent: 'center' },
  cardOn: { borderColor: colors.asphalt, backgroundColor: '#FFF7D1' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.line },
  radioOn: { borderColor: colors.asphalt, borderWidth: 6 },
  table: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', height: 30 },
  cell: { height: 30, justifyContent: 'center', paddingHorizontal: space.s, borderRightWidth: 1, borderRightColor: colors.line },
  head: { backgroundColor: colors.road },
  zebra: { backgroundColor: '#F7F9F8' },
  headText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft, textAlign: 'center' },
  rowLabel: { fontFamily: fonts.bodyMedium, color: colors.ink },
  num: { width: CELL_W, height: 30, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  daily: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  dailyChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', backgroundColor: colors.road, borderRadius: 999,
    paddingLeft: 10, paddingRight: 4, paddingVertical: 3,
  },
  dailyPts: {
    fontFamily: fonts.bodyBold, fontSize: 12, color: colors.jerseyInk, backgroundColor: colors.jersey, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
  },
  link: { fontFamily: fonts.bodyMedium, color: colors.ink, textDecorationLine: 'underline' },
});
