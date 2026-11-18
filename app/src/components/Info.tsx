import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { t } from '../i18n';
import { colors, fonts, space, themed, type } from '../theme';
import { Button } from './Button';
import { Sheet } from './Modal';
import { Txt } from './Txt';

/** Un punto de la explicación: texto, o texto con el punto de color de un estado */
export type InfoItem = string | { dot: string; text: string };

/** Botón «Cómo funciona»: abre una hoja con la explicación de la pantalla, en vez de tenerla siempre a la vista */
export function InfoButton({ title, items, style, compact }: {
  title: string; items: InfoItem[]; style?: ViewStyle;
  compact?: boolean;          // solo el icono, en un círculo
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={t('info.how')} hitSlop={6}
                 style={({ pressed }) => [compact ? styles.round : styles.button, pressed && { opacity: 0.7 }, style]}>
        <Ionicons name="information-circle-outline" size={compact ? 20 : 17} color={colors.ink} />
        {compact ? null : <Txt style={styles.label}>{t('info.how')}</Txt>}
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={title}>
        <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: space.m, paddingBottom: space.l }}>
          {items.map((it, i) => (
            <View key={i} style={styles.item}>
              <View style={[styles.dot, { backgroundColor: typeof it === 'string' ? colors.jersey : it.dot }]} />
              <Txt style={{ flex: 1 }}>{typeof it === 'string' ? it : it.text}</Txt>
            </View>
          ))}
        </ScrollView>
        <Button label={t('common.close')} kind="quiet" onPress={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

/** Hueco reservado para un banner de anuncios (320 × 50); de momento vacío y sin marcar: solo guarda el sitio */
export function AdSlot({ style }: { style?: ViewStyle }) {
  return <View style={[styles.ad, style]} />;
}

const styles = themed(() => StyleSheet.create({
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: colors.road,
    borderRadius: 999, paddingLeft: 9, paddingRight: 12, paddingVertical: 6,
  },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.road, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.bodyMedium, fontSize: type.small, color: colors.ink },
  item: { flexDirection: 'row', gap: space.m },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  ad: { height: 58, marginHorizontal: space.l, marginTop: space.l },
}));
