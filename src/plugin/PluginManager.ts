import { Server, Socket } from 'net';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import {
  PluginInfo,
  PluginMessage,
  MessageType,
  RegisterMessage,
  ExecuteMessage,
  ResponseMessage
} from './PluginInterface';
import { PluginInstaller } from './PluginInstaller';
import { getAvailablePlugins } from '../services/firebase';

/**
 * Quản lý các plugin và giao tiếp với chúng
 */
export class PluginManager {
  private server!: Server;
  private plugins: Map<string, PluginConnection> = new Map();
  private port: number;
  private onPluginListChanged: (plugins: PluginInfo[]) => void;
  private pluginInstaller: PluginInstaller;
  private pluginProcesses: Map<string, ChildProcess> = new Map();

  constructor(port: number = 5000) {
    this.port = port;
    this.onPluginListChanged = () => {}; // Mặc định không làm gì
    this.pluginInstaller = new PluginInstaller();
  }

  /**
   * Khởi động server để lắng nghe kết nối từ các plugin
   */
  public async start(): Promise<void> {
    // Load installed plugins
    await this.loadInstalledPlugins();
    this.server = new Server((socket: Socket) => {
      console.log('Plugin connected');

      // Xử lý dữ liệu từ plugin
      socket.on('data', (data: Buffer) => {
        try {
          const message: PluginMessage = JSON.parse(data.toString());
          this.handlePluginMessage(socket, message);
        } catch (error) {
          console.error('Error parsing plugin message:', error);
        }
      });

      // Xử lý khi plugin ngắt kết nối
      socket.on('end', () => {
        this.handlePluginDisconnect(socket);
      });

      // Xử lý lỗi kết nối
      socket.on('error', (error) => {
        console.error('Plugin connection error:', error);
      });
    });

    // Khởi động server
    this.server.listen(this.port, 'localhost', () => {
      console.log(`Plugin server running on port ${this.port}`);
    });
  }

  /**
   * Đăng ký callback khi danh sách plugin thay đổi
   */
  public setPluginListChangedCallback(callback: (plugins: PluginInfo[]) => void): void {
    this.onPluginListChanged = callback;
  }

  /**
   * Lấy danh sách thông tin các plugin đã đăng ký
   */
  public getPlugins(): PluginInfo[] {
    return Array.from(this.plugins.values()).map(connection => connection.info);
  }

  /**
   * Lấy danh sách các plugin có sẵn từ Firebase
   */
  public async getAvailablePlugins(): Promise<{ name: string, installed: boolean }[]> {
    try {
      const availablePlugins = await getAvailablePlugins();
      const installedPlugins = this.getPlugins();
      const installedNames = installedPlugins.map(p => p.name);

      return availablePlugins.map(plugin => ({
        name: plugin.name,
        installed: installedNames.includes(plugin.name)
      }));
    } catch (error) {
      console.error('Error getting available plugins:', error);
      return [];
    }
  }

  /**
   * Thực thi một plugin với nội dung và tùy chọn
   */
  public async executePlugin(
    pluginName: string,
    content: string,
    filePath?: string,
    options?: any
  ): Promise<any> {
    const plugin = this.plugins.get(pluginName);

    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    return new Promise((resolve, reject) => {
      // Tạo message để gửi đến plugin
      const message: ExecuteMessage = {
        type: MessageType.EXECUTE,
        payload: {
          content,
          filePath,
          options
        }
      };

      // Đăng ký callback để nhận phản hồi
      const responseHandler = (response: ResponseMessage) => {
        if (response.payload.success) {
          resolve(response.payload.data);
        } else {
          reject(new Error(response.payload.message));
        }
      };

      // Gửi message và đợi phản hồi
      plugin.sendMessage(message, responseHandler);
    });
  }

  /**
   * Dừng server và đóng tất cả kết nối
   */
  public stop(): void {
    if (this.server) {
      this.server.close();

      // Đóng tất cả kết nối
      for (const plugin of this.plugins.values()) {
        if (plugin.socket) {
          plugin.socket.destroy();
        }
      }

      // Terminate all plugin processes
      for (const process of this.pluginProcesses.values()) {
        if (process && !process.killed) {
          process.kill();
        }
      }

      this.plugins.clear();
      this.pluginProcesses.clear();
    }
  }

