import { boot } from 'quasar/wrappers';
import { useAuthStore } from 'stores/auth';

export default boot(() => {
  useAuthStore().startListening();
});
