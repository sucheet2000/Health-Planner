import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCnvkh-3u0kQXV52WDscbpUHYrq-_4SQh8",
  authDomain: "lamar-health-4e241.firebaseapp.com",
  projectId: "lamar-health-4e241",
  storageBucket: "lamar-health-4e241.firebasestorage.app",
  messagingSenderId: "24105594428",
  appId: "1:24105594428:web:41768dfbdd78ab7e9b5d39"
};

let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export { db };
