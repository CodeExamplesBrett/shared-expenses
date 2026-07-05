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

      <q-card v-for="mealKey in MEAL_KEYS" :key="mealKey" class="q-mb-md">
        <q-card-section class="q-pb-none row items-center">
          <q-icon :name="mealIcons[mealKey]" size="20px" class="q-mr-sm" />
          <span class="text-subtitle2">{{ mealLabels[mealKey] }}</span>
          <q-space />
          <span class="text-subtitle2">€{{ mealSubtotal(day.meals[mealKey]).toFixed(2) }}</span>
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="edit_note"
            class="q-ml-xs"
            @click="editNote(mealKey)"
          >
            <q-tooltip>Edit note</q-tooltip>
          </q-btn>
        </q-card-section>

        <q-card-section
          v-if="day.meals[mealKey].note"
          class="q-py-xs text-caption text-grey-7 note-text"
        >
          {{ day.meals[mealKey].note }}
        </q-card-section>

        <q-list dense separator>
          <q-item
            v-for="(item, index) in day.meals[mealKey].items"
            :key="index"
            clickable
            @click="editItem(mealKey, index)"
          >
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
        </q-list>

        <q-card-actions>
          <q-btn flat dense color="primary" icon="add" label="Add item" @click="addItem(mealKey)" />
        </q-card-actions>
      </q-card>

      <q-btn
        v-if="dayExists"
        flat
        color="negative"
        icon="delete"
        label="Delete this day"
        class="full-width"
        @click="removeDay"
      />

      <FoodItemDialog
        v-model="showItemDialog"
        :item="editingItem"
        @save="saveItem"
        @delete="deleteItem"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import FoodItemDialog from 'components/FoodItemDialog.vue';
import { useFoodDiaryStore, MEAL_KEYS, emptyDay, mealSubtotal, dayTotal } from 'stores/foodDiary';
import type { DiaryDay, FoodItem, MealKey } from 'stores/foodDiary';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
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
  return dt.toISOString().slice(0, 10);
}

const showItemDialog = ref(false);
const editingMeal = ref<MealKey>('breakfast');
const editingIndex = ref<number | null>(null);

const editingItem = computed<FoodItem | null>(() =>
  editingIndex.value === null
    ? null
    : (day.value.meals[editingMeal.value].items[editingIndex.value] ?? null),
);

function addItem(meal: MealKey) {
  editingMeal.value = meal;
  editingIndex.value = null;
  showItemDialog.value = true;
}

function editItem(meal: MealKey, index: number) {
  editingMeal.value = meal;
  editingIndex.value = index;
  showItemDialog.value = true;
}

async function saveItem(item: FoodItem) {
  const updated = structuredClone(day.value);
  const items = updated.meals[editingMeal.value].items;
  if (editingIndex.value === null) items.push(item);
  else items[editingIndex.value] = item;
  await store.saveDay(updated);
}

async function deleteItem() {
  if (editingIndex.value === null) return;
  const updated = structuredClone(day.value);
  updated.meals[editingMeal.value].items.splice(editingIndex.value, 1);
  await store.saveDay(updated);
}

function editNote(meal: MealKey) {
  $q.dialog({
    title: `${mealLabels[meal]} note`,
    prompt: {
      model: day.value.meals[meal].note,
      type: 'textarea',
    },
    cancel: true,
  }).onOk((note: string) => {
    const updated = structuredClone(day.value);
    updated.meals[meal].note = note.trim();
    void store.saveDay(updated);
  });
}

function removeDay() {
  $q.dialog({
    title: 'Delete day',
    message: `Delete the whole entry for ${date.value}?`,
    cancel: true,
    ok: { color: 'negative', label: 'Delete' },
  }).onOk(() => {
    void store.deleteDay(date.value).then(() => router.push('/food-diary'));
  });
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
