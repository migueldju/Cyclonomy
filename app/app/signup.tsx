import { router } from 'expo-router';
import { AuthScreen } from '@/components/AuthCard';
import { SignupForm } from '@/components/AuthForms';
import { Button } from '@/components/Button';
import { t } from '@/i18n';

export default function Registro() {
  return (
    <AuthScreen title={t('auth.createAccount')}
                footer={<Button label={t('signup.haveAccount')} kind="quiet" onPress={() => router.replace('/login')} />}>
      <SignupForm />
    </AuthScreen>
  );
}
