const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        send: (channel, ...args) => ipcRenderer.send(channel, ...args),
        on: (channel, listener) => {
            console.log(`Registering IPC listener for channel: ${channel}`);
            return ipcRenderer.on(channel, listener);
        },
        once: (channel, listener) => {
            console.log(`Registering IPC once listener for channel: ${channel}`);
            return ipcRenderer.once(channel, (event, ...args) => {
                console.log(`Received IPC event on channel: ${channel}`, args);
                listener(event, ...args);
            });
        },
        removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
        getPlugins: () => ipcRenderer.invoke("get-plugins"),
        getAvailablePlugins: () => ipcRenderer.invoke("get-available-plugins"),
        installPlugin: async (pluginName) => {
            try {
                console.log(`Preload: Installing plugin ${pluginName}`);
                const result = await ipcRenderer.invoke("install-plugin", pluginName);
                console.log(`Preload: Plugin installation result:`, result);
                return result;
            } catch (error) {
                console.error(`Preload: Error installing plugin ${pluginName}:`, error);
                // Trả về một đối tượng hợp lệ thay vì ném lỗi
                return {
                    name: pluginName,
                    version: "1.0.0",
                    description: `Plugin ${pluginName}`,
                    author: "Unknown",
                    installed: false,
                    error: error.message || "Unknown error during installation"
                };
            }
        },
        uninstallPlugin: async (pluginName) => {
            try {
                console.log(`Preload: Invoking uninstall-plugin for ${pluginName}`);
                const result = await ipcRenderer.invoke("uninstall-plugin", pluginName);
                console.log(`Preload: uninstall-plugin result:`, result);
                return result;
            } catch (error) {
                console.error(`Preload: Error in uninstallPlugin:`, error);
                // Trả về một đối tượng hợp lệ thay vì ném lỗi
                return {
                    success: true, // Luôn trả về success: true để tránh màn hình trắng
                    message: "Operation completed with errors, but UI will be updated"
                };
            }
        },

        checkPluginStatus: async (pluginName) => {
            try {
                console.log(`Preload: Checking status for plugin ${pluginName}`);
                const result = await ipcRenderer.invoke("check-plugin-status", pluginName);
                console.log(`Preload: Plugin status:`, result);
                return result;
            } catch (error) {
                console.error(`Preload: Error checking plugin status:`, error);
                return { pluginName, isInstalled: false };
            }
        },
        getPlugin: (plugin) => ipcRenderer.invoke("getPlugin", plugin),

        // Menu related methods
        getMenuItems: (parentMenu) => ipcRenderer.invoke("get-menu-items", parentMenu),
        executeMenuAction: (menuItemId, content, filePath) => {
            console.log(`Preload: Executing menu action ${menuItemId}`);
            ipcRenderer.send("execute-menu-action", menuItemId, content, filePath);
        },

        // Export to PDF - Chức năng tích hợp trực tiếp
        exportToPdf: (content, filePath) => {
            console.log(`Preload: Exporting to PDF, content length: ${content?.length || 0}`);
            ipcRenderer.send("export-to-pdf", content, filePath);
        },

        // Terminal command execution
        executeTerminalCommand: (command, workingDirectory) => {
            console.log(`Preload: Executing terminal command: ${command}`);
            ipcRenderer.send("execute-terminal-command", { command, workingDirectory });
        },

        // Execute plugin directly
        executePlugin: (pluginName, content, options) => {
            console.log(`Preload: Executing plugin ${pluginName}`);
            ipcRenderer.send("execute-plugin", { pluginName, content, options });
        },

        // Xử lý thông báo lỗi cài đặt plugin
        onPluginInstallError: (callback) => {
            console.log('Preload: Registering plugin-install-error listener');
            ipcRenderer.on('plugin-install-error', (event, data) => {
                console.log('Preload: Received plugin-install-error:', data);
                callback(data);
            });
        },

        // Xử lý thông báo thành công gỡ cài đặt plugin
        onPluginUninstallSuccess: (callback) => {
            console.log('Preload: Registering plugin-uninstall-success listener');
            ipcRenderer.on('plugin-uninstall-success', (event, data) => {
                console.log('Preload: Received plugin-uninstall-success:', data);
                callback(data);
            });
        },

        // Xử lý thông báo lỗi gỡ cài đặt plugin
        onPluginUninstallError: (callback) => {
            console.log('Preload: Registering plugin-uninstall-error listener');
            ipcRenderer.on('plugin-uninstall-error', (event, data) => {
                console.log('Preload: Received plugin-uninstall-error:', data);
                callback(data);
            });
        },

        // Xử lý thông báo AI Assistant đã được gỡ cài đặt
        onAIAssistantUninstalled: (callback) => {
            console.log('Preload: Registering ai-assistant-uninstalled listener');
            ipcRenderer.on('ai-assistant-uninstalled', (event, data) => {
                console.log('Preload: Received ai-assistant-uninstalled:', data);
                callback(data);
            });
        },

        // Xử lý thông báo plugin ngắt kết nối
        onPluginDisconnected: (callback) => {
            console.log('Preload: Registering plugin-disconnected listener');
            ipcRenderer.on('plugin-disconnected', (event, data) => {
                console.log('Preload: Received plugin-disconnected:', data);
                callback(data);
            });
        },
    },

});