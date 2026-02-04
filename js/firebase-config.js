/**
 * Firebase Config (MODULAR - sem compat)
 * Usa Firebase v10.7.1 via ESM (type="module")
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBjJLveyhydYG8Tpr_OT794W8xWfy2SNck",
  authDomain: "rett-ff48d.firebaseapp.com",
  projectId: "rett-ff48d",
  storageBucket: "rett-ff48d.firebasestorage.app",
  messagingSenderId: "769230640017",
  appId: "1:769230640017:web:b445c5f49a2dbc456d0030",
  measurementId: "G-QW9MQWEQ6G"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

/**
 * Firestore: escolha APENAS 1:
 * - experimentalAutoDetectLongPolling: tenta detectar automaticamente
 * - experimentalForceLongPolling: força long polling sempre
 *
 * Recomendo AutoDetect primeiro (mais leve).
 */
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  // experimentalForceLongPolling: true, // <- use este só se continuar com problemas
  ignoreUndefinedProperties: true
});

console.log("[FIREBASE] Modular inicializado (Auth + Firestore).");
