import { defineStore } from 'pinia';

export type Expense = {
  id: string;
  type: 'expense' | 'payment';
  description: string;
  amount: number;
  paidBy: 'Brett' | 'Martina';
  date: string;
};

// Same-origin by default (app + API served from the NUC). Override for dev.
const API_URL = import.meta.env.VITE_EXPENSES_API ?? '/api/expenses';
const POLL_MS = 15_000;

export const useExpensesStore = defineStore('expenses', {
  state: () => ({
    expenses: [] as Expense[],
    ready: false,
    error: null as string | null,
    listenerCount: 0,
    pollTimer: null as null | ReturnType<typeof setInterval>,
  }),

  getters: {
    balance(state) {
      return state.expenses.reduce((sum, e) => sum + e.amount, 0);
    },
  },

  actions: {
    async load() {
      try {
        const res = await fetch(API_URL, { headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.expenses = (await res.json()) as Expense[];
        this.error = null;
      } catch (err) {
        this.error = String(err instanceof Error ? err.message : err);
      } finally {
        this.ready = true;
      }
    },

    // Reference-counted poll loop (no real-time push without Firestore).
    startListening() {
      this.listenerCount++;
      if (this.pollTimer) return;
      void this.load();
      this.pollTimer = setInterval(() => void this.load(), POLL_MS);
    },

    stopListening() {
      this.listenerCount = Math.max(0, this.listenerCount - 1);
      if (this.listenerCount > 0) return;
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },

    async addExpense(expense: Expense) {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: expense.type,
          description: expense.description,
          amount: expense.amount,
          paidBy: expense.paidBy,
          date: expense.date,
        }),
      });
      await this.load();
    },

    async updateExpense(id: string, updates: Omit<Expense, 'id'>) {
      await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(updates),
      });
      await this.load();
    },

    async deleteExpense(id: string) {
      await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      await this.load();
    },
  },
});
