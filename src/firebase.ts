import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB9TIPFrFpnlXvERM-Ao_gUWGmSOY5H130",
  authDomain: "mobius-a5a12.firebaseapp.com",
  projectId: "mobius-a5a12",
  storageBucket: "mobius-a5a12.firebasestorage.app",
  messagingSenderId: "101229279545",
  appId: "1:101229279545:web:885ea23ea391564ecd90e8",
  measurementId: "G-J94WQVXP84",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
