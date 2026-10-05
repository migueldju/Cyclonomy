import type { SheetAction } from '../components/Modal';
import { t } from '../i18n';
import { api } from './api';
import { dateTime, moneyShort } from './format';
import type { RosterRow } from './types';

/** Acciones sobre un ciclista de mi plantilla: vender al juego, subir la cláusula, poner o quitar de la venta */
export function actionsFor(r: RosterRow, opts: { onChangeClause?: () => void } = {}): SheetAction[] {
  if (!r.transferable) return [];               // le llega o se va el lunes: no se puede tocar
  const out: SheetAction[] = [];
  if (r.game_offer_id && r.game_offer_amount) {
    out.push({
      label: t('actions.sellToGame', { amount: moneyShort(r.game_offer_amount) }), kind: 'primary',
      hint: t('actions.sellToGameHint', { when: dateTime(r.game_offer_expires) }),
      onPress: () => api.acceptGameOffer(r.game_offer_id!),
    });
  }
  if (opts.onChangeClause) {
    out.push({
      label: t('actions.changeClause'),
      hint: t('actions.changeClauseHint', { from: moneyShort(clauseLevelValue(r.price_paid, 0)),
                                            to: moneyShort(clauseLevelValue(r.price_paid, CLAUSE_LEVELS - 1)) }),
      onPress: opts.onChangeClause,
    });
  }
  out.push(r.for_sale
    ? { label: t('actions.unsell'), hint: t('actions.unsellHint'),
        onPress: () => api.setForSale(r.ownership_id, false) }
    : { label: t('actions.sell'),
        hint: t('actions.sellHint'),
        onPress: () => api.setForSale(r.ownership_id, true) });
  return out;
}

/**
 * Escalones de la cláusula (las mismas cuentas que set_clause en la base de datos): del 150 % al 500 % de lo que
 * pagaste, de 50 en 50 puntos (niveles 0 a 7). Subir cuesta la mitad de lo que sube; bajar devuelve un cuarto.
 */
export const CLAUSE_LEVELS = 8;

export function clauseLevelValue(pricePaid: number, level: number): number {
  return Math.round(pricePaid * (1.5 + 0.5 * level));
}

/** Nivel más cercano a la cláusula actual */
export function clauseLevel(clause: number, pricePaid: number): number {
  if (!pricePaid) return 0;
  return Math.min(CLAUSE_LEVELS - 1, Math.max(0, Math.round((clause / pricePaid - 1.5) / 0.5)));
}

/** Lo que cuesta (positivo) o devuelve (negativo) pasar de la cláusula actual a un nivel */
export function clauseChange(clause: number, pricePaid: number, level: number): number {
  const target = clauseLevelValue(pricePaid, level);
  return target >= clause ? Math.ceil((target - clause) / 2) : -Math.floor((clause - target) / 4);
}
