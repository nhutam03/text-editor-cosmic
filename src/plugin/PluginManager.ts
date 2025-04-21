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
  ResponseMessage,
  RegisterMenuMessage,
  ExecuteMenuActionMessage,
  PluginMenuItem
} from './PluginInterface';
import { MenuRegistry, MenuItem } from './MenuContribution';
import { PluginInstaller } from './PluginInstaller';
import { getAvailablePlugins } from '../services/firebase';
import { StorageReference } from 'firebase/storage';

/**
 * Quản lý các plugin và giao tiếp với chúng
 */
export class PluginManager {
  private server!: Server;
  private plugins: Map<string, PluginConnection> = new Map();
  private port: number;
  private onPluginListChanged: (plugins: PluginInfo[]) => void;
  private onMenuItemsChanged: (menuItems: MenuItem[]) => void;
  private pluginInstaller: PluginInstaller;
  private pluginProcesses: Map<string, ChildProcess> = new Map();
  private commands: { [key: string]: (...args: any[]) => any } = {};
  private menuRegistry: MenuRegistry;

  constructor(port: number = 5000) {
    this.port = port;
    this.onPluginListChanged = () => {}; // Mặc định không làm gì
    this.onMenuItemsChanged = () => {}; // Mặc định không làm gì
    this.pluginInstaller = new PluginInstaller();
    this.menuRegistry = MenuRegistry.getInstance();
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
   * Đăng ký callback khi danh sách menu item thay đổi
   */
  public setMenuItemsChangedCallback(callback: (menuItems: MenuItem[]) => void): void {
    this.onMenuItemsChanged = callback;

    // Đăng ký callback với MenuRegistry
    this.menuRegistry.addListener((items) => {
      this.onMenuItemsChanged(items);
    });
  }

  /**
   * Lấy danh sách menu item cho menu cha cụ thể
   */
  public getMenuItemsForParent(parentMenu: string): MenuItem[] {
    return this.menuRegistry.getMenuItemsForParent(parentMenu);
  }

  /**
   * Lấy danh sách thông tin các plugin đã đăng ký
   */
  public getPlugins(): PluginInfo[] {
    // Lấy danh sách plugin đã đăng ký
    const registeredPlugins = Array.from(this.plugins.values()).map(connection => connection.info);

    // Lấy danh sách plugin đã cài đặt nhưng chưa đăng ký
    const installedPlugins = this.pluginInstaller.getInstalledPlugins();

    // Kết hợp hai danh sách, ưu tiên plugin đã đăng ký
    const registeredNames = registeredPlugins.map(p => p.name);
    const combinedPlugins = [...registeredPlugins];

    // Thêm các plugin đã cài đặt nhưng chưa đăng ký
    for (const plugin of installedPlugins) {
      // Chuẩn hóa tên plugin (loại bỏ phiên bản nếu có)
      const normalizedName = plugin.name.replace(/(-\d+\.\d+\.\d+)$/, '');

      // Kiểm tra xem plugin đã được đăng ký chưa
      if (!registeredNames.includes(plugin.name) && !registeredNames.includes(normalizedName)) {
        combinedPlugins.push(plugin);
      }
    }

    return combinedPlugins;
  }

  /**
   * Lấy danh sách các plugin có sẵn từ Firebase
   */
  public async getAvailablePlugins(): Promise<{ name: string, installed: boolean }[]> {
    try {
      const availablePlugins = await getAvailablePlugins();
      const installedPlugins = this.getPlugins();

      // Tạo danh sách tên plugin đã cài đặt (bao gồm cả tên chuẩn hóa)
      const installedNames = new Set<string>();
      for (const plugin of installedPlugins) {
        installedNames.add(plugin.name);
        // Thêm tên chuẩn hóa nếu có phiên bản
        const normalizedName = plugin.name.replace(/(-\d+\.\d+\.\d+)$/, '');
        if (normalizedName !== plugin.name) {
          installedNames.add(normalizedName);
        }
      }

      // Lọc các plugin trùng lặp (loại bỏ các phiên bản trùng lặp)
      const uniquePlugins = new Map<string, { name: string, ref: StorageReference }>();
      for (const plugin of availablePlugins) {
        // Chuẩn hóa tên plugin (loại bỏ phiên bản nếu có)
        const normalizedName = plugin.name.replace(/(-\d+\.\d+\.\d+)$/, '');

        // Chỉ giữ lại plugin mới nhất cho mỗi tên chuẩn hóa
        if (!uniquePlugins.has(normalizedName) ||
            plugin.name.localeCompare(uniquePlugins.get(normalizedName)!.name) > 0) {
          uniquePlugins.set(normalizedName, plugin);
        }
      }

      // Chuyển đổi thành mảng kết quả
      return Array.from(uniquePlugins.values()).map(plugin => {
        // Chuẩn hóa tên plugin (loại bỏ phiên bản nếu có)
        const normalizedName = plugin.name.replace(/(-\d+\.\d+\.\d+)$/, '');

        return {
          name: plugin.name,
          installed: installedNames.has(normalizedName) || installedNames.has(plugin.name)
        };
      });
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
    console.log(`Executing plugin: ${pluginName}`);
    const plugin = this.plugins.get(pluginName);

    if (!plugin) {
      console.error(`Plugin ${pluginName} not found in registered plugins`);

      // Check if the plugin is installed but not registered
      const installedPlugins = this.pluginInstaller.getInstalledPlugins();
      const isInstalled = installedPlugins.some(p => p.name === pluginName);

      if (isInstalled) {
        console.log(`Plugin ${pluginName} is installed but not registered. Attempting to start it...`);
        try {
          // Try to start the plugin
          await this.startPlugin(pluginName);

          // Check if the plugin is now registered
          const plugin = this.plugins.get(pluginName);
          if (plugin) {
            console.log(`Successfully started and registered plugin ${pluginName}`);
            return this.executePlugin(pluginName, content, filePath, options);
          } else {
            throw new Error(`Failed to register plugin ${pluginName} after starting it`);
          }
        } catch (error: any) {
          console.error(`Failed to start plugin ${pluginName}:`, error);
          throw new Error(`Plugin ${pluginName} is installed but could not be started: ${error.message || error}`);
        }
      } else {
        throw new Error(`Plugin ${pluginName} is not installed`);
      }
    }

    return new Promise((resolve, reject) => {
      // Set a timeout for the plugin execution
      const timeoutId = setTimeout(() => {
        reject(new Error(`Plugin ${pluginName} execution timed out after 30 seconds`));
      }, 30000);

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
        clearTimeout(timeoutId);

        if (response.payload.success) {
          console.log(`Plugin ${pluginName} executed successfully`);
          resolve(response.payload.data);
        } else {
          console.error(`Plugin ${pluginName} execution failed:`, response.payload.message);
          reject(new Error(response.payload.message));
        }
      };

      try {
        // Gửi message và đợi phản hồi
        console.log(`Sending execute message to plugin ${pluginName}`);
        plugin.sendMessage(message, responseHandler);
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error(`Error sending message to plugin ${pluginName}:`, error);
        reject(new Error(`Error sending message to plugin: ${error.message || String(error)}`));
      }
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
      console.log(`Installing plugin: ${pluginName}`);

      // Check if plugin is already installed
      if (this.pluginInstaller.isPluginInstalled(pluginName)) {
        console.log(`Plugin ${pluginName} is already installed, starting it...`);

        // Get the installed plugin info
        const installedPlugins = this.pluginInstaller.getInstalledPlugins();
        const pluginInfo = installedPlugins.find(p => {
          // Normalize plugin name (remove version suffix if present)
          const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');
          return p.name === pluginName || p.name === normalizedName;
        });

        if (pluginInfo) {
          // Try to start the plugin
          await this.startPlugin(pluginInfo.name);

          // Notify that the plugin list has changed
          this.onPluginListChanged(this.getPlugins());

          return pluginInfo;
        }
      }

      // Install the plugin
      console.log(`Installing plugin from Firebase: ${pluginName}`);
      const pluginInfo = await this.pluginInstaller.installPluginByName(pluginName);
      console.log(`Plugin installed: ${JSON.stringify(pluginInfo)}`);

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
   * Uninstall a plugin - Sử dụng cách tiếp cận đơn giản hóa tối đa
   */
  public async uninstallPlugin(pluginName: string): Promise<boolean> {
    if (!pluginName) {
      console.error(`PluginManager: Invalid plugin name: ${pluginName}`);
      return true; // Vẫn trả về true để tránh lỗi UI
    }

    console.log(`PluginManager: Uninstalling plugin: ${pluginName}`);

    try {
      // 1. Chuẩn hóa tên plugin
      const normalizedName = String(pluginName).replace(/(-\d+\.\d+\.\d+)$/, '');
      console.log(`PluginManager: Normalized plugin name: ${normalizedName}`);

      // 2. Xóa plugin khỏi danh sách đã đăng ký
      this.plugins.delete(pluginName);
      this.plugins.delete(normalizedName);

      // 3. Xóa các lệnh đã đăng ký
      const commandsToRemove = Object.keys(this.commands || {}).filter(cmd =>
        cmd.startsWith(`${pluginName}.`) || cmd.startsWith(`${normalizedName}.`)
      );

      for (const cmd of commandsToRemove) {
        console.log(`PluginManager: Removing command: ${cmd}`);
        delete this.commands[cmd];
      }

      // 4. Dừng plugin nếu đang chạy
      if (this.pluginProcesses.has(pluginName)) {
        try {
          const process = this.pluginProcesses.get(pluginName);
          if (process && !process.killed) {
            process.kill();
          }
          this.pluginProcesses.delete(pluginName);
        } catch (error) {
          console.error(`PluginManager: Error stopping plugin process:`, error);
          // Tiếp tục ngay cả khi có lỗi
        }
      }

      // 5. Xóa thư mục plugin
      try {
        this.pluginInstaller.uninstallPlugin(pluginName);
      } catch (error) {
        console.error(`PluginManager: Error removing plugin directory:`, error);
        // Tiếp tục ngay cả khi có lỗi
      }
    } catch (error) {
      console.error(`PluginManager: Error in uninstallPlugin:`, error);
      // Không ném lỗi, chỉ ghi log
    }

    // Luôn thông báo thay đổi danh sách plugin
    try {
      this.onPluginListChanged(this.getPlugins());
    } catch (error) {
      console.error(`PluginManager: Error notifying plugin list changed:`, error);
    }

    // Luôn trả về true để tránh lỗi UI
    return true;
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
      console.log(`Starting plugin: ${pluginName}`);

      // Get the main script path
      const mainPath = this.pluginInstaller.getPluginMainPath(pluginName);

      if (!mainPath) {
        throw new Error(`Plugin ${pluginName} main script not found`);
      }

      console.log(`Found main script at: ${mainPath}`);

      // Check if the plugin is already running
      if (this.pluginProcesses.has(pluginName)) {
        console.log(`Plugin ${pluginName} is already running`);
        return;
      }

      // Get plugin directory
      const pluginDir = path.dirname(mainPath);
      console.log(`Plugin directory: ${pluginDir}`);

      // Check if package.json exists and has dependencies
      const packageJsonPath = path.join(pluginDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

          // Check if the plugin has a specific protocol configuration
          const protocol = packageJson.protocol || {};
          const port = protocol.port || this.port;

          console.log(`Starting plugin process with port: ${port}`);

          // Start the plugin process with appropriate arguments
          const args = [mainPath];

          // Add port argument
          args.push(`--port=${port}`);

          // Start the plugin process
          const process = spawn('node', args, {
            stdio: 'pipe',
            detached: false,
            cwd: pluginDir // Set working directory to plugin directory
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
            // Set a timeout to resolve anyway after 10 seconds
            const timeout = setTimeout(() => {
              console.warn(`Plugin ${pluginName} did not connect within the timeout period`);

              // Create a simple plugin info object for plugins that don't connect
              if (!this.plugins.has(pluginName)) {
                console.log(`Creating manual plugin registration for ${pluginName}`);

                // Read plugin info from package.json
                const pluginInfo: PluginInfo = {
                  name: pluginName,
                  version: packageJson.version || '1.0.0',
                  description: packageJson.description || 'No description provided',
                  author: packageJson.author || 'Unknown'
                };

                // Create a dummy connection for the plugin
                const dummySocket = new Socket();
                const pluginConnection = new PluginConnection(dummySocket, pluginInfo);

                // Add to plugins list
                this.plugins.set(pluginName, pluginConnection);

                // Notify that the plugin list has changed
                this.onPluginListChanged(this.getPlugins());
              }

              resolve();
            }, 10000);

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
          console.error(`Error starting plugin process for ${pluginName}:`, error);
          throw error;
        }
      } else {
        throw new Error(`Package.json not found for plugin ${pluginName}`);
      }
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
      console.log(`Attempting to stop plugin: ${pluginName}`);

      // Get the plugin process
      const process = this.pluginProcesses.get(pluginName);

      if (process) {
        if (!process.killed) {
          try {
            // Kill the process
            console.log(`Killing process for plugin: ${pluginName}`);
            process.kill();
          } catch (killError) {
            console.error(`Error killing process for plugin ${pluginName}:`, killError);
          }
        } else {
          console.log(`Process for plugin ${pluginName} is already killed`);
        }

        // Remove from processes map regardless of kill success
        this.pluginProcesses.delete(pluginName);
      } else {
        console.log(`No process found for plugin: ${pluginName}`);
      }

      // Remove the plugin from the list
      if (this.plugins.has(pluginName)) {
        console.log(`Removing plugin ${pluginName} from registered plugins list`);
        this.plugins.delete(pluginName);
      } else {
        console.log(`Plugin ${pluginName} not found in registered plugins list`);
      }
    } catch (error) {
      console.error(`Error stopping plugin ${pluginName}:`, error);
      // Don't rethrow - we want to continue even if stopping fails
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

      case MessageType.REGISTER_MENU:
        this.handleRegisterMenuMessage(socket, message as RegisterMenuMessage);
        break;

      case MessageType.EXECUTE_MENU_ACTION:
        this.handleExecuteMenuActionMessage(socket, message as ExecuteMenuActionMessage);
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

        // Xóa các menu item của plugin
        this.menuRegistry.unregisterMenuItemsByPlugin(name);

        // Thông báo danh sách plugin đã thay đổi
        this.onPluginListChanged(this.getPlugins());

        // Thông báo danh sách menu item đã thay đổi
        this.onMenuItemsChanged(this.menuRegistry.getMenuItems());
        return;
      }
    }
  }

  /**
   * Xử lý thông điệp đăng ký menu từ plugin
   */
  private handleRegisterMenuMessage(socket: Socket, message: RegisterMenuMessage): void {
    // Tìm plugin từ socket
    let pluginName = '';
    for (const [name, plugin] of this.plugins.entries()) {
      if (plugin.socket === socket) {
        pluginName = name;
        break;
      }
    }

    if (!pluginName) {
      console.warn('Received register menu message from unregistered plugin');
      return;
    }

    console.log(`Registering menu items for plugin ${pluginName}:`, message.payload.menuItems);

    // Xóa các menu item cũ của plugin (nếu có)
    this.menuRegistry.unregisterMenuItemsByPlugin(pluginName);

    // Đăng ký các menu item mới
    for (const menuItem of message.payload.menuItems) {
      const item: MenuItem = {
        ...menuItem,
        pluginId: pluginName
      };

      this.menuRegistry.registerMenuItem(item);
    }

    // Thông báo danh sách menu item đã thay đổi
    this.onMenuItemsChanged(this.menuRegistry.getMenuItems());
  }

  /**
   * Xử lý thông điệp thực thi hành động menu
   */
  private handleExecuteMenuActionMessage(socket: Socket, message: ExecuteMenuActionMessage): void {
    // Tìm plugin từ socket
    for (const plugin of this.plugins.values()) {
      if (plugin.socket === socket) {
        // Tìm menu item tương ứng
        const menuItems = this.menuRegistry.getMenuItems();
        const menuItem = menuItems.find(item => item.id === message.payload.menuItemId);

        if (!menuItem) {
          console.warn(`Menu item with ID ${message.payload.menuItemId} not found`);
          return;
        }

        // Thực thi hành động menu
        console.log(`Executing menu action for item ${menuItem.id} (${menuItem.label})`);

        // Gọi executePlugin với nội dung và tùy chọn từ message
        this.executePlugin(
          plugin.info.name,
          message.payload.content || '',
          message.payload.filePath,
          message.payload.options
        ).catch(error => {
          console.error(`Error executing menu action: ${error.message}`);
        });

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
