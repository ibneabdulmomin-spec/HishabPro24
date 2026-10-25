import test from 'node:test';
import assert from 'node:assert/strict';
import type { Account, Business, Contact, Transaction } from './types.ts';
import { summarize, contactPosition, businessReport, validateTransaction, findDuplicate, editTransaction, reverseTransaction, incomeExpenseSeries, budgetProgress, toCsv, LedgerError, type Ctx } from './ledger.ts';
import { parseTakaToPaisa, formatMoney, plainTaka } from './money.ts';

const U = 'u1'; let n = 0;
const accounts: Account[] = [
  { id: 'cash', uid: U, name: 'Cash', kind: 'cash', openingBalance: 100000 },
  { id: 'bk', uid: U, name: 'bKash', kind: 'bkash', openingBalance: 0 }];
const contacts: Contact[] = [{ id: 'rahim', uid: U, name: 'Rahim', kind: 'person' }];
const businesses: Business[] = [{ id: 'shop', uid: U, name: 'Shop', kind: 'business' }];
const mk = (p: Partial<Transaction>): Transaction => ({ id: `t${++n}`, uid: U, date: '2026-10-01', amount: 100, type: 'income', accountId: 'cash', description: '', receiptNo: null, status: 'active', createdAt: `2026-10-01T00:00:${String(n).padStart(2, '0')}Z`, updatedAt: '', history: [], ...p });
const ctx = (transactions: Transaction[]): Ctx => ({ accounts, contacts, businesses, transactions });
const sum = (t: Transaction[], asOf = '2026-10-25') => summarize(accounts, t, asOf);
const code = (f: () => void) => { try { f(); } catch (e) { return (e as LedgerError).code; } return null; };

