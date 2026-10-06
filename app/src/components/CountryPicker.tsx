import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { t } from '../i18n';
import { COUNTRIES, countryName } from '../lib/countries';
import { colors, fonts, space, type } from '../theme';
import { Flag } from './Flag';
import { Sheet } from './Modal';
import { Txt } from './Txt';

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Campo para elegir el país del equipo: abre una lista con buscador y banderas */
export function CountryPicker({ value, onChange, label }: {
  value: string | null; onChange: (code: string) => void; label?: string;
}) {
  label = label ?? t('country.label');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = plain(query.trim());
    return q ? COUNTRIES.filter(([, name]) => plain(name).includes(q)) : COUNTRIES;
  }, [query]);

  return (
    <View style={{ marginBottom: space.l }}>
      <Txt variant="label" style={{ marginBottom: space.xs }}>{label}</Txt>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label} style={styles.field}>
        {value ? <Flag code={value} height={14} /> : null}
        <Txt style={{ flex: 1, color: value ? colors.ink : colors.inkSoft }}>{countryName(value) ?? t('country.choose')}</Txt>
        <Txt variant="small">{t('common.change')}</Txt>
      </Pressable>
      <Txt variant="small" style={{ marginTop: space.xs }}>{t('country.permanent')}</Txt>

      <Sheet visible={open} onClose={() => setOpen(false)} title={t('country.label')}>
        <TextInput value={query} onChangeText={setQuery} placeholder={t('country.search')} placeholderTextColor={colors.inkSoft}
                   style={styles.search} accessibilityLabel={t('country.search')} autoCorrect={false} />
        <FlatList
          data={list}
          keyExtractor={([code]) => code}
          style={{ maxHeight: 360 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: [code, name] }) => (
            <Pressable onPress={() => { onChange(code); setOpen(false); setQuery(''); }} accessibilityRole="radio"
                       accessibilityState={{ checked: code === value }}
                       style={({ pressed }) => [styles.option, (pressed || code === value) && { backgroundColor: colors.road }]}>
              <Flag code={code} height={14} />
              <Txt style={{ flex: 1 }}>{name}</Txt>
            </Pressable>
          )}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.paper, borderWidth: 1,
    borderColor: colors.line, borderRadius: 6, paddingHorizontal: space.m, paddingVertical: 12,
  },
  search: {
    backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: space.m,
    paddingVertical: 10, fontFamily: fonts.body, fontSize: type.body, color: colors.ink, marginBottom: space.s,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: 10, paddingHorizontal: space.s,
            borderRadius: 6 },
});
