// Example plugin that demonstrates menu registration
const net = require('net');

// Plugin information
const pluginInfo = {
  name: 'export-to-pdf',
  displayName: 'Export to PDF',
  version: '1.0.0',
  description: 'Export document to PDF format',
  author: 'Text Editor Team'
};

// Menu items to register
const menuItems = [
  {
    id: 'export-to-pdf.exportToPdf',
    label: 'Export to PDF',
    parentMenu: 'file',
    position: 100, // Position after standard menu items
    shortcut: 'Ctrl+Shift+E'
  }
];

// Connect to the text editor
const PORT = process.argv.find(arg => arg.startsWith('--port='))?.split('=')[1] || 5000;
const client = new net.Socket();

client.connect(PORT, 'localhost', () => {
  console.log('Connected to text editor');
  
  // Register the plugin
  const registerMessage = {
    type: 'register-plugin',
    payload: pluginInfo
  };
  
  client.write(JSON.stringify(registerMessage));
  
  // Register menu items
  setTimeout(() => {
    const registerMenuMessage = {
      type: 'register-menu',
      payload: {
        pluginName: pluginInfo.name,
        menuItems: menuItems
      }
    };
    
    client.write(JSON.stringify(registerMenuMessage));
    console.log('Registered menu items:', menuItems);
  }, 1000); // Wait a bit to ensure plugin is registered first
});

// Handle messages from the text editor
client.on('data', (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    if (message.type === 'execute-plugin') {
      handleExecute(message);
    } else if (message.type === 'execute-menu-action') {
      handleMenuAction(message);
    }
  } catch (error) {
    console.error('Error parsing message:', error);
    sendResponse(message.id, false, 'Error parsing message');
  }
});

// Handle execute message
function handleExecute(message) {
  const { content, filePath, options } = message.payload;
  
  console.log('Executing plugin with content length:', content.length);
  console.log('Output file path:', filePath);
  
  // In a real plugin, we would convert the content to PDF here
  // For this example, we'll just simulate success
  
  // Send response
  sendResponse(message.id, true, 'PDF exported successfully', { filePath });
}

// Handle menu action
function handleMenuAction(message) {
  const { menuItemId, content, filePath } = message.payload;
  
  console.log('Executing menu action:', menuItemId);
  console.log('Content length:', content.length);
  console.log('File path:', filePath);
  
  // Handle specific menu actions
  if (menuItemId === 'export-to-pdf.exportToPdf') {
    // In a real plugin, we would show a save dialog and export to PDF
    // For this example, we'll just simulate success
    
    // Send response
    sendResponse(message.id, true, 'PDF export initiated', { success: true });
  } else {
    sendResponse(message.id, false, `Unknown menu action: ${menuItemId}`);
  }
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
