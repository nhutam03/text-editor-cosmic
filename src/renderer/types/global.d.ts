export { };

declare global {
    interface Window {
        electron: {
            ipcRenderer: {
                invoke: (channel: string, ...args: any[]) => Promise<any>;
                send: (channel: string, ...args: any[]) => void;
                on: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => void;
                removeAllListeners: (channel: string) => void;
                getPlugins: () => Promise<string[]>;
                getAvailablePlugins: () => Promise<{ name: string, installed: boolean }[]>;
                installPlugin: (pluginName: string) => Promise<{ success: boolean, plugin?: any, error?: string }>;
                uninstallPlugin: (pluginName: string) => Promise<{ success: boolean, error?: string }>;
                getPlugin: (plugin: string) => Promise<any>;
                getMenuItems: (parentMenu: string) => Promise<any[]>;
                executeMenuAction: (menuItemId: string, content: string, filePath?: string) => void;
            };
        };
    }
}