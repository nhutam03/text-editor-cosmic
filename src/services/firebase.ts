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
    // Check if pluginRef is valid
    if (!pluginRef || typeof pluginRef.name !== 'string') {
      console.error('Invalid plugin reference:', pluginRef);
      throw new Error('Invalid plugin reference');
    }

    // Extract plugin name from reference to handle it safely
    const pluginName = pluginRef.name.replace('.zip', '');
    console.log(`Getting download URL for plugin reference: ${pluginName}`);
    console.log(`Plugin reference full path: ${pluginRef.fullPath}`);

    // Create a new reference to ensure it's properly initialized
    const safeRef = ref(storage, `/plugins/${pluginName}.zip`);
    console.log(`Created safe reference with path: ${safeRef.fullPath}`);

    // Get the download URL using the safe reference
    const url = await getDownloadURL(safeRef);
    console.log(`Successfully got download URL for ${pluginName}: ${url}`);
    return url;
  } catch (error: any) {
    console.error('Error getting plugin download URL:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    if (error.customData) {
      console.error('Server response:', error.customData.serverResponse);
    }

    // Extract plugin name from reference for fallback
    const pluginName = pluginRef?.name?.replace('.zip', '') || 'unknown';

    // Không sử dụng URL hardcode nữa, thay vào đó sẽ tạo URL dựa trên tên plugin và bucket
    console.log(`Không sử dụng URL hardcode, sẽ tạo URL dựa trên tên plugin và bucket`);

    // Tạo URL dựa trên tên plugin và bucket
    const bucket = firebaseConfig.storageBucket;
    const pluginFileName = `${pluginName}.zip`;
    const encodedPluginName = encodeURIComponent(`plugins/${pluginFileName}`);
    const dynamicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPluginName}?alt=media`;

    console.log(`Tạo URL động cho plugin ${pluginName}: ${dynamicUrl}`);

    // Kiểm tra URL bằng cách gửi request HEAD
    try {
      const response = await fetch(dynamicUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log(`URL hợp lệ và có thể truy cập: ${dynamicUrl}`);
        return dynamicUrl;
      } else {
        console.log(`URL trả về status ${response.status}: ${dynamicUrl}`);
        // Tiếp tục với getPluginDownloadUrlByName
      }
    } catch (error) {
      console.log(`Lỗi kiểm tra URL: ${error}`);
      // Tiếp tục với getPluginDownloadUrlByName
    }

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

    // Tạo tham chiếu đến plugin trong Firebase Storage
    const pluginRef = ref(storage, `/plugins/${normalizedName}.zip`);
    console.log(`Plugin reference path: ${pluginRef.fullPath}`);

    try {
      // Lấy URL tải xuống từ Firebase Storage
      const downloadUrl = await getDownloadURL(pluginRef);
      console.log(`Found download URL for ${normalizedName}: ${downloadUrl}`);
      return downloadUrl;
    } catch (error) {
      console.log(`Error getting download URL for ${normalizedName}: ${error}`);

      // Thử với tên đầy đủ nếu tên chuẩn hóa không hoạt động
      const fullNameRef = ref(storage, `/plugins/${pluginName}.zip`);
      console.log(`Trying with full name: ${fullNameRef.fullPath}`);

      try {
        const fullNameUrl = await getDownloadURL(fullNameRef);
        console.log(`Found download URL for ${pluginName}: ${fullNameUrl}`);
        return fullNameUrl;
      } catch (fullNameError) {
        console.log(`Error getting download URL for ${pluginName}: ${fullNameError}`);

        // Thử với tên có phiên bản
        const versionedRef = ref(storage, `/plugins/${normalizedName}-1.0.0.zip`);
        console.log(`Trying with versioned name: ${versionedRef.fullPath}`);

        try {
          const versionedUrl = await getDownloadURL(versionedRef);
          console.log(`Found download URL for ${normalizedName}-1.0.0: ${versionedUrl}`);
          return versionedUrl;
        } catch (versionedError) {
          console.log(`Error getting download URL for ${normalizedName}-1.0.0: ${versionedError}`);
          // Tiếp tục với các phương pháp khác
        }
      }
    }

    // Tạo tham chiếu đến plugin trong Firebase Storage
    console.log(`Creating reference to plugin in Firebase Storage: ${pluginName}`);

    // Tạo danh sách các tên file có thể có
    const possibleFileNames = [
      `${pluginName}.zip`,
      `${normalizedName}.zip`,
      `${normalizedName}-1.0.0.zip`,
      `${pluginName}-1.0.0.zip`
    ];

    // Thử từng tên file
    for (const fileName of possibleFileNames) {
      try {
        console.log(`Trying to get plugin with filename: ${fileName}`);
        const pluginRef = ref(storage, `/plugins/${fileName}`);
        console.log(`Plugin reference path: ${pluginRef.fullPath}`);

        // Lấy URL tải xuống từ Firebase Storage
        const downloadUrl = await getDownloadURL(pluginRef);
        console.log(`Found download URL for ${fileName}: ${downloadUrl}`);
        return downloadUrl;
      } catch (error) {
        console.log(`Error getting download URL for ${fileName}: ${error}`);
        // Tiếp tục với tên file tiếp theo
      }
    }

    // Thử với các tên plugin khác nhau
    const possibleNames = [
      pluginName,                // Tên gốc
      normalizedName,            // Tên chuẩn hóa
      `${normalizedName}-1.0.0`  // Với phiên bản
    ];

    // Try each possible name
    for (const name of possibleNames) {
      try {
        console.log(`Trying to get download URL for: ${name}`);
        const pluginRef = ref(storage, `/plugins/${name}.zip`);
        console.log(`Created reference with path: ${pluginRef.fullPath}`);

        const downloadUrl = await getDownloadURL(pluginRef);
        console.log(`Found download URL for ${name}: ${downloadUrl}`);
        return downloadUrl;
      } catch (nameError: any) {
        console.log(`No plugin found with name: ${name}`);
        if (nameError.code) {
          console.log(`Error code: ${nameError.code}`);
        }
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

    // Tạo URL động dựa trên tên plugin và bucket
    console.log(`Tạo URL động dựa trên tên plugin và bucket`);

    // Danh sách các tên file có thể có
    const dynamicFileNames = [
      `${normalizedName}.zip`,
      `${normalizedName}-1.0.0.zip`,
      `${pluginName}.zip`,
      `${pluginName}-1.0.0.zip`
    ];

    // Thử từng tên file
    for (const fileName of dynamicFileNames) {
      try {
        const bucket = firebaseConfig.storageBucket;
        const encodedPluginName = encodeURIComponent(`plugins/${fileName}`);
        const dynamicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPluginName}?alt=media`;

        console.log(`Thử URL động: ${dynamicUrl}`);

        // Kiểm tra URL bằng cách gửi request HEAD
        const response = await fetch(dynamicUrl, { method: 'HEAD' });
        if (response.ok) {
          console.log(`URL hợp lệ và có thể truy cập: ${dynamicUrl}`);
          return dynamicUrl;
        } else {
          console.log(`URL trả về status ${response.status}: ${dynamicUrl}`);
          // Tiếp tục với tên file tiếp theo
        }
      } catch (error) {
        console.log(`Lỗi kiểm tra URL: ${error}`);
        // Tiếp tục với tên file tiếp theo
      }
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

    // Thử tạo URL trực tiếp dựa trên tên plugin và bucket
    try {
      const bucket = firebaseConfig.storageBucket;
      const encodedPluginName = encodeURIComponent(`plugins/${pluginName}.zip`);
      const directUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPluginName}?alt=media`;

      console.log(`Trying direct URL construction: ${directUrl}`);

      // Kiểm tra xem URL có tồn tại không
      const response = await fetch(directUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log(`Direct URL exists and is accessible: ${directUrl}`);
        return directUrl;
      } else {
        console.log(`Direct URL returned status ${response.status}: ${directUrl}`);
      }
    } catch (error) {
      console.log(`Error checking direct URL: ${error}`);
    }

    // Fall back to mock implementation
    console.log('Falling back to mock getPluginDownloadUrlByName due to error');
    return firebaseMock.getPluginDownloadUrlByName(pluginName);
  }
}
