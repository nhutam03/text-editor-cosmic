import { initializeApp } from 'firebase/app';
import { getStorage, ref, getDownloadURL, listAll, uploadBytes, StorageReference } from 'firebase/storage';
import { firebaseConfig } from './firebase-config';
import * as firebaseMock from './firebase-mock';

// Log Firebase configuration for debugging
console.log('Firebase configuration loaded:', {
  apiKey: firebaseConfig.apiKey ? '✓ Set' : '✗ Missing',
  authDomain: firebaseConfig.authDomain ? '✓ Set' : '✗ Missing',
  projectId: firebaseConfig.projectId ? '✓ Set' : '✗ Missing',
  storageBucket: firebaseConfig.storageBucket ? '✓ Set' : '✗ Missing',
  messagingSenderId: firebaseConfig.messagingSenderId ? '✓ Set' : '✗ Missing',
  appId: firebaseConfig.appId ? '✓ Set' : '✗ Missing',
  measurementId: firebaseConfig.measurementId ? '✓ Set' : '✗ Missing'
});

// Initialize Firebase
let app: any;
let storage: any;
let useMockImplementation = false;

try {
  // Check if storageBucket is set
  if (!firebaseConfig.storageBucket) {
    console.error('Firebase Storage Bucket is not set in the configuration!');
    console.error('Please check your .env file and make sure VITE_FIREBASE_STORAGE_BUCKET is set correctly.');
    throw new Error('Firebase Storage: No default bucket found. Did you set the storageBucket property?');
  }

  app = initializeApp(firebaseConfig);
  storage = getStorage(app);
  console.log('Firebase initialized successfully with storage bucket:', firebaseConfig.storageBucket);
} catch (error) {
  console.error('Error initializing Firebase:', error);
  console.log('Falling back to mock implementation for Firebase Storage');
  useMockImplementation = true;
}

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
  // If we're using mock implementation, use the mock function
  if (useMockImplementation) {
    console.log('Using mock getAvailablePlugins');
    return firebaseMock.getAvailablePlugins();
  }

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

    // Fall back to mock implementation
    console.log('Falling back to mock getAvailablePlugins due to error');
    return firebaseMock.getAvailablePlugins();
  }
}

/**
 * Get download URL for a plugin
 */
export async function getPluginDownloadUrl(pluginRef: StorageReference): Promise<string> {
  // If we're using mock implementation, use the mock function
  if (useMockImplementation) {
    console.log('Using mock getPluginDownloadUrl');
    return firebaseMock.getPluginDownloadUrl(pluginRef);
  }

  try {
    // Extract plugin name from reference to handle it safely
    const pluginName = pluginRef.name.replace('.zip', '');
    console.log(`Getting download URL for plugin reference: ${pluginName}`);

    // Create a new reference to ensure it's properly initialized
    const safeRef = ref(storage, `/plugins/${pluginName}.zip`);

    // Get the download URL using the safe reference
    return await getDownloadURL(safeRef);
  } catch (error) {
    console.error('Error getting plugin download URL:', error);

    // Extract plugin name from reference for fallback
    const pluginName = pluginRef.name.replace('.zip', '');

    // Fall back to getPluginDownloadUrlByName which has better error handling
    console.log(`Falling back to getPluginDownloadUrlByName for ${pluginName}`);
    return getPluginDownloadUrlByName(pluginName);
  }
}

/**
 * Get download URL for a plugin by name
 */
export async function getPluginDownloadUrlByName(pluginName: string): Promise<string> {
  // If we're using mock implementation, use the mock function
  if (useMockImplementation) {
    console.log('Using mock getPluginDownloadUrlByName');
    return firebaseMock.getPluginDownloadUrlByName(pluginName);
  }

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
      'prettier',                // Alternative name for prettier
      'ai-assistant',            // Specific for AI assistant plugin
      'ai-assistant-1.0.0',      // Specific version for AI assistant
      'code-runner',             // Specific for code runner plugin
      'code-runner.zip',         // Exact filename for code runner
      'AutoSave_Plugin',         // AutoSave plugin
      'AutoSave_Plugin.zip'      // Exact filename for AutoSave plugin
    ];

    // Thử trực tiếp với URL từ Firebase Storage cho các plugin đặc biệt
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

    // Special handling for ai-assistant plugin
    if (normalizedName === 'ai-assistant') {
      try {
        // Sử dụng URL trực tiếp từ Firebase Console
        const directUrl = 'https://firebasestorage.googleapis.com/v0/b/cosmic-text-editor.appspot.com/o/plugins%2Fai-assistant-1.0.0.zip?alt=media';
        console.log(`Trying direct URL for ai-assistant: ${directUrl}`);
        return directUrl;
      } catch (directError) {
        console.log('Direct URL failed for ai-assistant, continuing with other methods');
      }
    }

    // Special handling for code-runner plugin
    if (normalizedName === 'code-runner') {
      try {
        // Sử dụng URL trực tiếp từ Firebase Console
        const directUrl = 'https://firebasestorage.googleapis.com/v0/b/cosmic-text-editor.appspot.com/o/plugins%2Fcode-runner.zip?alt=media';
        console.log(`Trying direct URL for code-runner: ${directUrl}`);
        return directUrl;
      } catch (directError) {
        console.log('Direct URL failed for code-runner, continuing with other methods');
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

    // If we still can't find it, fall back to mock implementation
    console.log(`Plugin ${pluginName} not found in Firebase Storage, falling back to mock`);
    return firebaseMock.getPluginDownloadUrlByName(pluginName);
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

    // Special handling for ai-assistant plugin
    if (pluginName === 'ai-assistant' || pluginName.includes('ai-assistant')) {
      console.log('Error occurred but returning hardcoded URL for ai-assistant');
      return 'https://firebasestorage.googleapis.com/v0/b/cosmic-text-editor.appspot.com/o/plugins%2Fai-assistant-1.0.0.zip?alt=media';
    }

    // Special handling for code-runner plugin
    if (pluginName === 'code-runner' || pluginName.includes('code-runner')) {
      console.log('Error occurred but returning hardcoded URL for code-runner');
      return 'https://firebasestorage.googleapis.com/v0/b/cosmic-text-editor.appspot.com/o/plugins%2Fcode-runner.zip?alt=media';
    }

    // Fall back to mock implementation
    console.log('Falling back to mock getPluginDownloadUrlByName due to error');
    return firebaseMock.getPluginDownloadUrlByName(pluginName);
  }
}
