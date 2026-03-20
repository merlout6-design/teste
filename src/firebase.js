import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAf7ML3Gd9kJQI5XcowCRlH0F1VF7x-gMI",
  authDomain: "rodaodef.firebaseapp.com",
  projectId: "rodaodef",
  storageBucket: "rodaodef.firebasestorage.app",
  messagingSenderId: "232817991067",
  appId: "1:232817991067:web:43d6cb14e3b3e4ea10153e",
  measurementId: "G-SGFYV3565X"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();