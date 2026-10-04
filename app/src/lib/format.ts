// Formatos en español sin depender de Intl (no siempre completo en Android)

function thousands(n: number): string {
  const s = Math.round(Math.abs(n)).toString();
  return (n < 0 ? '−' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 1.250.000 € */
export function money(v: number | null | undefined): string {
  return v == null ? '—' : `${thousands(v)} €`;
}

/** 1,25 M € · 850.000 € */
export function moneyShort(v: number | null | undefined): string {
  if (v == null) return '—';
  if (Math.abs(v) >= 1_000_000) {
    const m = (Math.abs(v) / 1_000_000).toFixed(2).replace(/0$/, '').replace('.', ',');
    return `${v < 0 ? '−' : ''}${m} M €`;
  }
  return money(v);
}

export function points(v: number | null | undefined): string {
  return v == null ? '—' : `${thousands(v)} pts`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** 'YYYY-MM-DD' → Date a mediodía local (sin saltos de zona horaria) */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function dayMonth(day: string): string {
  const d = parseDay(day);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
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
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${time(ts)}`;
}

/** en 3 h 20 min · en 2 días · cerrado */
export function countdown(ts: string | null, now = Date.now()): string {
  if (!ts) return '—';
  const diff = new Date(ts).getTime() - now;
  if (diff <= 0) return 'ya';
  const min = Math.floor(diff / 60000);
  if (min < 60) return `en ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `en ${h} h ${min % 60} min`;
  return `en ${Math.floor(h / 24)} días`;
}

export function ordinal(n: number | null | undefined): string {
  return n == null ? '—' : `${n}.º`;
}

export function parseAmount(text: string): number | null {
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}
