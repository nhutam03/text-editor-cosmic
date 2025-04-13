# Plugin System for Text Editor App

This document explains how to create, package, and use plugins for the Text Editor App.

## Overview

The Text Editor App supports a plugin system similar to Visual Studio Code's extension system. Plugins are packaged as ZIP files and can be installed from a Firebase storage repository.

## Installing Plugins

1. Open the Text Editor App
2. Click on the "Extensions" tab in the sidebar
3. Click "Browse Extensions" to open the Plugin Marketplace
4. Find the plugin you want to install and click "Install"
5. Once installed, the plugin will appear in your Extensions list

## Creating a Plugin

### Plugin Structure

A plugin is a Node.js application with the following structure:

```
plugin-name/
├── package.json     # Plugin metadata and dependencies
├── index.js         # Main plugin file
└── ... other files  # Additional plugin files
```

### package.json

The `package.json` file must contain the following fields:

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Description of your plugin",
  "main": "index.js",
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    // Plugin dependencies
  }
}
```

### Main Plugin File

The main plugin file (usually `index.js`) should:

1. Connect to the Text Editor App via TCP socket
2. Register the plugin with the Text Editor App
3. Handle messages from the Text Editor App

Here's a basic template:

```javascript
const net = require('net');

// Get port from command line arguments
const args = process.argv.slice(2);
const portArg = args.find(arg => arg.startsWith('--port='));
const PORT = portArg ? parseInt(portArg.split('=')[1]) : 5000;

// Plugin information
const pluginInfo = {
  name: 'plugin-name',
  version: '1.0.0',
  description: 'Description of your plugin',
  author: 'Your Name'
};

// Connect to the text editor
const client = new net.Socket();

client.connect(PORT, 'localhost', () => {
  console.log('Connected to text editor');
  
  // Register the plugin
  const registerMessage = {
    type: 'register-plugin',
    payload: pluginInfo
  };
  
  client.write(JSON.stringify(registerMessage));
});

// Handle messages from the text editor
client.on('data', (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    if (message.type === 'execute-plugin') {
      handleExecute(message);
    }
  } catch (error) {
    console.error('Error parsing message:', error);
    sendResponse(message.id, false, 'Error parsing message');
  }
});

// Handle execute message
function handleExecute(message) {
  const { content, filePath, options } = message.payload;
  
  // Process the content
  // ...
  
  // Send response
  sendResponse(message.id, true, 'Plugin executed successfully', { result: 'some result' });
}

// Send response to the text editor
function sendResponse(id, success, message, data = null) {
  const response = {
    type: 'plugin-response',
    id,
    payload: {
      success,
      message,
      data
    }
  };
  
  client.write(JSON.stringify(response));
}

// Handle errors and cleanup
client.on('error', (error) => {
  console.error('Connection error:', error);
});

client.on('close', () => {
  console.log('Connection closed');
});

process.on('SIGINT', () => {
  client.destroy();
  process.exit();
});
```

## Packaging a Plugin

To package your plugin:

1. Create a ZIP file containing your plugin directory
2. Upload the ZIP file to Firebase Storage in the `plugins` folder
3. The ZIP file name should match the plugin name (e.g., `plugin-name.zip`)

## Plugin Communication Protocol

Plugins communicate with the Text Editor App using a simple JSON-based protocol over TCP.

### Messages from Plugin to Text Editor

#### Register Plugin

```json
{
  "type": "register-plugin",
  "payload": {
    "name": "plugin-name",
    "version": "1.0.0",
    "description": "Description of your plugin",
    "author": "Your Name"
  }
}
```

#### Response to Execute

```json
{
  "type": "plugin-response",
  "id": "message-id",
  "payload": {
    "success": true,
    "message": "Operation successful",
    "data": { ... }
  }
}
```

### Messages from Text Editor to Plugin

#### Execute Plugin

```json
{
  "type": "execute-plugin",
  "id": "message-id",
  "payload": {
    "content": "Text content to process",
    "filePath": "Optional file path",
    "options": { ... }
  }
}
```

## Example Plugin

See the `plugin-example` directory for a complete example of a PDF export plugin.

## Troubleshooting

If you encounter issues with your plugin:

1. Check the console output for error messages
2. Verify that your plugin is correctly connecting to the Text Editor App
3. Make sure your plugin is correctly handling messages from the Text Editor App
4. Check that your plugin is correctly packaged and uploaded to Firebase Storage
