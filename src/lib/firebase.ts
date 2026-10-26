/**
 * إعداد Firebase وتصدير Auth و Firestore لتطبيق رفيقي
 * مشروع: rafeeqi-c8c57
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || '';
const appId = import.meta.env.VITE_FIREBASE_APP_ID || '';

// التحقق من صحة واكتمال الإعدادات السحابية
export const isFirebaseConfigured = Boolean(apiKey.trim() && appId.trim());

const firebaseConfig = {
  apiKey: apiKey || 'unconfigured-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'rafeeqi-c8c57.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'rafeeqi-c8c57',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'rafeeqi-c8c57.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: appId || 'unconfigured-app-id',
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});
