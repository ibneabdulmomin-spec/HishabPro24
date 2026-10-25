import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, google } from './firebase.ts';
import { createTransaction, newId, saveEntity, seedCategories, updateTransaction, useData, type Data } from './data.ts';
import { tr, type Lang } from './i18n.ts';
import { formatDate, formatMoney, parseTakaToPaisa, plainTaka, todayDhaka } from './core/money.ts';
import { businessReport, contactPosition, findDuplicate, incomeExpenseSeries, LedgerError, reverseTransaction, summarize, toCsv, validateTransaction } from './core/ledger.ts';
import type { Transaction, TxType } from './core/types.ts';
import { EntityHead } from './ui.tsx';
import { currentFont, nextFont } from './fonts.ts';
import { EditSheet, LockScreen, managePin, printDoc } from './extras.tsx';

const QUICK: [TxType, string][] = [['income', '＋'], ['expense', '－'], ['lend', '↗'], ['repay_received', '↙'], ['transfer', '⇄'], ['invest', '▲']];
const ALL_TYPES: TxType[] = ['income','expense','lend','borrow','repay_given','repay_received','transfer','invest','capital_return','invest_profit','invest_loss','refund_received','refund_given','adjustment'];
const CONTACT = ['lend','borrow','repay_given','repay_received']; const BIZ = ['invest','capital_return','invest_profit','invest_loss'];
const POSITIVE = ['income','borrow','repay_received','capital_return','invest_profit','refund_received'];

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [lang, setLang] = useState<Lang>((localStorage.getItem('hp_lang') as Lang) || 'bn'); // UI preference only, never financial data
  const [dark, setDark] = useState(localStorage.getItem('hp_dark') === '1');
  const [tab, setTab] = useState<'home' | 'people' | 'biz' | 'accounts'>('home');
  const [form, setForm] = useState<TxType | null>(null);
  const [, setFont] = useState(currentFont()); const [locked, setLocked] = useState(!!localStorage.getItem('hp_pin')); const [priv, setPriv] = useState(localStorage.getItem('hp_priv') === '1');
  const t = (k: string) => tr(lang, k);
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); if (u) seedCategories(u.uid).catch(console.error); }), []);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('hp_dark', dark ? '1' : '0'); }, [dark]);
  useEffect(() => { document.documentElement.lang = lang; localStorage.setItem('hp_lang', lang); }, [lang]);
  const data = useData(user?.uid ?? null);

  if (user === undefined) return <p className="p-8 text-mute">{t('loading')}</p>;
  if (!user) return (
    <main className="login-bg min-h-screen grid place-items-center p-6 relative overflow-hidden">
      <span className="orb" style={{ top: '-60px', left: '-50px', width: 220, height: 220 }} /><span className="orb o2" style={{ bottom: '-70px', right: '-60px', width: 260, height: 260 }} />
      <div className="relative max-w-sm w-full text-center text-white rise">
        <div className="logo mx-auto mb-5">H</div>
        <h1 className="text-4xl font-bold tracking-tight">Hishab<span style={{ color: '#9BE3C8' }}>Pro</span></h1>
        <p className="mt-1 opacity-90">{t('tagline')}</p>
        <div className="mt-8 rounded-3xl bg-white/95 text-ink p-5 shadow-2xl space-y-4">
          <button className="gbtn" onClick={() => signInWithPopup(auth, google)}>
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
            {t('signIn')}</button>
          <p className="text-xs text-mute">🔒 {t('signInSub')}</p></div>
        <p className="mt-5 text-sm opacity-90">{lang === 'bn' ? 'পাওনা-দেনা · আয়-ব্যয় · বিনিয়োগ · PDF রিপোর্ট' : 'Debts · Income & expense · Investments · PDF reports'}</p>
        <button className="mt-4 text-sm underline opacity-90" onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}>{lang === 'bn' ? 'English' : 'বাংলা'}</button></div></main>);

  if (locked) return <LockScreen lang={lang} onOpen={() => setLocked(false)} />;
  return (
    <div className={`mx-auto max-w-3xl pb-24 ${priv ? 'priv' : ''}`}>
      <header className="flex items-center justify-between gap-2 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="min-w-0"><h1 className="text-xl font-bold tracking-tight leading-none">Hishab<span className="text-taka">Pro</span></h1><div className="text-[11px] text-mute mt-0.5">{t('tagline')}</div></div>
        <div className="flex shrink-0 gap-2 text-sm">
          <button className="btn !px-2.5 !py-2 text-sm shrink-0" onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}>{lang === 'bn' ? 'EN' : 'বাং'}</button>
          <button className="btn !px-2.5 !py-2 text-sm shrink-0" aria-label={t('theme')} onClick={() => setDark(!dark)}>{dark ? '☀' : '☾'}</button>
          <button className="btn !px-2.5 !py-2 text-sm shrink-0" aria-label="font" onClick={() => setFont(nextFont())}>Aa</button>
          <button className="btn !px-2.5 !py-2 text-sm shrink-0" aria-label="privacy" onClick={() => { localStorage.setItem('hp_priv', priv ? '0' : '1'); setPriv(!priv); }}>{priv ? '🙈' : '👁'}</button>
          <button className="btn !px-2.5 !py-2 text-sm shrink-0" aria-label="PIN" onClick={() => managePin(lang, () => setLocked(true))}>🔒</button>
          <button className="btn !px-2.5 !py-2 text-sm shrink-0" onClick={() => signOut(auth)}>⎋</button></div></header>
      {!data.ready ? <p className="p-4 text-mute">{t('loading')}</p> :
        tab === 'home' ? <Home data={data} lang={lang} onQuick={setForm} /> :
        tab === 'people' ? <People data={data} lang={lang} uid={user.uid} /> :
        tab === 'biz' ? <Biz data={data} lang={lang} uid={user.uid} /> : <Accounts data={data} lang={lang} uid={user.uid} />}
      <nav className="fixed bottom-0 inset-x-0 border-t border-line bg-card grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {([['home', lang === 'bn' ? 'ড্যাশবোর্ড' : 'Home'], ['people', lang === 'bn' ? 'খাতা' : 'Ledger'], ['biz', t('business')], ['accounts', t('accounts')]] as const).map(([k, l]) =>
          <button key={k} onClick={() => setTab(k)} className={`py-3 text-sm ${tab === k ? 'text-taka font-semibold' : 'text-mute'}`}>{l}</button>)}</nav>
      {form && <TxForm type={form} data={data} lang={lang} uid={user.uid} onClose={() => setForm(null)} />}
    </div>);
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-2xl bg-card border border-line p-3"><div className="text-xs text-mute">{label}</div><div className={`num text-lg ${tone ?? ''}`}>{value}</div></div>;
}

