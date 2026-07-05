<template>
  <q-dialog v-model="open" persistent :maximized="$q.platform.is.mobile">
    <q-card style="width: 100%; max-width: 400px">
      <q-card-section>
        <div class="text-h6">{{ item ? 'Edit item' : 'Add item' }}</div>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-md">
        <q-select
          v-model="name"
          :options="filteredOptions"
          label="Ingredient"
          outlined
          dense
          use-input
          fill-input
          hide-selected
          input-debounce="0"
          new-value-mode="add-unique"
          autofocus
          @filter="filterFn"
          @update:model-value="onIngredientPicked"
        >
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt }}</q-item-label>
                <q-item-label caption>{{ priceCaption(scope.opt) }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <q-input v-model="amount" label="Amount (free text, e.g. ~60 g)" outlined dense />

        <div class="row q-col-gutter-sm">
          <div class="col-6">
            <q-input
              v-model.number="unitPrice"
              :label="`Unit price (€/${unit ?? '?'})`"
              type="number"
              step="0.01"
              outlined
              dense
            />
          </div>
          <div class="col-6">
            <q-select v-model="unit" :options="unitOptions" label="Unit" outlined dense />
          </div>
        </div>

        <q-input
          v-model.number="quantity"
          :label="quantityLabel"
          type="number"
          step="0.001"
          outlined
          dense
          hint="Optional — auto-calculates the cost"
        />

        <q-input
          v-model.number="cost"
          label="Cost (€)"
          type="number"
          step="0.01"
          outlined
          dense
          @update:model-value="costTouched = true"
        />
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-btn
          v-if="item"
          flat
          label="Delete"
          color="negative"
          class="q-mr-auto"
          @click="emitDelete"
        />
        <q-btn flat label="Cancel" color="grey" @click="open = false" />
        <q-btn label="Save" color="primary" :disable="!isValid" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useFoodDiaryStore } from 'stores/foodDiary';
import type { FoodItem } from 'stores/foodDiary';

const props = defineProps<{
  item?: FoodItem | null;
}>();

const emit = defineEmits<{
  save: [item: FoodItem];
  delete: [];
}>();

const open = defineModel<boolean>({ required: true });

const store = useFoodDiaryStore();

const name = ref<string | null>(null);
const amount = ref('');
const unitPrice = ref<number | null>(null);
const unit = ref<string | null>(null);
const quantity = ref<number | null>(null);
const cost = ref<number | null>(null);
const costTouched = ref(false);
const filter = ref('');

const unitOptions = ['kg', 'L', 'piece', 'portion', 'use'];

const priceNames = computed(() => store.sortedPrices.map((p) => p.name));

const filteredOptions = computed(() =>
  filter.value
    ? priceNames.value.filter((n) => n.toLowerCase().includes(filter.value.toLowerCase()))
    : priceNames.value,
);

const quantityLabel = computed(() => {
  switch (unit.value) {
    case 'kg':
      return 'Quantity (kg)';
    case 'L':
      return 'Quantity (litres)';
    case 'piece':
      return 'Number of pieces';
    case 'portion':
      return 'Number of portions';
    case 'use':
      return 'Number of uses';
    default:
      return 'Quantity';
  }
});

const isValid = computed(
  () => !!name.value && name.value.trim() !== '' && cost.value !== null && cost.value >= 0,
);

function filterFn(val: string, update: (fn: () => void) => void) {
  update(() => {
    filter.value = val;
  });
}

function priceCaption(ingredientName: string) {
  const p = store.prices.find((x) => x.name === ingredientName);
  return p ? `€${p.price.toFixed(2)}/${p.unit}` : '';
}

function onIngredientPicked(val: string | null) {
  const p = val ? store.prices.find((x) => x.name === val) : null;
  if (p) {
    unitPrice.value = p.price;
    unit.value = p.unit;
  }
}

// Auto-calculate cost from quantity × unit price unless the user typed a cost themselves
watch([quantity, unitPrice], ([q, p]) => {
  if (!costTouched.value && q !== null && p !== null) {
    cost.value = Math.round(q * p * 100) / 100;
  }
});

function save() {
  if (!isValid.value) return;
  emit('save', {
    name: name.value!.trim(),
    amount: amount.value.trim(),
    unitPrice: unitPrice.value,
    unit: unit.value,
    cost: cost.value!,
    shared: props.item?.shared ?? false,
  });
  open.value = false;
}

function emitDelete() {
  emit('delete');
  open.value = false;
}

watch(
  () => [props.item, open.value] as const,
  ([item, isOpen]) => {
    if (!isOpen) return;
    if (item) {
      name.value = item.name;
      amount.value = item.amount;
      unitPrice.value = item.unitPrice;
      unit.value = item.unit;
      cost.value = Math.round(item.cost * 100) / 100;
      quantity.value = null;
      costTouched.value = true;
    } else {
      name.value = null;
      amount.value = '';
      unitPrice.value = null;
      unit.value = null;
      quantity.value = null;
      cost.value = null;
      costTouched.value = false;
    }
  },
  { immediate: true },
);
</script>
