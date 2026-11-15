import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLoader } from '../hooks/useLoader';
import { t } from '../i18n';
import { api } from '../lib/api';
import type { Category, ScoringScheme, ScoringSystem } from '../lib/types';
import { categoryName, colors, fonts, space } from '../theme';
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
  const groups = (data.data?.[scheme] ?? []).filter((g) => scheme === 'uci' || depth == null || !cat.get(g.grp)
    || cat.get(g.grp)!.depth_level <= depth);
  if (!data.data) return <Txt variant="small" style={{ padding: space.l }}>{t('common.loading')}</Txt>;
  return (
    <>
      {scheme !== 'uci' ? <Txt variant="small" style={{ padding: space.l, paddingBottom: 0 }}>{t('scoring.teamBonus')}</Txt> : null}
      {groups.map((g, i) => {
        const isOpen = open === g.grp;
        const rules = g.rules ?? {};
        // sin etapas (solo clásicas), la general no aplica (en la UCI repite la tabla de la clásica)
        const kinds = Object.entries(rules).filter(([k]) => !(k === 'gc' && !('stage' in rules)))
          .sort(([a], [b]) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));
        return (
          <Row key={g.grp} last={i === groups.length - 1}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="lead">{groupName(scheme, g.grp)}</Txt>
              {cat.get(g.grp) && scheme !== 'uci' ? (
                <Txt variant="small">{t('rules.maxEntries', { n: cat.get(g.grp)!.max_entries })}</Txt>
              ) : null}
              {kinds.map(([kind, pts]) => (
                <Txt key={kind} variant="small">
                  {kindLabel(kind)}: {pts.slice(0, 5).join(' · ')}
                  {pts.length > 5 ? ` … ${t('rules.upToPos', { n: pts.length })}` : ''}
                </Txt>
              ))}
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
  link: { fontFamily: fonts.bodyMedium, color: colors.ink, textDecorationLine: 'underline' },
});
