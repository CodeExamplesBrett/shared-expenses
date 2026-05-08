import { defineStore } from 'pinia';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from 'boot/firebase';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    ready: false,
  }),

  getters: {
    isLoggedIn: (state) => state.user !== null,
  },

  actions: {
    startListening() {
      onAuthStateChanged(auth, (user) => {
        this.user = user;
        this.ready = true;
      });
    },

    async signInWithGoogle() {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    },

    async signInWithEmail(email: string, password: string) {
      await signInWithEmailAndPassword(auth, email, password);
    },

    async registerWithEmail(email: string, password: string) {
      await createUserWithEmailAndPassword(auth, email, password);
    },

    async signOut() {
      await firebaseSignOut(auth);
    },
  },
});
