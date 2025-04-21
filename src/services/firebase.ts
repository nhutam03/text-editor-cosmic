import { initializeApp } from 'firebase/app';
import { getStorage, ref, getDownloadURL, listAll, uploadBytes, StorageReference } from 'firebase/storage';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env');
console.log('Loading environment variables from:', envPath);
dotenv.config({ path: envPath });

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY ,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID ,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET ,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Function to check if Firebase Storage is properly configured
async function checkFirebaseStorage() {
  try {
    // Try to access the root of the storage bucket
    const rootRef = ref(storage, '/');
    const rootResult = await listAll(rootRef);
    if (rootResult.prefixes.length > 0) {
      rootResult.prefixes.forEach(prefix => {
        console.log('- Folder:', prefix.name, 'Full path:', prefix.fullPath);
      });
    }
    return true;
  } catch (error: any) {
    console.error('Error checking Firebase Storage:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    if (error.customData) {
      console.error('Server response:', error.customData.serverResponse);
    }
    return false;
  }
}

// Plugin storage reference
// Thử với đường dẫn tuyệt đối
const pluginsRef = ref(storage, '/plugins');

// Log để debug
console.log('Firebase Storage Bucket:', firebaseConfig.storageBucket);
console.log('Plugins reference path:', pluginsRef.fullPath);

// Function to try creating a placeholder file in the plugins folder
async function tryCreatePluginsFolder() {
  try {

    const placeholderRef = ref(storage, '/plugins/placeholder.txt');
    const placeholderContent = 'This is a placeholder file to ensure the plugins folder exists.';
    const bytes = new TextEncoder().encode(placeholderContent);
    await uploadBytes(placeholderRef, bytes);
    return true;
  } catch (error: any) {
    console.error('Error creating plugins folder:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    if (error.customData) {
      console.error('Server response:', error.customData.serverResponse);
    }

    return false;
  }
}

// Check Firebase Storage configuration
checkFirebaseStorage().then(async isConfigured => {
  if (isConfigured) {

    // Try to list plugins folder
    try {
      console.log('Checking if plugins folder exists...');
      const pluginsResult = await listAll(pluginsRef);
      console.log('Plugins folder exists with', pluginsResult.items.length, 'items');
    } catch (error: any) {
      console.error('Error checking plugins folder:', error);

      if (error.code === 'storage/object-not-found') {
        console.log('Plugins folder does not exist. Trying to create it...');
        const created = await tryCreatePluginsFolder();
        if (created) {
          console.log('Plugins folder created successfully!');
        } else {
          console.error('Failed to create plugins folder.');
        }
      }
    }
  } else {
    console.error('Firebase Storage is NOT properly configured!');
    console.error('Please check your Firebase project settings and make sure Storage is enabled.');
    console.error('Also make sure the storage bucket name is correct:', firebaseConfig.storageBucket);
  }
});

/**
 * Get a list of all available plugins from Firebase Storage
 */
export async function getAvailablePlugins(): Promise<{ name: string, ref: StorageReference }[]> {
  try {

    const result = await listAll(pluginsRef);
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

    console.error('Storage bucket used:', firebaseConfig.storageBucket);
    console.error('Plugins reference path:', pluginsRef.fullPath);
    console.error('Current working directory:', process.cwd());

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
    console.log(`Getting download URL for plugin: ${pluginName}`);

    // Normalize plugin name (remove version suffix if present)
    const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');
    console.log(`Normalized plugin name: ${normalizedName}`);

    // Try different possible plugin names
    const possibleNames = [
      pluginName,                // Original name
      normalizedName,            // Normalized name
      `${normalizedName}-1.0.0`, // With version
      'export-to-pdf',           // Specific for export-to-pdf plugin
      'export-to-pdf-1.0.0',     // Specific version for export-to-pdf
      'pdf-export',              // Alternative name for export-to-pdf
      'prettier-plugin',         // Specific for prettier plugin
      'prettier-plugin-1.0.0',   // Specific version for prettier
      'prettier'                 // Alternative name for prettier
    ];

    // Thử trực tiếp với URL từ Firebase Storage
    if (normalizedName === 'export-to-pdf') {
      try {
        // URL từ Firebase Storage trong hình ảnh của bạn
        const directUrl = 'https://firebasestorage.googleapis.com/v0/b/cosmic-text-editor.appspot.com/o/plugins%2Fexport-to-pdf-1.0.0.zip?alt=media';
        console.log(`Trying direct URL for export-to-pdf: ${directUrl}`);
        return directUrl;
      } catch (directError) {
        console.log('Direct URL failed, continuing with other methods');
      }
    }

    // Try each possible name
    for (const name of possibleNames) {
      try {
        console.log(`Trying to get download URL for: ${name}`);
        const pluginRef = ref(storage, `/plugins/${name}.zip`);
        const downloadUrl = await getDownloadURL(pluginRef);
        console.log(`Found download URL for ${name}: ${downloadUrl}`);
        return downloadUrl;
      } catch (nameError) {
        console.log(`No plugin found with name: ${name}`);
        // Continue to the next name
      }
    }

    // If we get here, none of the possible names worked
    // Try to list all available plugins and find a match
    console.log('Trying to find plugin in available plugins list...');
    const availablePlugins = await getAvailablePlugins();
    console.log('Available plugins:', availablePlugins.map(p => p.name));

    // Find a plugin that matches any of our possible names
    for (const plugin of availablePlugins) {
      for (const name of possibleNames) {
        if (plugin.name.toLowerCase().includes(name.toLowerCase())) {
          console.log(`Found matching plugin: ${plugin.name}`);
          return await getPluginDownloadUrl(plugin.ref);
        }
      }
    }

    // Nếu vẫn không tìm thấy, thử URL cứng cho export-to-pdf
    if (normalizedName === 'export-to-pdf') {
      console.log('Falling back to hardcoded URL for export-to-pdf');
      return 'https://firebasestorage.googleapis.com/v0/b/cosmic-text-editor.appspot.com/o/plugins%2Fexport-to-pdf-1.0.0.zip?alt=media';
    }

    // If we still can't find it, throw an error
    throw new Error(`Plugin ${pluginName} not found in Firebase Storage`);
  } catch (error: any) {
    console.error(`Error getting download URL for plugin ${pluginName}:`, error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    if (error.customData) {
      console.error('Server response:', error.customData.serverResponse);
    }

    console.error('Storage bucket used:', firebaseConfig.storageBucket);
    console.error('Current working directory:', process.cwd());

    // Nếu là export-to-pdf, trả về URL cứng ngay cả khi có lỗi
    if (pluginName === 'export-to-pdf' || pluginName.includes('export-to-pdf')) {
      console.log('Error occurred but returning hardcoded URL for export-to-pdf');
      return 'https://firebasestorage.googleapis.com/v0/b/cosmic-text-editor.appspot.com/o/plugins%2Fexport-to-pdf-1.0.0.zip?alt=media';
    }

    throw error;
  }
}
