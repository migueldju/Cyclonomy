// Declaraciones mínimas para comprobar la app con tsc sin node_modules (entorno sin acceso a npm).
// No sustituyen a los tipos reales: los componentes de librerías aceptan cualquier prop.
declare namespace JSX {
  interface Element {}
  interface ElementClass {}
  interface ElementAttributesProperty { props: {} }
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicAttributes { key?: string | number | null }
  interface IntrinsicElements { [k: string]: any }
}
declare module 'react' {
  export type ReactNode = any;
  export interface Context<T> { Provider: any }
  export function createContext<T>(v: T): Context<T>;
  export function useContext<T>(c: Context<T>): T;
  export function useState<T>(init: T | (() => T)): [T, (v: T | ((prev: T) => T)) => void];
  export function useEffect(fn: () => void | (() => void), deps?: unknown[]): void;
  export function useCallback<T extends (...a: any[]) => any>(fn: T, deps: unknown[]): T;
  export function useMemo<T>(fn: () => T, deps: unknown[]): T;
  export function useRef<T>(init: T | null): { current: T | null };
}
declare module 'react/jsx-runtime' { export const jsx: any; export const jsxs: any; export const Fragment: any; }
declare module 'react-native' {
  export const View: any, Text: any, Pressable: any, ScrollView: any, Image: any, TextInput: any, Switch: any,
    Modal: any, KeyboardAvoidingView: any, ActivityIndicator: any, RefreshControl: any;
  export class FlatList<T = any> { props: any; scrollToIndex(p: { index: number; animated?: boolean }): void;
    scrollToOffset(p: { offset: number; animated?: boolean }): void; }
  export type TextProps = { style?: any; children?: any; numberOfLines?: number; accessibilityRole?: string; [k: string]: any };
  export type TextInputProps = { style?: any; [k: string]: any };
  export type ViewStyle = any;
  export const StyleSheet: { create<T>(s: T): T; hairlineWidth: number };
  export const Platform: { OS: 'ios' | 'android' | 'web' };
  export const AppState: { addEventListener(e: string, cb: (s: string) => void): void };
  export const Share: { share(c: { message: string }): Promise<unknown> };
}
declare module 'expo-router' {
  export const router: { push(h: string): void; replace(h: string): void; navigate(h: string): void; back(): void;
    canDismiss(): boolean; dismissAll(): void };
  export const Stack: any, Tabs: any, Link: any;
  export function useSegments(): string[];
  export function useLocalSearchParams<T>(): Partial<T>;
  export function useFocusEffect(cb: () => void | (() => void)): void;
}
declare module '@expo/vector-icons' { export const Ionicons: any & { glyphMap: Record<string, number> }; }
declare module 'react-native-safe-area-context' {
  export const SafeAreaProvider: any;
  export function useSafeAreaInsets(): { top: number; bottom: number; left: number; right: number };
}
declare module 'expo-splash-screen' { export function preventAutoHideAsync(): Promise<void>; export function hideAsync(): Promise<void>; }
declare module 'expo-status-bar' { export const StatusBar: any; }
declare module '@expo-google-fonts/barlow' {
  export const Barlow_400Regular: any, Barlow_500Medium: any, Barlow_600SemiBold: any;
  export function useFonts(m: Record<string, any>): [boolean, Error | null];
}
declare module '@expo-google-fonts/barlow-condensed' { export const BarlowCondensed_600SemiBold: any, BarlowCondensed_700Bold: any; }
declare module '@supabase/supabase-js' {
  export interface Session { user: { id: string; email?: string } }
  export function createClient(url: string, key: string, opts?: any): any;
}
declare module '@react-native-async-storage/async-storage' {
  const s: { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void>; removeItem(k: string): Promise<void> };
  export default s;
}
declare module 'react-native-url-polyfill/auto' {}
declare module 'expo-auth-session' { export function makeRedirectUri(o: { scheme?: string; path?: string }): string; }
declare module 'expo-web-browser' {
  export function maybeCompleteAuthSession(): void;
  export function openAuthSessionAsync(url: string, redirect: string): Promise<{ type: string; url: string }>;
}
declare module 'expo-linking' { export function useURL(): string | null; }
declare module 'expo-image-picker' {
  export function launchImageLibraryAsync(o: any): Promise<{ canceled: boolean; assets: { uri: string; mimeType?: string }[] }>;
}
declare const process: { env: Record<string, string | undefined> };
