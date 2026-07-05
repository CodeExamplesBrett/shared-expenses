# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**shared-expenses** is a Vue 3 + Quasar + Firebase web application for tracking shared expenses between two people (Brett and Martina). The app calculates who owes whom and tracks both expenses (split 50/50) and direct payments.

- **Framework**: Quasar 2.16 (Vue 3 + Vite)
- **State Management**: Pinia
- **Backend**: Firebase (Auth + Firestore)
- **Language**: TypeScript
- **Styling**: SCSS + Quasar components

## Architecture

### Authentication Flow

- Two authentication methods: Google OAuth via Firebase Auth Popup and email/password sign-up/sign-in
- Auth state is managed in the `useAuthStore` (src/stores/auth.ts) which listens to `onAuthStateChanged` during boot
- Route guards (src/router/index.ts) check `meta.requiresAuth` and redirect unauthenticated users to `/login`
- Protected routes are under MainLayout; login page is public

### Data Model

The app tracks two transaction types in Firestore:

1. **Expenses** (`type: 'expense'`): Total amount split 50/50 between Brett and Martina
   - Stored as a net amount in `amount` field: positive means Brett paid more, negative means Martina paid more
   - Real total = `Math.abs(amount) * 2`
2. **Payments** (`type: 'payment'`): Direct transfers from one person to the other
   - `paidBy` indicates who initiated the payment
   - Positive amount means Brett → Martina; negative means Martina → Brett

**Balance Calculation**: The sum of all `amount` values across all expenses/payments shows who owes whom. Positive = Martina owes Brett; negative = Brett owes Martina.

### State Management (Pinia)

- **useAuthStore** (src/stores/auth.ts): User authentication state and actions
  - `user`: Firebase User object or null
  - `ready`: Boolean flag indicating if auth state has been initialized
  - Actions: `signInWithGoogle()`, `signInWithEmail()`, `registerWithEmail()`, `signOut()`, `startListening()`
- **useExpensesStore** (src/stores/expenses.ts): Expense/payment data and operations
  - `expenses`: Array of all transactions, ordered newest first
  - `unsubscribe`: Cleanup function for Firestore snapshot listener
  - Getter `balance`: Sum of all amounts
  - Actions: `startListening()`, `stopListening()`, `addExpense()`, `updateExpense()`, `deleteExpense()`

### Component Structure

- **MainLayout.vue**: App header with logout button, wraps authenticated pages
- **IndexPage.vue**: Home page, displays ExpensesComponent
- **ExpensesComponent.vue**: Main UI showing balance, transaction list, and dialog triggers
- **AddExpenseDialog.vue**: Modal for adding/editing 50/50 split expenses
- **PaymentDialog.vue**: Modal for adding/editing direct payments
- **LoginPage.vue**: Public login/register page with Google OAuth and email/password forms

### Food Diary

A second feature area tracking what was eaten per day (breakfast/lunch/dinner) with per-ingredient costs, migrated from an Obsidian vault (`~/Dokumente/obsidian-vault/Food Diary`).

- **Firestore collections**: `foodDiary` (doc id = `YYYY-MM-DD`, holds `meals.{breakfast,lunch,dinner}` with `items[]` and `note`, plus `totalCost`) and `ingredientPrices` (central price list: `name`, `unit`, `price`, `notes`, `addedAt`)
- **useFoodDiaryStore** (src/stores/foodDiary.ts): reference-counted Firestore listeners, `saveDay()`/`deleteDay()`, `savePrice()`/`deletePrice()`, and `importSeed()` which batch-imports `src/assets/food-diary-seed.json`
- **Pages**: FoodDiaryPage.vue (calendar with event dots + month summary, `/food-diary`), FoodDiaryDayPage.vue (day detail with meal editing, `/food-diary/:date`), IngredientPricesPage.vue (price list CRUD, `/food-diary/prices`)
- **FoodItemDialog.vue**: add/edit an ingredient line; picking an ingredient from the price list auto-fills unit price, and a quantity field auto-calculates cost
- **Migration**: `node scripts/parse-food-diary.mjs` parses the Obsidian markdown (English section) into `src/assets/food-diary-seed.json`, validating all subtotals/totals against the files. The app shows an "Import" banner on the calendar page while the `foodDiary` collection is empty. Shared dishes (split bowls/trays) store each item's cost already scaled to the owner's share, flagged `shared: true`

