import type { Account, Budget, Business, Contact, Transaction, TxType } from './types.ts';
import { MAX_PAISA } from './money.ts';

export class LedgerError extends Error {
  code: string;
  constructor(code: string, message?: string) { super(message ?? code); this.code = code; this.name = 'LedgerError'; }
}
export const TX_TYPES: TxType[] = ['income','expense','lend','borrow','repay_given','repay_received','transfer','invest','capital_return','invest_profit','invest_loss','refund_received','refund_given','adjustment'];
const IN = new Set<TxType>(['income','borrow','repay_received','capital_return','invest_profit','refund_received']);
const OUT = new Set<TxType>(['expense','lend','repay_given','invest','refund_given']);
const CONTACT_TYPES = new Set<TxType>(['lend','borrow','repay_given','repay_received']);
const BUSINESS_TYPES = new Set<TxType>(['invest','capital_return','invest_profit','invest_loss']);

/** Cash movement per account. Transfers move money between accounts; invest_loss is non-cash. */
export function cashEffects(t: Transaction): [string, number][] {
  if (t.type === 'invest_loss') return [];
  if (t.type === 'transfer') return [[t.accountId!, -t.amount], [t.toAccountId!, t.amount]];
  if (t.type === 'adjustment') return [[t.accountId!, t.direction === 'out' ? -t.amount : t.amount]];
  if (IN.has(t.type)) return [[t.accountId!, t.amount]];
  if (OUT.has(t.type)) return [[t.accountId!, -t.amount]];
  throw new LedgerError('BAD_TYPE', `Unknown type ${t.type}`);
}
const sortTx = (a: Transaction[]) => [...a].sort((x, y) => x.date.localeCompare(y.date) || x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id));
const active = (a: Transaction[]) => a.filter((t) => t.status === 'active');

// ---------- contact ledger ----------
export interface ContactPosition {
  owedToMe: number; iOwe: number; overdue: number;
  rows: { tx: Transaction; owedToMe: number; iOwe: number }[];
}
/** Receivable (lend − repay_received) and payable (borrow − repay_given) are tracked separately, never netted. */
export function contactPosition(all: Transaction[], contactId: string, asOf: string): ContactPosition {
  const txs = sortTx(active(all).filter((t) => t.contactId === contactId && CONTACT_TYPES.has(t.type)));
  let owedToMe = 0, iOwe = 0; const lends: { remaining: number; due: string | null }[] = []; const rows: ContactPosition['rows'] = [];
  for (const t of txs) {
    if (t.type === 'lend') { owedToMe += t.amount; lends.push({ remaining: t.amount, due: t.dueDate ?? null }); }
    else if (t.type === 'borrow') iOwe += t.amount;
    else if (t.type === 'repay_given') iOwe -= t.amount;
    else { owedToMe -= t.amount; let left = t.amount; for (const l of lends) { const k = Math.min(l.remaining, left); l.remaining -= k; left -= k; } }
    rows.push({ tx: t, owedToMe, iOwe });
  }
  const overdue = lends.reduce((s, l) => (l.due && l.due < asOf ? s + l.remaining : s), 0);
  return { owedToMe, iOwe, overdue, rows };
}

