import { router } from 'expo-router';
import { View } from 'react-native';
import { t } from '../i18n';
import { dateTime, money } from '../lib/format';
import type { LeagueMove } from '../lib/types';
import { fonts } from '../theme';
import { RiderAvatar } from './RiderAvatar';
import { Row } from './Section';
import { Txt } from './Txt';

/** Frase del movimiento, en una línea: quién fichó, compró, pagó la cláusula o vendió. */
export function moveText(m: LeagueMove): string {
  const p = { buyer: m.buyer_team ?? '—', seller: m.seller_team ?? '—', rider: shortName(m.rider_name) };
  switch (m.kind) {
    case 'signing': return t('moves.signing', p);
    case 'purchase': return t('moves.purchase', p);
    case 'clause': return t('moves.clause', p);
    case 'offer': return t('moves.offer', p);
    default: return t('moves.saleGame', p);
  }
}

/** Nombre corto del ciclista para que la frase quepa en una línea: sin el primer nombre (Tadej Pogačar → Pogačar) */
function shortName(name: string): string {
  const i = name.indexOf(' ');
  return i > 0 ? name.slice(i + 1) : name;
}

export function MoveRow({ m, last, myId }: { m: LeagueMove; last?: boolean; myId?: string | null }) {
  const mine = !!myId && (m.buyer_id === myId || m.seller_id === myId);
  return (
    <Row last={last} onPress={() => router.push(`/ciclista/${m.rider_id}`)}>
      <RiderAvatar name={m.rider_name} team={m.pro_team} size={36} />
      <View style={{ flex: 1 }}>
        <Txt numberOfLines={1} style={mine ? { fontFamily: fonts.bodyBold } : undefined}>{moveText(m)}</Txt>
        {/* el dueño anterior (clausulazos y compras a otro jugador), a la derecha de la hora */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>
            {dateTime(m.created_at)}{m.kind !== 'sale_game' && m.seller_team ? ` · ${t('market.from', { team: m.seller_team })}` : ''}
          </Txt>
          <Txt variant="number">{money(m.amount)}</Txt>
        </View>
      </View>
    </Row>
  );
}
