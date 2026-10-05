// Formatos según el idioma de la app, sin depender de Intl (no siempre completo en Android)
import { t } from '../i18n';

function thousands(n: number): string {
  const s = Math.round(Math.abs(n)).toString();
  return (n < 0 ? '−' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, t('fmt.thousands'));
}

/** 1.250.000 € */
export function money(v: number | null | undefined): string {
  return v == null ? '—' : t('fmt.money', { n: thousands(v) });
}

/** 1,25 M € · 850.000 € */
export function moneyShort(v: number | null | undefined): string {
  if (v == null) return '—';
  if (Math.abs(v) >= 1_000_000) {
    const m = (Math.abs(v) / 1_000_000).toFixed(2).replace(/0$/, '').replace('.', t('fmt.decimal'));
    return `${v < 0 ? '−' : ''}${t('fmt.millions', { n: m })}`;
  }
  return money(v);
}

export function points(v: number | null | undefined): string {
  return v == null ? '—' : t('fmt.points', { n: thousands(v) });
}

const months = () => t('fmt.months').split(',');
const weekdays = () => t('fmt.weekdays').split(',');

/** 'YYYY-MM-DD' → Date a mediodía local (sin saltos de zona horaria) */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function dayMonth(day: string): string {
  const d = parseDay(day);
  return t('fmt.dayMonth', { d: d.getDate(), mon: months()[d.getMonth()] });
}

export function dateRange(start: string, end: string): string {
  return start === end ? dayMonth(start) : `${dayMonth(start)} – ${dayMonth(end)}`;
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Hora local del dispositivo: 12:15 */
export function time(ts: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** mié 6 mar, 12:15 */
export function dateTime(ts: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return t('fmt.dateTime', { wd: weekdays()[d.getDay()], d: d.getDate(), mon: months()[d.getMonth()], time: time(ts) });
}

/** en 3 h 20 min · en 2 días · ya */
export function countdown(ts: string | null, now = Date.now()): string {
  if (!ts) return '—';
  const diff = new Date(ts).getTime() - now;
  if (diff <= 0) return t('fmt.now');
  const min = Math.floor(diff / 60000);
  if (min < 60) return t('fmt.inMinutes', { m: min });
  const h = Math.floor(min / 60);
  if (h < 48) return t('fmt.inHours', { h, m: min % 60 });
  return t('fmt.inDays', { d: Math.floor(h / 24) });
}

export function ordinal(n: number | null | undefined): string {
  return n == null ? '—' : t('fmt.ordinal', { n });
}

export function parseAmount(text: string): number | null {
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}