// ---------- business / investment ----------
export interface BusinessReport {
  invested: number; investedLoan: number; investedEquity: number; investmentExpense: number;
  capitalReturned: number; outstandingPrincipal: number; profitReceived: number; lossRecorded: number;
  recordedPnl: number; netCashResult: number; carryingValue: number;
  businessIncome: number; businessExpense: number; receivable: number; payable: number;
}
export function businessReport(all: Transaction[], businessId: string): BusinessReport {
  const r: BusinessReport = { invested: 0, investedLoan: 0, investedEquity: 0, investmentExpense: 0, capitalReturned: 0, outstandingPrincipal: 0, profitReceived: 0, lossRecorded: 0, recordedPnl: 0, netCashResult: 0, carryingValue: 0, businessIncome: 0, businessExpense: 0, receivable: 0, payable: 0 };
  for (const t of active(all)) {
    if (t.businessId !== businessId) continue;
    switch (t.type) {
      case 'invest':
        if (t.investmentType === 'equity') { r.investedEquity += t.amount; r.invested += t.amount; }
        else if (t.investmentType === 'loan') { r.investedLoan += t.amount; r.invested += t.amount; }
        else { r.investmentExpense += t.amount; r.businessExpense += t.amount; }
        break;
      case 'capital_return': r.capitalReturned += t.amount; break;
      case 'invest_profit': r.profitReceived += t.amount; break;
      case 'invest_loss': r.lossRecorded += t.amount; break;
      case 'income': r.businessIncome += t.amount; break;
      case 'expense': r.businessExpense += t.amount; break;
      case 'refund_received': r.businessExpense -= t.amount; break;
      case 'refund_given': r.businessIncome -= t.amount; break;
      case 'lend': r.receivable += t.amount; break;
      case 'repay_given': r.payable -= t.amount; break;
      case 'borrow': r.payable += t.amount; break;
      case 'repay_received': r.receivable -= t.amount; break;
    }
  }
  r.outstandingPrincipal = r.invested - r.capitalReturned;
  r.recordedPnl = r.profitReceived - r.lossRecorded;
  r.netCashResult = r.capitalReturned + r.profitReceived - r.invested;
  r.carryingValue = Math.max(0, r.outstandingPrincipal - r.lossRecorded); // no assumption of recoverability beyond recorded cost
  return r;
}

// ---------- summary ----------
export interface Summary {
  balances: Record<string, number>; totalCash: number;
  personalIncome: number; personalExpense: number; netSavings: number;
  businessIncome: number; businessExpense: number;
  receivables: number; payables: number; overdueReceivables: number;
  investedCapital: number; capitalReturned: number; investmentProfit: number; investmentLoss: number;
  netCashFlow: number; assets: number; liabilities: number; netWorth: number;
}
/**
 * Net worth = assets − liabilities.
 * assets = Σ account balances + Σ receivables + Σ business investment carrying value
 *          (invested − returned − recorded loss, floored at 0 per business; never marked up).
 * liabilities = Σ payables.
 */
export function summarize(accounts: Account[], all: Transaction[], asOf: string, opts: { from?: string; to?: string } = {}): Summary {
  const txs = active(all);
  const balances: Record<string, number> = {}; for (const a of accounts) balances[a.id] = a.openingBalance;
  for (const t of txs) for (const [id, d] of cashEffects(t)) balances[id] = (balances[id] ?? 0) + d;
  const inRange = (t: Transaction) => (!opts.from || t.date >= opts.from) && (!opts.to || t.date <= opts.to);
  const s: Summary = { balances, totalCash: Object.values(balances).reduce((a, b) => a + b, 0), personalIncome: 0, personalExpense: 0, netSavings: 0, businessIncome: 0, businessExpense: 0, receivables: 0, payables: 0, overdueReceivables: 0, investedCapital: 0, capitalReturned: 0, investmentProfit: 0, investmentLoss: 0, netCashFlow: 0, assets: 0, liabilities: 0, netWorth: 0 };
  for (const t of txs.filter(inRange)) {
    const biz = !!t.businessId;
    if (t.type === 'income') biz ? (s.businessIncome += t.amount) : (s.personalIncome += t.amount);
    if (t.type === 'refund_given') biz ? (s.businessIncome -= t.amount) : (s.personalIncome -= t.amount);
    if (t.type === 'expense') biz ? (s.businessExpense += t.amount) : (s.personalExpense += t.amount);
    if (t.type === 'refund_received') biz ? (s.businessExpense -= t.amount) : (s.personalExpense -= t.amount);
    if (t.type === 'invest') { if (t.investmentType === 'expense') s.businessExpense += t.amount; else s.investedCapital += t.amount; }
    if (t.type === 'capital_return') s.capitalReturned += t.amount;
    if (t.type === 'invest_profit') s.investmentProfit += t.amount;
    if (t.type === 'invest_loss') s.investmentLoss += t.amount;
    if (t.type !== 'transfer') for (const [, d] of cashEffects(t)) s.netCashFlow += d;
  }
  s.netSavings = s.personalIncome - s.personalExpense;
  for (const id of new Set(txs.map((t) => t.contactId).filter(Boolean) as string[])) {
    const p = contactPosition(txs, id, asOf); s.receivables += p.owedToMe; s.payables += p.iOwe; s.overdueReceivables += p.overdue;
  }
  let carrying = 0;
  for (const id of new Set(txs.map((t) => t.businessId).filter(Boolean) as string[])) carrying += businessReport(txs, id).carryingValue;
  s.assets = s.totalCash + s.receivables + carrying; s.liabilities = s.payables; s.netWorth = s.assets - s.liabilities;
  return s;
}

