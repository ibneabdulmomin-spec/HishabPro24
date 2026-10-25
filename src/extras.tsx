import { useState } from 'react';
import { updateTransaction, type Data } from './data.ts';
import { editTransaction, LedgerError } from './core/ledger.ts';
import { parseTakaToPaisa, plainTaka } from './core/money.ts';
import type { Transaction } from './core/types.ts';
import type { Lang } from './i18n.ts';

export const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hp:' + s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

export function LockScreen({ lang, onOpen }: { lang: Lang; onOpen: () => void }) {
  const [v, setV] = useState(''); const [bad, setBad] = useState(false);
  const go = async () => { if ((await sha(v)) === localStorage.getItem('hp_pin')) onOpen(); else { setBad(true); setV(''); } };
  return <main className="min-h-screen grid place-items-center p-6"><div className="max-w-xs w-full space-y-4 text-center">
    <h1 className="text-3xl font-bold">Hishab<span className="text-taka">Pro</span></h1><p className="text-mute">{lang === 'bn' ? 'PIN দিয়ে খুলুন' : 'Enter PIN'}</p>
    <input className="field text-center text-2xl tracking-widest" type="password" inputMode="numeric" maxLength={8} value={v} autoFocus onChange={(e) => { setV(e.target.value); setBad(false); }} onKeyDown={(e) => e.key === 'Enter' && go()} />
    {bad && <p className="text-owe text-sm">{lang === 'bn' ? 'PIN ভুল' : 'Wrong PIN'}</p>}
    <button className="btn btn-primary w-full" onClick={go}>{lang === 'bn' ? 'খুলুন' : 'Unlock'}</button></div></main>;
}

export async function managePin(lang: Lang, lock: () => void) {
  const bn = lang === 'bn';
  if (!localStorage.getItem('hp_pin')) { const p = prompt(bn ? 'নতুন PIN দিন (4–8 সংখ্যা)' : 'New PIN (4–8 digits)'); if (p && /^\d{4,8}$/.test(p)) { localStorage.setItem('hp_pin', await sha(p)); alert(bn ? 'PIN চালু হয়েছে' : 'PIN set'); } else if (p) alert(bn ? 'শুধু 4–8 সংখ্যা দিন' : 'Digits only'); return; }
  if (confirm(bn ? 'এখনই লক করবেন? (বাতিল চাপলে PIN বন্ধ/বদলের অপশন আসবে)' : 'Lock now? (Cancel for PIN options)')) return lock();
  if (confirm(bn ? 'PIN বন্ধ করবেন?' : 'Remove PIN?')) localStorage.removeItem('hp_pin');
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Print-ready page: the browser's "Save as PDF" keeps Bengali text exactly (no PDF font embedding problems). */
export function printDoc(title: string, head: string[], rows: string[][], summary: [string, string][]) {
  const w = window.open('', '_blank'); if (!w) { alert('Pop-up blocked'); return; }
  w.document.write(`<!doctype html><html lang="bn"><meta charset="utf-8"><title>${esc(title)}</title><style>
  body{font-family:'Hind Siliguri','Noto Sans Bengali',sans-serif;margin:20px;color:#12242A}h1{margin:0;font-size:22px}h1 span{color:#0E7A5F}.s{color:#5E7077;font-size:12px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid #D5DFDC;padding:6px;text-align:left}th{background:#EEF3F1}td:last-child,th:last-child{text-align:right}
  .sum{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.sum div{border:1px solid #D5DFDC;border-radius:8px;padding:6px 10px;font-size:13px}.sum b{display:block;font-size:15px}</style>
  <h1>Hishab<span>Pro</span></h1><div class="s">${esc(title)} · ${new Date().toLocaleDateString('bn-BD-u-nu-latn')}</div>
  <div class="sum">${summary.map(([k, v]) => `<div>${esc(k)}<b>${esc(v)}</b></div>`).join('')}</div>
  <table><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>
  <script>setTimeout(()=>print(),400)</script></html>`); w.document.close();
}

export function EditSheet({ x, data, lang, uid, onClose, Sheet }: { x: Transaction; data: Data; lang: Lang; uid: string; onClose: () => void; Sheet: React.ComponentType<{ title: string; onClose: () => void; children: React.ReactNode }> }) {
  const bn = lang === 'bn'; const [amount, setA] = useState(plainTaka(x.amount)); const [date, setD] = useState(x.date); const [desc, setDesc] = useState(x.description); const [err, setErr] = useState('');
  async function save() {
    try { await updateTransaction(uid, editTransaction(x, { amount: parseTakaToPaisa(amount), date, description: desc.trim() }, uid, new Date().toISOString(), data)); onClose(); }
    catch (e) { setErr(e instanceof LedgerError ? e.code : bn ? 'সঠিক পরিমাণ লিখুন' : 'Invalid amount'); }
  }
  return <Sheet title={bn ? 'এডিট' : 'Edit'} onClose={onClose}>
    <label className="block text-sm text-mute">{bn ? 'পরিমাণ (৳)' : 'Amount'}<input className="field mt-1 text-ink" inputMode="decimal" value={amount} onChange={(e) => setA(e.target.value)} /></label>
    <label className="block text-sm text-mute">{bn ? 'তারিখ' : 'Date'}<input type="date" className="field mt-1 text-ink" value={date} onChange={(e) => setD(e.target.value)} /></label>
    <label className="block text-sm text-mute">{bn ? 'বিবরণ' : 'Description'}<input className="field mt-1 text-ink" value={desc} maxLength={500} onChange={(e) => setDesc(e.target.value)} /></label>
    {err && <p className="text-owe text-sm">{err}</p>}<p className="text-xs text-mute">{bn ? 'পুরনো মান ইতিহাসে সংরক্ষিত থাকবে।' : 'Old values are kept in history.'}</p>
    <div className="flex gap-2"><button className="btn flex-1" onClick={onClose}>{bn ? 'বাতিল' : 'Cancel'}</button><button className="btn btn-primary flex-1" onClick={save}>{bn ? 'সংরক্ষণ' : 'Save'}</button></div></Sheet>;
}
