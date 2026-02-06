import { defineStore } from 'pinia';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import { db } from 'boot/firebase';

export type Expense = {
  id: string;
  type: 'expense' | 'payment';
  description: string;
  amount: number;
  paidBy: 'Brett' | 'Martina';
  date: string;
};

export const useExpensesStore = defineStore('expenses', {
  state: () => ({
    expenses: [] as Expense[],
    unsubscribe: null as null | (() => void),
  }),

  getters: {
    balance(state) {
      return state.expenses.reduce((sum, e) => sum + e.amount, 0);
    },
  },

  actions: {
    startListening() {
      if (this.unsubscribe) return;

      const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));

      this.unsubscribe = onSnapshot(q, (snapshot) => {
        this.expenses = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Expense, 'id'>),
        }));
      });
    },

    stopListening() {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    },

    async addExpense(expense: Expense) {
      await addDoc(collection(db, 'expenses'), {
        type: expense.type,
        description: expense.description,
        amount: expense.amount,
        paidBy: expense.paidBy,
        date: expense.date,
        createdAt: Timestamp.now(),
      });
    },
    async updateExpense(id: string, updates: Omit<Expense, 'id'>) {
      await updateDoc(doc(db, 'expenses', id), {
        ...updates,
      });
    },

    async deleteExpense(id: string) {
      await deleteDoc(doc(db, 'expenses', id));
    },
  },
});
