import { IpcRendererEvent } from 'electron';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        send: (channel: string, ...args: any[]) => void;
        on: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => void;
        removeAllListeners: (channel: string) => void;
        getPlugins: () => Promise<string[]>;
        getAvailablePlugins: () => Promise<Array<{name: string, installed: boolean}>>;
        installPlugin: (pluginName: string) => Promise<{success: boolean, message?: string}>;
        uninstallPlugin: (pluginName: string) => Promise<{success: boolean, message?: string}>;
        checkPluginStatus: (pluginName: string) => Promise<{pluginName: string, isInstalled: boolean}>;
        getPlugin: (plugin: string) => Promise<any>;
        getMenuItems: (parentMenu: string) => Promise<any[]>;
        executeMenuAction: (menuItemId: string, content: string, filePath?: string) => void;
        exportToPdf: (content: string, filePath?: string) => void;
      }
    }
  }
}

export {};
