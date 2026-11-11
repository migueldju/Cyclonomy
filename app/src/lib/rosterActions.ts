import type { SheetAction } from '../components/Modal';
import { t } from '../i18n';
import { api } from './api';
import { dateTime, money, moneyShort } from './format';
import type { RosterRow } from './types';

/** Acciones sobre un ciclista de mi plantilla: vender al juego, cambiar la cláusula, blindarlo, poner o quitar de la venta */
export function actionsFor(r: RosterRow, opts: { onChangeClause?: () => void; onLock?: () => void } = {}): SheetAction[] {
  if (!r.transferable) return [];               // le llega o se va el lunes: no se puede tocar
  const out: SheetAction[] = [];
  if (r.game_offer_id && r.game_offer_amount) {
    out.push({
      icon: 'cash-outline', kind: 'primary', label: t('actions.sellToGameShort'),
      detail: t('actions.sellToGameDetail', { amount: moneyShort(r.game_offer_amount), when: dateTime(r.game_offer_expires) }),
      onPress: () => api.acceptGameOffer(r.game_offer_id!),
      done: t('toast.soldToGame', { name: r.rider_name, amount: money(r.game_offer_amount) }),
    });
  }
  if (opts.onChangeClause) {
    out.push({ icon: 'options-outline', label: t('actions.changeClause'),
               detail: t('actions.changeClauseDetail', { amount: moneyShort(r.clause) }), onPress: opts.onChangeClause });
  }
  // blindarlo la semana que viene (una vez por semana)
  if (!r.locked_next) {
    out.push({ icon: 'lock-closed-outline', label: t('actions.lockShort'),
               detail: t('actions.lockDetail', { amount: moneyShort(r.lock_cost) }),
               // con confirmación (qué semana y qué protege) si la pantalla la ofrece
               onPress: opts.onLock ?? (() => api.lockRider(r.ownership_id)),
               done: opts.onLock ? undefined : t('toast.locked', { name: r.rider_name }) });
  }
  out.push(r.for_sale
    ? { icon: 'close-circle-outline', label: t('actions.unsell'), detail: t('actions.unsellDetail'),
        onPress: () => api.setForSale(r.ownership_id, false), done: t('toast.unsold', { name: r.rider_name }) }
    : { icon: 'pricetag-outline', label: t('actions.sell'), detail: t('actions.sellDetail'),
        onPress: () => api.setForSale(r.ownership_id, true), done: t('toast.forSale', { name: r.rider_name }) });
  return out;
}

/** La cláusula va del 130 % al 700 % de su base (lo pagado o, si es mayor, el valor de mercado), de 1 en 1 % */
export const CLAUSE_MIN_PCT = 130;
export const CLAUSE_MAX_PCT = 700;

/** Porcentaje actual de la cláusula sobre su base, redondeado al 1 % */
export const clauseCurrentPct = (r: { clause: number; clause_base: number }) =>
  Math.min(CLAUSE_MAX_PCT, Math.max(CLAUSE_MIN_PCT, Math.round((r.clause / Math.max(1, r.clause_base)) * 100)));

/** Lo que cuesta (positivo) o devuelve (negativo) poner la cláusula en una cantidad: la mitad de la subida, un cuarto de la bajada */
export function clauseChange(clause: number, target: number): number {
  return target >= clause ? Math.ceil((target - clause) / 2) : -Math.floor((clause - target) / 4);
}
