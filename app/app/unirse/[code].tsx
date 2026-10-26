import { Redirect, useLocalSearchParams } from 'expo-router';

/** Enlaces de invitación antiguos (cyclonomy://unirse/ABC123): llevan a /join */
export default function LegacyJoin() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={`/join/${code ?? ''}`} />;
}
