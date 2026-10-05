import type { SheetAction } from '../components/Modal';
import { api } from './api';
import { dateTime, money, moneyShort } from './format';
import type { RosterRow } from './types';

/** Acciones sobre un ciclista de mi plantilla: vender al juego, subir la cláusula, poner o quitar de la venta */
export function actionsFor(r: RosterRow): SheetAction[] {
  if (!r.transferable) return [];               // le llega o se va el lunes: no se puede tocar
  const out: SheetAction[] = [];
  if (r.game_offer_id && r.game_offer_amount) {
    out.push({
      label: `Vender al juego por ${moneyShort(r.game_offer_amount)}`, kind: 'primary',
      hint: `La oferta caduca ${dateTime(r.game_offer_expires)}. El ciclista queda libre al momento.`,
      onPress: () => api.acceptGameOffer(r.game_offer_id!),
    });
  }
  if (r.next_clause > r.clause) {
    out.push({
      label: `Subir la cláusula a ${moneyShort(r.next_clause)}`,
      hint: `Cuesta ${money(r.next_clause_cost)}. Tope: el 300 % de lo que pagaste (${money(r.price_paid * 3)}).`,
      onPress: () => api.raiseClause(r.ownership_id),
    });
  }
  out.push(r.for_sale
    ? { label: 'Quitar de la venta', onPress: () => api.setForSale(r.ownership_id, false) }
    : { label: 'Poner a la venta', hint: 'En la próxima actualización del mercado el juego te ofrecerá su valor ±10 %.',
        onPress: () => api.setForSale(r.ownership_id, true) });
  return out;
}
