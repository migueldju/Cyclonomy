import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, space, type } from '../theme';

let listener: ((message: string) => void) | null = null;

/** Aviso momentáneo abajo de la pantalla confirmando una acción */
export function showToast(message: string) {
  listener?.(message);
}

/** Muestra los avisos de showToast; va una sola vez, en la raíz de la app */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listener = (m) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(m);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setMessage(null));
      }, 2600);
    };
    return () => { listener = null; if (timer.current) clearTimeout(timer.current); };
  }, [opacity]);

  if (!message) return null;
  return (
    // por encima de la barra de pestañas
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" accessibilityRole="alert"
                   style={[styles.toast, { bottom: insets.bottom + 72, opacity,
                     transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      <Ionicons name="checkmark-circle" size={20} color={colors.jersey} />
      <Animated.Text style={styles.text}>{message}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', left: space.l, right: space.l, flexDirection: 'row', alignItems: 'center', gap: space.s,
    backgroundColor: colors.asphalt, borderRadius: 14, paddingVertical: space.m, paddingHorizontal: space.l,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  text: { flex: 1, color: colors.paper, fontFamily: fonts.bodyBold, fontSize: type.body },
});
