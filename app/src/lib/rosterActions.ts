import type { SheetAction } from '../components/Modal';
import { t } from '../i18n';
import { api } from './api';
import { dateTime, moneyShort } from './format';
import type { RosterRow } from './types';

/** Acciones sobre un ciclista de mi plantilla: vender al juego, cambiar la cláusula, blindarlo, poner o quitar de la venta */
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
      hint: t('actions.changeClauseHint', { from: moneyShort(clauseMin(r)), to: moneyShort(r.clause_base * 7) }),
      onPress: opts.onChangeClause,
    });
  }
  // blindarlo la semana que viene (una vez por semana)
  if (!r.locked_next) {
    out.push({ label: t('actions.lock', { amount: moneyShort(r.lock_cost) }), hint: t('actions.lockHint'),
               onPress: () => api.lockRider(r.ownership_id) });
  }
  out.push(r.for_sale
    ? { label: t('actions.unsell'), hint: t('actions.unsellHint'),
        onPress: () => api.setForSale(r.ownership_id, false) }
    : { label: t('actions.sell'),
        hint: t('actions.sellHint'),
        onPress: () => api.setForSale(r.ownership_id, true) });
  return out;
}

/** La cláusula va del 130 % al 700 % de su base (lo pagado o, si es mayor, el valor de mercado), de 1 en 1 % */
export const CLAUSE_MIN_PCT = 130;
export const CLAUSE_MAX_PCT = 700;

/** Porcentaje actual de la cláusula sobre su base, redondeado al 1 % */
export const clauseCurrentPct = (r: { clause: number; clause_base: number }) =>
  Math.min(CLAUSE_MAX_PCT, Math.max(CLAUSE_MIN_PCT, Math.round((r.clause / Math.max(1, r.clause_base)) * 100)));

/** Cláusula mínima: el 130 % de su base (lo pagado o, si es mayor, el valor de mercado), como en set_clause */
export const clauseMin = (r: { clause_base: number }) => Math.ceil(r.clause_base * 1.3);

/** Lo que cuesta (positivo) o devuelve (negativo) poner la cláusula en una cantidad: la mitad de la subida, un cuarto de la bajada */
export function clauseChange(clause: number, target: number): number {
  return target >= clause ? Math.ceil((target - clause) / 2) : -Math.floor((clause - target) / 4);
}
