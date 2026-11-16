import { useState } from 'react';
import { GestureResponderEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { t } from '../i18n';
import { dayMonth, moneyShort } from '../lib/format';
import { colors, space, themed } from '../theme';
import { Pills } from './Hero';
import { Txt } from './Txt';

const HEIGHT = 150;
const PAD_TOP = 8;
const PAD_BOTTOM = 8;
const AXIS_W = 64;          // columna de etiquetas del eje Y, a la derecha

type Point = { day: string; value: number };

// Periodos de la gráfica, en días
const RANGES = [
  { value: '3d', days: 3, label: 'chart.range.3d' },
  { value: '1w', days: 7, label: 'chart.range.1w' },
  { value: '1m', days: 30, label: 'chart.range.1m' },
  { value: '3m', days: 90, label: 'chart.range.3m' },
  { value: 'all', days: null, label: 'chart.range.all' },          // todo el historial
] as const;
type Range = (typeof RANGES)[number]['value'];

/** Evolución del valor de mercado, con selector de periodo: 3 días, 1 semana, 1 mes, 3 meses o todo (por defecto). */
export function ValueChart({ points }: { points: Point[] }) {
  const [range, setRange] = useState<Range>('all');
  if (points.length < 2) return <Chart points={points} />;
  // desde N días antes del último dato (incluido, para que el cambio abarque los N días)
  const days = RANGES.find((r) => r.value === range)!.days;
  const from = days == null ? '' : new Date(new Date(`${points[points.length - 1].day}T00:00:00Z`).getTime() - days * 86400000)
    .toISOString().slice(0, 10);
  const shown = points.filter((p) => p.day >= from);
  return (
    <View>
      <Pills options={RANGES.map((r) => ({ value: r.value, label: t(r.label) }))} value={range} onChange={setRange} compact
             style={{ marginHorizontal: space.l, marginTop: space.l, alignSelf: 'center' }} />
      {/* key: al cambiar de periodo se olvida el día señalado */}
      <Chart key={range} points={shown.length >= 2 ? shown : points.slice(-2)} />
    </View>
  );
}

/** Una línea, rejilla discreta y lectura del día al tocar o arrastrar. */
function Chart({ points }: { points: Point[] }) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <Txt variant="small" style={{ padding: space.l }}>
        {t('chart.empty')}
      </Txt>
    );
  }

  const values = points.map((p) => p.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const pad = hi === lo ? Math.max(hi * 0.1, 10000) : (hi - lo) * 0.08;
  lo = Math.max(0, lo - pad);
  hi += pad;

  const plotW = Math.max(0, width - AXIS_W);
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => (i / (points.length - 1)) * plotW;
  const y = (v: number) => PAD_TOP + (1 - (v - lo) / (hi - lo)) * plotH;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const ticks = [hi, (hi + lo) / 2, lo];

  const shown = active ?? points.length - 1;
  const first = points[0].value;
  const change = first ? (points[shown].value - first) / first : 0;

  function pick(e: GestureResponderEvent) {
    if (!plotW) return;
    const i = Math.round((e.nativeEvent.locationX / plotW) * (points.length - 1));
    setActive(Math.min(points.length - 1, Math.max(0, i)));
  }

  return (
    <View style={{ padding: space.l, gap: space.s }}>
      <View style={styles.readout}>
        <Txt variant="number">{moneyShort(points[shown].value)}</Txt>
        <Txt variant="small">
          {t('chart.change', { day: dayMonth(points[shown].day),
                              pct: `${change >= 0 ? '+' : '−'}${Math.abs(change * 100).toFixed(1).replace('.', t('fmt.decimal'))}`,
                              since: dayMonth(points[0].day) })}
        </Txt>
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}
            accessible accessibilityRole="image"
            accessibilityLabel={t('chart.a11y', { from: moneyShort(first), fromDay: dayMonth(points[0].day),
                                                  to: moneyShort(values[values.length - 1]), toDay: dayMonth(points[points.length - 1].day) })}>
        {width ? (
          <>
            <Svg width={width} height={HEIGHT}>
              {ticks.map((t, i) => (
                <Line key={i} x1={0} x2={plotW} y1={y(t)} y2={y(t)} stroke={colors.line} strokeWidth={1} />
              ))}
              <Path d={path} stroke={colors.ink} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              {active != null ? (
                <>
                  <Line x1={x(active)} x2={x(active)} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} stroke={colors.inkSoft} strokeWidth={1} />
                  <Circle cx={x(active)} cy={y(points[active].value)} r={5} fill={colors.ink} stroke={colors.paper} strokeWidth={2} />
                </>
              ) : null}
            </Svg>
            {ticks.map((t, i) => (
              <Txt key={i} variant="small" style={[styles.tick, { top: y(t) - 9, left: plotW + space.s }]}>{moneyShort(t)}</Txt>
            ))}
            {/* zona táctil más grande que la línea: tocar o arrastrar muestra el valor de ese día */}
            <View style={[StyleSheet.absoluteFill, { width: plotW }]}
                  onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
                  onResponderGrant={pick} onResponderMove={pick} onResponderRelease={() => setActive(null)}
                  onResponderTerminate={() => setActive(null)} />
          </>
        ) : null}
      </View>
      <View style={[styles.xAxis, { width: plotW }]}>
        <Txt variant="small">{dayMonth(points[0].day)}</Txt>
        <Txt variant="small">{dayMonth(points[points.length - 1].day)}</Txt>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: space.s, flexWrap: 'wrap' },
  tick: { position: 'absolute', fontSize: 11, lineHeight: 18 },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between' },
}));
