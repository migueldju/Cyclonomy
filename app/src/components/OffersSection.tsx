import { useState } from 'react';
import { View } from 'react-native';
import { useLeague } from '../context/LeagueContext';
import { useLoader } from '../hooks/useLoader';
import { t } from '../i18n';
import { api } from '../lib/api';
import { dateTime, money } from '../lib/format';
import type { OfferRow } from '../lib/types';
import { space } from '../theme';
import { Button } from './Button';
import { ErrorText, Row, Section } from './Section';
import { Txt } from './Txt';

/** Ofertas entre jugadores: las recibidas (aceptar o rechazar) y las enviadas (retirar). Solo aparece si hay alguna. */
export function OffersSection() {
  const { leagueId, refresh } = useLeague();
  const id = leagueId ?? '';
  const offers = useLoader(() => api.offers(id), [id], !!leagueId);   // se recarga con cada refresh() de la liga
  const [error, setError] = useState<string | null>(null);

  async function respond(o: OfferRow, accept: boolean) {
    setError(null);
    try {
      if (o.direction === 'received') await api.respondOffer(o.offer_id, accept);
      else await api.cancelOffer(o.offer_id);
      offers.reload(); refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!offers.data?.length) return <ErrorText error={error ?? offers.error} />;
  return (
    <>
      <Section title={t('squad.offers')}>
        {offers.data.map((o, i) => (
          <Row key={o.offer_id} last={i === offers.data!.length - 1}>
            <View style={{ flex: 1 }}>
              <Txt variant="lead">{o.rider_name}</Txt>
              <Txt variant="small">
                {o.direction === 'received' ? t('squad.offerReceived', { team: o.other_team, amount: money(o.amount) })
                  : t('squad.offerSent', { team: o.other_team, amount: money(o.amount) })}
                {' · '}{t('squad.expires', { when: dateTime(o.expires_at) })}
              </Txt>
            </View>
            {o.direction === 'received' ? (
              <View style={{ gap: space.xs }}>
                <Button small label={t('squad.accept')} onPress={() => respond(o, true)} />
                <Button small kind="quiet" label={t('squad.reject')} onPress={() => respond(o, false)} />
              </View>
            ) : <Button small kind="secondary" label={t('squad.withdraw')} onPress={() => respond(o, false)} />}
          </Row>
        ))}
      </Section>
      <ErrorText error={error} />
    </>
  );
}
