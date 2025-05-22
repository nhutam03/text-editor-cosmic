// Firebase configuration for the Cosmic Text Editor project
import { getFirebaseConfig } from '../utils/env-loader';

// Get Firebase configuration from environment variables or use hardcoded values as fallback
export const firebaseConfig = getFirebaseConfig() || {
  apiKey: "AIzaSyDNYDfz8wxViPu-9wVb7AzrTtv74EILogc",
  authDomain: "cosmic-text-editor.firebaseapp.com",
  projectId: "cosmic-text-editor",
  storageBucket: "cosmic-text-editor.firebasestorage.app",
  messagingSenderId: "339146736696",
  appId: "1:339146736696:web:f9f13e317905a9c8f9d2cd",
  measurementId: "G-XH2NWVZJBT"
};
