import { Text, TextProps } from 'react-native';
import { colors, fonts, type } from '../theme';

type Variant = 'body' | 'small' | 'lead' | 'title' | 'display' | 'hero' | 'number' | 'label';

const styles: Record<Variant, object> = {
  body: { fontFamily: fonts.body, fontSize: type.body, lineHeight: 21, color: colors.ink },
  small: { fontFamily: fonts.body, fontSize: type.small, lineHeight: 18, color: colors.inkSoft },
  lead: { fontFamily: fonts.bodyBold, fontSize: type.lead, lineHeight: 24, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: type.title, lineHeight: 26, color: colors.ink },
  display: { fontFamily: fonts.display, fontSize: type.display, lineHeight: 30, color: colors.ink },
  hero: { fontFamily: fonts.display, fontSize: type.hero, lineHeight: 36, color: colors.ink },
  number: { fontFamily: fonts.number, fontSize: type.lead, lineHeight: 22, color: colors.ink },
  label: { fontFamily: fonts.bodyMedium, fontSize: type.small, lineHeight: 18, color: colors.inkSoft },
};

export function Txt({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[styles[variant], style]} />;
}
