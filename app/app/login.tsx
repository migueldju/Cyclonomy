import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { AuthScreen } from '@/components/AuthCard';
import { LoginForm } from '@/components/AuthForms';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { t } from '@/i18n';
import { colors, fonts, space, themed } from '@/theme';

export default function Login() {
  return (
    <AuthScreen
      footer={<Button label={t('auth.createAccount')} kind="quiet" onPress={() => router.push('/signup')} />}>
      <Txt style={styles.tagline}>{t('login.tagline')}</Txt>
      <LoginForm />
    </AuthScreen>
  );
}

const styles = themed(() => StyleSheet.create({
  tagline: { fontFamily: fonts.bodyMedium, textAlign: 'center', color: colors.inkSoft, marginBottom: space.xl },
}));
