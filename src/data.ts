import { collection, doc, onSnapshot, runTransaction, setDoc, addDoc, getDocs, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from './firebase.ts';
import { receiptNumber } from './core/ledger.ts';
import type { Account, Budget, Business, Category, Contact, Transaction } from './core/types.ts';

export interface Data { accounts: Account[]; contacts: Contact[]; businesses: Business[]; categories: Category[]; budgets: Budget[]; transactions: Transaction[]; ready: boolean }
const empty: Data = { accounts: [], contacts: [], businesses: [], categories: [], budgets: [], transactions: [], ready: false };
const COLS = ['accounts', 'contacts', 'businesses', 'categories', 'budgets', 'transactions'] as const;

/** Live, user-scoped subscriptions. Every path starts with users/{uid}; rules enforce the same on the server. */
export function useData(uid: string | null): Data {
  const [d, setD] = useState<Data>(empty);
  useEffect(() => {
    if (!uid) { setD(empty); return; }
    const seen = new Set<string>();
    const unsubs = COLS.map((c) => onSnapshot(collection(db, 'users', uid, c), (snap) => {
      seen.add(c);
      setD((p) => ({ ...p, [c]: snap.docs.map((x) => x.data()) as never, ready: seen.size === COLS.length }));
    }, (e) => console.error(c, e)));
    return () => unsubs.forEach((u) => u());
  }, [uid]);
  return d;
}

export const newId = () => crypto.randomUUID();
export const saveEntity = (uid: string, col: 'accounts' | 'contacts' | 'businesses' | 'categories' | 'budgets', e: { id: string }) =>
  setDoc(doc(db, 'users', uid, col, e.id), { ...e, uid });

export async function seedCategories(uid: string) {
  const snap = await getDocs(collection(db, 'users', uid, 'categories')); if (!snap.empty) return;
  const b = writeBatch(db);
  const seed: [string, 'income' | 'expense'][] = [['বেতন / Salary', 'income'], ['ব্যবসা / Business', 'income'], ['খাবার / Food', 'expense'], ['যাতায়াত / Transport', 'expense'], ['বাসা ভাড়া / Rent', 'expense'], ['বিল / Bills', 'expense'], ['স্বাস্থ্য / Health', 'expense'], ['শিক্ষা / Education', 'expense']];
  for (const [name, kind] of seed) { const id = newId(); b.set(doc(db, 'users', uid, 'categories', id), { id, uid, name, kind }); }
  await b.commit();
}

/** Atomic create: receipt counter + transaction + receipt + audit log commit together. The doc id is the client-generated
 *  idempotency key, so a retried/double-tapped submit cannot create a second record. */
export async function createTransaction(uid: string, t: Transaction): Promise<void> {
  const tRef = doc(db, 'users', uid, 'transactions', t.id), cRef = doc(db, 'users', uid, 'meta', 'counters');
  await runTransaction(db, async (tx) => {
    if ((await tx.get(tRef)).exists()) return;
    const c = await tx.get(cRef); const seq = (c.exists() ? (c.data().receipt as number) : 0) + 1;
    const receiptNo = receiptNumber(t.date.slice(0, 4), seq);
    tx.set(cRef, { receipt: seq }); tx.set(tRef, { ...t, receiptNo });
    tx.set(doc(db, 'users', uid, 'receipts', t.id), { id: t.id, uid, receiptNo, txId: t.id, createdAt: t.createdAt });
    tx.set(doc(collection(db, 'users', uid, 'auditLogs')), { uid, txId: t.id, action: 'create', at: t.createdAt });
  });
}
/** Edit or reversal: the new version already carries one extra history entry (see core/ledger.ts). */
export async function updateTransaction(uid: string, t: Transaction): Promise<void> {
  const b = writeBatch(db);
  b.set(doc(db, 'users', uid, 'transactions', t.id), t);
  b.set(doc(collection(db, 'users', uid, 'auditLogs')), { uid, txId: t.id, action: t.history[t.history.length - 1].action, at: t.updatedAt });
  await b.commit();
}
