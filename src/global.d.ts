export { };

declare global {
    interface Window {
        electron: {
            ipcRenderer: {
                invoke: (channel: string, ...args: any[]) => Promise<any>;
                send: (channel: string, ...args: any[]) => void;
                on: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => void;
                removeAllListeners: (channel: string) => void;
            };
        };
    }
}