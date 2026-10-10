import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { colors, fonts, space, type } from '../theme';
import { Txt } from './Txt';

/** Fila de filtros que se desliza en horizontal: se elige una opción. */
export function Chips<T extends string>({ label, items, value, onChange }: {
  label: string; items: [T, string][]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <Txt variant="label">{label}</Txt>
      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(c) => c[0]}
        contentContainerStyle={{ gap: space.s }}
        renderItem={({ item: [code, name] }) => {
          const on = value === code;
          return (
            <Pressable onPress={() => onChange(code)} accessibilityRole="button" accessibilityState={{ selected: on }}
                       style={[styles.chip, on && styles.chipOn]}>
              <Txt style={[styles.chipText, on && { color: colors.paper }]}>{name}</Txt>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: space.m, paddingVertical: 7, borderRadius: 16, borderWidth: 1.5,
    borderColor: colors.line, backgroundColor: colors.paper,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: type.small, color: colors.ink, letterSpacing: 0.2 },
});
