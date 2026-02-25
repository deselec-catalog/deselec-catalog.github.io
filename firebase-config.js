// ===== CONFIGURACIÓN DE FIREBASE =====
const firebaseConfig = {
    apiKey: "AIzaSyCieW2pgIbGFqwBPkTQ6IK4a6QDbdoMvog",
    authDomain: "stockmaster-173bd.firebaseapp.com",
    projectId: "stockmaster-173bd",
    storageBucket: "stockmaster-173bd.firebasestorage.app",
    messagingSenderId: "1016129124873",
    appId: "1:1016129124873:web:316bf3b649248d0b6696d8"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

console.log('✅ Firebase inicializado correctamente');
console.log('📊 Proyecto:', firebaseConfig.projectId);