import { useRef, useState } from 'react';
import { GestureResponderEvent, PanResponder, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const THUMB = 26;

/**
 * Barra con dos tiradores (mínimo y máximo) sobre una lista de escalones repartidos por igual a lo largo
 * de la barra. Devuelve los índices de los escalones elegidos. Con `single` solo hay un tirador (el de `high`),
 * y la barra se rellena desde el principio.
 */
export function RangeSlider({ steps, low, high, onChange, label, single }: {
  steps: number; low: number; high: number; onChange: (low: number, high: number) => void; label?: string;
  single?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const track = Math.max(1, width - THUMB);
  const last = Math.max(1, steps - 1);
  const pos = (i: number) => (i / last) * track;

  // los PanResponder se crean una vez: leen el estado actual a través de una ref
  const state = useRef({ low, high, track, last, onChange, single });
  state.current = { low, high, track, last, onChange, single };
  const start = useRef(0);

  const responder = (which: 'low' | 'high') => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,        // que la lista no se quede el gesto al arrastrar
    onPanResponderGrant: () => {
      const s = state.current;
      start.current = ((which === 'low' ? s.low : s.high) / s.last) * s.track;
    },
    onPanResponderMove: (_, g) => {
      const s = state.current;
      const i = Math.round((Math.min(s.track, Math.max(0, start.current + g.dx)) / s.track) * s.last);
      if (which === 'low') { if (i !== s.low) s.onChange(Math.min(i, s.high), s.high); }
      else if (i !== s.high) s.onChange(s.low, Math.max(i, s.low));
    },
  });
  const lowPan = useRef(responder('low')).current;
  const highPan = useRef(responder('high')).current;

  // tocar sobre la barra lleva hasta ahí el tirador más cercano (y se puede seguir arrastrando sin soltar)
  const tapping = useRef<'low' | 'high'>('high');
  function moveTo(e: GestureResponderEvent, pick: boolean) {
    const s = state.current;
    const x = Math.min(s.track, Math.max(0, e.nativeEvent.locationX - THUMB / 2));
    const i = Math.round((x / s.track) * s.last);
    if (pick) {
      tapping.current = s.single || (Math.abs(i - s.high) <= Math.abs(i - s.low) && i >= s.low) || i > s.high
        ? 'high' : 'low';
    }
    if (tapping.current === 'low') s.onChange(Math.min(i, s.high), s.high);
    else s.onChange(s.low, Math.max(i, s.low));
  }

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.wrap} accessibilityLabel={label}
          onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => moveTo(e, true)} onResponderMove={(e) => moveTo(e, false)}>
      <View style={styles.rail} pointerEvents="none" />
      <View style={[styles.fill, { left: pos(low) + THUMB / 2, width: pos(high) - pos(low) }]} pointerEvents="none" />
      {single ? null : (
        <View {...lowPan.panHandlers} style={[styles.thumb, { left: pos(low) }]} accessibilityRole="adjustable"
              accessibilityLabel="Valor mínimo" hitSlop={10} />
      )}
      <View {...highPan.panHandlers} style={[styles.thumb, { left: pos(high) }]} accessibilityRole="adjustable"
            accessibilityLabel={single ? label : 'Valor máximo'} hitSlop={10} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: THUMB + 8, justifyContent: 'center' },
  rail: { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: 4, borderRadius: 2, backgroundColor: colors.line },
  fill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: colors.ink },
  thumb: {
    position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.paper,
    borderWidth: 2, borderColor: colors.ink,
  },
});
