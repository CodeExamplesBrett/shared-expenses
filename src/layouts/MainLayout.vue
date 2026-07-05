<template>
  <q-layout view="lHh lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat round dense icon="menu" aria-label="Menu">
          <q-menu anchor="bottom left" self="top left">
            <q-list style="min-width: 200px">
              <q-item clickable v-close-popup to="/" exact>
                <q-item-section avatar>
                  <q-icon name="receipt_long" />
                </q-item-section>
                <q-item-section>Expenses</q-item-section>
              </q-item>
              <q-item clickable v-close-popup to="/food-diary" exact>
                <q-item-section avatar>
                  <q-icon name="restaurant" />
                </q-item-section>
                <q-item-section>Food Diary</q-item-section>
              </q-item>
              <q-item clickable v-close-popup to="/food-diary/prices" exact>
                <q-item-section avatar>
                  <q-icon name="sell" />
                </q-item-section>
                <q-item-section>Ingredient Prices</q-item-section>
              </q-item>

              <q-separator />

              <q-item-label header>Theme</q-item-label>
              <q-item clickable v-close-popup :active="!$q.dark.isActive" @click="setDark(false)">
                <q-item-section avatar>
                  <q-icon name="light_mode" />
                </q-item-section>
                <q-item-section>Light mode</q-item-section>
              </q-item>
              <q-item clickable v-close-popup :active="$q.dark.isActive" @click="setDark(true)">
                <q-item-section avatar>
                  <q-icon name="dark_mode" />
                </q-item-section>
                <q-item-section>Dark mode</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <q-toolbar-title>Shared Expenses</q-toolbar-title>

        <q-btn flat round dense icon="logout" @click="handleSignOut">
          <q-tooltip>Sign out</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useAuthStore } from 'stores/auth';

const DARK_MODE_KEY = 'shared-expenses-dark-mode';

const $q = useQuasar();
const router = useRouter();
const authStore = useAuthStore();

onMounted(() => {
  const stored = localStorage.getItem(DARK_MODE_KEY);
  $q.dark.set(stored === 'true');
});

function setDark(value: boolean) {
  $q.dark.set(value);
  localStorage.setItem(DARK_MODE_KEY, String(value));
}

async function handleSignOut() {
  await authStore.signOut();
  await router.push('/login');
}
</script>
