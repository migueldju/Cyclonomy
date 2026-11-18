import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, ViewStyle } from 'react-native';
import { t } from '../i18n';
import { colors, fonts, space, themed, type } from '../theme';

/**
 * Buscador en una pastilla: lupa, texto y un aspa para borrar. Al escribir, la pastilla se resalta con un borde y
 * solo se ve el cursor parpadeando (en la web, sin el recuadro del navegador alrededor del texto).
 */
export function SearchField({ value, onChangeText, placeholder, style }: {
  value: string; onChangeText: (v: string) => void; placeholder: string; style?: ViewStyle;
}) {
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}
               style={[styles.box, focused && styles.boxOn, style]}>
      <Ionicons name="search" size={18} color={focused ? colors.ink : colors.inkSoft} />
      <TextInput
        ref={input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSoft}
        accessibilityLabel={placeholder}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        cursorColor={colors.ink}
        selectionColor={colors.jersey}
        style={[styles.input, WEB_INPUT]}
      />
      {value ? (
        <Pressable onPress={() => { onChangeText(''); input.current?.focus(); }} hitSlop={8}
                   accessibilityRole="button" accessibilityLabel={t('common.clear')} style={styles.clear}>
          <Ionicons name="close" size={14} color={colors.paper} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

// en la web: sin el contorno del navegador al enfocar (la pastilla ya lo marca) y con el cursor del color del texto
const WEB_INPUT = Platform.OS === 'web' ? ({ outlineStyle: 'none', caretColor: 'currentColor' } as object) : null;

const styles = themed(() => StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.road, borderRadius: 999,
    paddingHorizontal: space.l, borderWidth: 1.5, borderColor: 'transparent',
  },
  boxOn: { backgroundColor: colors.paper, borderColor: colors.jersey },
  input: { flex: 1, minWidth: 0, paddingVertical: 10, fontFamily: fonts.body, fontSize: type.body, color: colors.ink },
  clear: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center',
  },
}));
