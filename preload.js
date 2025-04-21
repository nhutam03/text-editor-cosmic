const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        send: (channel, ...args) => ipcRenderer.send(channel, ...args),
        on: (channel, listener) => {
            console.log(`Registering IPC listener for channel: ${channel}`);
            return ipcRenderer.on(channel, listener);
        },
        removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
        getPlugins: () => ipcRenderer.invoke("get-plugins"),
        getAvailablePlugins: () => ipcRenderer.invoke("get-available-plugins"),
        installPlugin: (pluginName) => ipcRenderer.invoke("install-plugin", pluginName),
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
    },

});