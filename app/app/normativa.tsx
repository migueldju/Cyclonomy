import { useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import { Button } from '@/components/Button';
import { DEFAULT_SETTINGS, depthHint, depthOptions, LeagueSettingsForm, payoutOptions } from '@/components/LeagueSettingsForm';
import { Screen } from '@/components/Screen';
import { ErrorText, Row, Section } from '@/components/Section';
import { Txt } from '@/components/Txt';
import { useLeague } from '@/context/LeagueContext';
import { useLoader } from '@/hooks/useLoader';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { inviteMessage } from '@/lib/invite';
import type { Category, League, ScoringRule } from '@/lib/types';
import { categoryName, space } from '@/theme';

const rules = () => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => t(`rules.r${n}` as 'rules.r1'));

export default function Normativa() {
  const { leagueId, me, refresh } = useLeague();
  const id = leagueId ?? '';
  const league = useLoader(() => api.league(id), [id], !!leagueId);
  const cats = useLoader(() => api.categories());
  const scoring = useLoader(() => api.scoring());
  const [editing, setEditing] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const lg = league.data;

  return (
    <Screen onRefresh={league.reload} refreshing={league.loading}>
      <View style={{ padding: space.l, paddingTop: space.xl }}>
        <Txt variant="hero">{t('home.rules')}</Txt>
        <Txt variant="small">{lg?.name ?? ''}</Txt>
      </View>
      <ErrorText error={league.error} />

      {lg && editing ? (
        <Section title={t('rules.edit')}>
          <View style={{ padding: space.l }}>
            <LeagueSettingsForm
              initial={{ ...DEFAULT_SETTINGS, ...pick(lg) }}
              initialName={lg.name}
              submitLabel={t('rules.save')}
              onSubmit={async (name, s) => {
                await api.updateLeague(id, { ...s, name });
                setEditing(false);
                league.reload();
                refresh();
              }}
            />
            <Button kind="quiet" label={t('common.cancel')} onPress={() => setEditing(false)} style={{ marginTop: space.s }} />
          </View>
        </Section>
      ) : lg ? (
        <Section title={t('rules.params')}
                 action={me?.is_admin ? <Button small kind="secondary" label={t('rules.editShort')} onPress={() => setEditing(true)} /> : undefined}>
          <Param label={t('settings.maxRiders')} value={String(lg.max_riders)} />
          <Param label={t('tabs.calendar')} value={depthOptions().find((o) => o.value === lg.calendar_depth)?.label ?? ''}
                 hint={depthHint(lg.calendar_depth)} />
          <Param label={t('tabs.market')} value={t('rules.marketValue', { n: lg.market_size, hour: `${String(lg.market_hour).padStart(2, '0')}:00` })} />
          <Param label={t('settings.clauses')} value={lg.clauses_enabled ? t('rules.on') : t('rules.off')} />
          <Param label={t('settings.payout')} value={payoutOptions().find((o) => o.value === lg.payout_mode)?.label ?? ''}
                 hint={payoutHint(lg)} last />
        </Section>
      ) : null}

      {me?.is_admin && lg ? (
        <Section title={t('rules.invitation')}>
          <View style={{ padding: space.l, gap: space.m }}>
            <Txt>{t('rules.code')} <Txt variant="number">{lg.invite_code}</Txt></Txt>
            <Button kind="secondary" label={t('home.shareInvite')}
                    onPress={() => Share.share({ message: inviteMessage(lg.name, lg.invite_code) })} />
            <Button kind="quiet" label={t('rules.newCode')}
                    onPress={async () => {
                      setCodeError(null);
                      try { await api.regenerateCode(id); league.reload(); } catch (e) { setCodeError((e as Error).message); }
                    }} />
            <ErrorText error={codeError} />
          </View>
        </Section>
      ) : null}

      <Section title={t('rules.title')}>
        {rules().map((r, i, all) => (
          <Row key={i} last={i === all.length - 1}><Txt style={{ flex: 1 }}>{r}</Txt></Row>
        ))}
      </Section>

      <Section title={t('rules.pointsByCategory')}>
        <ScoringTable cats={(cats.data ?? []).filter((c) => !lg || c.depth_level <= lg.calendar_depth)} rules={scoring.data ?? []} />
      </Section>
    </Screen>
  );
}

function pick(lg: League) {
  const { max_riders, calendar_depth, market_size, market_hour, clauses_enabled, payout_mode, payout_per_point, payout_by_position } = lg;
  return { max_riders, calendar_depth, market_size, market_hour, clauses_enabled, payout_mode, payout_per_point, payout_by_position };
}

function payoutHint(lg: League) {
  const perPoint = t('rules.perPoint', { amount: money(lg.payout_per_point) });
  const prizes = lg.payout_by_position.length
    ? lg.payout_by_position.map((p, i) => `${t('fmt.ordinal', { n: i + 1 })} ${money(p)}`).join(', ') : t('rules.noPrizes');
  const text = lg.payout_mode === 'per_point' ? perPoint : lg.payout_mode === 'by_position' ? prizes
    : t('rules.both', { perPoint, prizes });
  return t('rules.paidMondays', { text });
}

function Param({ label, value, hint, last }: { label: string; value: string; hint?: string; last?: boolean }) {
  return (
    <Row last={last}>
      <View style={{ flex: 1 }}>
        <Txt variant="small">{label}</Txt>
        <Txt variant="lead">{value}</Txt>
        {hint ? <Txt variant="small">{hint}</Txt> : null}
      </View>
    </Row>
  );
}

const kindLabel = (k: string) => {
  const key = `scoring.${k}` as 'scoring.oneday';
  const s = t(key);
  return s === key ? k : s;
};

function ScoringTable({ cats, rules }: { cats: Category[]; rules: ScoringRule[] }) {
  const byCat = useMemo(() => {
    const m = new Map<string, Map<string, ScoringRule[]>>();
    rules.forEach((r) => {
      if (!m.has(r.category)) m.set(r.category, new Map());
      const k = m.get(r.category)!;
      k.set(r.kind, [...(k.get(r.kind) ?? []), r]);
    });
    return m;
  }, [rules]);

  return (
    <>
      {cats.map((c, i) => {
        const kinds = [...(byCat.get(c.code)?.entries() ?? [])];
        return (
          <Row key={c.code} last={i === cats.length - 1}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="lead">{categoryName(c.code)}</Txt>
              <Txt variant="small">{t('rules.maxEntries', { n: c.max_entries })}</Txt>
              {kinds.map(([kind, rs]) => (
                <Txt key={kind} variant="small">
                  {kindLabel(kind)}: {rs.slice(0, 5).map((r) => r.points).join(' · ')}
                  {rs.length > 5 ? ` … ${t('rules.upToPos', { n: rs.length })}` : ''}
                </Txt>
              ))}
            </View>
          </Row>
        );
      })}
    </>
  );
}
