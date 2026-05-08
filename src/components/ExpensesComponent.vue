<template>
  <q-page class="q-pa-md flex flex-center">
    <div class="app-container">
      <q-card class="q-mb-md">
        <q-card-section class="text-center">
          <div class="text-subtitle1">
            {{ balanceText }}
          </div>
        </q-card-section>
      </q-card>

      <q-btn
        color="primary"
        icon="receipt"
        label="Add expense  50/50 ._)"
        class="full-width q-mb-md"
        @click="showDialog = true"
      />

      <q-btn
        color="secondary"
        icon="payment"
        label="Add payment"
        class="full-width q-mb-md"
        @click="showPaymentDialog = true"
      />

      <q-list bordered separator>
        <q-item
          v-for="expense in expenses"
          :key="expense.id"
          clickable
          :class="itemClass(expense)"
          @click="editExpense(expense)"
        >
          <q-item-section>
            <q-item-label>{{ expense.description }}</q-item-label>
            <q-item-label caption>{{ expense.date }}</q-item-label>
          </q-item-section>

          <q-item-section side>
            <span :class="expense.amount > 0 ? 'text-positive' : 'text-negative'">
              {{ formatAmount(expense.amount) }}
            </span>
          </q-item-section>

          <q-item-section side>
            <q-btn
              icon="delete"
              flat
              dense
              color="negative"
              @click.stop="deleteExpense(expense.id)"
            />
          </q-item-section>
        </q-item>
      </q-list>

      <AddExpenseDialog v-model="showDialog" :expense="selectedExpense" />

      <PaymentDialog v-model:open="showPaymentDialog" :payment="selectedPayment" />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useExpensesStore } from 'stores/expenses';
import AddExpenseDialog from 'components/AddExpenseDialog.vue';
import type { Expense } from 'stores/expenses';
import PaymentDialog from 'components/PaymentDialog.vue';

const selectedExpense = ref<Expense | null>(null);
const selectedPayment = ref<Expense | null>(null);

const store = useExpensesStore();

const showDialog = ref(false);
const showPaymentDialog = ref(false);

const expenses = computed(() => store.expenses);

const balanceText = computed(() => {
  if (store.balance > 0) {
    return `Martina owes Brett €${store.balance.toFixed(2)}`;
  }
  if (store.balance < 0) {
    return `Brett owes Martina €${Math.abs(store.balance).toFixed(2)}`;
  }
  return 'All settled 😊';
});

function formatAmount(amount: number) {
  return `${amount > 0 ? '+' : ''}${amount.toFixed(2)} €`;
}

function editExpense(expense: Expense) {
  if (expense.type === 'payment') {
    selectedPayment.value = expense;
    showPaymentDialog.value = true;
  } else {
    selectedExpense.value = expense;
    showDialog.value = true;
  }
}

async function deleteExpense(id: string) {
  await store.deleteExpense(id);
}

function itemClass(expense: Expense) {
  return expense.type === 'payment' ? 'payment-item' : 'expense-item';
}

onMounted(() => {
  store.startListening();
});

onUnmounted(() => {
  store.stopListening();
});

watch(showDialog, (open) => {
  if (!open) selectedExpense.value = null;
});

watch(showDialog, (open) => {
  if (!open) selectedExpense.value = null;
});

watch(showPaymentDialog, (open) => {
  if (!open) selectedPayment.value = null;
});
</script>

<style scoped>
.app-container {
  width: 100%;
  max-width: 420px;
}

.expense-item,
.payment-item {
  position: relative;
}

.expense-item::before,
.payment-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10%;
  bottom: 10%;
  width: 4px;
  border-radius: 2px;
}

.expense-item:hover::before,
.payment-item:hover::before {
  top: 6%;
  bottom: 6%;
}

.expense-item::before {
  background-color: #1976d2; /* Quasar primary */
}

.payment-item::before {
  background-color: #26a69a; /* Quasar secondary */
}
</style>
