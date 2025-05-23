import { ChildProcess, spawn } from "child_process";
import { StorageReference } from "firebase/storage";
import fs from "fs";
import { Server, Socket } from "net";
import path from "path";
import { MenuItem, MenuRegistry } from "./MenuContribution";
import { PluginInstaller } from "./PluginInstaller";
import {
  ExecuteMenuActionMessage,
  ExecuteMessage,
  MessageType,
  PluginInfo,
  PluginMessage,
  RegisterMenuMessage,
  RegisterMessage,
  ResponseMessage,
  PluginMenuItem
} from './PluginInterface';

// Import Firebase services
import { getAvailablePlugins as getFirebasePlugins } from '../services/firebase';
import { getAvailablePlugins as getMockPlugins } from '../services/firebase-mock';

// Define the functions we'll use
let getAvailablePlugins: () => Promise<{ name: string, ref: StorageReference }[]>;

try {
  // Try to use the real Firebase implementation
  getAvailablePlugins = getFirebasePlugins;
  console.log('Successfully imported Firebase services');
} catch (error) {
  // Fall back to mock implementation
  console.error('Error with Firebase services, falling back to mock implementation:', error);
  getAvailablePlugins = getMockPlugins;
  console.log('Using mock Firebase services');
}

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
  private mainWindow: Electron.BrowserWindow | null = null;

  constructor(port?: number) {
    // Use environment variable for port
    const envPort = process.env.VITE_PLUGIN_PORT ? parseInt(process.env.VITE_PLUGIN_PORT) : undefined;
    this.port = port || envPort || 5001; // Only fallback to 5001 if no env var and no parameter
    this.onPluginListChanged = () => {}; // Mặc định không làm gì
    this.onMenuItemsChanged = () => {}; // Mặc định không làm gì
    this.pluginInstaller = new PluginInstaller();
    this.menuRegistry = MenuRegistry.getInstance();

    console.log(`🔌 [PluginManager] Initialized with port: ${this.port} (from ${port ? 'parameter' : envPort ? 'environment' : 'default'})`);
  }

  /**
   * Đặt tham chiếu đến cửa sổ chính để gửi thông báo
   */
  public setMainWindow(window: Electron.BrowserWindow): void {
    this.mainWindow = window;
    console.log("Main window reference set in PluginManager");
  }

  /**
   * Khởi động server để lắng nghe kết nối từ các plugin
   */
  public async start(autoStartAI: boolean = false): Promise<void> {
    // Khởi động server
    this.server = new Server((socket: Socket) => {
      console.log("Plugin connected");

      // Xử lý dữ liệu từ plugin
      let buffer = '';
      socket.on("data", (data: Buffer) => {
        try {
          buffer += data.toString();

          // Tách các message bằng newline
          const messages = buffer.split('\n');

          // Giữ lại phần cuối chưa hoàn chỉnh
          buffer = messages.pop() || '';

          // Xử lý từng message hoàn chỉnh
          for (const messageStr of messages) {
            if (messageStr.trim()) {
              try {
                const message: PluginMessage = JSON.parse(messageStr);
                this.handlePluginMessage(socket, message);
              } catch (parseError) {
                console.error("Error parsing individual plugin message:", parseError);
                console.error("Message content:", messageStr);
              }
            }
          }
        } catch (error) {
          console.error("Error processing plugin data:", error);
        }
      });

      // Xử lý khi plugin ngắt kết nối
      socket.on("end", () => {
        this.handlePluginDisconnect(socket);
      });

      // Xử lý lỗi kết nối
      socket.on("error", (error) => {
        console.error("Plugin connection error:", error);
        this.handlePluginDisconnect(socket);
      });

      // Xử lý khi socket bị đóng
      socket.on("close", (hadError) => {
        console.log(`Plugin socket closed (had error: ${hadError})`);
        this.handlePluginDisconnect(socket);
      });
    });

    // Khởi động server với xử lý lỗi
    try {
      await new Promise<void>((resolve, reject) => {
        // Xử lý lỗi khi khởi động server
        this.server.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.error(`Port ${this.port} is already in use. Please close the application using this port or use a different port.`);
            reject(new Error(`Port ${this.port} is already in use`));
          } else {
            console.error(`Error starting plugin server:`, err);
            reject(err);
          }
        });

        // Khởi động server
        const serverHost = process.env.VITE_PLUGIN_SERVER_HOST || "127.0.0.1";
        this.server.listen(this.port, serverHost, () => {
          console.log(`Plugin server running on ${serverHost}:${this.port} (host from ${process.env.VITE_PLUGIN_SERVER_HOST ? 'environment' : 'default'})`);
          resolve();
        });
      });
    } catch (error) {
      console.error(`Failed to start plugin server on port ${this.port}:`, error);

      // Thử với cổng khác
      const alternativePort = this.port + 1;
      console.log(`Trying alternative port: ${alternativePort}`);

      this.port = alternativePort;
      this.server = new Server((socket: Socket) => {
        console.log("Plugin connected");

        // Xử lý dữ liệu từ plugin
        let buffer = '';
        socket.on("data", (data: Buffer) => {
          try {
            buffer += data.toString();

            // Tách các message bằng newline
            const messages = buffer.split('\n');

            // Giữ lại phần cuối chưa hoàn chỉnh
            buffer = messages.pop() || '';

            // Xử lý từng message hoàn chỉnh
            for (const messageStr of messages) {
              if (messageStr.trim()) {
                try {
                  const message: PluginMessage = JSON.parse(messageStr);
                  this.handlePluginMessage(socket, message);
                } catch (parseError) {
                  console.error("Error parsing individual plugin message:", parseError);
                  console.error("Message content:", messageStr);
                }
              }
            }
          } catch (error) {
            console.error("Error processing plugin data:", error);
          }
        });

        // Xử lý khi plugin ngắt kết nối
        socket.on("end", () => {
          this.handlePluginDisconnect(socket);
        });

        // Xử lý lỗi kết nối
        socket.on("error", (error) => {
          console.error("Plugin connection error:", error);
          this.handlePluginDisconnect(socket);
        });

        // Xử lý khi socket bị đóng
        socket.on("close", (hadError) => {
          console.log(`Plugin socket closed (had error: ${hadError})`);
          this.handlePluginDisconnect(socket);
        });
      });

      // Khởi động server với cổng thay thế
      const serverHost = process.env.VITE_PLUGIN_SERVER_HOST || "127.0.0.1";
      this.server.listen(this.port, serverHost, () => {
        console.log(`Plugin server running on alternative port ${serverHost}:${this.port} (host from ${process.env.VITE_PLUGIN_SERVER_HOST ? 'environment' : 'default'})`);
      });
    }

    // Load installed plugins
    await this.loadInstalledPlugins();

    // Chỉ khởi động AI Assistant nếu được yêu cầu
    if (autoStartAI) {
      console.log("Auto-starting AI Assistant plugin is enabled");
      await this.ensureAIAssistantRunning();
    } else {
      console.log("Auto-starting AI Assistant plugin is disabled");
    }
  }

  /**
   * Đảm bảo plugin AI Assistant đang chạy nếu đã được cài đặt
   */
  private async ensureAIAssistantRunning(): Promise<void> {
    try {
      console.log('Checking if AI Assistant plugin is installed and running...');

      // Kiểm tra xem plugin AI Assistant đã được cài đặt chưa trong user data directory
      const aiAssistantPlugins = this.findAIAssistantPlugins();
      console.log(`Found ${aiAssistantPlugins.length} AI Assistant plugins in user data directory`);

      // Verify that the plugin actually exists in the user data directory
      const validAIAssistantPlugins = aiAssistantPlugins.filter(plugin => {
        const pluginDir = this.pluginInstaller.findPluginDirectory(plugin.name);
        const isInUserData = pluginDir && pluginDir.includes(this.pluginInstaller.getPluginsDirectory());
        console.log(`Plugin ${plugin.name}: directory=${pluginDir}, isInUserData=${isInUserData}`);
        return isInUserData;
      });

      const aiAssistantPlugin = validAIAssistantPlugins.length > 0 ? validAIAssistantPlugins[0] : null;

      if (aiAssistantPlugin) {
        console.log(`AI Assistant plugin found in user data directory: ${aiAssistantPlugin.name}, ensuring it is running on port ${this.port}...`);

        // Kiểm tra xem plugin đã đang chạy chưa
        const isProcessRunning = this.findAIAssistantProcessKeys().length > 0;
        const isPluginRegistered = this.findAIAssistantPluginKeys().length > 0;

        if (!isProcessRunning || !isPluginRegistered) {
          console.log(`AI Assistant plugin needs to be started (process running: ${isProcessRunning}, registered: ${isPluginRegistered})`);

          try {
            // Dừng tất cả tiến trình AI Assistant cũ nếu có
            const aiProcessKeys = this.findAIAssistantProcessKeys();
            for (const processKey of aiProcessKeys) {
              this.stopPlugin(processKey);
            }

            // Đợi một chút trước khi khởi động lại
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Khởi động plugin với logic đặc biệt
            await this.startAIAssistantPlugin(aiAssistantPlugin.name);
            console.log(`AI Assistant plugin started successfully on port ${this.port}`);

            // Thông báo cho người dùng
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('plugin-auto-started', {
                pluginName: aiAssistantPlugin.name,
                message: `AI Assistant plugin auto-started on port ${this.port}`
              });
            }
          } catch (startError) {
            console.error('Failed to start AI Assistant plugin:', startError);

            // Thông báo cho người dùng về lỗi
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('plugin-error', {
                pluginName: 'ai-assistant',
                error: `Không thể khởi động plugin AI Assistant: ${startError instanceof Error ? startError.message : String(startError)}`
              });
            }

            // Không ném lỗi, tiếp tục thực hiện
          }
        } else {
          console.log('AI Assistant plugin is already running and registered');

          // Kiểm tra xem có process nào bị killed không
          const aiProcessKeys = this.findAIAssistantProcessKeys();
          let hasKilledProcess = false;

          for (const processKey of aiProcessKeys) {
            const process = this.pluginProcesses.get(processKey);
            if (process && process.killed) {
              hasKilledProcess = true;
              console.log(`AI Assistant process ${processKey} is marked as killed`);
              this.pluginProcesses.delete(processKey);
            }
          }

          if (hasKilledProcess) {
            console.log('Restarting AI Assistant plugin due to killed processes...');

            // Khởi động lại plugin
            try {
              await this.startAIAssistantPlugin(aiAssistantPlugin.name);
              console.log('AI Assistant plugin restarted successfully');
            } catch (restartError) {
              console.error('Failed to restart AI Assistant plugin:', restartError);
            }
          } else {
            // Thông báo rằng plugin đã sẵn sàng
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('plugin-ready', {
                pluginName: aiAssistantPlugin.name,
                message: `AI Assistant plugin is ready on port ${this.port}`
              });
            }
          }
        }
      } else {
        console.log('AI Assistant plugin is not installed in user data directory. Skipping auto-start.');
        console.log(`User data plugins directory: ${this.pluginInstaller.getPluginsDirectory()}`);
        // Không tự động cài đặt plugin nếu chưa được cài đặt
      }
    } catch (error) {
      console.error('Error ensuring AI Assistant plugin is running:', error);
      // Không ném lỗi, chỉ ghi log
    }
  }

  /**
   * Đăng ký callback khi danh sách plugin thay đổi
   */
  public setPluginListChangedCallback(
    callback: (plugins: PluginInfo[]) => void
  ): void {
    this.onPluginListChanged = callback;
  }

  /**
   * Đăng ký callback khi danh sách menu item thay đổi
   */
  public setMenuItemsChangedCallback(
    callback: (menuItems: MenuItem[]) => void
  ): void {
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
   * Đăng ký menu item tích hợp sẵn
   */
  public registerBuiltInMenuItem(menuItem: PluginMenuItem & { pluginId: string }): void {
    try {
      const menuItemWithPluginId: MenuItem = {
        ...menuItem,
        pluginId: menuItem.pluginId
      };

      this.menuRegistry.registerMenuItem(menuItemWithPluginId);
      console.log(`Built-in menu item registered: ${menuItem.id}`);

      // Thông báo thay đổi menu items
      const allMenuItems = this.menuRegistry.getMenuItems();
      if (typeof this.onMenuItemsChanged === 'function') {
        this.onMenuItemsChanged(allMenuItems);
      }

      // Gửi thông báo đến renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send("menu-items-changed", allMenuItems);
      }
    } catch (error) {
      console.error(`Error registering built-in menu item ${menuItem.id}:`, error);
    }
  }

  /**
   * Kiểm tra xem plugin có phải là AI Assistant không (dựa trên tên)
   */
  private isAIAssistantPlugin(pluginName: string): boolean {
    if (!pluginName) return false;
    return pluginName.toLowerCase().includes('ai-assistant');
  }

  /**
   * Tìm tất cả plugin AI Assistant đã cài đặt
   */
  private findAIAssistantPlugins(): PluginInfo[] {
    try {
      const installedPlugins = this.pluginInstaller.getInstalledPlugins();
      return installedPlugins.filter(p => this.isAIAssistantPlugin(p.name));
    } catch (error) {
      console.error('Error finding AI Assistant plugins:', error);
      return [];
    }
  }

  /**
   * Tìm tất cả process keys liên quan đến AI Assistant
   */
  private findAIAssistantProcessKeys(): string[] {
    return Array.from(this.pluginProcesses.keys()).filter(key =>
      this.isAIAssistantPlugin(key)
    );
  }

  /**
   * Tìm tất cả plugin keys liên quan đến AI Assistant
   */
  private findAIAssistantPluginKeys(): string[] {
    return Array.from(this.plugins.keys()).filter(key =>
      this.isAIAssistantPlugin(key)
    );
  }

  /**
   * Khởi động plugin AI Assistant theo yêu cầu
   */
  public async startAIAssistant(): Promise<void> {
    try {
      console.log('Manual start of AI Assistant plugin requested');

      // Kiểm tra xem plugin AI Assistant đã được cài đặt chưa
      const aiAssistantPlugins = this.findAIAssistantPlugins();
      const aiAssistantPlugin = aiAssistantPlugins.length > 0 ? aiAssistantPlugins[0] : null;

      if (aiAssistantPlugin) {
        console.log(`Starting AI Assistant plugin: ${aiAssistantPlugin.name}`);

        // Thông báo cho người dùng rằng plugin đang khởi động
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('plugin-starting', {
            pluginName: aiAssistantPlugin.name,
            message: `Starting AI Assistant plugin on port ${this.port}...`
          });
        }

        await this.startAIAssistantPlugin(aiAssistantPlugin.name);
        console.log('AI Assistant plugin started successfully via manual request');
      } else {
        console.log('AI Assistant plugin is not installed');

        // Thông báo cho người dùng rằng plugin chưa được cài đặt
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('plugin-error', {
            pluginName: 'ai-assistant',
            error: 'AI Assistant plugin is not installed. Please install it from the plugin marketplace first.'
          });
        }

        throw new Error('AI Assistant plugin is not installed');
      }
    } catch (error) {
      console.error('Error starting AI Assistant plugin manually:', error);

      // Thông báo lỗi cho người dùng
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('plugin-error', {
          pluginName: 'ai-assistant',
          error: `Failed to start AI Assistant plugin: ${error instanceof Error ? error.message : String(error)}`
        });
      }

      throw error;
    }
  }

  /**
   * Kiểm tra trạng thái của plugin AI Assistant
   */
  public isAIAssistantRunning(): boolean {
    try {
      // Kiểm tra xem có process đang chạy không
      const hasRunningProcess = this.findAIAssistantProcessKeys().length > 0;

      // Kiểm tra xem plugin đã được đăng ký không
      const isRegistered = this.findAIAssistantPluginKeys().length > 0;

      console.log(`AI Assistant status - Process running: ${hasRunningProcess}, Registered: ${isRegistered}`);

      return hasRunningProcess && isRegistered;
    } catch (error) {
      console.error('Error checking AI Assistant status:', error);
      return false;
    }
  }

  /**
   * Lấy thông tin chi tiết về trạng thái AI Assistant
   */
  public getAIAssistantStatus(): { installed: boolean; running: boolean; registered: boolean; port: number } {
    try {
      // Kiểm tra cài đặt
      const isInstalled = this.findAIAssistantPlugins().length > 0;

      // Kiểm tra process đang chạy
      const isRunning = this.findAIAssistantProcessKeys().length > 0;

      // Kiểm tra đăng ký
      const isRegistered = this.findAIAssistantPluginKeys().length > 0;

      return {
        installed: isInstalled,
        running: isRunning,
        registered: isRegistered,
        port: this.port
      };
    } catch (error) {
      console.error('Error getting AI Assistant status:', error);
      return {
        installed: false,
        running: false,
        registered: false,
        port: this.port
      };
    }
  }

  /**
   * Lấy danh sách thông tin các plugin đã đăng ký
   */
  public getPlugins(): PluginInfo[] {
    // Lấy danh sách plugin đã đăng ký
    const registeredPlugins = Array.from(this.plugins.values()).map(
      (connection) => connection.info
    );

    // Lấy danh sách plugin đã cài đặt nhưng chưa đăng ký
    const installedPlugins = this.pluginInstaller.getInstalledPlugins();

    // Kết hợp hai danh sách, ưu tiên plugin đã đăng ký
    const registeredNames = registeredPlugins.map((p) => p.name);
    const combinedPlugins = [...registeredPlugins];

    // Thêm các plugin đã cài đặt nhưng chưa đăng ký
    for (const plugin of installedPlugins) {
      // Chuẩn hóa tên plugin (loại bỏ phiên bản nếu có)
      const normalizedName = plugin.name.replace(/(-\d+\.\d+\.\d+)$/, "");

      // Kiểm tra xem plugin đã được đăng ký chưa
      if (
        !registeredNames.includes(plugin.name) &&
        !registeredNames.includes(normalizedName)
      ) {
        combinedPlugins.push(plugin);
      }
    }

    return combinedPlugins;
  }

  /**
   * Lấy danh sách các plugin có sẵn từ Firebase
   */
  public async getAvailablePlugins(): Promise<
    { name: string; installed: boolean }[]
  > {
    try {
      const availablePlugins = await getAvailablePlugins();
      const installedPlugins = this.getPlugins();

      console.log(
        "Available plugins from Firebase:",
        availablePlugins.map((p) => p.name)
      );
      console.log(
        "Installed plugins:",
        installedPlugins.map((p) => p.name)
      );

      // Tạo danh sách tên plugin đã cài đặt (bao gồm cả tên chuẩn hóa)
      const installedNames = new Set<string>();
      for (const plugin of installedPlugins) {
        installedNames.add(plugin.name);
        // Thêm tên chuẩn hóa nếu có phiên bản
        const normalizedName = plugin.name.replace(/(-\d+\.\d+\.\d+)$/, "");
        if (normalizedName !== plugin.name) {
          installedNames.add(normalizedName);
        }
      }

      console.log(
        "Installed plugin names (including normalized):",
        Array.from(installedNames)
      );

      // Lọc các plugin trùng lặp (loại bỏ các phiên bản trùng lặp)
      const uniquePlugins = new Map<
        string,
        { name: string; ref: StorageReference }
      >();
      for (const plugin of availablePlugins) {
        // Chuẩn hóa tên plugin (loại bỏ phiên bản nếu có)
        const normalizedName = plugin.name.replace(/(-\d+\.\d+\.\d+)$/, "");

        // Chỉ giữ lại plugin mới nhất cho mỗi tên chuẩn hóa
        if (
          !uniquePlugins.has(normalizedName) ||
          plugin.name.localeCompare(uniquePlugins.get(normalizedName)!.name) > 0
        ) {
          uniquePlugins.set(normalizedName, plugin);
        }
      }

      console.log(
        "Unique plugins after filtering:",
        Array.from(uniquePlugins.keys())
      );

      // Chuyển đổi thành mảng kết quả
      const result = Array.from(uniquePlugins.values()).map((plugin) => {
        // Chuẩn hóa tên plugin (loại bỏ phiên bản nếu có)
        const normalizedName = plugin.name.replace(/(-\d+\.\d+\.\d+)$/, "");

        // Kiểm tra xem plugin đã được cài đặt chưa
        const isInstalled =
          installedNames.has(normalizedName) || installedNames.has(plugin.name);

        console.log(
          `Plugin ${plugin.name} (normalized: ${normalizedName}) installed: ${isInstalled}`
        );

        return {
          name: plugin.name,
          installed: isInstalled,
        };
      });

      console.log("Final result:", result);
      return result;
    } catch (error) {
      console.error("Error getting available plugins:", error);
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
    console.log(
      `Content length: ${content?.length || 0}, filePath: ${filePath || "none"}`
    );

    // Normalize plugin name (remove version suffix if present)
    const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");
    console.log(`Normalized plugin name: ${normalizedName}`);

    // KIỂM TRA QUAN TRỌNG: Đảm bảo plugin vẫn được cài đặt
    const installedPlugins = this.pluginInstaller.getInstalledPlugins();
    const isStillInstalled = installedPlugins.some(
      (p) => p.name === pluginName || p.name === normalizedName
    );

    if (!isStillInstalled) {
      console.error(`Plugin ${pluginName} is no longer installed`);
      throw new Error(`Plugin ${pluginName} has been uninstalled and is no longer available`);
    }

    // Try both original and normalized names
    let plugin =
      this.plugins.get(pluginName) || this.plugins.get(normalizedName);

    if (!plugin) {
      console.error(`Plugin ${pluginName} not found in registered plugins`);
      console.log(
        `Registered plugins: ${Array.from(this.plugins.keys()).join(", ")}`
      );

      // Check if the plugin is installed but not registered
      console.log(
        `Installed plugins: ${installedPlugins.map((p) => p.name).join(", ")}`
      );

      if (isStillInstalled) {
        console.log(
          `Plugin ${pluginName} is installed but not registered. Attempting to start it...`
        );
        try {
          // Special handling for prettier-plugin
          if (pluginName.includes('prettier') || normalizedName.includes('prettier')) {
            console.log(`Special handling for prettier plugin: ${pluginName}`);

            try {
              // For prettier plugin, we'll create a manual registration without starting a process
              // since prettier is a formatting tool that doesn't need a persistent process

              const pluginInfo: PluginInfo = {
                name: normalizedName,
                version: "1.0.0",
                description: "Code formatting plugin using Prettier",
                author: "Text Editor Team",
                installed: true
              };

              // Create a dummy connection for the plugin
              const dummySocket = new Socket();
              const pluginConnection = new PluginConnection(dummySocket, pluginInfo);

              // Add to plugins list
              this.plugins.set(pluginName, pluginConnection);
              this.plugins.set(normalizedName, pluginConnection);

              console.log(`Manually registered prettier plugin: ${pluginName}`);

              // Register default menu items for prettier plugin
              const prettierMenuItems = [
                {
                  id: 'prettier-plugin.format',
                  label: 'Format Document',
                  parentMenu: 'edit',
                  accelerator: 'Shift+Alt+F'
                }
              ];

              for (const menuItem of prettierMenuItems) {
                const item: MenuItem = {
                  ...menuItem,
                  pluginId: normalizedName
                };
                console.log(`Registering prettier menu item: ${JSON.stringify(item)}`);
                this.menuRegistry.registerMenuItem(item);
              }

              // Notify that menu items have changed
              const allMenuItems = this.menuRegistry.getMenuItems();
              if (typeof this.onMenuItemsChanged === 'function') {
                this.onMenuItemsChanged(allMenuItems);
              }

              // Notify that the plugin list has changed
              if (typeof this.onPluginListChanged === 'function') {
                this.onPluginListChanged(this.getPlugins());
              }

              // Update plugin reference after registration
              plugin = this.plugins.get(pluginName) || this.plugins.get(normalizedName);

              // For prettier, we'll handle the formatting directly without a plugin process
              return this.handlePrettierFormatting(content, filePath, options);
            } catch (prettierError) {
              console.error(`Error in prettier plugin special handling:`, prettierError);
              // Fall back to normal plugin handling if special handling fails
            }
          } else {
            // Try to start the plugin normally
            await this.startPlugin(pluginName);

            // Check if the plugin is now registered
            plugin =
              this.plugins.get(pluginName) || this.plugins.get(normalizedName);
            if (plugin) {
              console.log(
                `Successfully started and registered plugin ${pluginName}`
              );
              return this.executePlugin(pluginName, content, filePath, options);
            } else {
              console.error(
                `Failed to register plugin ${pluginName} after starting it`
              );
              throw new Error(
                `Failed to register plugin ${pluginName} after starting it`
              );
            }
          }
        } catch (error: any) {
          console.error(`Failed to start plugin ${pluginName}:`, error);
          throw new Error(
            `Plugin ${pluginName} is installed but could not be started: ${
              error.message || error
            }`
          );
        }
      } else {
        console.error(`Plugin ${pluginName} is not installed`);
        throw new Error(`Plugin ${pluginName} is not installed`);
      }
    }

    return new Promise((resolve, reject) => {
      // Set a timeout for the plugin execution
      const timeoutId = setTimeout(() => {
        reject(
          new Error(`Plugin ${pluginName} execution timed out after 30 seconds`)
        );
      }, 30000);

      // Tạo message để gửi đến plugin
      const message: ExecuteMessage = {
        type: MessageType.EXECUTE,
        payload: {
          content,
          filePath,
          options,
        },
      };

      // Đăng ký callback để nhận phản hồi
      const responseHandler = (response: ResponseMessage) => {
        clearTimeout(timeoutId);

        if (response.payload.success) {
          console.log(`Plugin ${pluginName} executed successfully`);
          resolve(response.payload.data);
        } else {
          console.error(
            `Plugin ${pluginName} execution failed:`,
            response.payload.message
          );
          reject(new Error(response.payload.message));
        }
      };

      try {
        // Kiểm tra plugin có tồn tại không trước khi gửi message
        if (!plugin) {
          clearTimeout(timeoutId);
          reject(new Error(`Plugin ${pluginName} is not available for execution`));
          return;
        }

        // Gửi message và đợi phản hồi
        console.log(`Sending execute message to plugin ${pluginName}`);
        plugin.sendMessage(message, responseHandler);
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error(`Error sending message to plugin ${pluginName}:`, error);
        reject(
          new Error(
            `Error sending message to plugin: ${error.message || String(error)}`
          )
        );
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

      // Đảm bảo mainWindow được thiết lập
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        console.warn(`Main window not available or destroyed when installing plugin ${pluginName}`);
      }

      // Send installation start notification
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('plugin-install-start', {
          pluginName,
          message: `Starting installation of ${pluginName}...`
        });
      }

      // Normalize plugin name (remove version suffix if present)
      const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");
      console.log(`Normalized plugin name: ${normalizedName}`);

      // Kiểm tra xem đây có phải là plugin AI Assistant không
      const isAIAssistantPlugin = this.isAIAssistantPlugin(pluginName) || this.isAIAssistantPlugin(normalizedName);

      // Check if plugin is already installed
      if (this.pluginInstaller.isPluginInstalled(pluginName) ||
          this.pluginInstaller.isPluginInstalled(normalizedName)) {
        console.log(
          `Plugin ${pluginName} is already installed, starting it...`
        );

        // Get the installed plugin info
        const installedPlugins = this.pluginInstaller.getInstalledPlugins();
        const pluginInfo = installedPlugins.find((p) => {
          return p.name === pluginName || p.name === normalizedName;
        });

        if (pluginInfo) {
          // Đảm bảo plugin được đánh dấu là đã cài đặt
          pluginInfo.installed = true;

          try {
            // Sử dụng logic đặc biệt cho AI Assistant plugin
            if (isAIAssistantPlugin) {
              console.log(`Using special startup logic for AI Assistant plugin: ${pluginInfo.name}`);
              await this.startAIAssistantPlugin(pluginInfo.name);
            } else {
              // For non-AI plugins, try to register them manually without starting a process
              console.log(`Manually registering non-AI plugin after installation: ${pluginInfo.name}`);

              try {
                // Check if it's a prettier plugin
                if (pluginInfo.name.includes('prettier')) {
                  // Use special prettier handling
                  const normalizedPluginName = pluginInfo.name.replace(/(-\d+\.\d+\.\d+)$/, "");

                  // Create a dummy connection for the plugin
                  const dummySocket = new Socket();
                  const pluginConnection = new PluginConnection(dummySocket, pluginInfo);

                  // Add to plugins list
                  this.plugins.set(pluginInfo.name, pluginConnection);
                  this.plugins.set(normalizedPluginName, pluginConnection);

                  // Register default menu items for prettier plugin
                  const prettierMenuItems = [
                    {
                      id: 'prettier-plugin.format',
                      label: 'Format Document',
                      parentMenu: 'edit',
                      accelerator: 'Shift+Alt+F'
                    }
                  ];

                  for (const menuItem of prettierMenuItems) {
                    const item: MenuItem = {
                      ...menuItem,
                      pluginId: normalizedPluginName
                    };
                    console.log(`Registering prettier menu item: ${JSON.stringify(item)}`);
                    this.menuRegistry.registerMenuItem(item);
                  }

                  console.log(`Successfully registered prettier plugin: ${pluginInfo.name}`);
                } else {
                  // For other non-AI plugins, just mark as installed without starting
                  console.log(`Plugin ${pluginInfo.name} is installed but not auto-started`);
                }
              } catch (registrationError) {
                console.error(`Error manually registering plugin ${pluginInfo.name}:`, registrationError);
                // Continue without throwing error
              }
            }
          } catch (startError) {
            console.error(`Error starting plugin ${pluginInfo.name}:`, startError);
            // Thông báo lỗi nhưng không ném ngoại lệ
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('plugin-install-error', {
                pluginName: pluginInfo.name,
                error: `Error starting plugin: ${startError instanceof Error ? startError.message : String(startError)}`
              });
            }
            // Tiếp tục mà không ném lỗi
          }

          // Notify that the plugin list has changed - với xử lý lỗi cải tiến
          try {
            if (typeof this.onPluginListChanged === 'function') {
              const plugins = this.getPlugins();
              this.onPluginListChanged(plugins);

              // Gửi thông báo trực tiếp đến renderer
              if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send("plugin-list", plugins);
              }
            }
          } catch (notifyError) {
            console.error(`Error notifying plugin list changed:`, notifyError);
          }

          // Cập nhật menu items - với xử lý lỗi cải tiến
          setTimeout(() => {
            try {
              // Lấy danh sách menu items cho các menu cha
              const fileMenuItems = this.getMenuItemsForParent("file");
              const editMenuItems = this.getMenuItemsForParent("edit");
              const runMenuItems = this.getMenuItemsForParent("run");
              const viewMenuItems = this.getMenuItemsForParent("view");

              console.log(
                `PluginManager: Sending updated menu items after plugin installation`
              );
              console.log(
                `File menu items: ${fileMenuItems.length}, Edit menu items: ${editMenuItems.length}, Run menu items: ${runMenuItems.length}, View menu items: ${viewMenuItems.length}`
              );

              // Tạo danh sách tất cả menu items
              const allMenuItems = [
                ...fileMenuItems,
                ...editMenuItems,
                ...runMenuItems,
                ...viewMenuItems
              ];

              // Thông báo thay đổi menu items
              if (typeof this.onMenuItemsChanged === 'function') {
                this.onMenuItemsChanged(allMenuItems);
              }

              // Gửi thông báo trực tiếp đến renderer
              if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send("menu-items-changed", allMenuItems);

                // Gửi từng loại menu riêng biệt
                this.mainWindow.webContents.send("file-menu-items", fileMenuItems);
                this.mainWindow.webContents.send("edit-menu-items", editMenuItems);
                this.mainWindow.webContents.send("run-menu-items", runMenuItems);
                this.mainWindow.webContents.send("view-menu-items", viewMenuItems);
              }
            } catch (menuError) {
              console.error(
                `PluginManager: Error sending menu items:`,
                menuError
              );
            }
          }, 1000); // Tăng thời gian chờ lên 1 giây

          return pluginInfo;
        }
      }

      // Install the plugin
      console.log(`Installing plugin from Firebase: ${pluginName}`);
      let pluginInfo: PluginInfo;

      // Send download progress notification
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('plugin-install-progress', {
          pluginName,
          message: `Downloading ${pluginName} from Firebase...`,
          progress: 25
        });
      }

      try {
        pluginInfo = await this.pluginInstaller.installPluginByName(
          pluginName
        );
        console.log(`Plugin installed: ${JSON.stringify(pluginInfo)}`);

        // Send extraction progress notification
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('plugin-install-progress', {
            pluginName,
            message: `Extracting ${pluginName}...`,
            progress: 75
          });
        }
      } catch (installError) {
        console.error(`Error installing plugin ${pluginName}:`, installError);

        // Tạo thông tin plugin tạm thời để tránh lỗi màn hình trắng
        pluginInfo = {
          name: pluginName,
          version: "1.0.0",
          description: `Plugin ${pluginName}`,
          author: "Unknown",
          installed: false
        };

        // Thông báo lỗi nhưng không ném ngoại lệ
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('plugin-install-error', {
            pluginName,
            error: installError instanceof Error ? installError.message : String(installError)
          });
        }

        return pluginInfo;
      }

      // Đảm bảo plugin được đánh dấu là đã cài đặt
      pluginInfo.installed = true;

      // Send startup progress notification
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('plugin-install-progress', {
          pluginName: pluginInfo.name,
          message: `Starting ${pluginInfo.name}...`,
          progress: 90
        });
      }

      // Start the plugin với logic đặc biệt cho AI Assistant
      try {
        if (isAIAssistantPlugin) {
          console.log(`Using special startup logic for newly installed AI Assistant plugin: ${pluginInfo.name}`);
          await this.startAIAssistantPlugin(pluginInfo.name);

          // Thông báo thành công cho AI Assistant plugin
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('plugin-install-success', {
              pluginName: pluginInfo.name,
              message: `AI Assistant plugin installed and started successfully on port ${this.port}`,
              progress: 100
            });
          }
        } else {
          await this.startPlugin(pluginInfo.name);

          // Thông báo thành công cho plugin thông thường
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('plugin-install-success', {
              pluginName: pluginInfo.name,
              message: `Plugin ${pluginInfo.name} installed and started successfully`,
              progress: 100
            });
          }
        }
      } catch (startError) {
        console.error(`Error starting plugin ${pluginInfo.name}:`, startError);
        // Thông báo lỗi nhưng không ném ngoại lệ
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('plugin-install-error', {
            pluginName: pluginInfo.name,
            error: `Plugin installed but failed to start: ${startError instanceof Error ? startError.message : String(startError)}`
          });
        }
        // Tiếp tục mà không ném lỗi
      }

      // Notify that the plugin list has changed - với xử lý lỗi cải tiến
      try {
        if (typeof this.onPluginListChanged === 'function') {
          const plugins = this.getPlugins();
          this.onPluginListChanged(plugins);

          // Gửi thông báo trực tiếp đến renderer
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send("plugin-list", plugins);
          }
        }
      } catch (notifyError) {
        console.error(`Error notifying plugin list changed:`, notifyError);
      }

      // Cập nhật menu items - với xử lý lỗi cải tiến
      setTimeout(() => {
        try {
          // Lấy danh sách menu items cho các menu cha
          const fileMenuItems = this.getMenuItemsForParent("file");
          const editMenuItems = this.getMenuItemsForParent("edit");
          const runMenuItems = this.getMenuItemsForParent("run");
          const viewMenuItems = this.getMenuItemsForParent("view");

          console.log(
            `PluginManager: Sending updated menu items after plugin installation`
          );
          console.log(
            `File menu items: ${fileMenuItems.length}, Edit menu items: ${editMenuItems.length}, Run menu items: ${runMenuItems.length}, View menu items: ${viewMenuItems.length}`
          );

          // Tạo danh sách tất cả menu items
          const allMenuItems = [
            ...fileMenuItems,
            ...editMenuItems,
            ...runMenuItems,
            ...viewMenuItems
          ];

          // Thông báo thay đổi menu items
          if (typeof this.onMenuItemsChanged === 'function') {
            this.onMenuItemsChanged(allMenuItems);
          }

          // Gửi thông báo trực tiếp đến renderer
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send("menu-items-changed", allMenuItems);

            // Gửi từng loại menu riêng biệt
            this.mainWindow.webContents.send("file-menu-items", fileMenuItems);
            this.mainWindow.webContents.send("edit-menu-items", editMenuItems);
            this.mainWindow.webContents.send("run-menu-items", runMenuItems);
            this.mainWindow.webContents.send("view-menu-items", viewMenuItems);
          }
        } catch (menuError) {
          console.error(`PluginManager: Error sending menu items:`, menuError);
        }
      }, 1000); // Tăng thời gian chờ lên 1 giây

      return pluginInfo;
    } catch (error) {
      console.error(`Error installing plugin ${pluginName}:`, error);

      // Tạo thông tin plugin tạm thời để tránh lỗi màn hình trắng
      const fallbackPluginInfo: PluginInfo = {
        name: pluginName,
        version: "1.0.0",
        description: `Plugin ${pluginName}`,
        author: "Unknown",
        installed: false
      };

      // Thông báo lỗi nhưng không ném ngoại lệ
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('plugin-install-error', {
          pluginName,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      return fallbackPluginInfo;
    }
  }
  /**
   * Uninstall a plugin - Cải tiến với xử lý lỗi tốt hơn và logic đặc biệt cho AI Assistant
   */
  public async uninstallPlugin(pluginName: string): Promise<boolean> {
    if (!pluginName) {
      console.error(`PluginManager: Invalid plugin name: ${pluginName}`);
      return true; // Vẫn trả về true để tránh lỗi UI
    }

    console.log(`PluginManager: Uninstalling plugin: ${pluginName}`);

    // Đảm bảo mainWindow được thiết lập
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn(`Main window not available or destroyed when uninstalling plugin ${pluginName}`);
    }

    // Kiểm tra xem đây có phải là plugin AI Assistant không
    const normalizedName = String(pluginName).replace(/(-\d+\.\d+\.\d+)$/, "");
    const isAIAssistantPlugin = this.isAIAssistantPlugin(pluginName) || this.isAIAssistantPlugin(normalizedName);

    if (isAIAssistantPlugin) {
      console.log(`PluginManager: Detected AI Assistant plugin uninstallation: ${pluginName}`);
    }

    try {
      console.log(`PluginManager: Normalized plugin name: ${normalizedName}`);

      // 1. Dừng plugin trước khi gỡ cài đặt - đặc biệt quan trọng cho AI Assistant
      try {
        console.log(`PluginManager: Stopping plugin processes before uninstallation`);

        // Dừng tất cả các process liên quan
        const processesToStop = [pluginName, normalizedName];

        // Nếu là AI Assistant, tìm tất cả process có tên chứa 'ai-assistant'
        if (isAIAssistantPlugin) {
          const aiProcesses = this.findAIAssistantProcessKeys();
          processesToStop.push(...aiProcesses);
        }

        for (const processName of processesToStop) {
          if (this.pluginProcesses && this.pluginProcesses.has(processName)) {
            const process = this.pluginProcesses.get(processName);
            console.log(`PluginManager: Stopping plugin process: ${processName}`);

            if (process) {
              try {
                if (!process.killed) {
                  process.kill('SIGTERM'); // Sử dụng SIGTERM trước
                  console.log(`PluginManager: Sent SIGTERM to process for ${processName}`);

                  // Đợi một chút để process tự thoát
                  await new Promise(resolve => setTimeout(resolve, 2000));

                  // Nếu vẫn chưa thoát, dùng SIGKILL
                  if (!process.killed) {
                    process.kill('SIGKILL');
                    console.log(`PluginManager: Sent SIGKILL to process for ${processName}`);
                  }
                } else {
                  console.log(`PluginManager: Process for ${processName} was already killed`);
                }
              } catch (killError) {
                console.error(`PluginManager: Error killing process for ${processName}:`, killError);
              }

              // Xóa tham chiếu process
              this.pluginProcesses.delete(processName);
            }
          }
        }
      } catch (processError) {
        console.error(`PluginManager: Error stopping plugin processes:`, processError);
        // Tiếp tục ngay cả khi có lỗi
      }

      // 2. Xóa plugin khỏi danh sách đã đăng ký - với xử lý lỗi
      try {
        const pluginsToRemove = [pluginName, normalizedName];

        // Nếu là AI Assistant, tìm tất cả plugin có tên chứa 'ai-assistant'
        if (isAIAssistantPlugin) {
          const aiPlugins = this.findAIAssistantPluginKeys();
          pluginsToRemove.push(...aiPlugins);
        }

        for (const pluginToRemove of pluginsToRemove) {
          if (this.plugins.has(pluginToRemove)) {
            console.log(`PluginManager: Removing plugin from registry: ${pluginToRemove}`);
            this.plugins.delete(pluginToRemove);
          }
        }
      } catch (registryError) {
        console.error(`PluginManager: Error removing plugin from registry:`, registryError);
        // Tiếp tục ngay cả khi có lỗi
      }

      // 3. Xóa các lệnh đã đăng ký
      try {
        const commandPrefixes = [pluginName, normalizedName];

        // Nếu là AI Assistant, tìm tất cả command có prefix chứa 'ai-assistant'
        if (isAIAssistantPlugin) {
          const aiCommands = Object.keys(this.commands || {}).filter(cmd =>
            this.isAIAssistantPlugin(cmd)
          );
          // Thêm các prefix từ commands thực tế
          const aiPrefixes = [...new Set(aiCommands.map(cmd => cmd.split('.')[0]))];
          commandPrefixes.push(...aiPrefixes);
        }

        const commandsToRemove = Object.keys(this.commands || {}).filter(
          (cmd) => commandPrefixes.some(prefix => cmd.startsWith(`${prefix}.`))
        );

        for (const cmd of commandsToRemove) {
          console.log(`PluginManager: Removing command: ${cmd}`);
          delete this.commands[cmd];
        }
      } catch (commandsError) {
        console.error(`PluginManager: Error removing commands:`, commandsError);
        // Tiếp tục ngay cả khi có lỗi
      }

      // 4. Xóa menu items của plugin - Cải thiện logic
      try {
        console.log(`PluginManager: Removing menu items for plugin: ${pluginName}`);

        // Lấy tất cả menu items hiện tại để debug
        const allMenuItems = this.menuRegistry.getMenuItems();
        console.log(`PluginManager: Current menu items before removal:`,
          allMenuItems.map(item => ({ id: item.id, pluginId: item.pluginId, label: item.label })));

        const menuPluginsToRemove = [pluginName, normalizedName];

        // Nếu là AI Assistant, tìm tất cả menu items có pluginId chứa 'ai-assistant'
        if (isAIAssistantPlugin) {
          // Lấy tất cả menu items hiện tại và tìm những cái có pluginId chứa 'ai-assistant'
          const aiMenuPluginIds = [...new Set(
            allMenuItems
              .filter(item => item.pluginId && this.isAIAssistantPlugin(item.pluginId))
              .map(item => item.pluginId!)
          )];
          menuPluginsToRemove.push(...aiMenuPluginIds);
          console.log(`PluginManager: Found AI Assistant menu plugin IDs:`, aiMenuPluginIds);
        }

        // Thêm tất cả các biến thể tên có thể có
        const additionalVariants = [
          pluginName.toLowerCase(),
          normalizedName.toLowerCase(),
          pluginName.replace(/[^a-zA-Z0-9]/g, '-'),
          normalizedName.replace(/[^a-zA-Z0-9]/g, '-')
        ];
        menuPluginsToRemove.push(...additionalVariants);

        // Tìm tất cả menu items có pluginId khớp với bất kỳ biến thể nào
        const menuItemsToRemove = allMenuItems.filter(item => {
          if (!item.pluginId) return false;

          // Kiểm tra khớp chính xác
          if (menuPluginsToRemove.includes(item.pluginId)) return true;

          // Kiểm tra khớp với pattern (cho trường hợp có version suffix)
          return menuPluginsToRemove.some(variant =>
            item.pluginId!.startsWith(variant) ||
            item.pluginId!.includes(variant) ||
            variant.includes(item.pluginId!)
          );
        });

        console.log(`PluginManager: Menu items to remove:`,
          menuItemsToRemove.map(item => ({ id: item.id, pluginId: item.pluginId, label: item.label })));

        // Xóa menu items theo plugin ID
        try {
          // Xóa từng menu item riêng lẻ
          for (const menuItem of menuItemsToRemove) {
            try {
              this.menuRegistry.unregisterMenuItemsByPlugin(menuItem.pluginId!);
              console.log(`PluginManager: Successfully removed menu items for pluginId: ${menuItem.pluginId}`);
            } catch (menuError) {
              console.error(`PluginManager: Error removing menu items for pluginId ${menuItem.pluginId}:`, menuError);
            }
          }

          // Xóa theo danh sách plugin names để đảm bảo
          for (const menuPluginName of menuPluginsToRemove) {
            try {
              this.menuRegistry.unregisterMenuItemsByPlugin(menuPluginName);
              console.log(`PluginManager: Successfully removed menu items for: ${menuPluginName}`);
            } catch (menuError) {
              console.error(`PluginManager: Error removing menu items for ${menuPluginName}:`, menuError);
            }
          }
        } catch (menuRemovalError) {
          console.error(`PluginManager: Error in menu removal process:`, menuRemovalError);
        }

        // Kiểm tra kết quả sau khi xóa
        const remainingMenuItems = this.menuRegistry.getMenuItems();
        console.log(`PluginManager: Remaining menu items after removal:`,
          remainingMenuItems.map(item => ({ id: item.id, pluginId: item.pluginId, label: item.label })));

      } catch (menuRemovalError) {
        console.error(`PluginManager: Error in menu removal process:`, menuRemovalError);
        // Tiếp tục ngay cả khi có lỗi
      }

      // 5. Xóa thư mục plugin - với xử lý lỗi cải tiến
      try {
        console.log(`PluginManager: Removing plugin directory for: ${pluginName}`);

        // Thử gỡ cài đặt với tên gốc
        let uninstallResult = this.pluginInstaller.uninstallPlugin(pluginName);
        console.log(`PluginManager: Plugin directory removal result for ${pluginName}: ${uninstallResult}`);

        // Nếu không thành công và tên khác với tên chuẩn hóa, thử với tên chuẩn hóa
        if (!uninstallResult && pluginName !== normalizedName) {
          uninstallResult = this.pluginInstaller.uninstallPlugin(normalizedName);
          console.log(`PluginManager: Plugin directory removal result for ${normalizedName}: ${uninstallResult}`);
        }
      } catch (dirError) {
        console.error(`PluginManager: Error removing plugin directory:`, dirError);
        // Tiếp tục ngay cả khi có lỗi
      }
    } catch (error) {
      console.error(`PluginManager: Error in uninstallPlugin:`, error);

      // Thông báo lỗi cho renderer process
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        try {
          this.mainWindow.webContents.send('plugin-uninstall-error', {
            pluginName,
            error: error instanceof Error ? error.message : String(error)
          });
        } catch (sendError) {
          console.error(`PluginManager: Error sending uninstall error to renderer:`, sendError);
        }
      }

      // Không ném lỗi, chỉ ghi log
    }

    // Luôn thông báo thay đổi danh sách plugin - với xử lý lỗi cải tiến
    try {
      console.log(`PluginManager: Notifying plugin list changed after uninstallation`);
      const currentPlugins = this.getPlugins();
      console.log(`PluginManager: Current plugins after uninstallation: ${currentPlugins.length}`);

      // Đảm bảo onPluginListChanged được gọi an toàn
      if (typeof this.onPluginListChanged === 'function') {
        this.onPluginListChanged(currentPlugins);

        // Gửi thông báo trực tiếp đến renderer
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send("plugin-list", currentPlugins);
        }
      } else {
        console.warn(`PluginManager: onPluginListChanged is not a function`);
      }

      // Cập nhật menu items ngay lập tức - với xử lý lỗi cải tiến
      const updateMenuItems = () => {
        try {
          // Lấy danh sách menu items cho các menu cha
          const fileMenuItems = this.getMenuItemsForParent("file");
          const editMenuItems = this.getMenuItemsForParent("edit");
          const runMenuItems = this.getMenuItemsForParent("run");
          const viewMenuItems = this.getMenuItemsForParent("view");

          console.log(
            `PluginManager: Sending updated menu items after plugin uninstallation`
          );
          console.log(
            `File menu items: ${fileMenuItems.length}, Edit menu items: ${editMenuItems.length}, Run menu items: ${runMenuItems.length}, View menu items: ${viewMenuItems.length}`
          );

          // Tạo danh sách tất cả menu items
          const allMenuItems = [
            ...fileMenuItems,
            ...editMenuItems,
            ...runMenuItems,
            ...viewMenuItems
          ];

          // Thông báo thay đổi menu items
          if (typeof this.onMenuItemsChanged === 'function') {
            this.onMenuItemsChanged(allMenuItems);
          }

          // Gửi thông báo trực tiếp đến renderer
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send("menu-items-changed", allMenuItems);

            // Gửi từng loại menu riêng biệt
            this.mainWindow.webContents.send("file-menu-items", fileMenuItems);
            this.mainWindow.webContents.send("edit-menu-items", editMenuItems);
            this.mainWindow.webContents.send("run-menu-items", runMenuItems);
            this.mainWindow.webContents.send("view-menu-items", viewMenuItems);

            // Gửi thông báo đặc biệt để force refresh menu
            this.mainWindow.webContents.send("force-menu-refresh", {
              reason: "plugin-uninstalled",
              pluginName: pluginName,
              timestamp: Date.now()
            });
          }
        } catch (menuError) {
          console.error(`PluginManager: Error updating menu items:`, menuError);
        }
      };

      // Cập nhật ngay lập tức
      updateMenuItems();

      // Cập nhật lại sau 500ms để đảm bảo
      setTimeout(updateMenuItems, 500);
    } catch (error) {
      console.error(
        `PluginManager: Error notifying plugin list changed:`,
        error
      );
    }

    // Thông báo thành công cho renderer process
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        const successMessage = isAIAssistantPlugin
          ? `AI Assistant plugin uninstalled successfully. All AI features have been removed.`
          : `Plugin ${pluginName} uninstalled successfully`;

        this.mainWindow.webContents.send('plugin-uninstall-success', {
          pluginName,
          message: successMessage,
          isAIAssistant: isAIAssistantPlugin
        });

        // Thông báo đặc biệt cho AI Assistant
        if (isAIAssistantPlugin) {
          this.mainWindow.webContents.send('ai-assistant-uninstalled', {
            message: 'AI Assistant has been completely removed from the system'
          });
        }
      } catch (sendError) {
        console.error(`PluginManager: Error sending uninstall success to renderer:`, sendError);
      }
    }

    console.log(`PluginManager: Uninstall completed for plugin: ${pluginName}${isAIAssistantPlugin ? ' (AI Assistant)' : ''}`);
    // Luôn trả về true để tránh lỗi UI
    return true;
  }

  /**
   * Load all installed plugins
   */
  private async loadInstalledPlugins(): Promise<void> {
    try {
      const installedPlugins = this.pluginInstaller.getInstalledPlugins();
      console.log("Found installed plugins:", installedPlugins);

      for (const pluginInfo of installedPlugins) {
        console.log(`Starting plugin: ${pluginInfo.name}`);

        try {
          await this.startPlugin(pluginInfo.name);
          console.log(`Successfully started plugin: ${pluginInfo.name}`);
        } catch (error) {
          console.error(`Error starting plugin ${pluginInfo.name}:`, error);
          // Continue with other plugins even if one fails
        }
      }
    } catch (error) {
      console.error("Error loading installed plugins:", error);
    }
  }

  /**
   * Start a plugin
   */
  public async startPlugin(pluginName: string, forceNormalStartup: boolean = false): Promise<void> {
    try {
      console.log(`Starting plugin: ${pluginName}`);

      // Đảm bảo mainWindow được thiết lập
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        console.warn(`Main window not available or destroyed when starting plugin ${pluginName}`);
      }

      // Normalize plugin name (remove version suffix if present)
      const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");
      console.log(`Normalized plugin name: ${normalizedName}`);

      // Xử lý đặc biệt cho plugin ai-assistant nếu không bị buộc dùng quy trình thông thường
      const isAIAssistantPlugin = this.isAIAssistantPlugin(pluginName) || this.isAIAssistantPlugin(normalizedName);
      if (!forceNormalStartup && isAIAssistantPlugin) {
        console.log('Using special handling for ai-assistant plugin');
        return await this.startAIAssistantPlugin(pluginName);
      }

      // Get the main script path
      const mainPath = this.pluginInstaller.getPluginMainPath(pluginName);

      if (!mainPath) {
        const error = new Error(`Plugin ${pluginName} main script not found`);
        console.error(error);

        // Thông báo lỗi cho renderer process
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('plugin-error', {
            pluginName,
            error: `Main script not found. Please reinstall the plugin.`
          });
        }

        throw error;
      }

      console.log(`Found main script at: ${mainPath}`);

      // Check if the plugin is already running
      if (this.pluginProcesses.has(pluginName) || this.pluginProcesses.has(normalizedName)) {
        const existingProcess = this.pluginProcesses.get(pluginName) || this.pluginProcesses.get(normalizedName);

        if (existingProcess && !existingProcess.killed) {
          console.log(`Plugin ${pluginName} is already running`);
          return;
        } else {
          console.log(`Plugin ${pluginName} process exists but is not running, will restart it`);
          // Xóa process cũ
          this.pluginProcesses.delete(pluginName);
          this.pluginProcesses.delete(normalizedName);
        }
      }

      // Get plugin directory - should be the root plugin directory, not the directory containing the main script
      const pluginDir = this.pluginInstaller.findPluginDirectory(pluginName);
      if (!pluginDir) {
        throw new Error(`Plugin directory not found for ${pluginName}`);
      }
      console.log(`Plugin directory: ${pluginDir}`);

      // Check if node_modules exists
      const nodeModulesPath = path.join(pluginDir, "node_modules");
      console.log(`Checking for node_modules at: ${nodeModulesPath}`);
      if (!fs.existsSync(nodeModulesPath)) {
        console.warn(
          `node_modules not found for plugin ${pluginName}. Installing dependencies...`
        );
        try {
          const { execSync } = require("child_process");
          execSync("npm install --no-fund --no-audit --loglevel=error", {
            cwd: pluginDir,
            stdio: "inherit",
            timeout: 60000, // 60 seconds timeout
          });
          console.log(
            `Dependencies installed successfully for plugin ${pluginName}`
          );
        } catch (npmError) {
          console.error(
            `Error installing dependencies for plugin ${pluginName}:`,
            npmError
          );

          // Thông báo lỗi cho renderer process
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('plugin-error', {
              pluginName,
              error: `Error installing dependencies: ${npmError instanceof Error ? npmError.message : String(npmError)}`
            });
          }

          console.log(
            "Continuing without installing dependencies - plugin may not work correctly"
          );
        }
      } else {
        console.log(`node_modules found for plugin ${pluginName}`);
      }

      // Check if package.json exists and has dependencies
      const packageJsonPath = path.join(pluginDir, "package.json");
      console.log(`Checking for package.json at: ${packageJsonPath}`);
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, "utf-8")
          );
          console.log(`package.json for plugin ${pluginName}:`, packageJson);

          // Check if the plugin has a specific protocol configuration
          const protocol = packageJson.protocol || {};
          const port = protocol.port || this.port;

          console.log(`Starting plugin process with port: ${port}`);

          // Start the plugin process with appropriate arguments
          const args = [mainPath];

          // Add port argument
          args.push(`--port=${port}`);

          // Start the plugin process
          const process = spawn("node", args, {
            stdio: "pipe",
            detached: false,
            cwd: pluginDir, // Set working directory to plugin directory
          });

          // Store the process
          this.pluginProcesses.set(pluginName, process);
          // Also store with normalized name if different
          if (normalizedName !== pluginName) {
            this.pluginProcesses.set(normalizedName, process);
          }

          // Handle process output
          process.stdout.on("data", (data) => {
            console.log(`[Plugin ${pluginName}] ${data.toString().trim()}`);
          });

          process.stderr.on("data", (data) => {
            const errorMessage = data.toString().trim();
            console.error(`[Plugin ${pluginName} Error] ${errorMessage}`);

            // Kiểm tra lỗi thiếu module
            if (errorMessage.includes("Cannot find module")) {
              const missingModuleMatch = errorMessage.match(/Cannot find module '([^']+)'/);
              if (missingModuleMatch && missingModuleMatch[1]) {
                const missingModule = missingModuleMatch[1];
                console.log(`Detected missing module: ${missingModule}`);

                // Thông báo cho renderer process
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                  this.mainWindow.webContents.send('plugin-error', {
                    pluginName,
                    error: `Missing module: ${missingModule}. Attempting to install...`
                  });
                }

                // Thử cài đặt module bị thiếu
                try {
                  const { execSync } = require("child_process");
                  execSync(`npm install ${missingModule} --no-fund --no-audit --loglevel=error`, {
                    cwd: pluginDir,
                    stdio: "inherit",
                    timeout: 60000, // 60 seconds timeout
                  });
                  console.log(`Successfully installed missing module: ${missingModule}`);
                } catch (installError) {
                  console.error(`Error installing missing module ${missingModule}:`, installError);

                  // Thông báo lỗi cho renderer process
                  if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.send('plugin-error', {
                      pluginName,
                      error: `Failed to install missing module: ${missingModule}`
                    });
                  }
                }
              }
            }
          });

          // Handle process exit
          process.on("exit", (code) => {
            console.log(`Plugin ${pluginName} exited with code ${code}`);
            this.pluginProcesses.delete(pluginName);
            if (normalizedName !== pluginName) {
              this.pluginProcesses.delete(normalizedName);
            }

            // Thông báo cho renderer process nếu plugin thoát với lỗi
            if (code !== 0 && this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('plugin-error', {
                pluginName,
                error: `Plugin process exited with code ${code}`
              });
            }

            // Remove the plugin from the list if it's not connected
            if (!this.plugins.has(pluginName) && !this.plugins.has(normalizedName)) {
              if (typeof this.onPluginListChanged === 'function') {
                this.onPluginListChanged(this.getPlugins());
              }
            }
          });

          // Wait for the plugin to connect
          await new Promise<void>((resolve) => {
            // Set a timeout to resolve anyway after 10 seconds
            const timeout = setTimeout(() => {
              console.warn(
                `Plugin ${pluginName} did not connect within the timeout period`
              );

              // Create a simple plugin info object for plugins that don't connect
              if (!this.plugins.has(pluginName) && !this.plugins.has(normalizedName)) {
                console.log(
                  `Creating manual plugin registration for ${pluginName}`
                );

                // Read plugin info from package.json
                const pluginInfo: PluginInfo = {
                  name: pluginName,
                  version: packageJson.version || "1.0.0",
                  description:
                    packageJson.description || "No description provided",
                  author: packageJson.author || "Unknown",
                  installed: true
                };

                // Create a dummy connection for the plugin
                const dummySocket = new Socket();
                const pluginConnection = new PluginConnection(
                  dummySocket,
                  pluginInfo
                );

                // Add to plugins list
                this.plugins.set(pluginName, pluginConnection);
                // Also register with normalized name if different
                if (normalizedName !== pluginName) {
                  this.plugins.set(normalizedName, pluginConnection);
                }

                // Đọc thông tin menu items từ package.json nếu có
                try {
                  if (
                    packageJson.menuItems &&
                    Array.isArray(packageJson.menuItems)
                  ) {
                    console.log(
                      `Found menu items in package.json for ${pluginName}:`,
                      packageJson.menuItems
                    );

                    // Đăng ký các menu items
                    for (const menuItem of packageJson.menuItems) {
                      const item: MenuItem = {
                        ...menuItem,
                        pluginId: pluginName,
                      };
                      console.log(
                        `Registering menu item from package.json: ${JSON.stringify(
                          item
                        )}`
                      );
                      this.menuRegistry.registerMenuItem(item);
                    }

                    // Thông báo danh sách menu item đã thay đổi
                    const allMenuItems = this.menuRegistry.getMenuItems();
                    if (typeof this.onMenuItemsChanged === 'function') {
                      this.onMenuItemsChanged(allMenuItems);
                    }

                    // Gửi thông báo đến renderer process
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                      this.mainWindow.webContents.send(
                        "menu-items-changed",
                        allMenuItems
                      );
                    }
                  }
                } catch (menuError) {
                  console.error(
                    `Error registering menu items from package.json for ${pluginName}:`,
                    menuError
                  );
                }

                // Notify that the plugin list has changed
                if (typeof this.onPluginListChanged === 'function') {
                  this.onPluginListChanged(this.getPlugins());
                }
              }

              resolve();
            }, 10000);

            // Set up a temporary listener for plugin list changes
            const originalCallback = this.onPluginListChanged;
            this.onPluginListChanged = (plugins) => {
              // Call the original callback
              if (typeof originalCallback === 'function') {
                originalCallback(plugins);
              }

              // Check if our plugin is in the list
              if (plugins.some((p) => p.name === pluginName || p.name === normalizedName)) {
                clearTimeout(timeout);
                this.onPluginListChanged = originalCallback;
                resolve();
              }
            };
          });
        } catch (error) {
          console.error(
            `Error starting plugin process for ${pluginName}:`,
            error
          );

          // Thông báo lỗi cho renderer process
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('plugin-error', {
              pluginName,
              error: `Error starting plugin: ${error instanceof Error ? error.message : String(error)}`
            });
          }

          throw error;
        }
      } else {
        console.error(`package.json not found at: ${packageJsonPath}`);
        console.log(`Plugin directory contents:`, fs.existsSync(pluginDir) ? fs.readdirSync(pluginDir) : 'Directory does not exist');
        console.log(`Main script path: ${mainPath}`);
        console.log(`Plugin directory: ${pluginDir}`);

        const error = new Error(`package.json not found for plugin ${pluginName}`);
        console.error(error);

        // Thông báo lỗi cho renderer process
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('plugin-error', {
            pluginName,
            error: `package.json not found. Please reinstall the plugin.`
          });
        }

        throw error;
      }
    } catch (error) {
      console.error(`Error starting plugin ${pluginName}:`, error);

      // Thông báo lỗi cho renderer process nếu chưa được gửi
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('plugin-error', {
          pluginName,
          error: `Failed to start plugin: ${error instanceof Error ? error.message : String(error)}`
        });
      }

      throw error;
    }
  }
  /**
   * Tìm thư mục plugin AI Assistant
   */
  private findAIAssistantPluginDirectory(pluginName: string): string | null {
    try {
      console.log(`Finding AI Assistant plugin directory for: ${pluginName}`);

      // Sử dụng PluginInstaller để tìm thư mục plugin
      const pluginDir = this.pluginInstaller.findPluginDirectory(pluginName);
      if (pluginDir) {
        console.log(`Found AI Assistant plugin directory using PluginInstaller: ${pluginDir}`);
        return pluginDir;
      }

      // Nếu không tìm thấy, thử tìm trong thư mục plugins của userData
      const pluginsDir = this.pluginInstaller.getPluginsDirectory();
      console.log(`Plugins directory: ${pluginsDir}`);

      // Kiểm tra các thư mục có thể
      const possibleDirs = [
        path.join(pluginsDir, 'ai-assistant'),
        path.join(pluginsDir, 'ai-assistant-1.0.0')
      ];

      for (const dir of possibleDirs) {
        if (fs.existsSync(dir)) {
          console.log(`Found AI Assistant plugin directory at: ${dir}`);
          return dir;
        }
      }

      // Tìm kiếm trong tất cả các thư mục con
      try {
        const allDirs = fs.readdirSync(pluginsDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        // Tìm thư mục có tên chứa 'ai-assistant'
        const aiAssistantDir = allDirs.find(dir => dir.includes('ai-assistant'));
        if (aiAssistantDir) {
          const fullPath = path.join(pluginsDir, aiAssistantDir);
          console.log(`Found AI Assistant plugin directory by name search: ${fullPath}`);
          return fullPath;
        }
      } catch (error) {
        console.error(`Error searching for AI Assistant plugin directory:`, error);
      }

      console.error(`AI Assistant plugin directory not found`);
      return null;
    } catch (error) {
      console.error(`Error finding AI Assistant plugin directory:`, error);
      return null;
    }
  }

  /**
   * Tìm main script cho plugin AI Assistant trong thư mục cụ thể
   */
  private findAIAssistantMainScript(pluginDir: string, mainScriptPath: string): string | null {
    try {
      console.log(`Finding AI Assistant main script in ${pluginDir} with path ${mainScriptPath}`);

      // Kiểm tra đường dẫn trực tiếp
      const directPath = path.join(pluginDir, mainScriptPath);
      if (fs.existsSync(directPath)) {
        console.log(`Found AI Assistant main script at: ${directPath}`);
        return directPath;
      }

      // Các vị trí có thể có main script
      const possiblePaths = [
        path.join(pluginDir, 'dist', 'index.js'),
        path.join(pluginDir, 'index.js'),
        path.join(pluginDir, 'ai-assistant', 'dist', 'index.js'),
        path.join(pluginDir, 'ai-assistant', 'index.js')
      ];

      // Kiểm tra từng vị trí
      for (const mainPath of possiblePaths) {
        if (fs.existsSync(mainPath)) {
          console.log(`Found AI Assistant main script at: ${mainPath}`);
          return mainPath;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error finding AI Assistant main script:`, error);
      return null;
    }
  }

  /**
   * Tìm tất cả các file JavaScript trong thư mục
   */
  private findJavaScriptFiles(dir: string): string[] {
    try {
      const results: string[] = [];
      const files = fs.readdirSync(dir);

      for (const file of files) {
        try {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);

          if (stat.isDirectory()) {
            results.push(...this.findJavaScriptFiles(filePath));
          } else if (file.endsWith('.js')) {
            results.push(filePath);
          }
        } catch (error) {
          console.error(`Error processing file ${file}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error(`Error finding JavaScript files in ${dir}:`, error);
      return [];
    }
  }

  /**
   * Handle prettier formatting without starting a plugin process
   */
  private async handlePrettierFormatting(content: string, filePath?: string, options?: any): Promise<string> {
    try {
      console.log('Handling prettier formatting directly');

      // Try to use prettier if available
      try {
        // Import prettier dynamically to handle potential missing dependency
        let prettier: any;
        try {
          prettier = require('prettier');
        } catch (importError) {
          console.warn('Prettier module not found, attempting to install...');
          // If prettier is not available, return formatted content using basic formatting
          return this.basicFormatting(content);
        }

        // Determine parser based on file extension
        let parser = 'babel';
        if (filePath) {
          const ext = filePath.split('.').pop()?.toLowerCase();
          switch (ext) {
            case 'js':
            case 'jsx':
              parser = 'babel';
              break;
            case 'ts':
            case 'tsx':
              parser = 'typescript';
              break;
            case 'css':
              parser = 'css';
              break;
            case 'html':
              parser = 'html';
              break;
            case 'json':
              parser = 'json';
              break;
            case 'md':
              parser = 'markdown';
              break;
            case 'cpp':
            case 'c':
            case 'h':
              // For C/C++ files, use basic formatting since prettier doesn't support them
              return this.basicFormatting(content);
            default:
              parser = 'babel';
          }
        }

        const formatted = await prettier.format(content, {
          parser,
          semi: true,
          singleQuote: true,
          tabWidth: 2,
          trailingComma: 'es5',
          printWidth: 80,
          ...options
        });

        console.log('Content formatted successfully with prettier');
        return formatted;
      } catch (prettierError) {
        console.warn('Prettier formatting failed, using basic formatting:', prettierError);
        // Fallback to basic formatting
        return this.basicFormatting(content);
      }
    } catch (error) {
      console.error('Error in prettier formatting:', error);
      // Return original content if all formatting fails
      return content;
    }
  }

  /**
   * Basic formatting fallback
   */
  private basicFormatting(content: string): string {
    try {
      // Try to parse and format as JSON first
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If not JSON, apply basic indentation and formatting
      const lines = content.split('\n');
      let indentLevel = 0;
      const indentSize = 2;

      const formattedLines = lines.map(line => {
        const trimmedLine = line.trim();

        // Skip empty lines
        if (!trimmedLine) {
          return '';
        }

        // Decrease indent for closing brackets/braces
        if (trimmedLine.match(/^[\}\]\)]/)) {
          indentLevel = Math.max(0, indentLevel - 1);
        }

        // Apply current indentation
        const formattedLine = ' '.repeat(indentLevel * indentSize) + trimmedLine;

        // Increase indent for opening brackets/braces
        if (trimmedLine.match(/[\{\[\(]$/)) {
          indentLevel++;
        }

        return formattedLine;
      });

      return formattedLines.join('\n');
    }
  }

  /**
   * Start AI Assistant plugin
   */
  private async startAIAssistantPlugin(pluginName: string): Promise<void> {
    try {
      console.log(`Starting AI Assistant plugin: ${pluginName}`);

      // Kiểm tra xem plugin đã đang chạy chưa
      if (this.pluginProcesses.has(pluginName)) {
        const process = this.pluginProcesses.get(pluginName);
        if (process && !process.killed) {
          console.log(`AI Assistant plugin ${pluginName} is already running`);

          // Kiểm tra xem plugin đã đăng ký chưa
          if (this.plugins.has(pluginName)) {
            console.log(`AI Assistant plugin ${pluginName} is already registered`);
            return;
          } else {
            console.log(`AI Assistant plugin ${pluginName} is running but not registered, will register it manually`);
            // Tiếp tục để đăng ký plugin thủ công
          }
        } else {
          console.log(`AI Assistant plugin ${pluginName} process exists but is not running, will restart it`);
          this.pluginProcesses.delete(pluginName);
        }
      }

      // Tìm thư mục plugin
      const pluginDir = this.findAIAssistantPluginDirectory(pluginName);
      if (!pluginDir) {
        console.error(`Plugin directory for ${pluginName} not found`);
        throw new Error(`Plugin directory for ${pluginName} not found. Please install the plugin from Firebase first.`);
      }
      console.log(`Found AI Assistant plugin directory at: ${pluginDir}`);

      // Check if the plugin is already running
      if (this.pluginProcesses.has(pluginName)) {
        console.log(`Plugin ${pluginName} is already running`);

        // Kiểm tra xem tiến trình có thực sự đang chạy không
        const process = this.pluginProcesses.get(pluginName);
        if (process && process.killed) {
          console.log(`Process for ${pluginName} is marked as killed, removing from list`);
          this.pluginProcesses.delete(pluginName);
        } else {
          return;
        }
      }

      // Kiểm tra hoặc tạo package.json nếu cần
      const packageJsonPath = path.join(pluginDir, 'package.json');
      let packageJson: any;

      if (!fs.existsSync(packageJsonPath)) {
        console.log(`package.json not found for plugin ${pluginName}, creating a default one`);
        packageJson = {
          name: 'ai-assistant',
          version: '1.0.0',
          description: 'AI Assistant plugin for Text Editor',
          main: 'dist/index.js',
          author: 'nhtam',
          dependencies: {
            axios: '^1.6.2',
            dotenv: '^16.3.1',
            firebase: '^11.7.3'
          }
        };

        // Ghi file package.json
        try {
          fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
          console.log(`Created default package.json for plugin ${pluginName}`);
        } catch (writeError) {
          console.error(`Error creating package.json for plugin ${pluginName}:`, writeError);
          // Tiếp tục mà không cần ghi file
        }
      } else {
        try {
          packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          console.log(`package.json for plugin ${pluginName}:`, packageJson);

          // Ensure dependencies object exists
          if (!packageJson.dependencies) {
            packageJson.dependencies = {};
          }

          // Check and add required dependencies if missing
          let dependenciesUpdated = false;

          if (!packageJson.dependencies.axios) {
            packageJson.dependencies.axios = '^1.6.2';
            dependenciesUpdated = true;
          }

          if (!packageJson.dependencies.dotenv) {
            packageJson.dependencies.dotenv = '^16.3.1';
            dependenciesUpdated = true;
          }

          if (!packageJson.dependencies.firebase) {
            packageJson.dependencies.firebase = '^11.7.3';
            dependenciesUpdated = true;
          }

          // Special handling for prettier plugin - add prettier dependency
          const normalizedPluginName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");
          if (pluginName.includes('prettier') || normalizedPluginName.includes('prettier')) {
            if (!packageJson.dependencies.prettier) {
              packageJson.dependencies.prettier = '^3.0.0';
              dependenciesUpdated = true;
              console.log(`Added prettier dependency for plugin ${pluginName}`);
            }
          }

          // Update package.json if dependencies were added
          if (dependenciesUpdated) {
            console.log(`Updating package.json with required dependencies for plugin ${pluginName}`);
            try {
              fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
              console.log(`Updated package.json for plugin ${pluginName}`);
            } catch (writeError) {
              console.error(`Error updating package.json for plugin ${pluginName}:`, writeError);
            }
          }
        } catch (readError) {
          console.error(`Error reading package.json for plugin ${pluginName}:`, readError);
          packageJson = {
            name: 'ai-assistant',
            version: '1.0.0',
            description: 'AI Assistant plugin for Text Editor',
            main: 'dist/index.js',
            author: 'nhtam',
            dependencies: {
              axios: '^1.6.2',
              dotenv: '^16.3.1',
              firebase: '^11.7.3'
            }
          };

          // Write the default package.json if reading failed
          try {
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
            console.log(`Created default package.json after read error for plugin ${pluginName}`);
          } catch (writeError) {
            console.error(`Error creating package.json after read error for plugin ${pluginName}:`, writeError);
          }
        }
      }

      // Tạo file .env nếu chưa có
      const envFilePath = path.join(pluginDir, '.env');
      if (!fs.existsSync(envFilePath)) {
        try {
          // Sử dụng global process thay vì biến process cục bộ
          const geminiApiKey = global.process && global.process.env ? global.process.env.GEMINI_API_KEY || '' : '';
          const envContent = `AI_PROVIDER=gemini
GEMINI_API_KEY=${geminiApiKey}
GEMINI_MODEL=gemini-pro`;
          fs.writeFileSync(envFilePath, envContent, 'utf-8');
          console.log(`Created .env file for plugin ${pluginName}`);
        } catch (writeError) {
          console.error(`Error creating .env file for plugin ${pluginName}:`, writeError);
        }
      }

      // Tìm main script
      let mainPath = this.findAIAssistantMainScript(pluginDir, packageJson.main || 'dist/index.js');
      if (!mainPath) {
        console.error(`Main script not found for plugin ${pluginName}`);

        // Tìm bất kỳ file JavaScript nào trong thư mục
        const jsFiles = this.findJavaScriptFiles(pluginDir);
        if (jsFiles.length > 0) {
          mainPath = jsFiles[0];
          console.log(`Using ${mainPath} as main script for plugin ${pluginName}`);
        } else {
          // Tạo file index.js đơn giản nếu không tìm thấy
          const simpleIndexPath = path.join(pluginDir, 'index.js');
          try {
            // Sử dụng nội dung từ simple-package.js nếu có
            const simplePackagePath = path.join(pluginDir, 'simple-package.js');
            if (fs.existsSync(simplePackagePath)) {
              fs.copyFileSync(simplePackagePath, simpleIndexPath);
              console.log(`Copied simple-package.js to index.js for plugin ${pluginName}`);
            } else {
              // Tạo file index.js đơn giản
              const simpleIndexContent = `
const net = require('net');
const axios = require('axios');

// Plugin communication
const PORT = 5000;
let client;
let messageQueue = [];
let connected = false;

// Connect to the editor
function connectToEditor() {
  client = new net.Socket();

  client.connect(PORT, '127.0.0.1', () => {
    console.log('Connected to editor');
    connected = true;

    // Register plugin
    client.write(JSON.stringify({
      type: 'register-plugin',
      payload: {
        name: 'ai-assistant',
        version: '1.0.0',
        description: 'AI Assistant plugin for Text Editor',
        author: 'nhtam'
      }
    }));

    // Register menu items
    client.write(JSON.stringify({
      type: 'register-menu',
      payload: {
        pluginName: 'ai-assistant',
        menuItems: [
          {
            id: 'ai-assistant.aiChat',
            label: 'AI Chat',
            parentMenu: 'view',
            accelerator: 'Alt+A'
          }
        ]
      }
    }));
  });

  client.on('data', (data) => {
    console.log('Received data from editor');
  });

  client.on('close', () => {
    console.log('Connection closed');
    connected = false;
    // Try to reconnect after a delay
    setTimeout(connectToEditor, 5000);
  });

  client.on('error', (error) => {
    console.error('Connection error:', error);
    connected = false;
  });
}

// Start the plugin
connectToEditor();
`;
              fs.writeFileSync(simpleIndexPath, simpleIndexContent, 'utf-8');
              console.log(`Created simple index.js for plugin ${pluginName}`);
            }
            mainPath = simpleIndexPath;
          } catch (createError) {
            console.error(`Error creating index.js for plugin ${pluginName}:`, createError);
            throw new Error(`No JavaScript files found for plugin ${pluginName}`);
          }
        }
      }
      console.log(`Found main script at: ${mainPath}`);

      // Check if node_modules exists or if dependencies were updated
      const nodeModulesPath = path.join(pluginDir, 'node_modules');
      const axiosModulePath = path.join(nodeModulesPath, 'axios');
      const dotenvModulePath = path.join(nodeModulesPath, 'dotenv');

      console.log(`Checking for node_modules at: ${nodeModulesPath}`);

      // Force reinstall if required modules are missing
      const forceReinstall = !fs.existsSync(axiosModulePath) || !fs.existsSync(dotenvModulePath);

      if (!fs.existsSync(nodeModulesPath) || forceReinstall) {
        console.warn(`${forceReinstall ? 'Required modules missing' : 'node_modules not found'} for plugin ${pluginName}. Installing dependencies...`);
        try {
          const { execSync } = require('child_process');
          execSync('npm install --no-fund --no-audit --loglevel=error', {
            cwd: pluginDir,
            stdio: 'inherit',
            timeout: 120000 // 120 seconds timeout (increased from 60s)
          });
          console.log(`Dependencies installed successfully for plugin ${pluginName}`);
        } catch (npmError) {
          console.error(`Error installing dependencies for plugin ${pluginName}:`, npmError);

          // Try installing specific packages directly if npm install fails
          try {
            console.log(`Attempting to install specific required packages directly...`);
            const { execSync } = require('child_process');

            // Base packages for all plugins
            let packagesToInstall = 'axios dotenv firebase';

            // Add prettier for prettier plugins
            const normalizedPluginName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");
            if (pluginName.includes('prettier') || normalizedPluginName.includes('prettier')) {
              packagesToInstall += ' prettier';
              console.log(`Adding prettier package for plugin ${pluginName}`);
            }

            execSync(`npm install ${packagesToInstall} --no-fund --no-audit --loglevel=error`, {
              cwd: pluginDir,
              stdio: 'inherit',
              timeout: 120000
            });
            console.log(`Required packages installed successfully for plugin ${pluginName}`);
          } catch (directInstallError) {
            console.error(`Error installing specific packages for plugin ${pluginName}:`, directInstallError);
            console.log('Continuing without installing dependencies - plugin may not work correctly');
          }
        }
      } else {
        console.log(`node_modules found for plugin ${pluginName}`);
      }

      // Start the plugin process with appropriate arguments
      const args = [mainPath];

      // Add port argument - đảm bảo sử dụng cổng hiện tại của PluginManager
      console.log(`Starting AI Assistant plugin on port ${this.port}`);
      args.push(`--port=${this.port}`);

      // Start the plugin process
      const childProcess = spawn('node', args, {
        stdio: 'pipe',
        detached: false,
        cwd: pluginDir, // Set working directory to plugin directory
        env: {
          ...global.process.env,
          // Thêm biến môi trường để plugin biết cổng chính xác
          PLUGIN_PORT: String(this.port),
          // Đảm bảo plugin biết đây là AI Assistant
          AI_ASSISTANT_MODE: 'true',
          // Thiết lập provider mặc định
          AI_PROVIDER: 'gemini'
        }
      });

      // Store the process
      this.pluginProcesses.set(pluginName, childProcess);

      // Thông báo cho người dùng rằng plugin đang khởi động
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('plugin-starting', {
          pluginName,
          message: `AI Assistant plugin is starting on port ${this.port}...`
        });
      }

      // Handle process output
      childProcess.stdout.on('data', (data: Buffer) => {
        console.log(`[Plugin ${pluginName}] ${data.toString().trim()}`);
      });

      // Biến để theo dõi số lần lỗi kết nối liên tiếp
      let connectionErrorCount = 0;
      const MAX_CONNECTION_ERRORS = 5;
      let isRestarting = false;
      let lastErrorTime = 0;
      const ERROR_COOLDOWN_MS = 10000; // 10 giây giữa các lần khởi động lại

      childProcess.stderr.on('data', (data: Buffer) => {
        const errorText = data.toString().trim();
        const currentTime = Date.now();

        // Kiểm tra lỗi kết nối (có thể là port 5000 hoặc 5001)
        if (errorText.includes('ECONNREFUSED') && (errorText.includes('127.0.0.1:5000') || errorText.includes('127.0.0.1:5001'))) {
          // Chỉ tăng bộ đếm nếu đã qua thời gian cooldown
          if (currentTime - lastErrorTime > 1000) { // 1 giây giữa các lần đếm lỗi
            connectionErrorCount++;
            lastErrorTime = currentTime;
          }

          // Chỉ hiển thị thông báo lỗi kết nối sau mỗi 5 lần
          if (connectionErrorCount % 5 === 1) {
            console.error(`[Plugin ${pluginName} Error] Connection error (${connectionErrorCount}): ${errorText}`);

            // Thông báo cho người dùng về lỗi kết nối
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('plugin-connection-error', {
                pluginName,
                error: 'Không thể kết nối đến máy chủ AI Assistant. Vui lòng kiểm tra kết nối mạng hoặc khởi động lại ứng dụng.'
              });
            }
          }

          // Nếu có quá nhiều lỗi kết nối liên tiếp, khởi động lại plugin
          if (connectionErrorCount >= MAX_CONNECTION_ERRORS && !isRestarting &&
              (currentTime - lastErrorTime > ERROR_COOLDOWN_MS)) {
            console.log(`Too many connection errors (${connectionErrorCount}), restarting plugin ${pluginName}...`);
            connectionErrorCount = 0;
            isRestarting = true;

            // Khởi động lại plugin
            try {
              if (childProcess && !childProcess.killed) {
                childProcess.kill();
                console.log(`Killed process for plugin ${pluginName}`);
              }
            } catch (killError) {
              console.error(`Error killing process for plugin ${pluginName}:`, killError);
            }

            // Đặt lại trạng thái sau khi khởi động lại
            setTimeout(() => {
              isRestarting = false;
            }, ERROR_COOLDOWN_MS);
          }
        } else {
          // Đặt lại bộ đếm lỗi kết nối nếu gặp lỗi khác
          connectionErrorCount = 0;
          console.error(`[Plugin ${pluginName} Error] ${errorText}`);

          // Check for missing module errors and try to fix them
          if (errorText.includes('Cannot find module') && !errorText.includes('already tried')) {
            const moduleMatch = errorText.match(/Cannot find module '([^']+)'/);
            if (moduleMatch && moduleMatch[1]) {
              const missingModule = moduleMatch[1];
              console.log(`Detected missing module: ${missingModule}. Attempting to install it...`);

              try {
                const { execSync } = require('child_process');
                execSync(`npm install ${missingModule} --no-fund --no-audit --loglevel=error`, {
                  cwd: pluginDir,
                  stdio: 'inherit',
                  timeout: 60000
                });
                console.log(`Successfully installed missing module: ${missingModule}`);

                // Don't restart here - let the process exit handler handle it
              } catch (installError) {
                console.error(`Error installing missing module ${missingModule}:`, installError);
              }
            }
          }
        }
      });

      // Handle process exit
      childProcess.on('exit', (code: number) => {
        console.log(`Plugin ${pluginName} exited with code ${code}`);
        this.pluginProcesses.delete(pluginName);

        // Automatically restart the plugin if it exits
        console.log(`Automatically restarting plugin ${pluginName}...`);
        setTimeout(() => {
          this.startAIAssistantPlugin(pluginName).catch(error => {
            console.error(`Error restarting plugin ${pluginName}:`, error);
          });
        }, 5000); // Wait 5 seconds before restarting
      });

      // Register the plugin manually if it doesn't connect within the timeout period
      setTimeout(() => {
        if (!this.plugins.has(pluginName)) {
          console.log(`Manually registering AI Assistant plugin ${pluginName} after timeout`);

          // Create plugin info
          const pluginInfo: PluginInfo = {
            name: pluginName,
            version: packageJson.version || '1.0.0',
            description: packageJson.description || 'AI Assistant plugin for Text Editor',
            author: packageJson.author || 'nhtam',
            installed: true
          };

          // Create a dummy connection for the plugin
          const dummySocket = new Socket();
          const pluginConnection = new PluginConnection(
            dummySocket,
            pluginInfo
          );

          // Add to plugins list
          this.plugins.set(pluginName, pluginConnection);

          // Register default menu items for AI Assistant if not found in package.json
          const defaultMenuItems = [
            {
              id: 'ai-assistant.aiChat',
              label: 'AI Chat',
              parentMenu: 'view',
              accelerator: 'Alt+A'
            }
          ];

          const menuItemsToRegister = (packageJson.menuItems && Array.isArray(packageJson.menuItems))
            ? packageJson.menuItems
            : defaultMenuItems;

          console.log(`Registering menu items for AI Assistant ${pluginName}:`, menuItemsToRegister);

          // Register menu items
          for (const menuItem of menuItemsToRegister) {
            const item: MenuItem = {
              ...menuItem,
              pluginId: pluginName
            };
            console.log(`Registering menu item: ${JSON.stringify(item)}`);
            this.menuRegistry.registerMenuItem(item);
          }

          // Notify that menu items have changed
          const allMenuItems = this.menuRegistry.getMenuItems();
          if (typeof this.onMenuItemsChanged === 'function') {
            this.onMenuItemsChanged(allMenuItems);
          }

          // Notify that the plugin list has changed
          if (typeof this.onPluginListChanged === 'function') {
            this.onPluginListChanged(this.getPlugins());
          }

          // Thông báo thành công cho người dùng
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('plugin-ready', {
              pluginName,
              message: `AI Assistant plugin is ready and running on port ${this.port}`
            });
          }
        } else {
          console.log(`AI Assistant plugin ${pluginName} connected successfully within timeout`);

          // Thông báo thành công cho người dùng
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('plugin-ready', {
              pluginName,
              message: `AI Assistant plugin connected successfully on port ${this.port}`
            });
          }
        }
      }, 15000); // Tăng thời gian chờ lên 15 giây cho AI Assistant

      console.log(`AI Assistant plugin ${pluginName} startup initiated successfully`);
    } catch (error) {
      console.error(`Error starting AI Assistant plugin ${pluginName}:`, error);
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
            console.error(
              `Error killing process for plugin ${pluginName}:`,
              killError
            );
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
        console.log(
          `Removing plugin ${pluginName} from registered plugins list`
        );
        this.plugins.delete(pluginName);
      } else {
        console.log(
          `Plugin ${pluginName} not found in registered plugins list`
        );
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
        this.handleExecuteMenuActionMessage(
          socket,
          message as ExecuteMenuActionMessage
        );
        break;

      case 'save-file':
        this.handleSaveFileMessage(socket, message);
        break;

      case 'show-ai-chat':
        this.handleShowAIChatMessage(socket, message);
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Xử lý thông điệp đăng ký từ plugin
   */
  private handleRegisterMessage(
    socket: Socket,
    message: RegisterMessage
  ): void {
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
        name: name || "Unknown Plugin",
        version: version || "1.0.0",
        description: description || "No description provided",
        author: author || "Unknown",
      };
    }

    // Tạo kết nối plugin mới
    const pluginConnection = new PluginConnection(socket, pluginInfo);

    // Lưu vào danh sách
    this.plugins.set(pluginInfo.name, pluginConnection);

    console.log(
      `Plugin registered: ${pluginInfo.name} v${
        pluginInfo.version || "unknown"
      }`
    );

    // Thông báo danh sách plugin đã thay đổi
    this.onPluginListChanged(this.getPlugins());
  }

  /**
   * Xử lý thông điệp phản hồi từ plugin
   */
  private handleResponseMessage(
    socket: Socket,
    message: ResponseMessage
  ): void {
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
    try {
      // Tìm và xóa plugin khỏi danh sách
      let disconnectedPluginName = "";

      for (const [name, plugin] of this.plugins.entries()) {
        if (plugin.socket === socket) {
          disconnectedPluginName = name;
          this.plugins.delete(name);
          console.log(`Plugin disconnected: ${name}`);

          // Xóa các menu item của plugin
          try {
            this.menuRegistry.unregisterMenuItemsByPlugin(name);
          } catch (menuError) {
            console.error(`Error unregistering menu items for plugin ${name}:`, menuError);
          }

          break;
        }
      }

      if (disconnectedPluginName) {
        // Thông báo cho renderer process về việc plugin đã ngắt kết nối
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          try {
            this.mainWindow.webContents.send('plugin-disconnected', {
              pluginName: disconnectedPluginName
            });
          } catch (sendError) {
            console.error(`Error sending plugin-disconnected event:`, sendError);
          }
        }

        // Thông báo danh sách plugin đã thay đổi - với xử lý lỗi cải tiến
        try {
          if (typeof this.onPluginListChanged === 'function') {
            const plugins = this.getPlugins();
            this.onPluginListChanged(plugins);

            // Gửi thông báo trực tiếp đến renderer
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send("plugin-list", plugins);
            }
          }
        } catch (listError) {
          console.error(`Error notifying plugin list changed:`, listError);
        }

        // Thông báo danh sách menu item đã thay đổi - với xử lý lỗi cải tiến
        try {
          if (typeof this.onMenuItemsChanged === 'function') {
            const allMenuItems = this.menuRegistry.getMenuItems();
            this.onMenuItemsChanged(allMenuItems);

            // Gửi thông báo trực tiếp đến renderer
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send("menu-items-changed", allMenuItems);
            }
          }
        } catch (menuError) {
          console.error(`Error notifying menu items changed:`, menuError);
        }

        // Kiểm tra xem có cần khởi động lại plugin AI Assistant không
        if (disconnectedPluginName.includes('ai-assistant')) {
          console.log(`AI Assistant plugin disconnected, attempting to restart...`);
          setTimeout(() => {
            try {
              this.startAIAssistantPlugin(disconnectedPluginName).catch(error => {
                console.error(`Error restarting AI Assistant plugin:`, error);
              });
            } catch (restartError) {
              console.error(`Error restarting AI Assistant plugin:`, restartError);
            }
          }, 5000); // Chờ 5 giây trước khi khởi động lại
        }
      }
    } catch (error) {
      console.error(`Error handling plugin disconnect:`, error);
      // Không ném lỗi, chỉ ghi log
    }
  }

  /**
   * Xử lý thông điệp đăng ký menu từ plugin
   */
  private handleRegisterMenuMessage(
    socket: Socket,
    message: RegisterMenuMessage
  ): void {
    try {
      console.log("Received register menu message:", message);

      // Kiểm tra message và payload
      if (!message || !message.payload) {
        console.error("Invalid register menu message: missing payload");
        return;
      }

      // Kiểm tra menu items
      if (!message.payload.menuItems || !Array.isArray(message.payload.menuItems)) {
        console.error("Invalid register menu message: menuItems is not an array");
        return;
      }

      // Tìm plugin từ socket
      let pluginName = "";
      for (const [name, plugin] of this.plugins.entries()) {
        if (plugin.socket === socket) {
          pluginName = name;
          break;
        }
      }

      // Nếu không tìm thấy plugin từ socket, sử dụng tên plugin từ message
      if (!pluginName && message.payload && message.payload.pluginName) {
        pluginName = message.payload.pluginName;
        console.log(`Using plugin name from message: ${pluginName}`);

        // Kiểm tra xem plugin có tồn tại trong danh sách đã đăng ký không
        if (!this.plugins.has(pluginName)) {
          console.warn(
            `Plugin ${pluginName} not found in registered plugins. Attempting to find it...`
          );

          // Tìm plugin dựa trên tên chuẩn hóa
          const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");

          // Kiểm tra xem plugin có tồn tại với tên chuẩn hóa không
          if (this.plugins.has(normalizedName)) {
            pluginName = normalizedName;
            console.log(`Found plugin with normalized name: ${pluginName}`);
          } else {
            // Tìm kiếm plugin dựa trên socket
            for (const [name, plugin] of this.plugins.entries()) {
              if (plugin.socket === socket) {
                pluginName = name;
                console.log(`Found plugin by socket: ${pluginName}`);
                break;
              }
            }
          }
        }
      }

      if (!pluginName) {
        console.warn("Received register menu message from unregistered plugin");
        console.log("Registered plugins:", Array.from(this.plugins.keys()));
        console.log("Attempting to start plugin from message payload...");

        if (message.payload && message.payload.pluginName) {
          const pluginNameFromPayload = message.payload.pluginName;
          console.log(`Attempting to start plugin: ${pluginNameFromPayload}`);

          // Thử khởi động plugin
          try {
            this.startPlugin(pluginNameFromPayload).catch((error) => {
              console.error(
                `Failed to start plugin ${pluginNameFromPayload}:`,
                error
              );
            });
          } catch (startError) {
            console.error(`Error starting plugin ${pluginNameFromPayload}:`, startError);
          }
        }

        return;
      }

      console.log(
        `Registering menu items for plugin ${pluginName}:`,
        message.payload.menuItems
      );

      // Xóa các menu item cũ của plugin (nếu có)
      try {
        this.menuRegistry.unregisterMenuItemsByPlugin(pluginName);
      } catch (unregisterError) {
        console.error(`Error unregistering menu items for plugin ${pluginName}:`, unregisterError);
        // Tiếp tục ngay cả khi có lỗi
      }

      // Đăng ký các menu item mới
      for (const menuItem of message.payload.menuItems) {
        try {
          // Đảm bảo menuItem có đủ thông tin cần thiết
          if (!menuItem.id) {
            console.warn(
              `Menu item from plugin ${pluginName} is missing id, generating one...`
            );
            menuItem.id = `${pluginName}.${menuItem.label
              ? menuItem.label.toLowerCase().replace(/\s+/g, "-")
              : "unknown"}`;
          }

          if (!menuItem.parentMenu) {
            console.warn(
              `Menu item ${menuItem.id} is missing parentMenu, defaulting to 'edit'...`
            );
            menuItem.parentMenu = "edit";
          }

          // Tạo menu item với đầy đủ thông tin
          const item: MenuItem = {
            ...menuItem,
            pluginId: pluginName,
          };

          console.log(`Registering menu item: ${JSON.stringify(item)}`);
          this.menuRegistry.registerMenuItem(item);
        } catch (menuItemError) {
          console.error(`Error registering menu item for plugin ${pluginName}:`, menuItemError);
          // Tiếp tục với menu item tiếp theo
        }
      }

      // Thông báo danh sách menu item đã thay đổi - với xử lý lỗi cải tiến
      try {
        const allMenuItems = this.menuRegistry.getMenuItems();
        console.log(
          `All registered menu items after update: ${JSON.stringify(
            allMenuItems.map((item) => ({
              id: item.id,
              label: item.label,
              pluginId: item.pluginId,
              parentMenu: item.parentMenu,
            }))
          )}`
        );

        // Lọc menu items theo loại
        const fileMenuItems = this.getMenuItemsForParent("file");
        const editMenuItems = this.getMenuItemsForParent("edit");
        const viewMenuItems = this.getMenuItemsForParent("view");
        const runMenuItems = this.getMenuItemsForParent("run");

        console.log(
          `File menu items: ${fileMenuItems.length}, Edit menu items: ${editMenuItems.length}, View menu items: ${viewMenuItems.length}, Run menu items: ${runMenuItems.length}`
        );

        // Đảm bảo callback được gọi an toàn
        if (typeof this.onMenuItemsChanged === 'function') {
          this.onMenuItemsChanged(allMenuItems);
        } else {
          console.warn("onMenuItemsChanged is not a function");
        }

        // Gửi thông báo đến renderer process để cập nhật menu
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          try {
            console.log("Sending menu-items-changed event to renderer");
            this.mainWindow.webContents.send("menu-items-changed", allMenuItems);

            // Gửi thông báo cập nhật danh sách plugin để đảm bảo UI được cập nhật
            const plugins = this.getPlugins();
            console.log("Sending updated plugin list to renderer");
            this.mainWindow.webContents.send(
              "plugin-list",
              plugins.map((p) => p.name)
            );

            // Đảm bảo gửi cả danh sách menu items theo loại
            console.log("Sending specific menu categories to renderer");
            this.mainWindow.webContents.send("file-menu-items", fileMenuItems);
            this.mainWindow.webContents.send("edit-menu-items", editMenuItems);
            this.mainWindow.webContents.send("view-menu-items", viewMenuItems);
            this.mainWindow.webContents.send("run-menu-items", runMenuItems);
          } catch (sendError) {
            console.error("Error sending events to renderer:", sendError);
          }
        } else {
          console.warn("Main window not available or destroyed when sending menu updates");
        }
      } catch (menuError) {
        console.error(`Error updating menu items:`, menuError);
      }
    } catch (error) {
      console.error(`Error handling register menu message:`, error);
      // Không ném lỗi, chỉ ghi log
    }
  }

  /**
   * Xử lý thông điệp lưu file từ plugin (cho autosave)
   */
  private handleSaveFileMessage(_socket: Socket, message: any): void {
    try {
      console.log('Received save-file message from plugin');

      if (!message.payload || !message.payload.content || !message.payload.filePath) {
        console.error('Invalid save-file message: missing content or filePath');
        return;
      }

      const { content, filePath } = message.payload;
      console.log(`Auto-saving file: ${filePath}`);

      // Gửi yêu cầu lưu file đến main window
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('auto-save-file', {
          content,
          filePath
        });
        console.log(`Auto-save request sent for file: ${filePath}`);
      } else {
        console.warn('Main window not available for auto-save');
      }
    } catch (error) {
      console.error('Error handling save-file message:', error);
    }
  }

  /**
   * Xử lý thông điệp hiển thị AI Chat từ plugin
   */
  private handleShowAIChatMessage(_socket: Socket, message: any): void {
    try {
      console.log('Received show-ai-chat message from plugin:', message);

      // Kiểm tra message payload
      if (!message.payload) {
        console.error('Invalid show-ai-chat message: missing payload');
        return;
      }

      const { title, initialPrompt } = message.payload;
      console.log(`Opening AI Chat with title: "${title}", initial prompt: "${initialPrompt}"`);

      // Gửi yêu cầu mở AI Chat đến main window
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('show-ai-chat', {
          title: title || 'AI Assistant',
          initialPrompt: initialPrompt || ''
        });
        console.log(`AI Chat open request sent with title: "${title}"`);
      } else {
        console.warn('Main window not available for opening AI Chat');
      }
    } catch (error) {
      console.error('Error handling show-ai-chat message:', error);
    }
  }

  /**
   * Thông báo cho tất cả plugin khi nội dung file thay đổi
   */
  public notifyContentChanged(content: string, filePath: string): void {
    const message = {
      type: "content-update",
      payload: {
        content,
        filePath
      }
    };

    this.plugins.forEach((plugin, pluginName) => {
      try {
        // Enhanced socket state checking
        if (plugin.socket && !plugin.socket.destroyed && plugin.socket.writable) {
          plugin.socket.write(JSON.stringify(message) + '\n');
          console.log(`Sent content-update to plugin: ${pluginName}`);
        } else {
          console.warn(`Cannot send content-update to plugin ${pluginName}: socket is not writable`);
          // Remove the plugin if socket is not usable
          if (plugin.socket && plugin.socket.destroyed) {
            console.log(`Removing plugin ${pluginName} due to destroyed socket`);
            this.handlePluginDisconnect(plugin.socket);
          }
        }
      } catch (error) {
        console.error(`Error sending content-update to plugin ${pluginName}:`, error);
        // If it's a socket error, handle the disconnection
        if (error instanceof Error && error.message.includes('ERR_SOCKET_CLOSED')) {
          console.log(`Handling socket closed error for plugin ${pluginName}`);
          this.handlePluginDisconnect(plugin.socket);
        }
      }
    });
  }

  /**
   * Thông báo cho tất cả plugin khi file được mở
   */
  public notifyFileOpened(content: string, filePath: string): void {
    const message = {
      type: "file-opened",
      payload: {
        content,
        filePath
      }
    };

    this.plugins.forEach((plugin, pluginName) => {
      try {
        // Enhanced socket state checking
        if (plugin.socket && !plugin.socket.destroyed && plugin.socket.writable) {
          plugin.socket.write(JSON.stringify(message) + '\n');
          console.log(`Sent file-opened to plugin: ${pluginName}`);
        } else {
          console.warn(`Cannot send file-opened to plugin ${pluginName}: socket is not writable`);
          // Remove the plugin if socket is not usable
          if (plugin.socket && plugin.socket.destroyed) {
            console.log(`Removing plugin ${pluginName} due to destroyed socket`);
            this.handlePluginDisconnect(plugin.socket);
          }
        }
      } catch (error) {
        console.error(`Error sending file-opened to plugin ${pluginName}:`, error);
        // If it's a socket error, handle the disconnection
        if (error instanceof Error && error.message.includes('ERR_SOCKET_CLOSED')) {
          console.log(`Handling socket closed error for plugin ${pluginName}`);
          this.handlePluginDisconnect(plugin.socket);
        }
      }
    });
  }

  /**
   * Xử lý thông điệp thực thi hành động menu
   */
  private handleExecuteMenuActionMessage(
    socket: Socket,
    message: ExecuteMenuActionMessage
  ): void {
    try {
      // Kiểm tra message và payload
      if (!message || !message.payload) {
        console.error("Invalid execute menu action message: missing payload");
        return;
      }

      // Kiểm tra menuItemId
      if (!message.payload.menuItemId) {
        console.error("Invalid execute menu action message: missing menuItemId");
        return;
      }

      // Tìm plugin từ socket
      let foundPlugin: PluginConnection | null = null;
      let pluginName = "";

      for (const plugin of this.plugins.values()) {
        if (plugin.socket === socket) {
          foundPlugin = plugin;
          pluginName = plugin.info.name;
          break;
        }
      }

      if (!foundPlugin) {
        console.warn("Received execute menu action message from unregistered plugin");
        return;
      }

      // Tìm menu item tương ứng
      try {
        const menuItems = this.menuRegistry.getMenuItems();
        const menuItem = menuItems.find(
          (item) => item.id === message.payload.menuItemId
        );

        if (!menuItem) {
          console.warn(
            `Menu item with ID ${message.payload.menuItemId} not found`
          );

          // Thông báo lỗi cho renderer process
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('menu-action-error', {
              menuItemId: message.payload.menuItemId,
              error: `Menu item not found`
            });
          }

          return;
        }

        // Thực thi hành động menu
        console.log(
          `Executing menu action for item ${menuItem.id} (${menuItem.label})`
        );

        // Thông báo cho renderer process về việc đang thực thi hành động menu
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          try {
            this.mainWindow.webContents.send('menu-action-started', {
              menuItemId: menuItem.id,
              label: menuItem.label
            });
          } catch (sendError) {
            console.error(`Error sending menu-action-started event:`, sendError);
          }
        }

        // Gọi executePlugin với nội dung và tùy chọn từ message
        this.executePlugin(
          pluginName,
          message.payload.content || "",
          message.payload.filePath,
          message.payload.options
        ).then((result) => {
          // Thông báo kết quả thành công cho renderer process
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            try {
              this.mainWindow.webContents.send('menu-action-completed', {
                menuItemId: menuItem.id,
                result: result
              });
            } catch (sendError) {
              console.error(`Error sending menu-action-completed event:`, sendError);
            }
          }
        }).catch((error) => {
          console.error(`Error executing menu action: ${error.message}`);

          // Thông báo lỗi cho renderer process
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            try {
              this.mainWindow.webContents.send('menu-action-error', {
                menuItemId: menuItem.id,
                error: error instanceof Error ? error.message : String(error)
              });
            } catch (sendError) {
              console.error(`Error sending menu-action-error event:`, sendError);
            }
          }
        });
      } catch (menuError) {
        console.error(`Error finding or executing menu item:`, menuError);

        // Thông báo lỗi cho renderer process
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          try {
            this.mainWindow.webContents.send('menu-action-error', {
              menuItemId: message.payload.menuItemId,
              error: `Error executing menu action: ${menuError instanceof Error ? menuError.message : String(menuError)}`
            });
          } catch (sendError) {
            console.error(`Error sending menu-action-error event:`, sendError);
          }
        }
      }
    } catch (error) {
      console.error(`Error handling execute menu action message:`, error);
      // Không ném lỗi, chỉ ghi log
    }
  }
}

