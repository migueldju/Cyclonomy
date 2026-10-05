import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api } from '../lib/api';
import { money, moneyShort } from '../lib/format';
import { CLAUSE_LEVELS, clauseChange, clauseLevel, clauseLevelValue } from '../lib/rosterActions';
import type { RosterRow } from '../lib/types';
import { colors, space } from '../theme';
import { Button } from './Button';
import { Sheet } from './Modal';
import { RangeSlider } from './RangeSlider';
import { ErrorText } from './Section';
import { Txt } from './Txt';

const pct = (level: number) => `${150 + 50 * level} %`;   // espacio que no se parte entre el número y el %

/**
 * Cambiar la cláusula de uno de mis ciclistas: 8 niveles del 150 % al 500 % de lo que pagó. La barra empieza
 * en el escalón actual; a la derecha se sube (pagando la mitad de la subida) y a la izquierda se baja
 * (recibiendo un cuarto de la bajada).
 */
export function ClauseSheet({ row, available, visible, onClose, onDone }: {
  row: RosterRow | null; available: number | null | undefined; visible: boolean; onClose: () => void; onDone?: () => void;
}) {
  const current = row ? clauseLevel(row.clause, row.price_paid) : 0;
  const [chosen, setChosen] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setChosen(current); setError(null); } }, [visible, current]);

  if (!row) return null;
  const target = clauseLevelValue(row.price_paid, chosen);
  const change = clauseChange(row.clause, row.price_paid, chosen);    // > 0 pago, < 0 me devuelven
  const same = target === row.clause;
  const after = available != null ? available - change : null;
  const short = change > 0 && after != null && after < 0;

  async function confirm() {
    if (!row || same) return;
    setBusy(true);
    setError(null);
    try {
      await api.setClause(row.ownership_id, chosen);
      onDone?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={`Cláusula de ${row.rider_name}`}>
      <View style={styles.headline}>
        <Txt variant="title" style={{ color: colors.inkSoft }}>{moneyShort(row.clause)}</Txt>
        <Txt variant="title" style={{ color: colors.inkSoft }}>→</Txt>
        <Txt variant="display">{moneyShort(target)}</Txt>
        <Txt variant="small">({pct(chosen)})</Txt>
      </View>
      <Txt style={{ marginBottom: space.m }}>
        {same ? 'Toca o arrastra la barra para subirla o bajarla.'
          : change > 0 ? <>Pagas <Txt variant="number">{money(change)}</Txt></>
          : <>Recibes <Txt variant="number" style={{ color: colors.green }}>{money(-change)}</Txt></>}
        {!same && after != null ? (
          <Txt variant="small" style={short ? { color: colors.red } : undefined}>{'  ·  '}saldo después: {money(after)}</Txt>
        ) : null}
      </Txt>

      <RangeSlider single steps={CLAUSE_LEVELS} low={0} high={chosen} label="Escalón de la cláusula"
                   onChange={(_, h) => setChosen(h)} />
      {/* un porcentaje bajo cada escalón */}
      <View style={styles.ticks}>
        {Array.from({ length: CLAUSE_LEVELS }, (_, level) => (
          <Txt key={level} variant="small"
               style={[styles.tick, level === chosen && { color: colors.ink }, level === current && styles.current]}>
            {pct(level)}
          </Txt>
        ))}
      </View>

      <ErrorText error={error} />
      <Button onPress={confirm} busy={busy} disabled={same || short} style={{ marginTop: space.l }}
              label={same ? 'Elige otro escalón' : change > 0
                ? `Subir a ${moneyShort(target)} · pagar ${money(change)}`
                : `Bajar a ${moneyShort(target)} · recibir ${money(-change)}`} />
      <Txt variant="small" style={{ marginTop: space.s }}>
        % de lo que pagaste ({moneyShort(row.price_paid)}). Subir cuesta la mitad de la subida; bajar te devuelve un
        cuarto de la bajada.
      </Txt>
      <Button label="Cancelar" kind="quiet" onPress={onClose} style={{ marginTop: space.s }} />
    </Sheet>
  );
}

const TICK_W = 40;

const styles = StyleSheet.create({
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: space.s, marginBottom: space.xs, flexWrap: 'wrap' },
  // un número centrado bajo cada escalón: los extremos de la barra están a 13 px (medio tirador) del borde
  ticks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2, marginHorizontal: 13 - TICK_W / 2 },
  tick: { width: TICK_W, textAlign: 'center', fontSize: 11 },
  current: { textDecorationLine: 'underline' },
});
