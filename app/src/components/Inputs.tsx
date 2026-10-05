import { Pressable, StyleSheet, Switch, TextInput, TextInputProps, View } from 'react-native';
import { colors, fonts, space, type } from '../theme';
import { t } from '../i18n';
import { Txt } from './Txt';

export function Input({ label, hint, ...rest }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ marginBottom: space.l }}>
      <Txt variant="label" style={{ marginBottom: 4 }}>{label}</Txt>
      <TextInput {...rest} accessibilityLabel={label} placeholderTextColor={colors.inkSoft} style={[styles.input, rest.style]} />
      {hint ? <Txt variant="small" style={{ marginTop: 4 }}>{hint}</Txt> : null}
    </View>
  );
}

/** Selector de una opción entre varias (segmentos) */
export function Segmented<T extends string | number>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={{ marginBottom: space.l }}>
      <Txt variant="label" style={{ marginBottom: 6 }}>{label}</Txt>
      <View style={styles.segments}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={String(o.value)} onPress={() => onChange(o.value)} accessibilityRole="radio"
                       accessibilityState={{ selected: on }} style={[styles.segment, on && styles.segmentOn]}>
              <Txt style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Número con botones − / + */
export function Stepper({ label, value, onChange, min, max, step = 1, format }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number;
  format?: (v: number) => string;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <View style={[styles.stepRow, { marginBottom: space.l }]}>
      <Txt style={{ flex: 1 }}>{label}</Txt>
      <Pressable onPress={() => set(value - step)} style={styles.stepBtn} accessibilityLabel={t('input.less', { label })}>
        <Txt variant="lead">−</Txt>
      </Pressable>
      <Txt variant="number" style={{ minWidth: 64, textAlign: 'center' }}>{format ? format(value) : value}</Txt>
      <Pressable onPress={() => set(value + step)} style={styles.stepBtn} accessibilityLabel={t('input.more', { label })}>
        <Txt variant="lead">+</Txt>
      </Pressable>
    </View>
  );
}

export function Toggle({ label, value, onChange, hint }: {
  label: string; value: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <View style={{ marginBottom: space.l }}>
      <View style={styles.stepRow}>
        <Txt style={{ flex: 1 }}>{label}</Txt>
        <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.jersey, false: colors.line }}
                thumbColor={colors.paper} accessibilityLabel={label} />
      </View>
      {hint ? <Txt variant="small">{hint}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 6,
    paddingHorizontal: space.m, paddingVertical: 10, fontFamily: fonts.body, fontSize: type.body, color: colors.ink,
  },
  segments: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  segment: {
    paddingHorizontal: space.m, paddingVertical: 8, borderRadius: 6, borderWidth: 1.5,
    borderColor: colors.line, backgroundColor: colors.paper,
  },
  segmentOn: { borderColor: colors.ink, backgroundColor: colors.ink },
  segmentText: { fontFamily: fonts.bodyMedium, fontSize: type.small, color: colors.ink, letterSpacing: 0.2 },
  segmentTextOn: { color: colors.paper },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  stepBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper,
  },
});
