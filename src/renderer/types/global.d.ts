export {};

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        send: (channel: string, ...args: any[]) => void;
        on: (
          channel: string,
          listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void
        ) => void;
        removeAllListeners: (channel: string) => void;
        getPlugins: () => Promise<string[]>;
        getPlugin: (plugin: string) => Promise<any>;
        // Thêm type cho spell check
        invoke(
          channel: "spell-check",
          content: string
        ): Promise<Array<{
          word: string;
          suggestions: string[];
        }> | null>;
      };
    };
  }
}