function Home({ data, lang, onQuick }: { data: Data; lang: Lang; onQuick: (t: TxType) => void }) {
  const t = (k: string) => tr(lang, k); const m = (p: number) => formatMoney(p, lang);
  const today = todayDhaka(); const month = today.slice(0, 7); const bn = lang === 'bn';
  const [per, setPer] = useState<'today' | 'month' | 'all'>('month'); const [q, setQ] = useState('');
  const range = per === 'today' ? { from: today, to: today } : per === 'month' ? { from: `${month}-01`, to: `${month}-31` } : {}; const plabel = per === 'today' ? (bn ? 'আজ' : 'Today') : per === 'month' ? month : (bn ? 'মোট' : 'All');
  const all = useMemo(() => summarize(data.accounts, data.transactions, today), [data, today]);
  const mon = useMemo(() => summarize(data.accounts, data.transactions, today, range), [data, today, per]);
  const series = useMemo(() => incomeExpenseSeries(data.transactions, 'month').slice(-6), [data.transactions]);
  const recent = useMemo(() => [...data.transactions].filter((x) => !q.trim() || [x.description, x.receiptNo, name(data.contacts, x.contactId), name(data.businesses, x.businessId), t('t_' + x.type), plainTaka(x.amount)].join(' ').toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, q ? 100 : 20), [data.transactions, q]);
  const soon = useMemo(() => { const lim = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10); return data.transactions.filter((x) => x.status === 'active' && x.type === 'lend' && x.dueDate && x.dueDate <= lim && contactPosition(data.transactions, x.contactId ?? '', today).owedToMe > 0).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)).slice(0, 5); }, [data.transactions, today]);
  const max = Math.max(1, ...series.flatMap((s) => [s.income, s.expense]));
  return (<div className="px-4 space-y-4">
    <section className="rounded-3xl p-5" style={{ background: 'var(--taka)', color: 'var(--paper)' }}>
      <div className="text-sm opacity-80">{t('cash')}</div><div className="num text-4xl">{m(all.totalCash)}</div>
      <div className="mt-2 text-sm opacity-90">{t('networth')}: <span className="num">{m(all.netWorth)}</span></div></section>
    <div className="grid grid-cols-3 gap-2">{QUICK.map(([ty, ic]) => <button key={ty} className="btn flex flex-col items-center gap-1 px-1 text-xs" onClick={() => onQuick(ty)}><span className="text-lg">{ic}</span>{t('t_' + ty)}</button>)}</div>
    {soon.length > 0 && <section className="rounded-2xl border border-line bg-card p-3 text-sm space-y-1"><div className="font-semibold text-warn">{bn ? '⏰ তাগাদার সময়' : '⏰ Due soon'}</div>{soon.map((x) => <div key={x.id} className="flex justify-between"><span>{name(data.contacts, x.contactId)}</span><span className={x.dueDate! < today ? 'text-owe' : 'text-mute'}>{formatDate(x.dueDate!, lang)} · <span className="num">{m(x.amount)}</span></span></div>)}</section>}
    <div className="grid grid-cols-3 gap-2">{([['today', bn ? 'আজ' : 'Today'], ['month', bn ? 'এই মাস' : 'Month'], ['all', bn ? 'মোট' : 'All']] as const).map(([k, l]) => <button key={k} className={`btn ${per === k ? 'btn-primary' : ''}`} onClick={() => setPer(k)}>{l}</button>)}</div>
    <div className="grid grid-cols-2 gap-2">
      <Stat label={`${t('income')} (${plabel})`} value={m(mon.personalIncome)} tone="text-taka" /><Stat label={`${t('expense')} (${plabel})`} value={m(mon.personalExpense)} tone="text-owe" />
      <Stat label={t('savings')} value={m(mon.netSavings)} /><Stat label={t('cashflow')} value={m(mon.netCashFlow)} />
      <Stat label={t('receivable')} value={m(all.receivables)} /><Stat label={t('payable')} value={m(all.payables)} tone="text-owe" />
      <Stat label={t('overdue')} value={m(all.overdueReceivables)} tone="text-warn" /><Stat label={t('invested')} value={m(all.investedCapital)} />
      <Stat label={t('returned')} value={m(all.capitalReturned)} /><Stat label={`${t('profit')} / ${t('loss')}`} value={`${m(all.investmentProfit)} / ${m(all.investmentLoss)}`} /></div>
    <section className="rounded-2xl bg-card border border-line p-3"><div className="text-sm text-mute mb-2">{t('chart')}</div>
      {series.length === 0 ? <p className="text-sm text-mute">{t('empty')}</p> :
        <svg viewBox={`0 0 ${series.length * 60} 120`} className="w-full" role="img" aria-label={t('chart')}>{series.map((s, i) => <g key={s.key}>
          <rect x={i * 60 + 8} y={100 - (s.income / max) * 90} width="20" height={(s.income / max) * 90} fill="var(--taka)" rx="3" />
          <rect x={i * 60 + 32} y={100 - (Math.max(0, s.expense) / max) * 90} width="20" height={(Math.max(0, s.expense) / max) * 90} fill="var(--owe)" rx="3" />
          <text x={i * 60 + 30} y="115" textAnchor="middle" fontSize="9" fill="var(--mute)">{s.key.slice(2)}</text></g>)}</svg>}</section>
    <section><input className="field mb-2" placeholder={bn ? '🔍 খুঁজুন: নাম, বিবরণ, পরিমাণ, রসিদ' : '🔍 Search'} value={q} onChange={(e) => setQ(e.target.value)} /><div className="flex justify-between items-center mb-2"><h2 className="font-semibold">{t('recent')}</h2>
      <div className="flex gap-2"><button className="btn text-xs" onClick={() => { const rows = data.transactions.filter((x) => x.status === 'active' && (!range.from || x.date >= range.from) && (!range.to || x.date <= range.to)).sort((a, b) => a.date.localeCompare(b.date)).map((x) => [formatDate(x.date, lang), t('t_' + x.type), [name(data.contacts, x.contactId), name(data.businesses, x.businessId), x.description].filter(Boolean).join(' · '), formatMoney(x.amount, lang)]); printDoc((bn ? 'রিপোর্ট — ' : 'Report — ') + plabel, [bn ? 'তারিখ' : 'Date', bn ? 'ধরন' : 'Type', bn ? 'বিবরণ' : 'Details', bn ? 'টাকা' : 'Amount'], rows, [[t('income'), m(mon.personalIncome)], [t('expense'), m(mon.personalExpense)], [t('savings'), m(mon.netSavings)], [t('receivable'), m(all.receivables)], [t('payable'), m(all.payables)], [t('cash'), m(all.totalCash)]]); }}>PDF</button><button className="btn text-xs" onClick={() => download('hisabpro-transactions.csv', toCsv([['id', 'date', 'type', 'amount_bdt', 'account', 'contact', 'business', 'description', 'receipt', 'status'], ...data.transactions.map((x) => [x.id, x.date, x.type, plainTaka(x.amount), name(data.accounts, x.accountId), name(data.contacts, x.contactId), name(data.businesses, x.businessId), x.description, x.receiptNo, x.status])]), 'text/csv')}>{t('exportCsv')}</button>
        <button className="btn text-xs" onClick={() => download('hisabpro-backup.json', JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...data, ready: undefined }, null, 2), 'application/json')}>{t('backup')}</button></div></div>
      {recent.length === 0 ? <p className="text-mute text-sm">{t('empty')}</p> : <ul className="space-y-2">{recent.map((x) => <TxRow key={x.id} x={x} data={data} lang={lang} />)}</ul>}</section>
  </div>);
}
const name = (a: { id: string; name: string }[], id?: string | null) => a.find((x) => x.id === id)?.name ?? '';
function download(file: string, text: string, mime: string) { const u = URL.createObjectURL(new Blob([text], { type: mime })); const a = document.createElement('a'); a.href = u; a.download = file; a.click(); URL.revokeObjectURL(u); }

