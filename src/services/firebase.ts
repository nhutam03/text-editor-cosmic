import { initializeApp } from 'firebase/app';
import { getStorage, ref, getDownloadURL, listAll, StorageReference } from 'firebase/storage';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDNYDfz8wxViPu-9wVb7AzrTtv74EILogc",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "cosmic-text-editor.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "cosmic-text-editor",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "cosmic-text-editor.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "339146736696",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:339146736696:web:f9f13e317905a9c8f9d2cd",
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || "G-XH2NWVZJBT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Plugin storage reference
// Thử với đường dẫn tuyệt đối
const pluginsRef = ref(storage, '/plugins');

// Log để debug
console.log('Firebase Storage Bucket:', firebaseConfig.storageBucket);
console.log('Plugins reference path:', pluginsRef.fullPath);

/**
 * Get a list of all available plugins from Firebase Storage
 */
export async function getAvailablePlugins(): Promise<{ name: string, ref: StorageReference }[]> {
  try {
    console.log('Fetching plugins from Firebase Storage...');
    const result = await listAll(pluginsRef);

    console.log('Found plugins:', result.items.length);
    result.items.forEach(item => {
      console.log('- Plugin:', item.name, 'Full path:', item.fullPath);
    });

    return result.items.map(item => ({
      name: item.name.replace('.zip', ''),
      ref: item
    }));
  } catch (error: any) {
    console.error('Error getting available plugins:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    if (error.customData) {
      console.error('Server response:', error.customData.serverResponse);
    }

    // Trả về mảng rỗng thay vì ném lỗi
    return [];
  }
}

/**
 * Get download URL for a plugin
 */
export async function getPluginDownloadUrl(pluginRef: StorageReference): Promise<string> {
  try {
    return await getDownloadURL(pluginRef);
  } catch (error) {
    console.error('Error getting plugin download URL:', error);
    throw error;
  }
}

/**
 * Get download URL for a plugin by name
 */
export async function getPluginDownloadUrlByName(pluginName: string): Promise<string> {
  try {
    // Sử dụng đường dẫn tuyệt đối
    const pluginRef = ref(storage, `/plugins/${pluginName}.zip`);
    console.log(`Trying to get download URL for plugin: ${pluginName}`);
    console.log(`Plugin reference path: ${pluginRef.fullPath}`);

    const downloadUrl = await getDownloadURL(pluginRef);
    console.log(`Download URL obtained: ${downloadUrl}`);
    return downloadUrl;
  } catch (error: any) {
    console.error(`Error getting download URL for plugin ${pluginName}:`, error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    if (error.customData) {
      console.error('Server response:', error.customData.serverResponse);
    }

    throw error;
  }
}
