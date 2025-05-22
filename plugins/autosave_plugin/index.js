const net = require('net');

// Get port from command line arguments
const args = process.argv.slice(2);
const portArg = args.find(arg => arg.startsWith('--port='));
const PORT = portArg ? parseInt(portArg.split('=')[1]) : 5000;

// Plugin information
const pluginInfo = {
  name: 'autosave_plugin',
  version: '1.0.0',
  description: 'Auto-save plugin for Text Editor',
  author: 'Cosmic Text Editor'
};

// Variables to track connection and auto-save interval
let client = null;
let connected = false;
let autoSaveInterval = null;
let lastContent = '';
let lastFilePath = '';
const AUTO_SAVE_INTERVAL_MS = 30000; // 30 seconds

// Connect to the editor
function connectToEditor() {
  client = new net.Socket();

  client.connect(PORT, '127.0.0.1', () => {
    console.log('Connected to editor');
    connected = true;

    // Register plugin
    client.write(JSON.stringify({
      type: 'register-plugin',
      payload: pluginInfo
    }));

    // Register menu items
    client.write(JSON.stringify({
      type: 'register-menu',
      payload: {
        pluginName: 'autosave_plugin',
        menuItems: [
          {
            id: 'autosave_plugin.toggle',
            label: 'Toggle Auto Save',
            parentMenu: 'file',
            accelerator: 'Alt+S'
          }
        ]
      }
    }));

    // Start auto-save interval
    startAutoSave();
  });

  client.on('data', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received message:', message.type);

      if (message.type === 'execute-plugin') {
        handleExecute(message);
      } else if (message.type === 'execute-menu-action') {
        handleMenuAction(message);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  client.on('close', () => {
    console.log('Connection closed');
    connected = false;
    stopAutoSave();

    // Try to reconnect after a delay
    setTimeout(() => {
      if (!connected) {
        console.log('Attempting to reconnect...');
        connectToEditor();
      }
    }, 5000);
  });

  client.on('error', (error) => {
    console.error('Connection error:', error);
    connected = false;
    stopAutoSave();
  });
}

// Handle execute plugin message
function handleExecute(message) {
  const { content, filePath, options } = message.payload;
  
  // Store the content and file path for auto-save
  if (content && filePath) {
    lastContent = content;
    lastFilePath = filePath;
  }

  // Send response
  sendResponse(message.id, true, 'Plugin executed successfully');
}

// Handle menu action message
function handleMenuAction(message) {
  const { menuItemId, content, filePath } = message.payload;

  if (menuItemId === 'autosave_plugin.toggle') {
    if (autoSaveInterval) {
      stopAutoSave();
      sendResponse(message.id, true, 'Auto-save disabled');
    } else {
      startAutoSave();
      sendResponse(message.id, true, 'Auto-save enabled');
    }
  }

  // Store the content and file path for auto-save
  if (content && filePath) {
    lastContent = content;
    lastFilePath = filePath;
  }
}

// Start auto-save interval
function startAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }

  autoSaveInterval = setInterval(() => {
    if (connected && lastContent && lastFilePath) {
      console.log('Auto-saving file:', lastFilePath);
      
      // Send save request to editor
      client.write(JSON.stringify({
        type: 'save-file',
        payload: {
          content: lastContent,
          filePath: lastFilePath
        }
      }));
    }
  }, AUTO_SAVE_INTERVAL_MS);

  console.log('Auto-save enabled with interval:', AUTO_SAVE_INTERVAL_MS, 'ms');
}

// Stop auto-save interval
function stopAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
    console.log('Auto-save disabled');
  }
}

// Send response to editor
function sendResponse(id, success, message, data = null) {
  if (!connected || !client) return;

  const response = {
    type: 'plugin-response',
    id: id,
    payload: {
      success: success,
      message: message,
      data: data
    }
  };

  client.write(JSON.stringify(response));
}

// Start the plugin
connectToEditor();

// Handle process termination
process.on('SIGINT', () => {
  stopAutoSave();
  if (client) {
    client.destroy();
  }
  process.exit(0);
});

console.log('AutoSave plugin started on port:', PORT);
