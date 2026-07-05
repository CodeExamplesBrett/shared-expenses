<template>
  <q-page class="q-pa-md flex flex-center">
    <div class="app-container">
      <q-btn
        color="primary"
        icon="add"
        label="Add ingredient"
        class="full-width q-mb-md"
        @click="openDialog(null)"
      />

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
        <q-item
          v-for="price in filteredPrices"
          :key="price.id"
          clickable
          @click="openDialog(price)"
        >
          <q-item-section>
            <q-item-label>{{ price.name }}</q-item-label>
            <q-item-label v-if="price.notes" caption>{{ price.notes }}</q-item-label>
          </q-item-section>
          <q-item-section side>€{{ price.price.toFixed(2) }}/{{ price.unit }}</q-item-section>
        </q-item>
      </q-list>

      <q-dialog v-model="showDialog" persistent :maximized="$q.platform.is.mobile">
        <q-card style="width: 100%; max-width: 400px">
          <q-card-section>
            <div class="text-h6">{{ editing ? 'Edit ingredient' : 'Add ingredient' }}</div>
          </q-card-section>

          <q-separator />

          <q-card-section class="q-gutter-md">
            <q-input v-model="name" label="Ingredient name" outlined dense autofocus />
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <q-input
                  v-model.number="price"
                  label="Price (€)"
                  type="number"
                  step="0.01"
                  outlined
                  dense
                />
              </div>
              <div class="col-6">
                <q-select v-model="unit" :options="unitOptions" label="Per unit" outlined dense />
              </div>
            </div>
            <q-input v-model="notes" label="Notes / source" outlined dense />
          </q-card-section>

          <q-separator />

          <q-card-actions align="right">
            <q-btn
              v-if="editing"
              flat
              label="Delete"
              color="negative"
              class="q-mr-auto"
              @click="removePrice"
            />
            <q-btn flat label="Cancel" color="grey" @click="showDialog = false" />
            <q-btn label="Save" color="primary" :disable="!isValid" @click="save" />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useQuasar } from 'quasar';
import { useFoodDiaryStore } from 'stores/foodDiary';
import type { IngredientPrice } from 'stores/foodDiary';

const $q = useQuasar();
const store = useFoodDiaryStore();

const search = ref('');
const showDialog = ref(false);
const editing = ref<IngredientPrice | null>(null);

const name = ref('');
const price = ref<number | null>(null);
const unit = ref('kg');
const notes = ref('');

const unitOptions = ['kg', 'L', 'piece', 'portion', 'use'];

const filteredPrices = computed(() => {
  const q = (search.value ?? '').toLowerCase();
  return q
    ? store.sortedPrices.filter((p) => p.name.toLowerCase().includes(q))
    : store.sortedPrices;
});

const isValid = computed(
  () => name.value.trim() !== '' && price.value !== null && price.value >= 0,
);

function openDialog(existing: IngredientPrice | null) {
  editing.value = existing;
  name.value = existing?.name ?? '';
  price.value = existing?.price ?? null;
  unit.value = existing?.unit ?? 'kg';
  notes.value = existing?.notes ?? '';
  showDialog.value = true;
}

async function save() {
  if (!isValid.value) return;
  await store.savePrice(
    {
      name: name.value.trim(),
      unit: unit.value,
      price: price.value!,
      notes: notes.value.trim(),
      addedAt: editing.value?.addedAt ?? new Date().toISOString().slice(0, 10),
    },
    editing.value?.id,
  );
  showDialog.value = false;
}

function removePrice() {
  const target = editing.value;
  if (!target) return;
  $q.dialog({
    title: 'Delete ingredient',
    message: `Delete "${target.name}" from the price list?`,
    cancel: true,
    ok: { color: 'negative', label: 'Delete' },
  }).onOk(() => {
    void store.deletePrice(target.id).then(() => {
      showDialog.value = false;
    });
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
</style>
