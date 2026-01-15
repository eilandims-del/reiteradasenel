/**
 * Configuração do Firebase
 * Substitua as credenciais abaixo pelas suas do Firebase Console
 */

// TODO: Configure suas credenciais do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBGoHI9AO-vHhZuwO8bUCgM19XbAe1ZrKQ",
    authDomain: "enel-reintera.firebaseapp.com",
    projectId: "enel-reintera",
    storageBucket: "enel-reintera.firebasestorage.app",
    messagingSenderId: "5266075645",
    appId: "1:5266075645:web:7bbda69f4036822371b394"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Exportar serviços
export const auth = firebase.auth();
export const db = firebase.firestore();

