import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { PositionJersey } from '@/components/PositionJersey';
import { Flag } from '@/components/Flag';
import { Segmented } from '@/components/Inputs';
import { Screen } from '@/components/Screen';
import { Empty, ErrorText, Row, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { moneyShort, points } from '@/lib/format';
import { colors, space } from '@/theme';

export default function Clasificacion() {
  const { leagueId, me } = useLeague();
  const id = leagueId ?? '';
  const { data, error, loading, reload } = useLoader(() => api.standings(id), [id], !!leagueId);
  const [mode, setMode] = useState<'total' | 'week'>('total');

  const rows = useMemo(() => {
    const list = [...(data ?? [])];
    if (mode === 'total') return list.map((r) => ({ ...r, shown: r.points_total, rank: r.pos }));
    list.sort((a, b) => b.points_week - a.points_week);
    return list.map((r) => ({ ...r, shown: r.points_week, rank: 1 + list.filter((x) => x.points_week > r.points_week).length }));
  }, [data, mode]);

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <View style={{ padding: space.l, paddingTop: space.xl, paddingBottom: 0 }}>
        <Segmented label={t('admin.classification')} value={mode} onChange={setMode}
                   options={[{ value: 'total', label: t('kind.gc') }, { value: 'week', label: t('standings.week') }]} />
      </View>
      <Section style={{ marginTop: 0 }}>
        {rows.length ? rows.map((r, i) => {
          const mine = r.member_id === me?.member_id;
          return (
            <Row key={r.member_id} last={i === rows.length - 1}
                 onPress={() => (mine ? router.navigate('/plantilla') : router.push(`/jugador/${r.member_id}`))}>
              <PositionJersey position={r.rank} />
              {r.avatar_url ? <Image source={{ uri: r.avatar_url }} style={styles.avatar} /> : <View style={[styles.avatar, styles.noAvatar]} />}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                  <Txt variant="lead" numberOfLines={1}
                       style={[{ flexShrink: 1 }, mine ? { textDecorationLine: 'underline' } : null]}>
                    {r.team_name}
                  </Txt>
                  <Flag code={r.country} />
                </View>
                <Txt variant="small" numberOfLines={1}>{r.display_name ?? ''} · {t('standings.squadValue', { amount: moneyShort(r.team_value) })}</Txt>
              </View>
              <Txt variant="number">{points(r.shown)}</Txt>
            </Row>
          );
        }) : <Empty text={loading ? t('common.loading') : t('standings.empty')} />}
      </Section>
      <ErrorText error={error} />
      <Txt variant="small" style={{ padding: space.l }}>
        {t('standings.hint')}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 32, height: 32, borderRadius: 16 },
  noAvatar: { backgroundColor: colors.line },
});
