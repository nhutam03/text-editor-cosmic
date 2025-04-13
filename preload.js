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
        uninstallPlugin: (pluginName) => ipcRenderer.invoke("uninstall-plugin", pluginName),
        getPlugin: (plugin) => ipcRenderer.invoke("getPlugin", plugin),
    },

});