/**
 * Đại diện cho một kết nối plugin
 */
class PluginConnection {
  public socket: Socket;
  public info: PluginInfo;
  private responseCallbacks: Map<string, (response: ResponseMessage) => void> =
    new Map();
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
    // Enhanced socket state checking
    if (!this.socket || this.socket.destroyed || !this.socket.writable || this.socket.readyState !== 'open') {
      console.error('Cannot send message: socket is closed, destroyed, or not writable');
      if (callback) {
        callback({
          id: '',
          type: MessageType.RESPONSE,
          payload: {
            success: false,
            message: 'Plugin connection is closed or not writable'
          }
        });
      }
      return;
    }

    // Thêm ID cho thông điệp để theo dõi phản hồi
    const id = (this.messageId++).toString();
    const messageWithId = { ...message, id };

    // Lưu callback để xử lý phản hồi sau này
    if (callback) {
      this.responseCallbacks.set(id, callback);

      // Thêm timeout để tránh callback bị treo vô hạn
      setTimeout(() => {
        if (this.responseCallbacks.has(id)) {
          this.responseCallbacks.delete(id);
          callback({
            id,
            type: MessageType.RESPONSE,
            payload: {
              success: false,
              message: 'Plugin response timeout'
            }
          });
        }
      }, 30000); // 30 giây timeout
    }

