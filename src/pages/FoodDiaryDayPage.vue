<template>
  <q-page class="q-pa-md flex flex-center">
    <div class="app-container">
      <div class="row items-center justify-between q-mb-md">
        <q-btn flat round dense icon="chevron_left" :to="`/food-diary/${prevDate}`" />
        <div class="text-center">
          <div class="text-subtitle1">{{ dateLabel }}</div>
          <div class="text-caption text-grey">
            Daily total: <b>€{{ total.toFixed(2) }}</b>
          </div>
        </div>
        <q-btn flat round dense icon="chevron_right" :to="`/food-diary/${nextDate}`" />
      </div>

      <q-banner v-if="!dayExists" class="bg-grey-2 text-grey-8 q-mb-md" rounded>
        No entry recorded for this day.
      </q-banner>

      <q-card v-for="mealKey in MEAL_KEYS" :key="mealKey" class="q-mb-md">
        <q-card-section class="q-pb-none row items-center">
          <q-icon :name="mealIcons[mealKey]" size="20px" class="q-mr-sm" />
          <span class="text-subtitle2">{{ mealLabels[mealKey] }}</span>
          <q-space />
          <span class="text-subtitle2">€{{ mealSubtotal(day.meals[mealKey]).toFixed(2) }}</span>
        </q-card-section>

        <q-card-section
          v-if="day.meals[mealKey].note"
          class="q-py-xs text-caption text-grey-7 note-text"
        >
          {{ day.meals[mealKey].note }}
        </q-card-section>

        <q-list dense separator>
          <q-item v-for="(item, index) in day.meals[mealKey].items" :key="index">
            <q-item-section>
              <q-item-label>
                {{ item.name }}
                <q-badge v-if="item.shared" outline color="grey" label="shared" class="q-ml-xs" />
              </q-item-label>
              <q-item-label caption>
                {{ item.amount }}
                <template v-if="item.unitPrice !== null">
                  · €{{ item.unitPrice.toFixed(2) }}/{{ item.unit }}
                </template>
              </q-item-label>
            </q-item-section>
            <q-item-section side>€{{ item.cost.toFixed(2) }}</q-item-section>
          </q-item>

          <q-item v-if="day.meals[mealKey].items.length === 0">
            <q-item-section class="text-grey text-caption">—</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useFoodDiaryStore, MEAL_KEYS, emptyDay, mealSubtotal, dayTotal } from 'stores/foodDiary';
import type { DiaryDay, MealKey } from 'stores/foodDiary';

const route = useRoute();
const store = useFoodDiaryStore();

const mealLabels: Record<MealKey, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};
const mealIcons: Record<MealKey, string> = {
  breakfast: 'free_breakfast',
  lunch: 'lunch_dining',
  dinner: 'dinner_dining',
};

const date = computed(() => String(route.params.date));

const day = computed<DiaryDay>(() => store.dayByDate(date.value) ?? emptyDay(date.value));
const dayExists = computed(() => store.dayByDate(date.value) !== null);
const total = computed(() => dayTotal(day.value));

const dateLabel = computed(() =>
  new Date(date.value + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
);

const prevDate = computed(() => shiftDate(date.value, -1));
const nextDate = computed(() => shiftDate(date.value, 1));

function shiftDate(d: string, days: number) {
  const dt = new Date(d + 'T00:00:00');
  dt.setDate(dt.getDate() + days);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

onMounted(() => {
  store.startListening();
});

onUnmounted(() => {
  store.stopListening();
});
</script>

<style scoped>
.app-container {
  width: 100%;
  max-width: 420px;
}

.note-text {
  white-space: pre-line;
}
</style>
