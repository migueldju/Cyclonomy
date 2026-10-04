import { router } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';
import { Bib } from '@/components/Bib';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Row, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { api } from '@/lib/api';
import { dateRange, ordinal, points, time, todayISO } from '@/lib/format';
import { inviteMessage } from '@/lib/invite';
import type { CalendarRow, TodayRow } from '@/lib/types';
import { categoryColor, colors, space } from '@/theme';

export default function Inicio() {
  const { leagueId, me } = useLeague();
  const id = leagueId ?? '';
  const today = useLoader(() => api.today(id), [id], !!leagueId);
  const calendar = useLoader(() => api.calendar(id), [id], !!leagueId);
  const offers = useLoader(() => api.offers(id), [id], !!leagueId);
  const reload = () => { today.reload(); calendar.reload(); offers.reload(); };

  const upcoming = (calendar.data ?? []).filter((r) => r.status === 'upcoming' && r.start_date >= todayISO()).slice(0, 5);
  const received = (offers.data ?? []).filter((o) => o.direction === 'received');

  return (
    <Screen onRefresh={reload} refreshing={today.loading}>
      {/* Mi puesto */}
      <View style={styles.hero}>
        <Bib value={me ? ordinal(me.position) : '—'} size="l" />
        <View style={{ flex: 1 }}>
          <Txt variant="small">de {me?.members ?? '—'} jugadores en {me?.league_name ?? 'la liga'}</Txt>
          <Txt variant="hero">{points(me?.points_total)}</Txt>
          <Txt variant="small">Esta semana: {points(me?.points_week)}</Txt>
        </View>
      </View>

      {me?.sanctioned_this_week ? (
        <Txt style={styles.warning}>
          Esta semana no puntúas: el lunes a las 00:00 tu saldo era negativo. Vende o deja de pujar para volver a positivo antes del próximo lunes.
        </Txt>
      ) : null}

      {me && me.members < 2 ? (
        <Section title="Invita a tus amigos">
          <View style={{ padding: space.l, gap: space.m }}>
            <Txt>Comparte el código <Txt variant="number">{me.invite_code}</Txt> o el enlace de la liga.</Txt>
            <Button kind="secondary" label="Compartir invitación"
                    onPress={() => Share.share({ message: inviteMessage(me.league_name, me.invite_code) })} />
          </View>
        </Section>
      ) : null}

      {received.length ? (
        <Section>
          <Row onPress={() => router.navigate('/plantilla')} last>
            <Txt style={{ flex: 1 }}>
              Tienes {received.length} {received.length === 1 ? 'oferta' : 'ofertas'} por tus ciclistas
            </Txt>
            <Txt variant="label">Ver</Txt>
          </Row>
        </Section>
      ) : null}

      <Section title="Hoy en carrera">
        {today.data?.length ? today.data.map((s, i) => (
          <StageRow key={s.stage_id} s={s} last={i === today.data!.length - 1} />
        )) : <Empty text={today.loading ? 'Cargando…' : 'Hoy no hay carreras de tu calendario.'} />}
      </Section>
      <ErrorText error={today.error} />

      <Section title="Próximas carreras"
               action={<Button small kind="quiet" label="Calendario" onPress={() => router.navigate('/calendario')} />}>
        {upcoming.length ? upcoming.map((r, i) => (
          <RaceRow key={r.race_id} r={r} last={i === upcoming.length - 1} />
        )) : <Empty text={calendar.loading ? 'Cargando…' : 'No hay carreras próximas en tu calendario.'} />}
      </Section>
      <ErrorText error={calendar.error} />

      <View style={{ padding: space.l }}>
        <Button kind="secondary" label="Normativa de la liga" onPress={() => router.push('/normativa')} />
      </View>
    </Screen>
  );
}

function StageRow({ s, last }: { s: TodayRow; last: boolean }) {
  const label = s.status === 'scored' ? `${points(s.my_points)} para ti`
    : s.status === 'finished' ? 'Llegada: calculando puntos'
    : s.start_at ? `Salida ${time(s.start_at)} · llegada hacia las ${time(s.est_finish_at)}` : 'Horario por confirmar';
  return (
    <Row last={last}>
      <View style={[styles.swatch, { backgroundColor: categoryColor[s.category] ?? colors.line }]} />
      <View style={{ flex: 1 }}>
        <Txt variant="lead" numberOfLines={1}>{s.race_name}</Txt>
        <Txt variant="small">{s.number === 0 ? 'Prólogo' : `Etapa ${s.number}`} · {label}</Txt>
      </View>
      <Button small kind="secondary" label="Puntuaciones" onPress={() => router.push(`/etapa/${s.stage_id}`)} />
    </Row>
  );
}

function RaceRow({ r, last }: { r: CalendarRow; last: boolean }) {
  return (
    <Row last={last}>
      <View style={[styles.swatch, { backgroundColor: categoryColor[r.category] ?? colors.line }]} />
      <View style={{ flex: 1 }}>
        <Txt variant="lead" numberOfLines={1}>{r.name}</Txt>
        <Txt variant="small">
          {dateRange(r.start_date, r.end_date)} · {r.my_entry_count ? `${r.my_entry_count}/${r.max_entries} inscritos` : 'sin inscripción'}
        </Txt>
      </View>
      <Button small label="Inscribir" onPress={() => router.push(`/carrera/${r.race_id}`)} />
    </Row>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.l, padding: space.l, paddingTop: space.xl },
  warning: { color: colors.red, paddingHorizontal: space.l },
  swatch: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
});
