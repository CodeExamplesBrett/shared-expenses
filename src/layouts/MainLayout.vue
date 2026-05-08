<template>
  <q-layout view="lHh lpr lFf">
    <q-header elevated>
      <q-toolbar>
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
import { useRouter } from 'vue-router';
import { useAuthStore } from 'stores/auth';

const router = useRouter();
const authStore = useAuthStore();

async function handleSignOut() {
  await authStore.signOut();
  await router.push('/login');
}
</script>