export type Bucket = 'day' | 'month' | 'year';
export function incomeExpenseSeries(all: Transaction[], bucket: Bucket) {
  const len = bucket === 'day' ? 10 : bucket === 'month' ? 7 : 4; const m = new Map<string, { key: string; income: number; expense: number }>();
  for (const t of active(all)) {
    if (t.businessId) continue;
    const d = t.type === 'income' ? [1, 0] : t.type === 'refund_given' ? [-1, 0] : t.type === 'expense' ? [0, 1] : t.type === 'refund_received' ? [0, -1] : null;
    if (!d) continue;
    const key = t.date.slice(0, len); const e = m.get(key) ?? { key, income: 0, expense: 0 };
    e.income += d[0] * t.amount; e.expense += d[1] * t.amount; m.set(key, e);
  }
  return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
}
export function categoryExpenses(all: Transaction[], from: string, to: string) {
  const m: Record<string, number> = {};
  for (const t of active(all)) {
    if (t.businessId || t.date < from || t.date > to) continue;
    const k = t.categoryId ?? 'uncategorized';
    if (t.type === 'expense') m[k] = (m[k] ?? 0) + t.amount; else if (t.type === 'refund_received') m[k] = (m[k] ?? 0) - t.amount;
  }
  return m;
}
export function budgetProgress(budgets: Budget[], all: Transaction[], month: string) {
  const spent = categoryExpenses(all, `${month}-01`, `${month}-31`);
  return budgets.filter((b) => b.month === month).map((b) => ({ budget: b, spent: spent[b.categoryId] ?? 0, pct: b.limit ? Math.round(((spent[b.categoryId] ?? 0) / b.limit) * 100) : 0 }));
}

// ---------- validation ----------
export interface Ctx { accounts: Account[]; contacts: Contact[]; businesses: Business[]; transactions: Transaction[] }
const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;

/** Replays events chronologically and returns human-readable violations (over-repayment, over-return). */
export function integrityViolations(all: Transaction[]): string[] {
  const out: string[] = []; const txs = sortTx(active(all));
  const owed: Record<string, number> = {}, owe: Record<string, number> = {}, inv: Record<string, number> = {}, ret: Record<string, number> = {};
  for (const t of txs) {
    if (t.contactId && CONTACT_TYPES.has(t.type)) {
      const c = t.contactId;
      if (t.type === 'lend') owed[c] = (owed[c] ?? 0) + t.amount;
      if (t.type === 'repay_received') { owed[c] = (owed[c] ?? 0) - t.amount; if (owed[c] < 0) out.push(`OVER_REPAYMENT:${c}:${t.id}`); }
      if (t.type === 'borrow') owe[c] = (owe[c] ?? 0) + t.amount;
      if (t.type === 'repay_given') { owe[c] = (owe[c] ?? 0) - t.amount; if (owe[c] < 0) out.push(`OVER_REPAYMENT:${c}:${t.id}`); }
    }
    if (t.businessId && t.type === 'invest' && t.investmentType !== 'expense') inv[t.businessId] = (inv[t.businessId] ?? 0) + t.amount;
    if (t.businessId && t.type === 'capital_return') { ret[t.businessId] = (ret[t.businessId] ?? 0) + t.amount; if (ret[t.businessId] > (inv[t.businessId] ?? 0)) out.push(`OVER_RETURN:${t.businessId}:${t.id}`); }
  }
  return out;
}