### Firebase Integration

- **Initialization**: src/boot/firebase.ts initializes Firebase app and exports `db` (Firestore) and `auth` (Firebase Auth)
- **Firestore Rules** (firestore.rules): Simple rule allowing all read/write for authenticated users
- **Database**: Collection `expenses` stores all transactions
- **Indexes**: Firestore auto-creates indexes; firestore.indexes.json documents them

## Development Workflow

### Setup

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Opens the app at http://localhost:9000 (default Quasar dev port) with hot-module reloading.

### Build for Production

```bash
npm run build
```

Outputs optimized SPA to `dist/spa/` directory configured for Firebase Hosting (see firebase.json rewrites).

### Linting

```bash
npm run lint
```

Runs ESLint with flat config (eslint.config.js) on all TypeScript/Vue files in src/. Enforces consistent type imports and Vue/TypeScript best practices.

### Code Formatting

```bash
npm run format
```

Runs Prettier with config (100 character line width, single quotes). Formats all code, json, markdown, and styles.

### Firestore Emulation (if needed)

Firestore can run locally for testing; project uses `shared-expenses-9800b` Firebase project (see .firebaserc).

## Key Files Reference

| File                          | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `src/router/routes.ts`        | Route definitions with auth guards               |
| `src/stores/auth.ts`          | Authentication state and Firebase Auth API calls |
| `src/stores/expenses.ts`      | Expense data management and Firestore operations |
| `quasar.config.ts`            | Quasar build config, boot files, vite plugins    |
| `firebase.json`               | Firebase hosting and Firestore config            |
| `firestore.rules`             | Firestore security rules                         |
| `.env.example` / `.env.local` | Environment variables for Firebase config        |

## Environment Variables

Firebase configuration must be set in `.env.local`:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Common Issues & Patterns

### Auth State Not Ready

- `useAuthStore().ready` must be `true` before making Firebase operations
- Auth boot (src/boot/auth.ts) starts listening to `onAuthStateChanged` during app startup
- Router guards await `getCurrentUser()` which waits for the first auth state change

### Expense/Payment Logic

- When adding an expense, the form takes the total amount and calculates the net: `netAmount = paidBy === 'Brett' ? +total/2 : -total/2`
- When editing, multiply stored amount by 2 and infer paidBy from amount sign
- Payment amounts are stored as-is but always relative to direction (Brett→Martina = positive, Martina→Brett = negative)

### Firestore Snapshot Listener Cleanup

- `startListening()` sets up a real-time listener via `onSnapshot()`
- Must call `stopListening()` on component unmount to unsubscribe and prevent memory leaks
- See ExpensesComponent.vue for the pattern (onMounted/onUnmounted hooks)

### Form Validation

- Both dialog components use computed `isValid` properties to disable save buttons
- AddExpenseDialog requires description, positive amount, and paidBy selection
- PaymentDialog requires amount, from !== to

### Quasar Mobile Responsiveness

- Dialogs use `:maximized="$q.platform.is.mobile"` to fill screen on mobile devices
- Components are built with Quasar's flexbox utilities (q-pa-md, full-width, etc.)

## Testing

No automated tests currently configured (package.json script is a no-op). Manual testing should verify:

- Login/register flows (Google and email/password)
- Adding, editing, deleting expenses
- Adding, editing, deleting payments
- Balance calculation correctness
- Firestore data persistence

## Firebase deployment

Firestore deploy: firebase deploy --only hosting
