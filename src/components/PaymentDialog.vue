<template>
  <q-dialog v-model="open" persistent :maximized="$q.platform.is.mobile">
    <q-card style="width: 100%; max-width: 400px">
      <q-card-section>
        <div class="text-h6">
          {{ payment ? 'Edit payment' : 'Add payment' }}
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section class="q-gutter-md">
        <q-input
          v-model.number="amount"
          label="Amount (€)"
          type="number"
          outlined
          dense
          autofocus
        />
        <q-select
          v-model="from"
          :options="userOptions"
          label="From"
          outlined
          dense
          emit-value
          map-options
        />
        <q-select
          v-model="to"
          :options="userOptions"
          label="To"
          outlined
          dense
          emit-value
          map-options
          disable
        />
        <q-input v-model="description" label="What is it?" outlined dense />
        <q-input v-model="date" label="Date" type="date" outlined dense />
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="grey" @click="close" />
        <q-btn label="Save" color="secondary" :disable="!isValid" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useExpensesStore } from 'stores/expenses';
import type { Expense } from 'stores/expenses';

const props = defineProps<{
  payment?: Expense | null;
}>();

const open = defineModel<boolean>('open', { required: true });
const store = useExpensesStore();

const description = ref('');
const amount = ref<number | null>(null);
const from = ref<'Brett' | 'Martina' | null>(null);
const to = ref<'Brett' | 'Martina' | null>(null);
const date = ref(new Date().toISOString().slice(0, 10));

const userOptions = [
  { label: 'Brett', value: 'Brett' },
  { label: 'Martina', value: 'Martina' },
];

const isValid = computed(
  () =>
    amount.value !== null &&
    amount.value > 0 &&
    from.value !== null &&
    to.value !== null &&
    from.value !== to.value,
);

function close() {
  open.value = false;
}

function autoFillDescription() {
  if (!from.value || !to.value) return;

  // Only auto-fill if user hasn't typed something custom
  if (!description.value || description.value.startsWith('Payment from')) {
    description.value = `Payment from ${from.value} to ${to.value}`;
  }
}

async function save() {
  if (!isValid.value) return;

  let netAmount = 0;
  const paidBy: 'Brett' | 'Martina' = from.value!;

  if (from.value === 'Martina' && to.value === 'Brett') {
    netAmount = -amount.value!;
  } else if (from.value === 'Brett' && to.value === 'Martina') {
    netAmount = amount.value!;
  }

  if (props.payment) {
    await store.updateExpense(props.payment.id, {
      type: 'payment',
      description: description.value,
      amount: netAmount,
      paidBy,
      date: date.value,
    });
  } else {
    await store.addExpense({
      id: '',
      type: 'payment',
      description: description.value,
      amount: netAmount,
      paidBy,
      date: date.value,
    });
  }

  reset();
  close();
}

function reset() {
  description.value = '';
  amount.value = null;
  from.value = null;
  to.value = null;
  date.value = new Date().toISOString().slice(0, 10);
}
watch(
  () => props.payment,
  (payment) => {
    if (!payment) {
      reset();
      return;
    }

    description.value = payment.description;
    amount.value = Math.abs(payment.amount);
    date.value = payment.date;

    if (payment.amount > 0) {
      from.value = 'Brett';
      to.value = 'Martina';
    } else {
      from.value = 'Martina';
      to.value = 'Brett';
    }
  },
  { immediate: true },
);
watch(from, (newFrom) => {
  if (!newFrom) {
    to.value = null;
    description.value = '';
    return;
  }
  to.value = newFrom === 'Brett' ? 'Martina' : 'Brett';
  autoFillDescription();
});
</script>
