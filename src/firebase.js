import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCkPhOoeRA02YiP-Eql-Zi-kZmP53LFrfA",
  authDomain: "expense-tracker-d1ed6.firebaseapp.com",
  projectId: "expense-tracker-d1ed6",
  storageBucket: "expense-tracker-d1ed6.firebasestorage.app",
  messagingSenderId: "389717640104",
  appId: "1:389717640104:web:7cdf8c972b325ecc26139d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);