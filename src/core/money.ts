export const MAX_PAISA = 1e13 * 100; // 10 trillion BDT, far below 2^53
const BN = '০১২৩৪৫৬৭৮৯';

/** Parse "১,২৫০.৫০" / "1250.5" / "৳1,250" into integer paisa. Throws on bad input. */
export function parseTakaToPaisa(input: string): number {
  const s = input.replace(/[০-৯]/g, (d) => String(BN.indexOf(d))).replace(/[,\s৳]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('INVALID_AMOUNT');
  const [w, f = ''] = s.split('.');
  const p = Number(w) * 100 + Number((f + '00').slice(0, 2));
  if (!Number.isSafeInteger(p) || p > MAX_PAISA) throw new Error('INVALID_AMOUNT');
  return p;
}
export function plainTaka(p: number): string {
  const sign = p < 0 ? '-' : ''; const a = Math.abs(p);
  return `${sign}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}
/** Bangladeshi lakh/crore grouping done manually (ICU support varies): bn → ৳১,২৫,০০০.৫০ ; en → ৳1,25,000.50 */
export function formatMoney(p: number, lang: 'bn' | 'en' = 'bn'): string {
  const neg = p < 0; const a = Math.abs(p); const whole = String(Math.floor(a / 100)); const frac = a % 100;
  const head = whole.slice(0, -3), tail = whole.slice(-3);
  const grouped = (head ? head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : '') + tail;
  let out = grouped + (frac ? '.' + String(frac).padStart(2, '0') : '');
  return `${neg ? '-' : ''}৳${out}`;
}
export function todayDhaka(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(now);
}
export function formatDate(d: string, lang: 'bn' | 'en' = 'bn'): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, day)));
}
