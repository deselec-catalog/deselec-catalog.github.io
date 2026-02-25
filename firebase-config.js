// ===== CONFIGURACIÓN DE FIREBASE =====
// REEMPLAZA ESTOS VALORES CON LOS DE TU PROYECTO FIREBASE
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Autenticación anónima
auth.signInAnonymously()
    .then(() => console.log('✅ Autenticado anónimamente'))
    .catch(error => console.error('Error autenticación:', error));