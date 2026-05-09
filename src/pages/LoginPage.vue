<template>
  <div class="flex flex-center bg-grey-2" style="min-height: 100vh">
    <q-card style="width: 100%; max-width: 400px" class="q-ma-md">
      <q-card-section class="text-center q-pb-none">
        <q-icon name="receipt_long" color="primary" size="48px" />
        <div class="text-h5 q-mt-sm">Shared Expenses</div>
        <div class="text-subtitle2 text-grey-6">
          {{ isRegister ? 'Create an account' : 'Sign in to continue' }}
        </div>
      </q-card-section>

      <q-card-section class="q-gutter-sm">
        <q-btn
          color="white"
          text-color="dark"
          class="full-width"
          outline
          icon="img:https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
          label="Continue with Google"
          :loading="loadingGoogle"
          @click="handleGoogle"
        />

        <q-separator />

        <q-input v-model="email" label="Email" type="email" outlined dense autocomplete="email" />

        <q-input
          v-model="password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          outlined
          dense
          autocomplete="current-password"
          @keyup.enter="handleEmail"
        >
          <template #append>
            <q-icon
              :name="showPassword ? 'visibility_off' : 'visibility'"
              class="cursor-pointer"
              @click="showPassword = !showPassword"
            />
          </template>
        </q-input>

        <q-banner v-if="errorMsg" class="bg-negative text-white" rounded dense>
          {{ errorMsg }}
        </q-banner>
      </q-card-section>

      <q-card-actions class="q-px-md q-pb-md q-gutter-sm column">
        <q-btn
          :label="isRegister ? 'Create account' : 'Sign in'"
          color="primary"
          class="full-width"
          :loading="loadingEmail"
          :disable="!isValid"
          @click="handleEmail"
        />

        <q-btn
          flat
          dense
          :label="isRegister ? 'Already have an account? Sign in' : 'No account? Create one'"
          color="primary"
          class="full-width"
          @click="toggleMode"
        />
      </q-card-actions>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from 'stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const isRegister = ref(false);
const loadingGoogle = ref(false);
const loadingEmail = ref(false);
const errorMsg = ref('');

const isValid = computed(() => email.value.trim() !== '' && password.value.length >= 6);

function toggleMode() {
  isRegister.value = !isRegister.value;
  errorMsg.value = '';
}

async function handleGoogle() {
  errorMsg.value = '';
  loadingGoogle.value = true;
  try {
    await authStore.signInWithGoogle();
    await router.push('/');
  } catch (e: unknown) {
    errorMsg.value = friendlyError(e);
  } finally {
    loadingGoogle.value = false;
  }
}

async function handleEmail() {
  if (!isValid.value) return;
  errorMsg.value = '';
  loadingEmail.value = true;
  try {
    if (isRegister.value) {
      await authStore.registerWithEmail(email.value, password.value);
    } else {
      await authStore.signInWithEmail(email.value, password.value);
    }
    await router.push('/');
  } catch (e: unknown) {
    errorMsg.value = friendlyError(e);
  } finally {
    loadingEmail.value = false;
  }
}

function friendlyError(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  if (
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential'
  ) {
    return 'Incorrect email or password.';
  }
  if (code === 'auth/email-already-in-use') return 'That email is already registered.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please try again later.';
  if (code === 'auth/popup-closed-by-user') return '';
  return 'Something went wrong. Please try again.';
}
</script>