export function validateTransaction(c: Transaction, ctx: Ctx): void {
  const bad = (code: string, msg = code) => { throw new LedgerError(code, msg); };
  if (!TX_TYPES.includes(c.type)) bad('BAD_TYPE');
  if (!Number.isSafeInteger(c.amount) || c.amount <= 0 || c.amount > MAX_PAISA) bad('BAD_AMOUNT', 'Amount must be a positive whole number of paisa');
  if (!isDate(c.date)) bad('BAD_DATE'); if (c.dueDate && !isDate(c.dueDate)) bad('BAD_DATE');
  if (c.description.length > 500) bad('DESC_TOO_LONG');
  const hasAcc = (id?: string | null) => !!id && ctx.accounts.some((a) => a.id === id);
  if (c.type !== 'invest_loss' && !hasAcc(c.accountId)) bad('ACCOUNT_REQUIRED');
  if (c.type === 'transfer') { if (!hasAcc(c.toAccountId)) bad('ACCOUNT_REQUIRED'); if (c.toAccountId === c.accountId) bad('SAME_ACCOUNT'); if (c.contactId || c.businessId || c.categoryId) bad('TRANSFER_NOT_TAGGABLE'); }
  if (c.type === 'adjustment' && c.direction !== 'in' && c.direction !== 'out') bad('DIRECTION_REQUIRED');
  if (CONTACT_TYPES.has(c.type) && !ctx.contacts.some((x) => x.id === c.contactId)) bad('CONTACT_REQUIRED');
  if (BUSINESS_TYPES.has(c.type) && !ctx.businesses.some((x) => x.id === c.businessId)) bad('BUSINESS_REQUIRED');
  if (c.businessId && !ctx.businesses.some((x) => x.id === c.businessId)) bad('BUSINESS_REQUIRED');
  if (c.type === 'invest' && !['loan', 'equity', 'expense'].includes(c.investmentType ?? '')) bad('INVESTMENT_TYPE_REQUIRED');
  if (c.status === 'active') {
    const others = ctx.transactions.filter((t) => t.id !== c.id);
    const before = new Set(integrityViolations(ctx.transactions));
    const v = integrityViolations([...others, c]).filter((x) => !before.has(x));
    if (v.length) bad(v[0].split(':')[0], v[0]);
  }
}

export function fingerprint(t: Transaction): string {
  return [t.date, t.type, t.amount, t.accountId, t.toAccountId, t.contactId, t.businessId, t.receiptNo, t.description.trim().toLowerCase()].join('|');
}
export function findDuplicate(c: Transaction, existing: Transaction[]): Transaction | undefined {
  const f = fingerprint(c); return active(existing).find((t) => t.id !== c.id && fingerprint(t) === f);
}

// ---------- edit / reverse with audit trail ----------
const EDITABLE = ['date','amount','type','accountId','toAccountId','categoryId','contactId','businessId','investmentType','direction','dueDate','description'] as const;
export function editTransaction(t: Transaction, patch: Partial<Pick<Transaction, (typeof EDITABLE)[number]>>, by: string, now: string, ctx: Ctx): Transaction {
  if (t.status === 'reversed') throw new LedgerError('ALREADY_REVERSED');
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of EDITABLE) if (k in patch && (patch as any)[k] !== (t as any)[k]) changes[k] = { from: (t as any)[k] ?? null, to: (patch as any)[k] ?? null };
  if (!Object.keys(changes).length) return t;
  const next: Transaction = { ...t, ...patch, updatedAt: now, history: [...t.history, { at: now, by, action: 'edit', changes }] };
  validateTransaction(next, ctx); return next;
}
/** Reversal keeps the record (never deletes). Blocked if later events depend on it (e.g. repayments of a reversed loan). */
export function reverseTransaction(t: Transaction, reason: string, by: string, now: string, ctx: Ctx): Transaction {
  if (t.status === 'reversed') throw new LedgerError('ALREADY_REVERSED');
  const next: Transaction = { ...t, status: 'reversed', updatedAt: now, history: [...t.history, { at: now, by, action: 'reverse', changes: { status: { from: 'active', to: 'reversed' } }, reason }] };
  const rest = ctx.transactions.filter((x) => x.id !== t.id);
  const before = new Set(integrityViolations(ctx.transactions));
  const v = integrityViolations(rest).filter((x) => !before.has(x));
  if (v.length) throw new LedgerError('REVERSAL_BLOCKED', `Later entries depend on this record (${v[0]})`);
  return next;
}

export const receiptNumber = (year: string, seq: number) => `HP-${year}-${String(seq).padStart(6, '0')}`;

/** CSV with spreadsheet-formula injection guard. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? '' : String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
