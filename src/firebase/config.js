import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDB9u6J352DVd_rIVRLCI0WvRtiXq7li6Y",
  authDomain: "careconnect-2026.firebaseapp.com",
  projectId: "careconnect-2026",
  storageBucket: "careconnect-2026.firebasestorage.app",
  messagingSenderId: "1002353891921",
  appId: "1:1002353891921:web:31c079915e160ff6807670",
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
