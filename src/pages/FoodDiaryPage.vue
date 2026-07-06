<template>
  <q-page class="q-pa-md flex flex-center">
    <div class="app-container">
      <q-banner v-if="store.error" class="bg-negative text-white q-mb-md" rounded>
        Couldn't reach the diary server: {{ store.error }}
      </q-banner>

      <q-date
        v-model="selectedDate"
        mask="YYYY-MM-DD"
        :events="eventDates"
        event-color="primary"
        today-btn
        flat
        bordered
        class="full-width q-mb-md"
        @update:model-value="openDay"
        @navigation="onNavigation"
      />

      <q-card v-if="monthDays.length > 0">
        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">{{ monthLabel }}</div>
          <q-list dense separator>
            <q-item
              v-for="day in monthDays"
              :key="day.date"
              clickable
              :to="`/food-diary/${day.date}`"
            >
              <q-item-section>{{ formatDay(day.date) }}</q-item-section>
              <q-item-section side>€{{ day.totalCost.toFixed(2) }}</q-item-section>
            </q-item>
          </q-list>
          <q-separator class="q-my-sm" />
          <div class="row justify-between text-weight-medium">
            <span>Month total</span>
            <span>€{{ monthTotal.toFixed(2) }}</span>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useFoodDiaryStore } from 'stores/foodDiary';

const router = useRouter();
const store = useFoodDiaryStore();

const today = new Date().toISOString().slice(0, 10);
const selectedDate = ref<string | null>(today);
const viewYear = ref(Number(today.slice(0, 4)));
const viewMonth = ref(Number(today.slice(5, 7)));

const eventDates = computed(() => store.days.map((d) => d.date.replace(/-/g, '/')));

const monthPrefix = computed(
  () => `${viewYear.value}-${String(viewMonth.value).padStart(2, '0')}`,
);

const monthDays = computed(() => store.days.filter((d) => d.date.startsWith(monthPrefix.value)));

const monthTotal = computed(() => monthDays.value.reduce((sum, d) => sum + d.totalCost, 0));

const monthLabel = computed(() =>
  new Date(viewYear.value, viewMonth.value - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  }),
);

function formatDay(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function onNavigation(view: { year: number; month: number }) {
  viewYear.value = view.year;
  viewMonth.value = view.month;
}

async function openDay(date: string | null) {
  if (date) await router.push(`/food-diary/${date}`);
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
</style>
