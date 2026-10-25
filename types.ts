export type TxType =
  | 'income' | 'expense' | 'lend' | 'borrow' | 'repay_given' | 'repay_received'
  | 'transfer' | 'invest' | 'capital_return' | 'invest_profit' | 'invest_loss'
  | 'refund_received' | 'refund_given' | 'adjustment';
export type InvestmentType = 'loan' | 'equity' | 'expense';
export interface HistoryEntry {
  at: string; by: string; action: 'create' | 'edit' | 'reverse';
  changes: Record<string, { from: unknown; to: unknown }>; reason?: string;
}
/** All amounts are integer paisa (1 BDT = 100 paisa). Dates are 'YYYY-MM-DD' (Asia/Dhaka). */
export interface Transaction {
  id: string; uid: string; date: string; amount: number; type: TxType;
  accountId: string | null; toAccountId?: string | null;
  categoryId?: string | null; contactId?: string | null; businessId?: string | null;
  investmentType?: InvestmentType | null; direction?: 'in' | 'out' | null;
  dueDate?: string | null; description: string; receiptNo: string | null;
  status: 'active' | 'reversed'; createdAt: string; updatedAt: string; history: HistoryEntry[];
}
export interface Account { id: string; uid: string; name: string; kind: 'cash' | 'bank' | 'bkash' | 'nagad' | 'wallet' | 'custom'; openingBalance: number }
export interface Contact { id: string; uid: string; name: string; kind: 'person' | 'organization'; phone?: string; note?: string }
export interface Business { id: string; uid: string; name: string; kind: 'business' | 'company' | 'partner'; agreementNote?: string; maturityDate?: string }
export interface Category { id: string; uid: string; name: string; kind: 'income' | 'expense' }
export interface Budget { id: string; uid: string; month: string; categoryId: string; limit: number }
