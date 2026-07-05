import { defineStore } from 'pinia';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from 'boot/firebase';

export type MealKey = 'breakfast' | 'lunch' | 'dinner';

export type FoodItem = {
  name: string;
  amount: string; // free text, e.g. "~60 g (avg. bowl)"
  unitPrice: number | null;
  unit: string | null; // 'kg' | 'L' | 'piece' | 'portion' | 'use'
  cost: number; // what it actually cost you (shared items store your share)
  shared: boolean;
};

export type Meal = {
  items: FoodItem[];
  note: string;
};

export type DiaryDay = {
  date: string; // YYYY-MM-DD, also the Firestore doc id
  meals: Record<MealKey, Meal>;
  totalCost: number;
};

export type IngredientPrice = {
  id: string;
  name: string;
  unit: string;
  price: number;
  notes: string;
  addedAt: string;
};

export const MEAL_KEYS: MealKey[] = ['breakfast', 'lunch', 'dinner'];

export function emptyMeal(): Meal {
  return { items: [], note: '' };
}

export function emptyDay(date: string): DiaryDay {
  return {
    date,
    meals: { breakfast: emptyMeal(), lunch: emptyMeal(), dinner: emptyMeal() },
    totalCost: 0,
  };
}

export function mealSubtotal(meal: Meal): number {
  return meal.items.reduce((sum, item) => sum + item.cost, 0);
}

export function dayTotal(day: DiaryDay): number {
  return MEAL_KEYS.reduce((sum, key) => sum + mealSubtotal(day.meals[key]), 0);
}

export const useFoodDiaryStore = defineStore('foodDiary', {
  state: () => ({
    days: [] as DiaryDay[],
    prices: [] as IngredientPrice[],
    daysReady: false,
    pricesReady: false,
    listenerCount: 0,
    unsubscribeDays: null as null | (() => void),
    unsubscribePrices: null as null | (() => void),
  }),

  getters: {
    dayByDate(state) {
      return (date: string) => state.days.find((d) => d.date === date) ?? null;
    },
    sortedPrices(state) {
      return [...state.prices].sort((a, b) => a.name.localeCompare(b.name));
    },
  },

  actions: {
    // Reference-counted so navigating between food diary pages keeps one live listener
    startListening() {
      this.listenerCount++;
      if (!this.unsubscribeDays) {
        this.unsubscribeDays = onSnapshot(collection(db, 'foodDiary'), (snapshot) => {
          this.days = snapshot.docs
            .map((d) => d.data() as DiaryDay)
            .sort((a, b) => a.date.localeCompare(b.date));
          this.daysReady = true;
        });
      }
      if (!this.unsubscribePrices) {
        this.unsubscribePrices = onSnapshot(collection(db, 'ingredientPrices'), (snapshot) => {
          this.prices = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<IngredientPrice, 'id'>),
          }));
          this.pricesReady = true;
        });
      }
    },

    stopListening() {
      this.listenerCount = Math.max(0, this.listenerCount - 1);
      if (this.listenerCount > 0) return;
      this.unsubscribeDays?.();
      this.unsubscribeDays = null;
      this.unsubscribePrices?.();
      this.unsubscribePrices = null;
    },

    async saveDay(day: DiaryDay) {
      const totalCost = Math.round(dayTotal(day) * 100) / 100;
      await setDoc(doc(db, 'foodDiary', day.date), { ...day, totalCost });
    },

    async deleteDay(date: string) {
      await deleteDoc(doc(db, 'foodDiary', date));
    },

    async savePrice(price: Omit<IngredientPrice, 'id'>, id?: string) {
      const ref = id ? doc(db, 'ingredientPrices', id) : doc(collection(db, 'ingredientPrices'));
      await setDoc(ref, price);
    },

    async deletePrice(id: string) {
      await deleteDoc(doc(db, 'ingredientPrices', id));
    },

    /** One-time import of the parsed Obsidian seed (src/assets/food-diary-seed.json). */
    async importSeed() {
      const seed = (await import('assets/food-diary-seed.json')).default as unknown as {
        days: DiaryDay[];
        prices: Omit<IngredientPrice, 'id'>[];
      };

      const existingDates = new Set(this.days.map((d) => d.date));
      const existingPriceNames = new Set(this.prices.map((p) => p.name.toLowerCase()));

      const batch = writeBatch(db);
      let count = 0;

      for (const day of seed.days) {
        if (existingDates.has(day.date)) continue;
        batch.set(doc(db, 'foodDiary', day.date), day);
        count++;
      }
      for (const price of seed.prices) {
        if (existingPriceNames.has(price.name.toLowerCase())) continue;
        batch.set(doc(collection(db, 'ingredientPrices')), price);
        count++;
      }

      if (count > 0) await batch.commit();
      return count;
    },
  },
});