  /**
   * Install a plugin from Firebase Storage
   */
  public async installPlugin(pluginName: string): Promise<PluginInfo> {
    try {
      // Install the plugin
      const pluginInfo = await this.pluginInstaller.installPluginByName(pluginName);

      // Start the plugin
      await this.startPlugin(pluginInfo.name);

      // Notify that the plugin list has changed
      this.onPluginListChanged(this.getPlugins());

      return pluginInfo;
    } catch (error) {
      console.error(`Error installing plugin ${pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Uninstall a plugin
   */
  public async uninstallPlugin(pluginName: string): Promise<boolean> {
    try {
      // Stop the plugin if it's running
      this.stopPlugin(pluginName);

      // Remove the plugin from the list
      this.plugins.delete(pluginName);

      // Uninstall the plugin
      const result = this.pluginInstaller.uninstallPlugin(pluginName);

      // Notify that the plugin list has changed
      this.onPluginListChanged(this.getPlugins());

      return result;
    } catch (error) {
      console.error(`Error uninstalling plugin ${pluginName}:`, error);
      return false;
    }
  }

  /**
   * Load all installed plugins
   */
  private async loadInstalledPlugins(): Promise<void> {
    try {
      const installedPlugins = this.pluginInstaller.getInstalledPlugins();

      for (const pluginInfo of installedPlugins) {
        await this.startPlugin(pluginInfo.name);
      }
    } catch (error) {
      console.error('Error loading installed plugins:', error);
    }
  }

  /**
   * Start a plugin
   */
  private async startPlugin(pluginName: string): Promise<void> {
    try {
      // Get the main script path
      const mainPath = this.pluginInstaller.getPluginMainPath(pluginName);

      if (!mainPath) {
        throw new Error(`Plugin ${pluginName} main script not found`);
      }

      // Check if the plugin is already running
      if (this.pluginProcesses.has(pluginName)) {
        console.log(`Plugin ${pluginName} is already running`);
        return;
      }

      // Start the plugin process
      const process = spawn('node', [mainPath, `--port=${this.port}`], {
        stdio: 'pipe',
        detached: false
      });

      // Store the process
      this.pluginProcesses.set(pluginName, process);

      // Handle process output
      process.stdout.on('data', (data) => {
        console.log(`[Plugin ${pluginName}] ${data.toString().trim()}`);
      });

      process.stderr.on('data', (data) => {
        console.error(`[Plugin ${pluginName} Error] ${data.toString().trim()}`);
      });

      // Handle process exit
      process.on('exit', (code) => {
        console.log(`Plugin ${pluginName} exited with code ${code}`);
        this.pluginProcesses.delete(pluginName);

        // Remove the plugin from the list if it's not connected
        if (!this.plugins.has(pluginName)) {
          this.onPluginListChanged(this.getPlugins());
        }
      });

      // Wait for the plugin to connect
      await new Promise<void>((resolve) => {
        // Set a timeout to resolve anyway after 5 seconds
        const timeout = setTimeout(() => {
          console.warn(`Plugin ${pluginName} did not connect within the timeout period`);
          resolve();
        }, 5000);

        // Set up a temporary listener for plugin list changes
        const originalCallback = this.onPluginListChanged;
        this.onPluginListChanged = (plugins) => {
          // Call the original callback
          originalCallback(plugins);

          // Check if our plugin is in the list
          if (plugins.some(p => p.name === pluginName)) {
            clearTimeout(timeout);
            this.onPluginListChanged = originalCallback;
            resolve();
          }
        };
      });
    } catch (error) {
      console.error(`Error starting plugin ${pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Stop a plugin
   */
  private stopPlugin(pluginName: string): void {
    try {
      // Get the plugin process
      const process = this.pluginProcesses.get(pluginName);

      if (process && !process.killed) {
        // Kill the process
        process.kill();
        this.pluginProcesses.delete(pluginName);
      }

      // Remove the plugin from the list
      this.plugins.delete(pluginName);
    } catch (error) {
      console.error(`Error stopping plugin ${pluginName}:`, error);
    }
  }

  /**
   * Xử lý thông điệp từ plugin
   */
  private handlePluginMessage(socket: Socket, message: PluginMessage): void {
    switch (message.type) {
      case MessageType.REGISTER:
        this.handleRegisterMessage(socket, message as RegisterMessage);
        break;

      case MessageType.RESPONSE:
        this.handleResponseMessage(socket, message as ResponseMessage);
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Xử lý thông điệp đăng ký từ plugin
   */
  private handleRegisterMessage(socket: Socket, message: RegisterMessage): void {
    // Handle both formats: with payload or with direct properties
    let pluginInfo: PluginInfo;

    if (message.payload) {
      // Standard format with payload
      pluginInfo = message.payload;
    } else {
      // Legacy format with properties directly in the message
      // Extract properties from the message object itself
      const { name, version, description, author } = message as any;

      // Create a valid PluginInfo object
      pluginInfo = {
        name: name || 'Unknown Plugin',
        version: version || '1.0.0',
        description: description || 'No description provided',
        author: author || 'Unknown'
      };
    }

    // Tạo kết nối plugin mới
    const pluginConnection = new PluginConnection(socket, pluginInfo);

    // Lưu vào danh sách
    this.plugins.set(pluginInfo.name, pluginConnection);

    console.log(`Plugin registered: ${pluginInfo.name} v${pluginInfo.version || 'unknown'}`);

    // Thông báo danh sách plugin đã thay đổi
    this.onPluginListChanged(this.getPlugins());
  }

  /**
   * Xử lý thông điệp phản hồi từ plugin
   */
  private handleResponseMessage(socket: Socket, message: ResponseMessage): void {
    // Tìm plugin từ socket
    for (const plugin of this.plugins.values()) {
      if (plugin.socket === socket) {
        // Gọi callback xử lý phản hồi nếu có
        plugin.handleResponse(message);
        return;
      }
    }
  }

  /**
   * Xử lý khi plugin ngắt kết nối
   */
  private handlePluginDisconnect(socket: Socket): void {
    // Tìm và xóa plugin khỏi danh sách
    for (const [name, plugin] of this.plugins.entries()) {
      if (plugin.socket === socket) {
        this.plugins.delete(name);
        console.log(`Plugin disconnected: ${name}`);

        // Thông báo danh sách plugin đã thay đổi
        this.onPluginListChanged(this.getPlugins());
        return;
      }
    }
  }
}

/**
 * Đại diện cho một kết nối plugin
 */
class PluginConnection {
  public socket: Socket;
  public info: PluginInfo;
  private responseCallbacks: Map<string, (response: ResponseMessage) => void> = new Map();
  private messageId: number = 0;

  constructor(socket: Socket, info: PluginInfo) {
    this.socket = socket;
    this.info = info;
  }

  /**
   * Gửi thông điệp đến plugin và đăng ký callback để nhận phản hồi
   */
  public sendMessage(
    message: PluginMessage,
    callback?: (response: ResponseMessage) => void
  ): void {
    // Thêm ID cho thông điệp để theo dõi phản hồi
    const id = (this.messageId++).toString();
    const messageWithId = { ...message, id };

    // Lưu callback để xử lý phản hồi sau này
    if (callback) {
      this.responseCallbacks.set(id, callback);
    }

    // Gửi thông điệp
    this.socket.write(JSON.stringify(messageWithId));
  }

  /**
   * Xử lý phản hồi từ plugin
   */
  public handleResponse(response: ResponseMessage): void {
    // Lấy ID từ phản hồi
    const id = (response as any).id;

    if (id && this.responseCallbacks.has(id)) {
      // Gọi callback tương ứng
      const callback = this.responseCallbacks.get(id);
      callback!(response);

      // Xóa callback sau khi đã xử lý
      this.responseCallbacks.delete(id);
    }
  }
}