    try {
      // Double-check socket state before writing
      if (!this.socket.writable) {
        throw new Error('Socket is not writable');
      }

      // Gửi thông điệp với newline để đảm bảo plugin có thể parse
      const messageStr = JSON.stringify(messageWithId) + '\n';
      this.socket.write(messageStr);
      console.log(`Message sent to plugin: ${messageWithId.type} (ID: ${id})`);
    } catch (error: any) {
      console.error('Error writing to socket:', error);

      // Handle socket closed errors specifically
      if (error.message && error.message.includes('ERR_SOCKET_CLOSED')) {
        console.log('Socket closed error detected in sendMessage');
      }

      // Xóa callback nếu gửi thất bại
      if (callback) {
        this.responseCallbacks.delete(id);
        callback({
          id,
          type: MessageType.RESPONSE,
          payload: {
            success: false,
            message: `Failed to send message: ${error.message}`
          }
        });
      }
    }
  }

  /**
   * Xử lý phản hồi từ plugin
   */
  public handleResponse(response: ResponseMessage): void {
    // Tìm callback tương ứng với ID của phản hồi
    if (response.id) {
      const callback = this.responseCallbacks.get(response.id);
      if (callback) {
        // Gọi callback và xóa khỏi danh sách
        callback(response);
        this.responseCallbacks.delete(response.id);
      } else {
        console.warn(`No callback found for response with ID ${response.id}`);
      }
    } else {
      console.warn('Received response without ID');
    }
  }

  /**
   * Cleanup all pending callbacks and close socket
   */
  public cleanup(): void {
    console.log(`Cleaning up plugin connection: ${this.info.name}`);

    // Call all pending callbacks with error
    for (const [id, callback] of this.responseCallbacks.entries()) {
      try {
        callback({
          id,
          type: MessageType.RESPONSE,
          payload: {
            success: false,
            message: 'Plugin disconnected'
          }
        });
      } catch (error) {
        console.error(`Error calling cleanup callback for ID ${id}:`, error);
      }
    }

    // Clear all callbacks
    this.responseCallbacks.clear();

    // Close socket if still open
    if (this.socket && !this.socket.destroyed) {
      try {
        this.socket.destroy();
      } catch (error) {
        console.error(`Error destroying socket for plugin ${this.info.name}:`, error);
      }
    }
  }
}
