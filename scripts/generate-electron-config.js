const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Create electron-builder configuration from environment variables
const config = {
  appId: process.env.VITE_APP_ID || "com.cosmic.texteditor",
  productName: process.env.VITE_APP_PRODUCT_NAME || "Cosmic Text Editor",
  files: [
    "dist/**/*",
    "preload.js"
  ],
  directories: {
    buildResources: process.env.VITE_BUILD_RESOURCES_DIR || "resources",
    output: process.env.VITE_BUILD_OUTPUT_DIR || "release"
  },
  win: {
    target: ["nsis"],
    icon: process.env.VITE_BUILD_ICON_PATH || "resources/icon.ico",
    signingHashAlgorithms: null,
    signAndEditExecutable: false
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: process.env.VITE_APP_PRODUCT_NAME || "Cosmic Text Editor",
    installerIcon: process.env.VITE_BUILD_ICON_PATH || "resources/icon.ico",
    uninstallerIcon: process.env.VITE_BUILD_ICON_PATH || "resources/icon.ico"
  },
  extraResources: [
    {
      from: ".env",
      to: ".env"
    }
  ]
};

// Write electron-builder configuration
const configPath = path.join(__dirname, '../electron-builder-config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

console.log('✅ Electron builder config updated with environment variables');
console.log('📦 App ID:', config.appId);
console.log('📦 Product Name:', config.productName);
console.log('📦 Output Directory:', config.directories.output);
console.log('📦 Icon Path:', config.win.icon);
