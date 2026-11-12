import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CodeInput, PasswordInput } from '@/components/AuthInputs';
import { Button } from '@/components/Button';
import { HeroCard } from '@/components/Hero';
import { Input } from '@/components/Inputs';
import { Sheet } from '@/components/Modal';
import { Screen } from '@/components/Screen';
import { ErrorText, Row, Section } from '@/components/Section';
import { showToast } from '@/components/Toast';
import { Txt } from '@/components/Txt';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { authErrorText, redirectTo } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme';

type Panel = 'email' | 'password' | 'delete' | null;

/** Cuenta y seguridad: correo, contraseña, formas de acceso, sesiones y eliminar la cuenta */
export default function Seguridad() {
  const { session } = useAuth();
  const { selectLeague } = useLeague();
  const user = session?.user;
  const providers = (user?.identities ?? []).map((i) => i.provider);
  const withGoogle = providers.includes('google');
  // con contraseña: quien se dio de alta con el correo o quien la creó después desde aquí
  const hasPassword = providers.includes('email') || user?.user_metadata?.has_password === true;
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // cambiar el correo
  const [newEmail, setNewEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  // cambiar la contraseña
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  // eliminar la cuenta
  const [word, setWord] = useState('');

  const open = (p: Panel) => {
    setPanel(p); setError(null); setNewEmail(''); setEmailSent(false); setEmailCode(''); setCurrent(''); setPassword(''); setWord('');
  };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError(authErrorText((e as Error).message)); }
    setBusy(false);
  }
  const check = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

  const requestEmail = () => run(async () => {
    check((await supabase.auth.updateUser({ email: newEmail.trim() }, { emailRedirectTo: redirectTo })).error);
    setEmailSent(true);
  });
  const confirmEmail = () => run(async () => {
    check((await supabase.auth.verifyOtp({ email: newEmail.trim(), token: emailCode, type: 'email_change' })).error);
    showToast(t('account.emailChanged'));
    setPanel(null);
  });

  const savePassword = () => run(async () => {
    if (password.length < 8) throw new Error(t('auth.passwordShort'));
    if (hasPassword) {
      // como en las apps grandes: para cambiarla hay que saber la actual
      const { error } = await supabase.auth.signInWithPassword({ email: user?.email ?? '', password: current });
      if (error) throw new Error(t('account.wrongPassword'));
    }
    check((await supabase.auth.updateUser({ password, data: { has_password: true } })).error);
    showToast(t('account.passwordChanged'));
    setPanel(null);
  });

  const signOutAll = () => run(async () => {
    await selectLeague(null);
    check((await supabase.auth.signOut({ scope: 'global' })).error);
  });

  const deleteAccount = () => run(async () => {
    await api.deleteAccount();
    showToast(t('account.deleted'));
    await selectLeague(null);
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  });

  return (
    <Screen>
      <HeroCard>
        <Txt variant="display">{t('account.title')}</Txt>
        <Txt variant="small">{user?.email ?? ''}</Txt>
      </HeroCard>

      <Section title={t('account.access')}>
        <Row onPress={() => open('email')}>
          <Ionicons name="mail-outline" size={22} color={colors.ink} />
          <View style={{ flex: 1 }}>
            <Txt variant="lead">{t('account.email')}</Txt>
            <Txt variant="small" numberOfLines={1}>{user?.email ?? ''}</Txt>
          </View>
          <Txt variant="label">{t('account.change')}</Txt>
        </Row>
        <Row onPress={() => open('password')}>
          <Ionicons name="key-outline" size={22} color={colors.ink} />
          <View style={{ flex: 1 }}>
            <Txt variant="lead">{t('auth.password')}</Txt>
            <Txt variant="small">{hasPassword ? '••••••••' : t('account.noPassword')}</Txt>
          </View>
          <Txt variant="label">{hasPassword ? t('account.change') : t('account.create')}</Txt>
        </Row>
        <Row last>
          <Ionicons name="logo-google" size={22} color={colors.ink} />
          <View style={{ flex: 1 }}>
            <Txt variant="lead">Google</Txt>
            <Txt variant="small">{withGoogle ? t('account.linked') : t('account.notLinked')}</Txt>
          </View>
          {withGoogle ? <Ionicons name="checkmark-circle" size={22} color={colors.green} /> : null}
        </Row>
      </Section>

      <Section title={t('account.sessions')}>
        <View style={styles.block}>
          <Txt variant="small">{t('account.signOutAllHint')}</Txt>
          <Button kind="secondary" label={t('account.signOutAll')} onPress={signOutAll} busy={busy && panel === null} />
        </View>
      </Section>

      <Section title={t('account.danger')}>
        <View style={styles.block}>
          <Txt variant="small">{t('account.deleteHint')}</Txt>
          <Button kind="danger" label={t('account.deleteButton')} onPress={() => open('delete')} />
        </View>
      </Section>
      {panel === null ? <ErrorText error={error} /> : null}

      <Sheet visible={panel === 'email'} onClose={() => setPanel(null)} title={t('account.changeEmail')}>
        {emailSent ? (
          <>
            <Txt style={{ marginBottom: space.l }}>{t('account.emailSent', { email: newEmail.trim() })}</Txt>
            <CodeInput label={t('auth.code')} value={emailCode} onChange={setEmailCode} />
            <ErrorText error={error} />
            <Button label={t('auth.verify')} onPress={confirmEmail} busy={busy} disabled={emailCode.length < 6} />
          </>
        ) : (
          <>
            <Input label={t('account.newEmail')} value={newEmail} onChangeText={setNewEmail} autoCapitalize="none"
                   keyboardType="email-address" autoComplete="email" />
            <ErrorText error={error} />
            <Button label={t('account.changeEmail')} onPress={requestEmail} busy={busy}
                    disabled={!newEmail.includes('@') || newEmail.trim() === user?.email} />
          </>
        )}
        <Button label={t('common.cancel')} kind="quiet" onPress={() => setPanel(null)} style={{ marginTop: space.s }} />
      </Sheet>

      <Sheet visible={panel === 'password'} onClose={() => setPanel(null)}
             title={hasPassword ? t('account.changePassword') : t('account.createPassword')}>
        {hasPassword ? (
          <PasswordInput label={t('account.currentPassword')} value={current} onChangeText={setCurrent}
                         autoComplete="current-password" textContentType="password" />
        ) : <Txt variant="small" style={{ marginBottom: space.l }}>{t('account.noPasswordHint')}</Txt>}
        <PasswordInput label={t('account.newPassword')} value={password} onChangeText={setPassword} meter
                       hint={t('auth.min8')} autoComplete="new-password" textContentType="newPassword" />
        <ErrorText error={error} />
        <Button label={t('common.save')} onPress={savePassword} busy={busy} disabled={!password || (hasPassword && !current)} />
        <Button label={t('common.cancel')} kind="quiet" onPress={() => setPanel(null)} style={{ marginTop: space.s }} />
      </Sheet>

      <Sheet visible={panel === 'delete'} onClose={() => setPanel(null)} title={t('account.danger')}>
        <Txt style={{ marginBottom: space.m }}>{t('account.deleteHint')}</Txt>
        <Input label={t('account.deleteConfirm', { word: t('account.deleteWord') })} value={word} onChangeText={setWord}
               autoCapitalize="characters" autoCorrect={false} />
        <ErrorText error={error} />
        <Button kind="danger" label={t('account.deleteButton')} onPress={deleteAccount} busy={busy}
                disabled={word.trim().toUpperCase() !== t('account.deleteWord').toUpperCase()} />
        <Button label={t('common.cancel')} kind="quiet" onPress={() => setPanel(null)} style={{ marginTop: space.s }} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { padding: space.l, gap: space.m },
});
