export type Lang = 'bn' | 'en';
const D = {
  signIn: ['Google দিয়ে সাইন ইন', 'Sign in with Google'], signOut: ['সাইন আউট', 'Sign out'], tagline: ['আপনার ব্যক্তিগত ও ব্যবসায়িক হিসাব, এক জায়গায়', 'Your personal and business ledger in one place'],
  cash: ['মোট ক্যাশ ও ব্যালান্স', 'Total cash & balances'], income: ['আয়', 'Income'], expense: ['ব্যয়', 'Expense'], savings: ['মাসিক সঞ্চয়', 'Monthly savings'],
  receivable: ['পাওনা', 'Receivable'], payable: ['দেনা', 'Payable'], overdue: ['মেয়াদোত্তীর্ণ পাওনা', 'Overdue receivables'], invested: ['বিনিয়োগকৃত মূলধন', 'Invested capital'],
  returned: ['ফেরত মূলধন', 'Capital returned'], profit: ['মুনাফা', 'Profit'], loss: ['ক্ষতি', 'Loss'], cashflow: ['নেট ক্যাশ ফ্লো', 'Net cash flow'], networth: ['নিট সম্পদ', 'Net worth'],
  recent: ['সাম্প্রতিক লেনদেন', 'Recent transactions'], empty: ['এখনও কোনো লেনদেন নেই। উপরের বোতাম থেকে শুরু করুন।', 'No transactions yet. Start with a button above.'],
  accounts: ['অ্যাকাউন্ট', 'Accounts'], addAccount: ['অ্যাকাউন্ট যোগ', 'Add account'], contacts: ['ব্যক্তি ও প্রতিষ্ঠান', 'People & organizations'], businesses: ['ব্যবসা ও অংশীদার', 'Businesses & partners'],
  add: ['যোগ করুন', 'Add'], name: ['নাম', 'Name'], opening: ['প্রারম্ভিক ব্যালান্স', 'Opening balance'], save: ['সংরক্ষণ', 'Save'], cancel: ['বাতিল', 'Cancel'],
  amount: ['পরিমাণ (৳)', 'Amount (৳)'], date: ['তারিখ', 'Date'], account: ['অ্যাকাউন্ট', 'Account'], toAccount: ['গন্তব্য অ্যাকাউন্ট', 'To account'], contact: ['ব্যক্তি/প্রতিষ্ঠান', 'Contact'],
  business: ['ব্যবসা', 'Business'], category: ['ক্যাটাগরি', 'Category'], desc: ['বিবরণ', 'Description'], due: ['পরিশোধের তারিখ', 'Due date'], invType: ['বিনিয়োগের ধরন', 'Investment type'],
  reverse: ['বাতিল (রিভার্স)', 'Reverse'], reversed: ['রিভার্সড', 'Reversed'], exportCsv: ['CSV এক্সপোর্ট', 'Export CSV'], backup: ['ব্যাকআপ (JSON)', 'Backup (JSON)'],
  dupAsk: ['একই রকম একটি এন্ট্রি আছে। তবুও যোগ করবেন?', 'A similar entry exists. Add anyway?'], reverseAsk: ['এই লেনদেন রিভার্স করবেন? রেকর্ড মুছবে না, হিসাব থেকে বাদ যাবে।', 'Reverse this entry? The record is kept but excluded from totals.'],
  reasonAsk: ['কারণ লিখুন', 'Reason'], setupFirst: ['আগে একটি অ্যাকাউন্ট যোগ করুন।', 'Add an account first.'], loading: ['লোড হচ্ছে…', 'Loading…'],
  chart: ['মাসওয়ারি আয় ও ব্যয়', 'Income vs expense by month'], theme: ['থিম', 'Theme'],
  loan: ['ঋণ', 'Loan'], equity: ['ইকুইটি/মূলধন', 'Equity / capital'], invExpense: ['ব্যয়', 'Expense'], in: ['জমা', 'In'], out: ['খরচ', 'Out'],
  t_income: ['আয়', 'Income'], t_expense: ['ব্যয়', 'Expense'], t_lend: ['টাকা দিলাম', 'Money lent'], t_borrow: ['ঋণ নিলাম', 'Loan received'], t_repay_given: ['ঋণ পরিশোধ করলাম', 'Repayment given'],
  t_repay_received: ['টাকা ফেরত পেলাম', 'Repayment received'], t_transfer: ['ট্রান্সফার', 'Transfer'], t_invest: ['বিনিয়োগ', 'Investment'], t_capital_return: ['মূলধন ফেরত', 'Capital returned'],
  t_invest_profit: ['বিনিয়োগ মুনাফা', 'Investment profit'], t_invest_loss: ['বিনিয়োগ ক্ষতি', 'Investment loss'], t_refund_received: ['রিফান্ড পেলাম', 'Refund received'],
  t_refund_given: ['রিফান্ড দিলাম', 'Refund given'], t_adjustment: ['সমন্বয়', 'Adjustment'],
  BAD_AMOUNT: ['সঠিক পরিমাণ লিখুন (সর্বোচ্চ ২ দশমিক)।', 'Enter a valid amount (max 2 decimals).'], BAD_DATE: ['তারিখ সঠিক নয়।', 'Invalid date.'],
  ACCOUNT_REQUIRED: ['অ্যাকাউন্ট নির্বাচন করুন।', 'Select an account.'], SAME_ACCOUNT: ['দুটি অ্যাকাউন্ট আলাদা হতে হবে।', 'Accounts must differ.'],
  CONTACT_REQUIRED: ['ব্যক্তি/প্রতিষ্ঠান নির্বাচন করুন।', 'Select a contact.'], BUSINESS_REQUIRED: ['ব্যবসা নির্বাচন করুন।', 'Select a business.'],
  OVER_REPAYMENT: ['পরিমাণ বকেয়ার চেয়ে বেশি।', 'Amount exceeds the outstanding balance.'], OVER_RETURN: ['ফেরত মূলধন বিনিয়োগের চেয়ে বেশি। মুনাফা হলে "বিনিয়োগ মুনাফা" ব্যবহার করুন।', 'Return exceeds invested capital. Use "Investment profit" for gains.'],
  INVESTMENT_TYPE_REQUIRED: ['বিনিয়োগের ধরন নির্বাচন করুন।', 'Select investment type.'], REVERSAL_BLOCKED: ['পরবর্তী এন্ট্রি এটির উপর নির্ভরশীল, আগে সেগুলো রিভার্স করুন।', 'Later entries depend on this one; reverse those first.'],
} as const;
export type Key = keyof typeof D;
export const tr = (lang: Lang, k: string): string => ((D as Record<string, readonly [string, string]>)[k]?.[lang === 'bn' ? 0 : 1]) ?? k;
