// ===== CONFIGURACIÓN DE FIREBASE =====
import { initializeApp } from "firebase/app";
const firebaseConfig = {
    apiKey: "AIzaSyCieW2pgIbGFqwBPkTQ6IK4a6QDbdoMvog",
    authDomain: "stockmaster-173bd.firebaseapp.com",
    projectId: "stockmaster-173bd",
    storageBucket: "stockmaster-173bd.firebasestorage.app",
    messagingSenderId: "1016129124873",
    appId: "1:1016129124873:web:316bf3b649248d0b6696d8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Autenticación anónima
auth.signInAnonymously()
    .then(() => console.log('✅ Autenticado anónimamente'))
    .catch(error => console.error('Error autenticación:', error));