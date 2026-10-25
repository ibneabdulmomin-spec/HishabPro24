# HisabPro (হিসাবপ্রো)

## Status (honest)
- **Verified:** `src/core` (money, ledger engine, validation, reports) — type-checked, 11 tests passing (`npm test`).
- **Written but NOT yet built or run:** React UI, Firebase layer, Firestore rules, PWA config. No network was available to install dependencies or use the Firebase emulator. Run `npm run typecheck` and test rules in the emulator before trusting them.
- **Not implemented yet:** PDF receipts/statements/reports, receipt file attachments, budgets UI, backup *restore*, edit-transaction UI, custom-date report screens, weekly report, Firestore rules unit tests, icons (add `public/icon-192.png`, `icon-512.png`).

## Setup
1. `npm install`
2. Firebase console: create project → enable Google sign-in → create Firestore → register a web app; copy values into `.env.local` (see `.env.example`). The web config is public by design; security comes from Auth + `firestore.rules`.
3. `npm run dev`
4. Deploy (free Spark plan): `firebase login && firebase use <project> && npm run deploy`

## Model decisions
- Money = integer paisa. Dates = `YYYY-MM-DD` (Asia/Dhaka).
- **No stored balances.** Balances, receivables, payables, investment totals are computed from `transactions`, so they cannot drift or conflict. `ledger entries` are therefore a derived view (`contactPosition`), not a collection.
- Receivable (lend − repayments received) and payable (borrow − repayments given) are tracked separately, never netted.
- Lend/borrow are never income/expense. Transfers never count as income/expense. Business-tagged income/expense is reported under the business, not personal totals.
- Investments: loan/equity count as invested principal; type "expense" is a business expense. Capital return cannot exceed invested principal (gains use "profit"). Recorded loss is non-cash.
- Net worth = cash + receivables + investment carrying value (invested − returned − recorded loss, ≥ 0, never marked up) − payables.
- Records are never deleted: edits and reversals append to `history` and write an audit log; rules enforce this.
- Duplicate protection: client-generated doc ID (idempotent retry) + fingerprint warning. Receipt numbers come from a counter updated in the same Firestore transaction.

## মোবাইল থেকে ডিপ্লয় (GitHub + Cloudflare Pages)
1. Firebase Console: প্রজেক্ট → Authentication → Google চালু; Firestore Database তৈরি; Rules ট্যাবে `firestore.rules` পেস্ট করে Publish; Project settings → Web app → config কপি।
2. GitHub-এ নতুন রিপো করে এই ফোল্ডারের ফাইলগুলো আপলোড (node_modules/dist নয়)।
3. Cloudflare Pages → Create → Connect to Git। Build command: `npm run build`, Output directory: `dist`।
4. Environment variables-এ দিন: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID।
5. Firebase → Authentication → Settings → Authorized domains-এ `yourapp.pages.dev` যোগ করুন।
