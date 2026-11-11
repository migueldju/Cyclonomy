import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { Lang } from '../i18n';
import { colors, fonts, space } from '../theme';
import { Flag } from './Flag';
import { Sheet } from './Modal';
import { Txt } from './Txt';

// Bandera de cada idioma: la del país; el árabe, la de Arabia Saudí. Catalán, euskera y gallego, dibujadas aquí
// (flagcdn.com no tiene las de las comunidades)
const COUNTRY: Partial<Record<Lang, string>> = {
  es: 'es', en: 'gb', fr: 'fr', pt: 'pt', it: 'it', nl: 'nl', de: 'de', pl: 'pl', ru: 'ru', ar: 'sa', ja: 'jp', da: 'dk',
  sl: 'si', cs: 'cz',
};

const H = 14;            // alto de la bandera (caja 3:2, como Flag)
const W = H * 1.5;

function RegionFlag({ lang }: { lang: Lang }) {
  return (
    <Svg width={W} height={H} viewBox="0 0 18 12">
      {lang === 'ca' ? (
        // senyera: cuatro barras rojas sobre amarillo
        <>
          <Rect width={18} height={12} fill="#FCDD09" />
          {[1, 3, 5, 7].map((i) => <Rect key={i} y={(i * 12) / 9} width={18} height={12 / 9} fill="#DA121A" />)}
        </>
      ) : lang === 'eu' ? (
        // ikurriña: aspa verde y cruz blanca sobre rojo
        <>
          <Rect width={18} height={12} fill="#D52B1E" />
          <Path d="M0 0 L18 12 M18 0 L0 12" stroke="#009B48" strokeWidth={2} />
          <Path d="M9 0 V12 M0 6 H18" stroke="#FFFFFF" strokeWidth={1.6} />
        </>
      ) : (
        // gallega: banda azul en diagonal sobre blanco
        <>
          <Rect width={18} height={12} fill="#FFFFFF" />
          <Path d="M0 0 L18 12" stroke="#0099CC" strokeWidth={2.4} />
          <Rect width={18} height={12} fill="none" stroke={colors.line} strokeWidth={0.5} />
        </>
      )}
    </Svg>
  );
}

export function LangFlag({ lang }: { lang: Lang }) {
  const cc = COUNTRY[lang];
  return cc ? <Flag code={cc} height={H} /> : <RegionFlag lang={lang} />;
}

/** Elección del idioma: campo con la bandera y el idioma actual que abre la lista (desplegable) */
export function LanguagePicker({ label, hideLabel, languages, value, onChange }: {
  label: string; hideLabel?: boolean; languages: { code: Lang; name: string }[]; value: Lang; onChange: (l: Lang) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = languages.find((l) => l.code === value);
  return (
    <View style={{ marginBottom: space.l }}>
      {hideLabel ? null : <Txt variant="label" style={{ marginBottom: space.xs }}>{label}</Txt>}
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label}
                 style={({ pressed }) => [styles.field, pressed && { backgroundColor: colors.road }]}>
        <View style={styles.flag}><LangFlag lang={value} /></View>
        <Txt style={{ flex: 1 }}>{current?.name}</Txt>
        <Ionicons name="chevron-down" size={18} color={colors.inkSoft} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <ScrollView style={{ maxHeight: 420 }}>
          {languages.map((l) => {
            const on = l.code === value;
            return (
              <Pressable key={l.code} onPress={() => { onChange(l.code); setOpen(false); }} accessibilityRole="radio"
                         accessibilityState={{ checked: on }}
                         style={({ pressed }) => [styles.option, (pressed || on) && { backgroundColor: colors.road }]}>
                <View style={styles.flag}><LangFlag lang={l.code} /></View>
                <Txt style={[{ flex: 1 }, on && { fontFamily: fonts.bodyBold }]}>{l.name}</Txt>
                {on ? <Ionicons name="checkmark" size={18} color={colors.green} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.paper, borderWidth: 1,
    borderColor: colors.line, borderRadius: 6, paddingHorizontal: space.m, paddingVertical: 12,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: 10, paddingHorizontal: space.s,
            borderRadius: 6 },
  flag: { borderRadius: 2, overflow: 'hidden' },
});
