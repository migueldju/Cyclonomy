import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LoginForm, SignupForm } from '@/components/AuthForms';
import { Button } from '@/components/Button';
import { GameCarousel } from '@/components/GameCarousel';
import { Pills } from '@/components/Hero';
import { Txt } from '@/components/Txt';
import { t } from '@/i18n';
import { cardShadow, colors, fonts, space, themed, UCI_RAINBOW } from '@/theme';

const MAX = 1120;
type Panel = 'login' | 'signup';
type Anchor = { x: number; y: number; w: number; h: number };
const DROP_W = 400;

/** Portada de la web para quien aún no tiene sesión: qué es el juego y cómo entrar */
export default function Welcome() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  // en el ordenador, entrar y crear cuenta se abren en un desplegable bajo el menú, sin cambiar de página
  // el desplegable cuelga del botón que lo abre: se mide dónde está en la ventana
  const [panel, setPanel] = useState<Panel | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const navIn = useRef<View>(null), navUp = useRef<View>(null);
  const scroller = useRef<ScrollView>(null);
  // desplazamiento de la página: si se mueve con el desplegable abierto, el desplegable se mueve con el botón
  const scrollY = useRef(0);
  const [shift, setShift] = useState(0);
  // siempre cuelga del botón del menú que corresponde («Entrar» o «Crear cuenta»); desde los botones de la página,
  // se sube primero arriba del todo para que el menú esté a la vista
  // abre el desplegable colgando del botón del menú de `p` (también al cambiar de pestaña dentro de él)
  const hang = (p: Panel) => {
    const el = (p === 'login' ? navIn : navUp).current;
    if (!el) return;
    // en la web se lee directamente (measureInWindow espera al siguiente fotograma)
    const box = Platform.OS === 'web' ? (el as unknown as HTMLElement).getBoundingClientRect?.() : null;
    const at = scrollY.current;
    if (box) { setAnchor({ x: box.left, y: box.top + at, w: box.width, h: box.height }); setShift(at); setPanel(p); return; }
    el.measureInWindow((x, y, w, h) => { setAnchor({ x, y: y + at, w, h }); setShift(at); setPanel(p); });
  };
  const open = (p: Panel, fromPage = false) => {
    if (!wide) { router.push(p === 'login' ? '/login' : '/signup'); return; }
    if (panel === p) { setPanel(null); return; }
    const measure = () => hang(p);
    // sin animación: si se mide mientras la página aún sube, el menú está fuera de la pantalla
    if (fromPage) { scroller.current?.scrollTo({ y: 0, animated: false }); scrollY.current = 0; setTimeout(measure, 0); } else measure();
  };

  // Esc lo cierra; si la ventana se estrecha, se pasa a las pantallas de siempre
  useEffect(() => {
    if (!panel || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanel(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel]);
  useEffect(() => { setPanel(null); }, [width]);           // al cambiar el tamaño de la ventana el botón se mueve

  return (
    <View style={{ flex: 1 }}>
    <ScrollView ref={scroller} style={styles.page} contentContainerStyle={{ flexGrow: 1 }} scrollEventThrottle={16}
                onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; if (panel) setShift(scrollY.current); }}>
      {/* portada, sobre asfalto */}
      <View style={styles.top}>
        <View style={[styles.inner, styles.nav]}>
          <Image source={require('../assets/logo-horizontal.png')} style={styles.logo} resizeMode="contain"
                 tintColor={colors.onDark} accessibilityLabel="Cyclonomy" />
          <View style={styles.navButtons}>
            {wide ? (
              <>
                <View ref={navIn} collapsable={false}>
                  <Button small kind="ghost" label={t('login.signIn')} onPress={() => open('login')}
                          style={panel === 'login' ? styles.navOn : undefined} />
                </View>
                <View ref={navUp} collapsable={false}>
                  <Button small label={t('auth.createAccount')} onPress={() => open('signup')} />
                </View>
              </>
            ) : <Button small label={t('login.signIn')} onPress={() => open('login')} />}
          </View>
        </View>

        <View style={[styles.inner, styles.hero, wide && styles.heroWide]}>
          <View style={{ flex: wide ? 1.3 : undefined, gap: space.l }}>
            <Txt style={[styles.title, !wide && styles.titleNarrow]}>{t('landing.title')}</Txt>
            <Txt style={styles.subtitle}>{t('landing.subtitle')}</Txt>
            <View style={[styles.ctas, !wide && { flexDirection: 'column' }]}>
              <Button label={t('landing.cta')} leftIcon="bicycle" onPress={() => open('signup', true)} style={styles.cta} />
              <Button kind="ghost" label={t('landing.haveAccount')} onPress={() => open('login', true)} style={styles.cta} />
            </View>
          </View>
          {/* los menús del juego, girando */}
          <View style={[styles.carousel, !wide && { marginTop: space.xl }]}>
            <GameCarousel size={wide ? 1 : 0.86} />
          </View>
        </View>
      </View>
      {/* franja con el arcoíris de la UCI */}
      <View style={styles.stripes}>
        {UCI_RAINBOW.map((c) => <View key={c} style={{ flex: 1, backgroundColor: c }} />)}
      </View>

      <Txt variant="small" style={styles.footer}>© {new Date().getFullYear()} Cyclonomy</Txt>
    </ScrollView>

    {panel && anchor ? (() => {
      const top = anchor.y - shift;          // dónde está ahora el botón en la ventana
      const right = anchor.x + anchor.w / 2 > width / 2;
      const left = Math.max(space.l, Math.min(width - DROP_W - space.l, right ? anchor.x + anchor.w - DROP_W : anchor.x));
      const caret = Math.max(18, Math.min(DROP_W - 32, anchor.x + anchor.w / 2 - left - 7));
      const below = top + anchor.h + 560 < height || top < height / 2;
      const pos = below ? { top: top + anchor.h + 12 } : { bottom: height - top + 12 };
      return (
      <>
        {/* fuera del desplegable: lo cierra */}
        <Pressable style={styles.backdrop} onPress={() => setPanel(null)} accessibilityLabel={t('common.close')} />
        <View style={[styles.dropWrap, pos, { left }]}>
          <View style={[styles.drop, { maxHeight: below ? height - top - anchor.h - 28 : top - 28 }]} accessibilityViewIsModal>
            <View style={styles.dropHead}>
              <Pills value={panel} onChange={hang}
                     options={[{ value: 'login', label: t('login.signIn') }, { value: 'signup', label: t('auth.createAccount') }]} />
              <Pressable onPress={() => setPanel(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <Ionicons name="close" size={22} color={colors.inkSoft} />
              </Pressable>
            </View>
            {panel === 'login' ? <LoginForm key="login" /> : <SignupForm key="signup" />}
          </View>
          {/* el piquito que señala el botón */}
          <View pointerEvents="none" style={[styles.caret, below ? { top: -6 } : { bottom: -6 }, { left: caret }]} />
        </View>
      </>
      );
    })() : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.road },
  inner: { width: '100%', maxWidth: MAX, alignSelf: 'center', paddingHorizontal: space.xl },
  top: { flexGrow: 1, backgroundColor: colors.asphalt, paddingBottom: space.xxl * 1.5 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.l },
  logo: { width: 168, height: 28 },
  navButtons: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  navOn: { backgroundColor: 'rgba(255,255,255,0.12)' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(14,19,21,0.35)' },
  // anclado arriba a la derecha, bajo los botones del menú, alineado con el contenido
  dropWrap: { position: 'absolute', width: DROP_W },
  drop: {
    backgroundColor: colors.paper, borderRadius: 20, padding: space.xl,
    overflow: 'auto' as 'scroll', ...cardShadow, shadowOpacity: 0.25, shadowRadius: 24,   // barra solo si no cabe
  },
  caret: { position: 'absolute', width: 14, height: 14, backgroundColor: colors.paper, transform: [{ rotate: '45deg' }], zIndex: 1 },
  dropHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.l },
  hero: { paddingTop: space.xxl, flexGrow: 1, justifyContent: 'center' },          // centrada en el alto que queda
  heroWide: { flexDirection: 'row', alignItems: 'center', gap: space.xxl, paddingTop: space.xxl * 1.5 },
  title: { fontFamily: fonts.display, fontSize: 64, lineHeight: 66, letterSpacing: 1, color: colors.onDark },
  titleNarrow: { fontSize: 44, lineHeight: 46 },
  subtitle: { fontFamily: fonts.body, fontSize: 18, lineHeight: 28, color: '#C9D2D6', maxWidth: 560 },
  ctas: { flexDirection: 'row', gap: space.m, marginTop: space.s },
  cta: { paddingHorizontal: space.xl },
  carousel: { flex: 1, minWidth: 0, overflow: 'hidden' },
  stripes: { flexDirection: 'row', height: 8 },
  footer: { textAlign: 'center', paddingVertical: space.xxl },
}));
