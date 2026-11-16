import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cardShadow, colors, fonts, space, themed, type } from '../theme';
import { Screen } from './Screen';
import { Txt } from './Txt';

/**
 * Pantallas de acceso (entrar, crear cuenta, verificar, recuperar): el logo centrado, el formulario en una tarjeta
 * blanca como las del resto de la app y, debajo, los enlaces secundarios (`footer`).
 */
export function AuthScreen({ title, subtitle, children, footer }: {
  title?: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Screen padded>
      <View style={[styles.wrap, { paddingTop: insets.top + space.xxl }]}>
        <Image source={require('../../assets/logo-horizontal.png')} style={styles.logo} resizeMode="contain" tintColor={colors.ink}
               accessibilityLabel="Cyclonomy" />
        <View style={styles.card}>
          {title ? <Txt style={[styles.title, { marginBottom: subtitle ? space.xs : space.l }]}>{title}</Txt> : null}
          {subtitle ? <Txt variant="small" style={{ marginBottom: space.l }}>{subtitle}</Txt> : null}
          {children}
        </View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </Screen>
  );
}

/** Separador entre dos formas de entrar */
export function Divider() {
  return <View style={styles.or} />;
}

const styles = themed(() => StyleSheet.create({
  // centrado y sin estirarse en pantallas anchas (web, tableta)
  wrap: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  logo: { width: 214, height: 36, alignSelf: 'center', marginBottom: space.xl },          // 1200 × 202
  card: { backgroundColor: colors.paper, borderRadius: 24, padding: space.xl, ...cardShadow },
  // título en la letra del texto (Fira Sans), no en la condensada de las cabeceras
  title: { fontFamily: fonts.bodyBold, fontSize: type.title, color: colors.ink, letterSpacing: -0.2 },
  footer: { alignItems: 'center', marginTop: space.l, gap: space.xs },
  or: { height: 1, backgroundColor: colors.line, marginVertical: space.l },
}));
