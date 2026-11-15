import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { t } from '../i18n';
import { moneyShort } from '../lib/format';
import type { RiderStatus } from '../lib/types';
import { colors, fonts, space, type } from '../theme';
import { Flag } from './Flag';
import { RiderAvatar } from './RiderAvatar';
import { Txt } from './Txt';

/** Aviso corto de un ciclista (llega el lunes, en venta, blindado…): icono y texto en una pastilla de color */
export type RiderTag = { icon: ComponentProps<typeof Ionicons>['name']; text: string; color: string };

/** Fila de ciclista: foto, nombre con bandera y equipo a la izquierda; valor y dato secundario a la derecha. */
export function RiderRow({ name, team, value, detail, note, onPress, last, right, photo, nationality, sub, pointsBox, trend, tags }: {
  tags?: RiderTag[];          // avisos en pastillas, debajo de la segunda línea
  sub?: ReactNode;            // segunda línea propia (en vez de «equipo · nota»)
  pointsBox?: string;         // puntos en un recuadro al principio de la segunda línea (como en el mercado)
  trend?: -1 | 0 | 1;         // flecha de tendencia junto al valor
  name: string; team?: string | null; value: number; detail?: string; status?: RiderStatus; note?: string;
  onPress?: () => void; last?: boolean; right?: ReactNode; photo?: string | null; nationality?: string | null;
}) {
  const content = (
    <>
      <View style={styles.row}>
        <RiderAvatar url={photo} name={name} team={team} />
        <View style={styles.main}>
          <View style={styles.nameLine}>
            <Txt variant="lead" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Txt>
            <Flag code={nationality} />
          </View>
          {sub ?? (pointsBox ? (
            <View style={styles.sub}>
              <View style={styles.pts}><Txt style={styles.ptsText}>{pointsBox}</Txt></View>
              <Txt variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>{[team, note].filter(Boolean).join(' · ')}</Txt>
            </View>
          ) : <Txt variant="small" numberOfLines={1}>{[team, note].filter(Boolean).join(' · ')}</Txt>)}
          {tags?.length ? (
            <View style={styles.tags}>
              {tags.map((g) => (
                <View key={g.text} style={[styles.tag, { backgroundColor: g.color + '1F' }]}>
                  <Ionicons name={g.icon} size={12} color={g.color} />
                  <Txt numberOfLines={1} style={[styles.tagText, { color: g.color }]}>{g.text}</Txt>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        {right ?? (
          <View style={styles.side}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {trend != null ? (
                <Ionicons name={trend > 0 ? 'arrow-up' : trend < 0 ? 'arrow-down' : 'remove'} size={16}
                          color={trend > 0 ? colors.green : trend < 0 ? colors.red : colors.inkSoft} />
              ) : null}
              <Txt variant="number">{moneyShort(value)}</Txt>
            </View>
            {detail ? <Txt variant="small">{detail}</Txt> : null}
          </View>
        )}
      </View>
      {!last ? <View style={styles.line} /> : null}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: colors.road }}>{content}</Pressable>
  ) : <View>{content}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, paddingVertical: space.m, gap: space.m },
  main: { flex: 1, gap: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  side: { alignItems: 'flex-end' },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  pts: { backgroundColor: colors.road, borderRadius: 6, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 6, paddingVertical: 1 },
  ptsText: { fontFamily: fonts.bodyBold, fontSize: type.small - 1, color: colors.ink },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, maxWidth: '100%' },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: type.small - 2, lineHeight: 15, flexShrink: 1 },
  line: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
});

/** Avisos de un ciclista de una plantilla: llega o se va el lunes, en venta, blindado, oferta del juego */
export function riderTags(r: { status: RiderStatus; for_sale?: boolean; locked?: boolean; locked_next?: boolean; gameOffer?: string | null }): RiderTag[] {
  const out: RiderTag[] = [];
  if (r.status === 'incoming') out.push({ icon: 'enter-outline', text: t('status.incoming'), color: colors.orange });
  if (r.status === 'leaving') out.push({ icon: 'exit-outline', text: t('status.leaving'), color: colors.red });
  if (r.for_sale) out.push({ icon: 'pricetag', text: t('squad.forSale'), color: colors.green });
  if (r.locked) out.push({ icon: 'lock-closed', text: t('squad.locked'), color: '#2F6FB7' });
  else if (r.locked_next) out.push({ icon: 'lock-closed-outline', text: t('squad.lockedNext'), color: '#2F6FB7' });
  if (r.gameOffer) out.push({ icon: 'cash-outline', text: t('squad.gameOffers', { amount: r.gameOffer }), color: colors.inkSoft });
  return out;
}
