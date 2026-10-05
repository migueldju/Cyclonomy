import type es from './locales/es';

export type Key = keyof typeof es;
export type Dict = Record<Key, string>;
