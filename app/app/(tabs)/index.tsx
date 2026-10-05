import { router } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';
import { Bib } from '@/components/Bib';
import { Button } from '@/components/Button';
import { Flag } from '@/components/Flag';
import { RiderAvatar } from '@/components/RiderAvatar';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Row, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { dateRange, moneyShort, ordinal, points, time, todayISO } from '@/lib/format';
import { inviteMessage } from '@/lib/invite';
import type { CalendarRow, TodayRow } from '@/lib/types';
import { categoryColor, categoryLabel, colors, space } from '@/theme';

export default function Inicio() {
  const { leagueId, me } = useLeague();
  const id = leagueId ?? '';
  const today = useLoader(() => api.today(id), [id], !!leagueId);
  const calendar = useLoader(() => api.calendar(id), [id], !!leagueId);
  const offers = useLoader(() => api.offers(id), [id], !!leagueId);
  const top = useLoader(() => api.ranking(id, 3), [id], !!leagueId);
  const reload = () => { today.reload(); calendar.reload(); offers.reload(); top.reload(); };

  const upcoming = (calendar.data ?? []).filter((r) => r.status === 'upcoming' && r.start_date >= todayISO()).slice(0, 5);
  const received = (offers.data ?? []).filter((o) => o.direction === 'received');

  return (
    <Screen onRefresh={reload} refreshing={today.loading}>
      {/* Mi puesto */}
      <View style={styles.hero}>
        <Bib value={me ? ordinal(me.position) : '—'} size="l" />
        <View style={{ flex: 1 }}>
          <Txt variant="small">{t('home.of', { n: me?.members ?? '—', league: me?.league_name ?? '' })}</Txt>
          <Txt variant="hero">{points(me?.points_total)}</Txt>
          <Txt variant="small">{t('home.thisWeek', { points: points(me?.points_week) })}</Txt>
        </View>
        <Button small kind="secondary" label={t('home.rules')} onPress={() => router.push('/normativa')} />
      </View>

      {me?.sanctioned_this_week ? (
        <Txt style={styles.warning}>
          {t('home.sanctioned')}
        </Txt>
      ) : null}

      {me && me.members < 2 ? (
        <Section title={t('home.invite')}>
          <View style={{ padding: space.l, gap: space.m }}>
            <Txt>{t('home.shareCodeA')} <Txt variant="number">{me.invite_code}</Txt> {t('home.shareCodeB')}</Txt>
            <Button kind="secondary" label={t('home.shareInvite')}
                    onPress={() => Share.share({ message: inviteMessage(me.league_name, me.invite_code) })} />
          </View>
        </Section>
      ) : null}

      <Section title={t('home.topRiders')}
               action={<Button small kind="quiet" label={t('ranking.title')} onPress={() => router.push('/ranking')} />}>
        {top.data?.length ? top.data.map((r, i) => (
          <Row key={r.rider_id} onPress={() => router.push(`/ciclista/${r.rider_id}`)} last={i === top.data!.length - 1}>
            <Txt variant="number" style={{ width: 20, color: colors.inkSoft }}>{i + 1}</Txt>
            <RiderAvatar url={r.photo_url} name={r.name} team={r.pro_team} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                <Txt variant="lead" numberOfLines={1} style={{ flexShrink: 1 }}>{r.name}</Txt>
                <Flag code={r.nationality} />
              </View>
              <Txt variant="small" numberOfLines={1}>
                {r.pro_team ?? t('rider.noTeam')} · {r.is_mine ? t('rider.yours') : r.owner_team ?? t('rider.free')}
              </Txt>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Txt variant="number">{points(r.season_points)}</Txt>
              <Txt variant="small">{moneyShort(r.market_value)}</Txt>
            </View>
          </Row>
        )) : <Empty text={top.loading ? t('common.loading') : t('home.noRiders')} />}
      </Section>
      <ErrorText error={top.error} />

      {received.length ? (
        <Section>
          <Row onPress={() => router.navigate('/plantilla')} last>
            <Txt style={{ flex: 1 }}>
              {t(received.length === 1 ? 'home.offers.one' : 'home.offers.other', { n: received.length })}
            </Txt>
            <Txt variant="label">{t('common.see')}</Txt>
          </Row>
        </Section>
      ) : null}

      <Section title={t('home.today')}>
        {today.data?.length ? today.data.map((s, i) => (
          <StageRow key={s.stage_id} s={s} last={i === today.data!.length - 1} />
        )) : <Empty text={today.loading ? t('common.loading') : t('home.noToday')} />}
      </Section>
      <ErrorText error={today.error} />

      <Section title={t('home.upcoming')}
               action={<Button small kind="quiet" label={t('tabs.calendar')} onPress={() => router.navigate('/calendario')} />}>
        {upcoming.length ? upcoming.map((r, i) => (
          <RaceRow key={r.race_id} r={r} last={i === upcoming.length - 1} />
        )) : <Empty text={calendar.loading ? t('common.loading') : t('home.noUpcoming')} />}
      </Section>
      <ErrorText error={calendar.error} />

    </Screen>
  );
}

function StageRow({ s, last }: { s: TodayRow; last: boolean }) {
  const label = s.status === 'scored' ? t('home.pointsForYou', { points: points(s.my_points) })
    : s.status === 'finished' ? t('home.scoring')
    : s.start_at ? t('home.schedule', { start: time(s.start_at), finish: time(s.est_finish_at) }) : t('home.noSchedule');
  return (
    <Row last={last}>
      <View style={[styles.swatch, { backgroundColor: categoryColor[s.category] ?? colors.line }]} />
      {/* bandera en una columna fija, a la altura del nombre: todas alineadas */}
      <View style={styles.flagCol}><Flag code={s.country} /></View>
      <View style={{ flex: 1 }}>
        <Txt variant="lead" numberOfLines={1}>{s.race_name}</Txt>
        <Txt variant="small">{s.number === 0 ? t('race.prologue') : t('race.stageN', { n: s.number })} · {label}</Txt>
      </View>
      <Button small kind="secondary" label={t('stage.scores')} onPress={() => router.push(`/etapa/${s.stage_id}`)} />
    </Row>
  );
}

function RaceRow({ r, last }: { r: CalendarRow; last: boolean }) {
  return (
    <Row last={last}>
      <View style={[styles.swatch, { backgroundColor: categoryColor[r.category] ?? colors.line }]} />
      {/* bandera en una columna fija, a la altura del nombre: todas alineadas */}
      <View style={styles.flagCol}><Flag code={r.country} /></View>
      <View style={{ flex: 1 }}>
        <Txt variant="lead" numberOfLines={1}>{r.name}</Txt>
        <Txt variant="small">
          {dateRange(r.start_date, r.end_date)} · {categoryLabel(r.category, r.is_stage_race)} ·{' '}
          {r.my_entry_count ? t('race.entered', { n: r.my_entry_count, max: r.max_entries }) : t('race.notEntered')}
        </Txt>
      </View>
      <Button small label={t('race.enter')} onPress={() => router.push(`/carrera/${r.race_id}`)} />
    </Row>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.l, padding: space.l, paddingTop: space.xl },
  warning: { color: colors.red, paddingHorizontal: space.l },
  swatch: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  flagCol: { width: 18, alignSelf: 'flex-start', marginTop: 6 },     // 6 = (alto de línea 24 − bandera 12) / 2
});
