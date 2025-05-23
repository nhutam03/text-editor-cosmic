const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Read package.json template
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Update package.json with environment variables
if (process.env.VITE_APP_NAME) {
  packageJson.name = process.env.VITE_APP_NAME.toLowerCase().replace(/\s+/g, '-') + '-app';
}

if (process.env.VITE_APP_VERSION) {
  packageJson.version = process.env.VITE_APP_VERSION;
}

if (process.env.VITE_APP_DESCRIPTION) {
  packageJson.description = process.env.VITE_APP_DESCRIPTION;
}

if (process.env.VITE_AUTHOR_NAME && process.env.VITE_AUTHOR_EMAIL) {
  packageJson.author = {
    name: process.env.VITE_AUTHOR_NAME,
    email: process.env.VITE_AUTHOR_EMAIL
  };
}

// Update build configuration
if (packageJson.build) {
  if (process.env.VITE_APP_ID) {
    packageJson.build.appId = process.env.VITE_APP_ID;
  }
  
  if (process.env.VITE_APP_PRODUCT_NAME) {
    packageJson.build.productName = process.env.VITE_APP_PRODUCT_NAME;
  }
  
  if (process.env.VITE_BUILD_OUTPUT_DIR) {
    packageJson.build.directories = packageJson.build.directories || {};
    packageJson.build.directories.output = process.env.VITE_BUILD_OUTPUT_DIR;
  }
  
  if (process.env.VITE_BUILD_RESOURCES_DIR) {
    packageJson.build.directories = packageJson.build.directories || {};
    packageJson.build.directories.buildResources = process.env.VITE_BUILD_RESOURCES_DIR;
  }
  
  if (process.env.VITE_BUILD_ICON_PATH) {
    if (packageJson.build.win) {
      packageJson.build.win.icon = process.env.VITE_BUILD_ICON_PATH;
    }
    if (packageJson.build.nsis) {
      packageJson.build.nsis.installerIcon = process.env.VITE_BUILD_ICON_PATH;
      packageJson.build.nsis.uninstallerIcon = process.env.VITE_BUILD_ICON_PATH;
    }
  }
  
  if (process.env.VITE_APP_PRODUCT_NAME && packageJson.build.nsis) {
    packageJson.build.nsis.shortcutName = process.env.VITE_APP_PRODUCT_NAME;
  }
}

// Write updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log('✅ Package.json updated with environment variables');
console.log('📦 App Name:', packageJson.name);
console.log('📦 Version:', packageJson.version);
console.log('📦 Product Name:', packageJson.build?.productName);
console.log('📦 App ID:', packageJson.build?.appId);
