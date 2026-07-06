import { defineStore } from 'pinia';

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
  date: string; // YYYY-MM-DD
  meals: Record<MealKey, Meal>;
  totalCost: number;
};

export type IngredientPrice = {
  name: string;
  unit: string;
  price: number;
  notes: string;
  addedAt: string;
};

export const MEAL_KEYS: MealKey[] = ['breakfast', 'lunch', 'dinner'];

// Same-origin by default (app + API served from the NUC). Override for dev.
const API_URL = import.meta.env.VITE_FOOD_DIARY_API ?? '/api/food-diary';
const POLL_MS = 60_000;

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
    ready: false,
    error: null as string | null,
    listenerCount: 0,
    pollTimer: null as null | ReturnType<typeof setInterval>,
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
    async load() {
      try {
        const res = await fetch(API_URL, { headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { days: DiaryDay[]; prices: IngredientPrice[] };
        this.days = [...data.days].sort((a, b) => a.date.localeCompare(b.date));
        this.prices = data.prices;
        this.error = null;
      } catch (err) {
        this.error = String(err instanceof Error ? err.message : err);
      } finally {
        this.ready = true;
      }
    },

    // Reference-counted so navigating between food diary pages keeps one poll loop.
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
  },
});
