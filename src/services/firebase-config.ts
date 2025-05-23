// Firebase configuration for the Cosmic Text Editor project
import { getFirebaseConfig } from '../utils/env-loader';

// Get Firebase configuration from environment variables only
const config = getFirebaseConfig();

// Validate that all required Firebase configuration is present
if (!config.apiKey || !config.authDomain || !config.projectId || !config.storageBucket || !config.messagingSenderId || !config.appId) {
  console.error('❌ [Firebase] Missing required Firebase configuration. Please check your .env file.');
  console.error('Required variables: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID');
  throw new Error('Missing Firebase configuration');
}

export const firebaseConfig = config;
