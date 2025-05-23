import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import dotenv from 'dotenv';

/**
 * Load environment variables from .env file
 * This function handles both development and production environments
 */
export function loadEnvVariables() {
  try {
    // In development, .env is in the project root
    // In production, .env is in the extraResources folder
    let envPath = path.join(process.cwd(), '.env');

    // Check if we're in a packaged app
    if (app.isPackaged) {
      // In packaged app, the .env file is in the resources directory
      envPath = path.join(process.resourcesPath, '.env');
      console.log('Loading .env from resources path:', envPath);
    } else {
      console.log('Loading .env from current directory:', envPath);
    }

    // Check if the file exists
    if (fs.existsSync(envPath)) {
      // Parse the .env file
      const envConfig = dotenv.parse(fs.readFileSync(envPath));

      // Set environment variables
      for (const key in envConfig) {
        process.env[key] = envConfig[key];
      }

      console.log('Environment variables loaded successfully');
      return true;
    } else {
      console.error('.env file not found at path:', envPath);
      return false;
    }
  } catch (error) {
    console.error('Error loading environment variables:', error);
    return false;
  }
}

/**
 * Get Firebase configuration from environment variables
 */
export function getFirebaseConfig() {
  // Make sure environment variables are loaded
  loadEnvVariables();

  // Create Firebase config from environment variables
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
  };

  // Log the configuration for debugging
  console.log('Firebase configuration loaded:', {
    apiKey: firebaseConfig.apiKey ? '✓ Set' : '✗ Missing',
    authDomain: firebaseConfig.authDomain ? '✓ Set' : '✗ Missing',
    projectId: firebaseConfig.projectId ? '✓ Set' : '✗ Missing',
    storageBucket: firebaseConfig.storageBucket ? '✓ Set' : '✗ Missing',
    messagingSenderId: firebaseConfig.messagingSenderId ? '✓ Set' : '✗ Missing',
    appId: firebaseConfig.appId ? '✓ Set' : '✗ Missing',
    measurementId: firebaseConfig.measurementId ? '✓ Set' : '✗ Missing'
  });

  return firebaseConfig;
}

/**
 * Get AI service configuration from environment variables
 */
export function getAIConfig() {
  // Make sure environment variables are loaded
  loadEnvVariables();

  const aiConfig = {
    geminiApiKey: process.env.VITE_GEMINI_API_KEY,
    geminiModel: process.env.VITE_GEMINI_MODEL,
    geminiApiHostname: process.env.VITE_GEMINI_API_HOSTNAME
  };

  console.log('AI configuration loaded:', {
    geminiApiKey: aiConfig.geminiApiKey ? '✓ Set' : '✗ Missing',
    geminiModel: aiConfig.geminiModel ? '✓ Set' : '✗ Missing',
    geminiApiHostname: aiConfig.geminiApiHostname ? '✓ Set' : '✗ Missing'
  });

  return aiConfig;
}

/**
 * Get plugin configuration from environment variables
 */
export function getPluginConfig() {
  // Make sure environment variables are loaded
  loadEnvVariables();

  const pluginConfig = {
    port: process.env.VITE_PLUGIN_PORT ? parseInt(process.env.VITE_PLUGIN_PORT) : 5001,
    serverHost: process.env.VITE_PLUGIN_SERVER_HOST || '127.0.0.1'
  };

  console.log('Plugin configuration loaded:', {
    port: pluginConfig.port,
    serverHost: pluginConfig.serverHost
  });

  return pluginConfig;
}

/**
 * Get application configuration from environment variables
 */
export function getAppConfig() {
  // Make sure environment variables are loaded
  loadEnvVariables();

  const appConfig = {
    name: process.env.VITE_APP_NAME,
    version: process.env.VITE_APP_VERSION,
    description: process.env.VITE_APP_DESCRIPTION,
    appId: process.env.VITE_APP_ID,
    productName: process.env.VITE_APP_PRODUCT_NAME,
    author: {
      name: process.env.VITE_AUTHOR_NAME,
      email: process.env.VITE_AUTHOR_EMAIL
    },
    build: {
      outputDir: process.env.VITE_BUILD_OUTPUT_DIR,
      resourcesDir: process.env.VITE_BUILD_RESOURCES_DIR,
      iconPath: process.env.VITE_BUILD_ICON_PATH
    }
  };

  console.log('Application configuration loaded:', {
    name: appConfig.name ? '✓ Set' : '✗ Missing',
    version: appConfig.version ? '✓ Set' : '✗ Missing',
    productName: appConfig.productName ? '✓ Set' : '✗ Missing',
    appId: appConfig.appId ? '✓ Set' : '✗ Missing'
  });

  return appConfig;
}
