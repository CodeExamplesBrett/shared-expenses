<template>
  <q-dialog v-model="open" persistent :maximized="$q.platform.is.mobile">
    <q-card style="width: 100%; max-width: 400px">
      <q-card-section>
        <div class="text-h6">
          {{ expense ? 'Edit expense' : 'Add expense' }}
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-md">
        <q-input v-model="description" label="What was it?" outlined dense autofocus />

        <q-input v-model.number="amount" label="Total amount (€)" type="number" outlined dense />

        <q-select
          v-model="paidBy"
          :options="paidByOptions"
          label="Who paid?"
          outlined
          dense
          emit-value
          map-options
        />

        <q-input v-model="date" label="Date" type="date" outlined dense />
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="grey" @click="close" />
        <q-btn label="Save" color="primary" :disable="!isValid" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useExpensesStore } from 'stores/expenses';
import type { Expense } from 'stores/expenses';

const props = defineProps<{
  expense?: Expense | null;
}>();

const open = defineModel<boolean>({ required: true });

const store = useExpensesStore();

const description = ref('');
const amount = ref<number | null>(null);
const paidBy = ref<'Brett' | 'Martina' | null>(null);
const date = ref(new Date().toISOString().slice(0, 10));

const paidByOptions = [
  { label: 'Brett', value: 'Brett' },
  { label: 'Martina', value: 'Martina' },
];

const isValid = computed(
  () =>
    description.value.trim() !== '' &&
    amount.value !== null &&
    amount.value > 0 &&
    paidBy.value !== null,
);

function close() {
  open.value = false;
}

async function save() {
  if (!isValid.value) return;

  const share = amount.value! / 2;
  const netAmount = paidBy.value === 'Brett' ? +share : -share;

  if (props.expense) {
    await store.updateExpense(props.expense.id, {
      type: 'expense',
      description: description.value,
      amount: netAmount,
      paidBy: paidBy.value!,
      date: date.value,
    });
  } else {
    await store.addExpense({
      id: '',
      type: 'expense',
      description: description.value,
      amount: netAmount,
      paidBy: paidBy.value!,
      date: date.value,
    });
  }

  reset();
  close();
}

function reset() {
  description.value = '';
  amount.value = null;
  paidBy.value = null;
  date.value = new Date().toISOString().slice(0, 10);
}
watch(
  () => props.expense,
  (expense) => {
    if (expense) {
      // EDIT MODE
      description.value = expense.description;
      amount.value = Math.abs(expense.amount * 2);
      paidBy.value = expense.amount > 0 ? 'Brett' : 'Martina';
      date.value = expense.date;
    } else {
      // ADD MODE → reset form
      reset();
    }
  },
  { immediate: true },
);
</script>