function TxRow({ x, data, lang }: { x: Transaction; data: Data; lang: Lang }) {
  const t = (k: string) => tr(lang, k); const uid = x.uid; const [ed, setEd] = useState(false);
  const sign = x.type === 'transfer' || x.type === 'invest_loss' ? '' : POSITIVE.includes(x.type) || (x.type === 'adjustment' && x.direction === 'in') ? '+' : '−';
  async function reverse() {
    if (!confirm(t('reverseAsk'))) return; const reason = prompt(t('reasonAsk')) ?? ''; if (!reason.trim()) return;
    try { await updateTransaction(uid, reverseTransaction(x, reason.trim(), uid, new Date().toISOString(), data)); } catch (e) { alert(t((e as LedgerError).code ?? 'ERR')); }
  }
  return <li className={`rounded-2xl bg-card border border-line p-3 flex justify-between gap-3 ${x.status === 'reversed' ? 'opacity-50' : ''}`}>
    <div className="min-w-0"><div className="font-medium">{t('t_' + x.type)} {x.status === 'reversed' && <span className="text-xs text-owe">({t('reversed')})</span>}</div>
      <div className="text-xs text-mute truncate">{formatDate(x.date, lang)} · {name(data.accounts, x.accountId)}{x.contactId ? ` · ${name(data.contacts, x.contactId)}` : ''}{x.businessId ? ` · ${name(data.businesses, x.businessId)}` : ''}</div>
      {x.description && <div className="text-sm truncate">{x.description}</div>}<div className="text-xs text-mute">{x.receiptNo}</div></div>
    <div className="text-right"><div className={`num ${sign === '+' ? 'text-taka' : sign === '−' ? 'text-owe' : ''}`}>{sign}{formatMoney(x.amount, lang)}</div>
      {x.status === 'active' && <div className="flex gap-2 justify-end text-xs text-mute underline"><button onClick={() => setEd(true)}>{lang === 'bn' ? 'এডিট' : 'Edit'}</button><button onClick={() => printDoc((lang === 'bn' ? 'রসিদ ' : 'Receipt ') + x.receiptNo, [lang === 'bn' ? 'বিষয়' : 'Item', lang === 'bn' ? 'মান' : 'Value'], [[lang === 'bn' ? 'তারিখ' : 'Date', formatDate(x.date, lang)], [lang === 'bn' ? 'ধরন' : 'Type', t('t_' + x.type)], [lang === 'bn' ? 'অ্যাকাউন্ট' : 'Account', name(data.accounts, x.accountId)], [lang === 'bn' ? 'ব্যক্তি/ব্যবসা' : 'Party', name(data.contacts, x.contactId) || name(data.businesses, x.businessId)], [lang === 'bn' ? 'বিবরণ' : 'Note', x.description], [lang === 'bn' ? 'টাকা' : 'Amount', formatMoney(x.amount, lang)]], [[lang === 'bn' ? 'রসিদ নং' : 'Receipt', x.receiptNo ?? '']])}>{lang === 'bn' ? 'রসিদ' : 'Receipt'}</button><button onClick={reverse}>{t('reverse')}</button></div>}
      {ed && <EditSheet x={x} data={data} lang={lang} uid={uid} onClose={() => setEd(false)} Sheet={Sheet} />}</div></li>;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-20 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}><div role="dialog" aria-label={title} className="bg-paper w-full max-w-md max-h-[92vh] overflow-auto rounded-t-3xl sm:rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}><h2 className="text-lg font-semibold">{title}</h2>{children}</div></div>;
}
const Sel = ({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) =>
  <label className="block text-sm text-mute">{label}<select className="field mt-1 text-ink" value={value} onChange={(e) => onChange(e.target.value)}>{children}</select></label>;

function TxForm({ type: t0, data, lang, uid, onClose }: { type: TxType; data: Data; lang: Lang; uid: string; onClose: () => void }) {
  const t = (k: string) => tr(lang, k);
  const [id] = useState(newId); // idempotency key: one id per opened form
  const [type, setType] = useState<TxType>(t0); const [date, setDate] = useState(todayDhaka()); const [amount, setAmount] = useState('');
  const [accountId, setAcc] = useState(data.accounts[0]?.id ?? ''); const [toAccountId, setTo] = useState(''); const [contactId, setContact] = useState(''); const [businessId, setBiz] = useState('');
  const [categoryId, setCat] = useState(''); const [description, setDesc] = useState(''); const [dueDate, setDue] = useState(''); const [investmentType, setInv] = useState('equity'); const [direction, setDir] = useState('in');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (data.accounts.length === 0) return <Sheet title={t('add')} onClose={onClose}><p>{t('setupFirst')}</p><button className="btn w-full" onClick={onClose}>OK</button></Sheet>;
  async function submit() {
    setErr(''); const now = new Date().toISOString();
    try {
      const tx: Transaction = { id, uid, date, amount: parseTakaToPaisa(amount), type, accountId: type === 'invest_loss' ? null : accountId || null, toAccountId: type === 'transfer' ? toAccountId || null : null,
        categoryId: categoryId || null, contactId: CONTACT.includes(type) ? contactId || null : null, businessId: BIZ.includes(type) || (['income', 'expense', 'lend', 'borrow', 'repay_given', 'repay_received'].includes(type) && businessId) ? businessId || null : null,
        investmentType: type === 'invest' ? (investmentType as never) : null, direction: type === 'adjustment' ? (direction as never) : null, dueDate: type === 'lend' && dueDate ? dueDate : null,
        description: description.trim(), receiptNo: null, status: 'active', createdAt: now, updatedAt: now, history: [{ at: now, by: uid, action: 'create', changes: {} }] };
      validateTransaction(tx, data);
      if (findDuplicate(tx, data.transactions) && !confirm(t('dupAsk'))) return;
      if (['expense', 'lend', 'repay_given', 'invest', 'refund_given', 'transfer'].includes(type) && accountId) {
        const bal = summarize(data.accounts, data.transactions, todayDhaka()).balances[accountId] ?? 0;
        if (tx.amount > bal && !confirm(t('balWarn'))) return;
      }
      setBusy(true); await createTransaction(uid, tx); onClose();
    } catch (e) { setErr(t(e instanceof LedgerError ? e.code : (e as Error).message === 'INVALID_AMOUNT' ? 'BAD_AMOUNT' : 'ERR')); setBusy(false); }
  }
  const cats = data.categories.filter((c) => (type === 'income' || type === 'refund_given') ? c.kind === 'income' : c.kind === 'expense');
  return <Sheet title={t('t_' + type)} onClose={onClose}>
    <Sel label={t('t_' + type)} value={type} onChange={(v) => setType(v as TxType)}>{ALL_TYPES.map((x) => <option key={x} value={x}>{t('t_' + x)}</option>)}</Sel>
    <p className="text-xs text-mute -mt-2">{t('h_' + type)}</p>
    <label className="block text-sm text-mute">{t('amount')}<input className="field mt-1 text-ink num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus /></label>
    <label className="block text-sm text-mute">{t('date')}<input type="date" className="field mt-1 text-ink" value={date} onChange={(e) => setDate(e.target.value)} /></label>
    {type !== 'invest_loss' && <Sel label={type === 'transfer' ? t('account') + ' ↑' : t('account')} value={accountId} onChange={setAcc}>{data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Sel>}
    {type === 'transfer' && <Sel label={t('toAccount')} value={toAccountId} onChange={setTo}><option value="">—</option>{data.accounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Sel>}
    {CONTACT.includes(type) && <><Sel label={t('contact')} value={contactId} onChange={setContact}><option value="">—</option>{data.contacts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Sel>
      <AddEntity label={t('newContact')} onSave={(name) => { const nid = newId(); saveEntity(uid, 'contacts', { id: nid, name, kind: 'person' } as never); setContact(nid); }} /></>}
    {(BIZ.includes(type) || ['income', 'expense'].includes(type)) && <><Sel label={t('business')} value={businessId} onChange={setBiz}><option value="">—</option>{data.businesses.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Sel>
      <AddEntity label={t('newBusiness')} onSave={(name) => { const nid = newId(); saveEntity(uid, 'businesses', { id: nid, name, kind: 'business' } as never); setBiz(nid); }} /></>}
    {type === 'invest' && <Sel label={t('invType')} value={investmentType} onChange={setInv}><option value="equity">{t('equity')}</option><option value="loan">{t('loan')}</option><option value="expense">{t('invExpense')}</option></Sel>}
    {type === 'adjustment' && <Sel label="±" value={direction} onChange={setDir}><option value="in">{t('in')}</option><option value="out">{t('out')}</option></Sel>}
    {type === 'lend' && <label className="block text-sm text-mute">{t('due')}<input type="date" className="field mt-1 text-ink" value={dueDate} onChange={(e) => setDue(e.target.value)} /></label>}
    {['income', 'expense', 'refund_given', 'refund_received'].includes(type) && <Sel label={t('category')} value={categoryId} onChange={setCat}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Sel>}
    <label className="block text-sm text-mute">{t('desc')}<input className="field mt-1 text-ink" maxLength={500} value={description} onChange={(e) => setDesc(e.target.value)} /></label>
    {err && <p role="alert" className="text-owe text-sm">{err}</p>}
    <div className="flex gap-2"><button className="btn flex-1" onClick={onClose}>{t('cancel')}</button><button className="btn btn-primary flex-1" disabled={busy} onClick={submit}>{t('save')}</button></div></Sheet>;
}

function AddEntity({ label, onSave }: { label: string; onSave: (name: string, extra: string) => void }) {
  const [n, setN] = useState(''); const [x, setX] = useState('');
  return <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (n.trim()) { onSave(n.trim(), x); setN(''); setX(''); } }}>
    <input className="field" value={n} maxLength={100} onChange={(e) => setN(e.target.value)} placeholder={label} />
    <button className="btn btn-primary">{label.length > 0 ? '＋' : ''}</button></form>;
}

function Accounts({ data, lang, uid }: { data: Data; lang: Lang; uid: string }) {
  const t = (k: string) => tr(lang, k); const s = summarize(data.accounts, data.transactions, todayDhaka()); const [open, setOpen] = useState('');
  const [kind, setKind] = useState('cash'); const [nm, setNm] = useState(''); const [ob, setOb] = useState('');
  const add = async () => { try { if (!nm.trim()) return; await saveEntity(uid, 'accounts', { id: newId(), name: nm.trim(), kind, openingBalance: ob ? parseTakaToPaisa(ob) : 0 } as never); setNm(''); setOb(''); } catch { alert(t('BAD_AMOUNT')); } };
  void open; void setOpen;
  return <div className="px-4 space-y-3"><h2 className="font-semibold">{t('accounts')}</h2>
    {data.accounts.map((a) => <div key={a.id} className="rounded-2xl bg-card border border-line p-3 flex justify-between"><span>{a.name} <span className="text-xs text-mute">{t('k_' + a.kind)}</span></span><span className="num">{formatMoney(s.balances[a.id] ?? 0, lang)}</span></div>)}
    <div className="rounded-2xl border border-line p-3 space-y-2"><div className="text-sm font-medium">{t('addAccount')}</div>
      <input className="field" placeholder={t('name')} value={nm} maxLength={100} onChange={(e) => setNm(e.target.value)} />
      <Sel label="" value={kind} onChange={setKind}>{['cash', 'bank', 'bkash', 'nagad', 'wallet', 'custom'].map((k) => <option key={k} value={k}>{t('k_' + k)}</option>)}</Sel>
      <input className="field num" inputMode="decimal" placeholder={t('opening')} value={ob} onChange={(e) => setOb(e.target.value)} />
      <button className="btn btn-primary w-full" onClick={add}>{t('save')}</button></div></div>;
}

function People({ data, lang, uid }: { data: Data; lang: Lang; uid: string }) {
  const t = (k: string) => tr(lang, k); const today = todayDhaka(); const [sel, setSel] = useState('');
  const [kind, setKind] = useState<'person' | 'organization'>('person');
  const p = sel ? contactPosition(data.transactions, sel, today) : null;
  return <div className="px-4 space-y-3"><h2 className="font-semibold">{t('contacts')}</h2>
    <AddEntity label={t('name')} onSave={(n) => saveEntity(uid, 'contacts', { id: newId(), name: n, kind } as never)} />
    <div className="flex gap-2 text-sm"><button className={`btn ${kind === 'person' ? 'btn-primary' : ''}`} onClick={() => setKind('person')}>{lang === 'bn' ? 'ব্যক্তি' : 'Person'}</button><button className={`btn ${kind === 'organization' ? 'btn-primary' : ''}`} onClick={() => setKind('organization')}>{lang === 'bn' ? 'প্রতিষ্ঠান' : 'Organization'}</button></div>
    {data.contacts.map((c) => { const q = contactPosition(data.transactions, c.id, today);
      const msg = q.owedToMe > 0 ? (lang === 'bn' ? `আসসালামু আলাইকুম ${c.name}, আপনার কাছে আমার ${formatMoney(q.owedToMe, lang)} পাওনা আছে। সুবিধামতো পরিশোধ করবেন, জাযাকাল্লাহু খাইরান।` : `Assalamu alaikum ${c.name}, you owe me ${formatMoney(q.owedToMe, lang)}. Please pay when convenient.`)
        : q.iOwe > 0 ? (lang === 'bn' ? `আসসালামু আলাইকুম ${c.name}, আপনার ${formatMoney(q.iOwe, lang)} আমার কাছে বাকি আছে। শীঘ্রই পরিশোধ করব ইনশাআল্লাহ।` : `Assalamu alaikum ${c.name}, I owe you ${formatMoney(q.iOwe, lang)}. I will pay soon.`) : (lang === 'bn' ? `আসসালামু আলাইকুম ${c.name}` : `Assalamu alaikum ${c.name}`);
      return <div key={c.id} onClick={() => setSel(sel === c.id ? '' : c.id)} className="w-full text-left rounded-2xl bg-card border border-line p-3 space-y-1">
      <EntityHead e={c} col="contacts" uid={uid} lang={lang} wa={msg} />
      <div className="text-sm flex justify-between"><span className="text-taka">{t('receivable')}: <span className="num">{formatMoney(q.owedToMe, lang)}</span></span><span className="text-owe">{t('payable')}: <span className="num">{formatMoney(q.iOwe, lang)}</span></span></div>
      {q.overdue > 0 && <div className="text-xs text-warn">{t('overdue')}: {formatMoney(q.overdue, lang)}</div>}
      {sel === c.id && p && <button className="btn text-xs" onClick={(e) => { e.stopPropagation(); printDoc((lang === 'bn' ? 'স্টেটমেন্ট — ' : 'Statement — ') + c.name, [lang === 'bn' ? 'তারিখ' : 'Date', lang === 'bn' ? 'ধরন' : 'Type', lang === 'bn' ? 'টাকা' : 'Amount'], p.rows.map((r) => [formatDate(r.tx.date, lang), t('t_' + r.tx.type), formatMoney(r.tx.amount, lang)]), [[t('receivable'), formatMoney(q.owedToMe, lang)], [t('payable'), formatMoney(q.iOwe, lang)]]); }}>PDF {lang === 'bn' ? 'স্টেটমেন্ট' : 'statement'}</button>}
      {sel === c.id && p && <ul className="mt-2 border-t border-line pt-2 space-y-1 text-sm">{p.rows.map((r) => <li key={r.tx.id} className="flex justify-between"><span>{formatDate(r.tx.date, lang)} · {t('t_' + r.tx.type)} <span className="text-mute">{r.tx.receiptNo}</span></span><span className="num">{formatMoney(r.tx.amount, lang)}</span></li>)}</ul>}</div>; })}</div>;
}

function Biz({ data, lang, uid }: { data: Data; lang: Lang; uid: string }) {
  const t = (k: string) => tr(lang, k); const m = (p: number) => formatMoney(p, lang);
  return <div className="px-4 space-y-3"><h2 className="font-semibold">{t('businesses')}</h2>
    <AddEntity label={t('name')} onSave={(n) => saveEntity(uid, 'businesses', { id: newId(), name: n, kind: 'business' } as never)} />
    {data.businesses.map((b) => { const r = businessReport(data.transactions, b.id); return <div key={b.id} className="rounded-2xl bg-card border border-line p-3 space-y-1"><EntityHead e={b} col="businesses" uid={uid} lang={lang} />
      <div className="grid grid-cols-2 gap-x-3 text-sm">{([[t('invested'), r.invested], [t('returned'), r.capitalReturned], [t('outstanding'), r.outstandingPrincipal], [t('profit'), r.profitReceived], [t('loss'), r.lossRecorded], [t('income'), r.businessIncome], [t('expense'), r.businessExpense], [t('receivable'), r.receivable]] as [string, number][]).map(([l, v]) => <div key={l} className="flex justify-between"><span className="text-mute">{l}</span><span className="num">{m(v)}</span></div>)}</div></div>; })}</div>;
}
