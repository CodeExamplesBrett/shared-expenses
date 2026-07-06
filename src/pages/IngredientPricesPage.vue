<template>
  <q-page class="q-pa-md flex flex-center">
    <div class="app-container">
      <q-input
        v-model="search"
        outlined
        dense
        clearable
        placeholder="Search ingredients"
        class="q-mb-md"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>

      <q-list bordered separator>
        <q-item v-for="price in filteredPrices" :key="price.name">
          <q-item-section>
            <q-item-label>{{ price.name }}</q-item-label>
            <q-item-label v-if="price.notes" caption>{{ price.notes }}</q-item-label>
          </q-item-section>
          <q-item-section side>€{{ price.price.toFixed(2) }}/{{ price.unit }}</q-item-section>
        </q-item>
      </q-list>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useFoodDiaryStore } from 'stores/foodDiary';

const store = useFoodDiaryStore();

const search = ref('');

const filteredPrices = computed(() => {
  const q = (search.value ?? '').toLowerCase();
  return q ? store.sortedPrices.filter((p) => p.name.toLowerCase().includes(q)) : store.sortedPrices;
});

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