test('money parsing and Bangladeshi formatting', () => {
  assert.equal(parseTakaToPaisa('১,২৫০.৫'), 125050); assert.equal(parseTakaToPaisa('৳ 10'), 1000);
  assert.equal(parseTakaToPaisa('0.1') + parseTakaToPaisa('0.2'), 30); // no float drift
  for (const bad of ['', '-5', '1.234', 'abc', '1e5']) assert.throws(() => parseTakaToPaisa(bad));
  assert.equal(plainTaka(125050), '1250.50'); assert.equal(formatMoney(12500000, 'en'), '৳1,25,000');
});
test('lending is not an expense; repayment reduces receivable', () => {
  const t = [mk({ type: 'lend', amount: 50000, contactId: 'rahim', dueDate: '2026-10-10' })];
  let s = sum(t); assert.equal(s.personalExpense, 0); assert.equal(s.receivables, 50000); assert.equal(s.balances.cash, 50000); assert.equal(s.overdueReceivables, 50000);
  t.push(mk({ type: 'repay_received', amount: 20000, contactId: 'rahim' }));
  s = sum(t); assert.equal(s.receivables, 30000); assert.equal(s.personalIncome, 0); assert.equal(s.overdueReceivables, 30000); assert.equal(s.balances.cash, 70000);
  t.push(mk({ type: 'repay_received', amount: 30000, contactId: 'rahim' }));
  assert.equal(sum(t).receivables, 0); assert.equal(sum(t).overdueReceivables, 0);
});
test('borrowing is not income; repayment reduces payable', () => {
  const t = [mk({ type: 'borrow', amount: 80000, contactId: 'rahim' }), mk({ type: 'repay_given', amount: 30000, contactId: 'rahim' })];
  const s = sum(t); assert.equal(s.personalIncome, 0); assert.equal(s.personalExpense, 0); assert.equal(s.payables, 50000); assert.equal(s.balances.cash, 100000 + 80000 - 30000);
  const p = contactPosition(t, 'rahim', '2026-10-25'); assert.equal(p.iOwe, 50000); assert.equal(p.owedToMe, 0); assert.equal(p.rows.length, 2);
});
test('over-repayment is rejected, both directions', () => {
  const lend = mk({ type: 'lend', amount: 1000, contactId: 'rahim' });
  assert.equal(code(() => validateTransaction(mk({ type: 'repay_received', amount: 1001, contactId: 'rahim' }), ctx([lend]))), 'OVER_REPAYMENT');
  assert.equal(code(() => validateTransaction(mk({ type: 'repay_given', amount: 1, contactId: 'rahim' }), ctx([lend]))), 'OVER_REPAYMENT');
  assert.equal(code(() => validateTransaction(mk({ type: 'repay_received', amount: 1000, contactId: 'rahim' }), ctx([lend]))), null);
});
test('transfer moves money without income/expense', () => {
  const s = sum([mk({ type: 'transfer', amount: 40000, accountId: 'cash', toAccountId: 'bk' })]);
  assert.equal(s.balances.cash, 60000); assert.equal(s.balances.bk, 40000); assert.equal(s.totalCash, 100000);
  assert.equal(s.personalIncome + s.personalExpense, 0); assert.equal(s.netCashFlow, 0);
  assert.equal(code(() => validateTransaction(mk({ type: 'transfer', accountId: 'cash', toAccountId: 'cash' }), ctx([]))), 'SAME_ACCOUNT');
});
test('investments: loan/equity/expense, returns, profit, loss — no assumed recovery', () => {
  const t = [mk({ type: 'invest', amount: 100000, businessId: 'shop', investmentType: 'equity' }), mk({ type: 'invest', amount: 50000, businessId: 'shop', investmentType: 'loan' }), mk({ type: 'invest', amount: 7000, businessId: 'shop', investmentType: 'expense' })];
  let r = businessReport(t, 'shop'); assert.equal(r.invested, 150000); assert.equal(r.investmentExpense, 7000); assert.equal(r.outstandingPrincipal, 150000);
  t.push(mk({ type: 'capital_return', amount: 20000, businessId: 'shop' }), mk({ type: 'invest_profit', amount: 5000, businessId: 'shop' }), mk({ type: 'invest_loss', amount: 10000, businessId: 'shop' }));
  r = businessReport(t, 'shop'); assert.equal(r.outstandingPrincipal, 130000); assert.equal(r.recordedPnl, -5000); assert.equal(r.netCashResult, 20000 + 5000 - 150000); assert.equal(r.carryingValue, 120000);
  const s = sum(t); assert.equal(s.investedCapital, 150000); assert.equal(s.personalExpense, 0); assert.equal(s.businessExpense, 7000);
  assert.equal(s.balances.cash, 100000 - 157000 + 25000); // loss is non-cash
  assert.equal(s.netWorth, s.totalCash + 120000);
  assert.equal(code(() => validateTransaction(mk({ type: 'capital_return', amount: 150001 - 20000 + 1, businessId: 'shop' }), ctx(t))), 'OVER_RETURN');
  assert.equal(code(() => validateTransaction(mk({ type: 'invest', businessId: 'shop' }), ctx([]))), 'INVESTMENT_TYPE_REQUIRED');
});
test('business income/expense is not double-counted in personal totals', () => {
  const s = sum([mk({ type: 'income', amount: 900, businessId: 'shop' }), mk({ type: 'expense', amount: 400, businessId: 'shop' }), mk({ type: 'income', amount: 500 })]);
  assert.equal(s.personalIncome, 500); assert.equal(s.personalExpense, 0); assert.equal(s.businessIncome, 900); assert.equal(s.businessExpense, 400); assert.equal(s.balances.cash, 100000 + 900 - 400 + 500);
});
test('refunds reduce expense/income; adjustment touches balance only', () => {
  const s = sum([mk({ type: 'expense', amount: 1000 }), mk({ type: 'refund_received', amount: 300 }), mk({ type: 'income', amount: 2000 }), mk({ type: 'refund_given', amount: 500 }), mk({ type: 'adjustment', amount: 50, direction: 'out' })]);
  assert.equal(s.personalExpense, 700); assert.equal(s.personalIncome, 1500); assert.equal(s.balances.cash, 100000 - 1000 + 300 + 2000 - 500 - 50);
});
test('duplicate detection', () => {
  const a = mk({ amount: 777, description: 'Rent' }); assert.ok(findDuplicate(mk({ amount: 777, description: ' rent ' }), [a])); assert.equal(findDuplicate(mk({ amount: 778, description: 'Rent' }), [a]), undefined);
});
test('edit keeps history; reversal keeps record and is excluded; dependent reversal blocked', () => {
  const lend = mk({ type: 'lend', amount: 1000, contactId: 'rahim' }); const rep = mk({ type: 'repay_received', amount: 400, contactId: 'rahim' });
  const e = editTransaction(lend, { amount: 1200 }, U, '2026-10-02T00:00:00Z', ctx([lend, rep]));
  assert.equal(e.history.length, 1); assert.deepEqual(e.history[0].changes.amount, { from: 1000, to: 1200 });
  assert.equal(code(() => editTransaction(lend, { amount: 300 }, U, 'x', ctx([lend, rep]))), 'OVER_REPAYMENT');
  assert.equal(code(() => reverseTransaction(lend, 'oops', U, 'x', ctx([lend, rep]))), 'REVERSAL_BLOCKED');
  const inc = mk({ amount: 900 }); const r = reverseTransaction(inc, 'wrong', U, 'x', ctx([inc]));
  assert.equal(r.status, 'reversed'); assert.equal(r.history.at(-1)!.reason, 'wrong'); assert.equal(sum([r]).balances.cash, 100000);
});
test('series, budgets, csv', () => {
  const t = [mk({ date: '2026-09-30', amount: 100 }), mk({ date: '2026-10-01', type: 'expense', amount: 40, categoryId: 'food' }), mk({ date: '2026-10-02', type: 'expense', amount: 10, categoryId: 'food' })];
  assert.deepEqual(incomeExpenseSeries(t, 'month'), [{ key: '2026-09', income: 100, expense: 0 }, { key: '2026-10', income: 0, expense: 50 }]);
  const b = budgetProgress([{ id: 'b', uid: U, month: '2026-10', categoryId: 'food', limit: 100 }], t, '2026-10'); assert.equal(b[0].spent, 50); assert.equal(b[0].pct, 50);
  assert.equal(toCsv([['=HYPERLINK("x")', 'a,b', 5]]), '\uFEFF"\'=HYPERLINK(""x"")","a,b",5');
});
