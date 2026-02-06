import { boot } from 'quasar/wrappers';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAxfxDLT133XATXYIS3HFRzpmihT-rlIj0',
  authDomain: 'shared-expenses-9800b.firebaseapp.com',
  projectId: 'shared-expenses-9800b',
  storageBucket: 'shared-expenses-9800b.firebasestorage.app',
  messagingSenderId: '153691354376',
  appId: '1:153691354376:web:e99ac15adbcbf8824268bd',
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

export { db };

export default boot(() => {
  // nothing else needed here (yet)
});
