import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { t } from '../i18n';
import { api } from '../lib/api';
import { money, moneyShort } from '../lib/format';
import { CLAUSE_MAX_PCT, CLAUSE_MIN_PCT, clauseChange, clauseCurrentPct } from '../lib/rosterActions';
import type { RosterRow } from '../lib/types';
import { colors, fonts, space, type } from '../theme';
import { Button } from './Button';
import { StatTile, StatTiles } from './Hero';
import { InfoButton } from './Info';
import { showToast } from './Toast';
import { Sheet } from './Modal';
import { RangeSlider } from './RangeSlider';
import { ErrorText } from './Section';
import { Txt } from './Txt';

const STEPS = CLAUSE_MAX_PCT - CLAUSE_MIN_PCT + 1;      // de 1 en 1 %: 130 %, 131 % … 700 %

/**
 * Cambiar la cláusula de uno de mis ciclistas: una barra del 130 % al 700 % de su base (lo que pagó o, si es
 * mayor, su valor de mercado), de 1 en 1 %, con − y + para afinar. Subir cuesta la mitad de lo que sube; bajar
 * devuelve un cuarto.
 */
export function ClauseSheet({ row, available, visible, onClose, onDone }: {
  row: RosterRow | null; available: number | null | undefined; visible: boolean; onClose: () => void; onDone?: () => void;
}) {
  const current = row ? clauseCurrentPct(row) : CLAUSE_MIN_PCT;
  const [pct, setPct] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setPct(current); setError(null); } }, [visible, current]);

  if (!row) return null;
  const target = Math.round((row.clause_base * pct) / 100);
  const same = pct === current;
  const change = same ? 0 : clauseChange(row.clause, target);     // > 0 pago, < 0 me devuelven
  const after = available != null ? available - change : null;
  const short = change > 0 && after != null && after < 0;
  const move = (d: number) => setPct((p) => Math.min(CLAUSE_MAX_PCT, Math.max(CLAUSE_MIN_PCT, p + d)));

  async function confirm() {
    if (!row || same) return;
    setBusy(true);
    setError(null);
    try {
      await api.setClause(row.ownership_id, target);
      showToast(t('toast.clause', { name: row.rider_name, amount: money(target) }));
      onDone?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('clause.title', { name: row.rider_name })}>
      <View style={styles.headline}>
        <Txt variant="title" style={{ color: colors.inkSoft }}>{moneyShort(row.clause)}</Txt>
        <Ionicons name="arrow-forward" size={20} color={colors.inkSoft} />
        <Txt variant="display">{moneyShort(target)}</Txt>
        <View style={styles.pct}><Txt style={styles.pctText}>{pct}{' '}%</Txt></View>
      </View>
      {same ? null : (
        <StatTiles style={{ marginBottom: space.m }}>
          <StatTile label={change > 0 ? t('clause.pay') : t('clause.receive')} value={money(Math.abs(change))}
                    icon={change > 0 ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                    color={change > 0 ? undefined : colors.green} />
          {after != null ? (
            <StatTile label={t('squad.balance')} value={money(after)} icon="wallet-outline"
                      color={short ? colors.red : undefined} />
          ) : null}
        </StatTiles>
      )}

      <View style={styles.sliderRow}>
        <Pressable onPress={() => move(-1)} style={styles.step} accessibilityRole="button" accessibilityLabel="−1 %">
          <Txt variant="lead">−</Txt>
        </Pressable>
        <View style={{ flex: 1 }}>
          <RangeSlider single steps={STEPS} low={0} high={pct - CLAUSE_MIN_PCT} label={t('clause.level')}
                       onChange={(_, h) => setPct(CLAUSE_MIN_PCT + h)} />
        </View>
        <Pressable onPress={() => move(1)} style={styles.step} accessibilityRole="button" accessibilityLabel="+1 %">
          <Txt variant="lead">+</Txt>
        </Pressable>
      </View>
      <View style={styles.ends}>
        <Txt variant="small">{CLAUSE_MIN_PCT}{' '}%</Txt>
        <Txt variant="small">{CLAUSE_MAX_PCT}{' '}%</Txt>
      </View>

      <ErrorText error={error} />
      <Button onPress={confirm} busy={busy} disabled={same || short} style={{ marginTop: space.l }}
              label={same ? t('clause.chooseOther') : change > 0
                ? t('clause.raiseTo', { clause: moneyShort(target), amount: money(change) })
                : t('clause.lowerTo', { clause: moneyShort(target), amount: money(-change) })} />
      <View style={styles.foot}>
        <InfoButton title={t('clause.title', { name: row.rider_name })}
                    items={[t('clause.rule', { base: moneyShort(row.clause_base) }), t('clause.hint')]} />
        <Button label={t('common.cancel')} kind="quiet" onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  headline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s, flexWrap: 'wrap',
    backgroundColor: colors.road, borderRadius: 18, paddingVertical: space.m, paddingHorizontal: space.l, marginBottom: space.m,
  },
  pct: { backgroundColor: colors.jersey, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pctText: { fontFamily: fonts.bodyBold, fontSize: type.small, color: colors.jerseyInk },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.m },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  step: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.road,
  },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 44 },
});
