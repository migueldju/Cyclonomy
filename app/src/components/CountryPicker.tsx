import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { t } from '../i18n';
import { COUNTRIES, countryName } from '../lib/countries';
import { colors, fonts, space, themed, type } from '../theme';
import { Flag } from './Flag';
import { Sheet } from './Modal';
import { SearchField } from './SearchField';
import { Txt } from './Txt';

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Campo para elegir el país del equipo: abre una lista con buscador y banderas */
export function CountryPicker({ value, onChange, label, hint = true }: {
  value: string | null; onChange: (code: string) => void; label?: string;
  hint?: boolean;             // el aviso de que no se puede cambiar después
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
        <Ionicons name="chevron-down" size={18} color={colors.inkSoft} />
      </Pressable>
      {hint ? <Txt variant="small" style={{ marginTop: space.xs }}>{t('country.permanent')}</Txt> : null}

      <Sheet visible={open} onClose={() => setOpen(false)} title={t('country.label')}>
        <SearchField value={query} onChangeText={setQuery} placeholder={t('country.search')} style={{ marginBottom: space.s }} />
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

const styles = themed(() => StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.paper, borderWidth: 1,
    borderColor: colors.line, borderRadius: 14, paddingHorizontal: space.l, paddingVertical: 13,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: 10, paddingHorizontal: space.s,
            borderRadius: 12 },
}));
