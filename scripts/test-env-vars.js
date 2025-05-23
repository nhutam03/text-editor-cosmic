const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('🔍 Testing Environment Variables Configuration\n');

// Test Firebase Configuration
console.log('📱 Firebase Configuration:');
console.log('  VITE_FIREBASE_API_KEY:', process.env.VITE_FIREBASE_API_KEY ? '✓ Set' : '✗ Missing');
console.log('  VITE_FIREBASE_AUTH_DOMAIN:', process.env.VITE_FIREBASE_AUTH_DOMAIN ? '✓ Set' : '✗ Missing');
console.log('  VITE_FIREBASE_PROJECT_ID:', process.env.VITE_FIREBASE_PROJECT_ID ? '✓ Set' : '✗ Missing');
console.log('  VITE_FIREBASE_STORAGE_BUCKET:', process.env.VITE_FIREBASE_STORAGE_BUCKET ? '✓ Set' : '✗ Missing');
console.log('  VITE_FIREBASE_MESSAGING_SENDER_ID:', process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ? '✓ Set' : '✗ Missing');
console.log('  VITE_FIREBASE_APP_ID:', process.env.VITE_FIREBASE_APP_ID ? '✓ Set' : '✗ Missing');
console.log('  VITE_FIREBASE_MEASUREMENT_ID:', process.env.VITE_FIREBASE_MEASUREMENT_ID ? '✓ Set' : '✗ Missing');

// Test AI Service Configuration
console.log('\n🤖 AI Service Configuration:');
console.log('  VITE_GEMINI_API_KEY:', process.env.VITE_GEMINI_API_KEY ? '✓ Set' : '✗ Missing');
console.log('  VITE_GEMINI_MODEL:', process.env.VITE_GEMINI_MODEL ? '✓ Set' : '✗ Missing');
console.log('  VITE_GEMINI_API_HOSTNAME:', process.env.VITE_GEMINI_API_HOSTNAME ? '✓ Set' : '✗ Missing');

// Test Plugin Configuration
console.log('\n🔌 Plugin Configuration:');
console.log('  VITE_PLUGIN_PORT:', process.env.VITE_PLUGIN_PORT ? '✓ Set' : '✗ Missing');
console.log('  VITE_PLUGIN_SERVER_HOST:', process.env.VITE_PLUGIN_SERVER_HOST ? '✓ Set' : '✗ Missing');

// Test Application Settings
console.log('\n📦 Application Settings:');
console.log('  VITE_APP_NAME:', process.env.VITE_APP_NAME ? '✓ Set' : '✗ Missing');
console.log('  VITE_APP_VERSION:', process.env.VITE_APP_VERSION ? '✓ Set' : '✗ Missing');
console.log('  VITE_APP_DESCRIPTION:', process.env.VITE_APP_DESCRIPTION ? '✓ Set' : '✗ Missing');
console.log('  VITE_APP_ID:', process.env.VITE_APP_ID ? '✓ Set' : '✗ Missing');
console.log('  VITE_APP_PRODUCT_NAME:', process.env.VITE_APP_PRODUCT_NAME ? '✓ Set' : '✗ Missing');

// Test Author Information
console.log('\n👤 Author Information:');
console.log('  VITE_AUTHOR_NAME:', process.env.VITE_AUTHOR_NAME ? '✓ Set' : '✗ Missing');
console.log('  VITE_AUTHOR_EMAIL:', process.env.VITE_AUTHOR_EMAIL ? '✓ Set' : '✗ Missing');

// Test Build Configuration
console.log('\n🏗️ Build Configuration:');
console.log('  VITE_BUILD_OUTPUT_DIR:', process.env.VITE_BUILD_OUTPUT_DIR ? '✓ Set' : '✗ Missing');
console.log('  VITE_BUILD_RESOURCES_DIR:', process.env.VITE_BUILD_RESOURCES_DIR ? '✓ Set' : '✗ Missing');
console.log('  VITE_BUILD_ICON_PATH:', process.env.VITE_BUILD_ICON_PATH ? '✓ Set' : '✗ Missing');

// Check for missing critical variables
const criticalVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_GEMINI_API_KEY',
  'VITE_APP_NAME',
  'VITE_APP_VERSION'
];

const missingVars = criticalVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('\n❌ Missing Critical Environment Variables:');
  missingVars.forEach(varName => {
    console.log(`  - ${varName}`);
  });
  console.log('\nPlease add these variables to your .env file.');
  process.exit(1);
} else {
  console.log('\n✅ All critical environment variables are configured!');
}
