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

// Use a simple flag to determine which implementation to use
let useFirebaseMock = false;

try {
  // Try to use the real Firebase implementation
  getAvailablePlugins = getFirebasePlugins;
  console.log('Successfully imported Firebase services');
} catch (error) {
  // Fall back to mock implementation
  console.error('Error with Firebase services, falling back to mock implementation:', error);
  useFirebaseMock = true;
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

  constructor(port: number = 5000) {
    this.port = port;
    this.onPluginListChanged = () => {}; // Mặc định không làm gì
    this.onMenuItemsChanged = () => {}; // Mặc định không làm gì
    this.pluginInstaller = new PluginInstaller();
    this.menuRegistry = MenuRegistry.getInstance();
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
  public async start(): Promise<void> {
    // Khởi động server
    this.server = new Server((socket: Socket) => {
      console.log("Plugin connected");

      // Xử lý dữ liệu từ plugin
      socket.on("data", (data: Buffer) => {
        try {
          const message: PluginMessage = JSON.parse(data.toString());
          this.handlePluginMessage(socket, message);
        } catch (error) {
          console.error("Error parsing plugin message:", error);
        }
      });

      // Xử lý khi plugin ngắt kết nối
      socket.on("end", () => {
        this.handlePluginDisconnect(socket);
      });

      // Xử lý lỗi kết nối
      socket.on("error", (error) => {
        console.error("Plugin connection error:", error);
      });
    });

    // Khởi động server
    this.server.listen(this.port, "localhost", () => {
      console.log(`Plugin server running on port ${this.port}`);
    });

    // Load installed plugins
    await this.loadInstalledPlugins();

    // Đảm bảo plugin AI Assistant được khởi động
    await this.ensureAIAssistantRunning();
  }

  /**
   * Đảm bảo plugin AI Assistant đang chạy
   */
  private async ensureAIAssistantRunning(): Promise<void> {
    try {
      console.log('Checking if AI Assistant plugin is installed and running...');

      // Kiểm tra xem plugin AI Assistant đã được cài đặt chưa
      const installedPlugins = this.pluginInstaller.getInstalledPlugins();
      const aiAssistantPlugin = installedPlugins.find(p => p.name === 'ai-assistant');

      if (aiAssistantPlugin) {
        console.log('AI Assistant plugin is installed, ensuring it is running...');

        // Kiểm tra xem plugin đã đang chạy chưa
        if (!this.pluginProcesses.has('ai-assistant')) {
          console.log('AI Assistant plugin is not running, starting it...');
          await this.startPlugin('ai-assistant');
        } else {
          console.log('AI Assistant plugin is already running');
        }
      } else {
        console.log('AI Assistant plugin is not installed');
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

    // Try both original and normalized names
    let plugin =
      this.plugins.get(pluginName) || this.plugins.get(normalizedName);

    if (!plugin) {
      console.error(`Plugin ${pluginName} not found in registered plugins`);
      console.log(
        `Registered plugins: ${Array.from(this.plugins.keys()).join(", ")}`
      );

      // Check if the plugin is installed but not registered
      const installedPlugins = this.pluginInstaller.getInstalledPlugins();
      console.log(
        `Installed plugins: ${installedPlugins.map((p) => p.name).join(", ")}`
      );

      const isInstalled = installedPlugins.some(
        (p) => p.name === pluginName || p.name === normalizedName
      );

      if (isInstalled) {
        console.log(
          `Plugin ${pluginName} is installed but not registered. Attempting to start it...`
        );
        try {
          // Try to start the plugin
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

      // Check if plugin is already installed
      if (this.pluginInstaller.isPluginInstalled(pluginName)) {
        console.log(
          `Plugin ${pluginName} is already installed, starting it...`
        );

        // Get the installed plugin info
        const installedPlugins = this.pluginInstaller.getInstalledPlugins();
        const pluginInfo = installedPlugins.find((p) => {
          // Normalize plugin name (remove version suffix if present)
          const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");
          return p.name === pluginName || p.name === normalizedName;
        });

        if (pluginInfo) {
          // Đảm bảo plugin được đánh dấu là đã cài đặt
          pluginInfo.installed = true;

          // Try to start the plugin
          await this.startPlugin(pluginInfo.name);

          // Notify that the plugin list has changed
          this.onPluginListChanged(this.getPlugins());

          // Cập nhật menu items
          setTimeout(() => {
            try {
              // Lấy danh sách menu items cho các menu cha
              const fileMenuItems = this.getMenuItemsForParent("file");
              const editMenuItems = this.getMenuItemsForParent("edit");
              const runMenuItems = this.getMenuItemsForParent("run");

              console.log(
                `PluginManager: Sending updated menu items after plugin installation`
              );
              console.log(
                `File menu items: ${fileMenuItems.length}, Edit menu items: ${editMenuItems.length}, Run menu items: ${runMenuItems.length}`
              );

              // Thông báo thay đổi menu items
              this.onMenuItemsChanged([
                ...fileMenuItems,
                ...editMenuItems,
                ...runMenuItems,
              ]);
            } catch (menuError) {
              console.error(
                `PluginManager: Error sending menu items:`,
                menuError
              );
            }
          }, 500);

          return pluginInfo;
        }
      }

      // Install the plugin
      console.log(`Installing plugin from Firebase: ${pluginName}`);
      const pluginInfo = await this.pluginInstaller.installPluginByName(
        pluginName
      );
      console.log(`Plugin installed: ${JSON.stringify(pluginInfo)}`);

      // Đảm bảo plugin được đánh dấu là đã cài đặt
      pluginInfo.installed = true;

      // Start the plugin
      await this.startPlugin(pluginInfo.name);

      // Notify that the plugin list has changed
      this.onPluginListChanged(this.getPlugins());

      // Cập nhật menu items
      setTimeout(() => {
        try {
          // Lấy danh sách menu items cho các menu cha
          const fileMenuItems = this.getMenuItemsForParent("file");
          const editMenuItems = this.getMenuItemsForParent("edit");
          const runMenuItems = this.getMenuItemsForParent("run");

          console.log(
            `PluginManager: Sending updated menu items after plugin installation`
          );
          console.log(
            `File menu items: ${fileMenuItems.length}, Edit menu items: ${editMenuItems.length}, Run menu items: ${runMenuItems.length}`
          );

          // Thông báo thay đổi menu items
          this.onMenuItemsChanged([
            ...fileMenuItems,
            ...editMenuItems,
            ...runMenuItems,
          ]);
        } catch (menuError) {
          console.error(`PluginManager: Error sending menu items:`, menuError);
        }
      }, 500);

      return pluginInfo;
    } catch (error) {
      console.error(`Error installing plugin ${pluginName}:`, error);
      throw error;
    }
  }
  /**
   * Uninstall a plugin - Cải tiến với xử lý lỗi tốt hơn
   */
  public async uninstallPlugin(pluginName: string): Promise<boolean> {
    if (!pluginName) {
      console.error(`PluginManager: Invalid plugin name: ${pluginName}`);
      return true; // Vẫn trả về true để tránh lỗi UI
    }

    console.log(`PluginManager: Uninstalling plugin: ${pluginName}`);

    try {
      // 1. Chuẩn hóa tên plugin
      const normalizedName = String(pluginName).replace(
        /(-\d+\.\d+\.\d+)$/,
        ""
      );
      console.log(`PluginManager: Normalized plugin name: ${normalizedName}`);

      // 2. Xóa plugin khỏi danh sách đã đăng ký - với xử lý lỗi
      try {
        if (this.plugins.has(pluginName)) {
          console.log(`PluginManager: Removing plugin from registry: ${pluginName}`);
          this.plugins.delete(pluginName);
        }

        if (this.plugins.has(normalizedName)) {
          console.log(`PluginManager: Removing normalized plugin from registry: ${normalizedName}`);
          this.plugins.delete(normalizedName);
        }
      } catch (registryError) {
        console.error(`PluginManager: Error removing plugin from registry:`, registryError);
        // Tiếp tục ngay cả khi có lỗi
      }

      // 3. Xóa các lệnh đã đăng ký
      try {
        const commandsToRemove = Object.keys(this.commands || {}).filter(
          (cmd) =>
            cmd.startsWith(`${pluginName}.`) ||
            cmd.startsWith(`${normalizedName}.`)
        );

        for (const cmd of commandsToRemove) {
          console.log(`PluginManager: Removing command: ${cmd}`);
          delete this.commands[cmd];
        }
      } catch (commandsError) {
        console.error(`PluginManager: Error removing commands:`, commandsError);
        // Tiếp tục ngay cả khi có lỗi
      }

      // 4. Dừng plugin nếu đang chạy - với xử lý lỗi cải tiến
      try {
        if (this.pluginProcesses && this.pluginProcesses.has(pluginName)) {
          console.log(`PluginManager: Stopping plugin process: ${pluginName}`);
          const process = this.pluginProcesses.get(pluginName);

          if (process) {
            try {
              if (!process.killed) {
                process.kill();
                console.log(`PluginManager: Successfully killed process for ${pluginName}`);
              } else {
                console.log(`PluginManager: Process for ${pluginName} was already killed`);
              }
            } catch (killError) {
              console.error(`PluginManager: Error killing process:`, killError);
            }

            this.pluginProcesses.delete(pluginName);
          }
        }
      } catch (processError) {
        console.error(`PluginManager: Error handling plugin process:`, processError);
        // Tiếp tục ngay cả khi có lỗi
      }

      // 5. Xóa thư mục plugin - với xử lý lỗi cải tiến
      try {
        console.log(`PluginManager: Removing plugin directory for: ${pluginName}`);
        const uninstallResult = this.pluginInstaller.uninstallPlugin(pluginName);
        console.log(`PluginManager: Plugin directory removal result: ${uninstallResult}`);
      } catch (dirError) {
        console.error(`PluginManager: Error removing plugin directory:`, dirError);
        // Tiếp tục ngay cả khi có lỗi
      }
    } catch (error) {
      console.error(`PluginManager: Error in uninstallPlugin:`, error);
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
      } else {
        console.warn(`PluginManager: onPluginListChanged is not a function`);
      }

      // Cập nhật menu items - với xử lý lỗi cải tiến
      setTimeout(() => {
        try {
          // Lấy danh sách menu items cho các menu cha
          const fileMenuItems = this.getMenuItemsForParent("file");
          const editMenuItems = this.getMenuItemsForParent("edit");
          const runMenuItems = this.getMenuItemsForParent("run");

          console.log(
            `PluginManager: Sending updated menu items after plugin uninstallation`
          );
          console.log(
            `File menu items: ${fileMenuItems.length}, Edit menu items: ${editMenuItems.length}, Run menu items: ${runMenuItems.length}`
          );

          // Thông báo thay đổi menu items
          this.onMenuItemsChanged([
            ...fileMenuItems,
            ...editMenuItems,
            ...runMenuItems,
          ]);
        } catch (menuError) {
          console.error(`PluginManager: Error updating menu items:`, menuError);
        }
      }, 500);
    } catch (error) {
      console.error(
        `PluginManager: Error notifying plugin list changed:`,
        error
      );
    }

    console.log(`PluginManager: Uninstall completed for plugin: ${pluginName}`);
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
        }
      }
    } catch (error) {
      console.error("Error loading installed plugins:", error);
    }
  }

  /**
   * Start a plugin
   */
  public async startPlugin(pluginName: string): Promise<void> {
    try {
      console.log(`Starting plugin: ${pluginName}`);

      // Xử lý đặc biệt cho plugin ai-assistant
      if (pluginName === 'ai-assistant') {
        console.log('Using special handling for ai-assistant plugin');
        return await this.startAIAssistantPlugin(pluginName);
      }

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
          console.log(
            "Continuing without installing dependencies - plugin may not work correctly"
          );
        }
      } else {
        console.log(`node_modules found for plugin ${pluginName}`);
      }

      // Check if package.json exists and has dependencies
      const packageJsonPath = path.join(pluginDir, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, "utf-8")
          );
          console.log(`Package.json for plugin ${pluginName}:`, packageJson);

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

          // Handle process output
          process.stdout.on("data", (data) => {
            console.log(`[Plugin ${pluginName}] ${data.toString().trim()}`);
          });

          process.stderr.on("data", (data) => {
            console.error(
              `[Plugin ${pluginName} Error] ${data.toString().trim()}`
            );
          });

          // Handle process exit
          process.on("exit", (code) => {
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
              console.warn(
                `Plugin ${pluginName} did not connect within the timeout period`
              );

              // Create a simple plugin info object for plugins that don't connect
              if (!this.plugins.has(pluginName)) {
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
                };

                // Create a dummy connection for the plugin
                const dummySocket = new Socket();
                const pluginConnection = new PluginConnection(
                  dummySocket,
                  pluginInfo
                );

                // Add to plugins list
                this.plugins.set(pluginName, pluginConnection);

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
                    this.onMenuItemsChanged(allMenuItems);

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
              if (plugins.some((p) => p.name === pluginName)) {
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
   * Start AI Assistant plugin
   */
  private async startAIAssistantPlugin(pluginName: string): Promise<void> {
    try {
      console.log(`Starting AI Assistant plugin: ${pluginName}`);

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

      // Check if package.json exists
      const packageJsonPath = path.join(pluginDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          console.log(`Package.json for plugin ${pluginName}:`, packageJson);

          // Check if node_modules exists
          const nodeModulesPath = path.join(pluginDir, 'node_modules');
          console.log(`Checking for node_modules at: ${nodeModulesPath}`);
          if (!fs.existsSync(nodeModulesPath)) {
            console.warn(`node_modules not found for plugin ${pluginName}. Installing dependencies...`);
            try {
              const { execSync } = require('child_process');
              execSync('npm install --no-fund --no-audit --loglevel=error', {
                cwd: pluginDir,
                stdio: 'inherit',
                timeout: 60000 // 60 seconds timeout
              });
              console.log(`Dependencies installed successfully for plugin ${pluginName}`);
            } catch (npmError) {
              console.error(`Error installing dependencies for plugin ${pluginName}:`, npmError);
              console.log('Continuing without installing dependencies - plugin may not work correctly');
            }
          } else {
            console.log(`node_modules found for plugin ${pluginName}`);
          }

          // Start the plugin process with appropriate arguments
          const args = [mainPath];

          // Add port argument
          args.push(`--port=${this.port}`);

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
              console.log(`Manually registering plugin ${pluginName}`);

              // Create plugin info
              const pluginInfo: PluginInfo = {
                name: pluginName,
                version: packageJson.version || '1.0.0',
                description: packageJson.description || 'AI Assistant plugin for Text Editor',
                author: packageJson.author || 'nhtam'
              };

              // Create a dummy connection for the plugin
              const dummySocket = new Socket();
              const pluginConnection = new PluginConnection(
                dummySocket,
                pluginInfo
              );

              // Add to plugins list
              this.plugins.set(pluginName, pluginConnection);

              // Register menu items from package.json
              if (packageJson.menuItems && Array.isArray(packageJson.menuItems)) {
                console.log(`Found menu items in package.json for ${pluginName}:`, packageJson.menuItems);

                // Register menu items
                for (const menuItem of packageJson.menuItems) {
                  const item: MenuItem = {
                    ...menuItem,
                    pluginId: pluginName
                  };
                  console.log(`Registering menu item from package.json: ${JSON.stringify(item)}`);
                  this.menuRegistry.registerMenuItem(item);
                }

                // Notify that menu items have changed
                const allMenuItems = this.menuRegistry.getMenuItems();
                this.onMenuItemsChanged(allMenuItems);
              }

              // Notify that the plugin list has changed
              this.onPluginListChanged(this.getPlugins());
            }
          }, 10000); // Wait 10 seconds for the plugin to connect

          console.log(`AI Assistant plugin ${pluginName} started successfully`);
        } catch (error) {
          console.error(`Error starting AI Assistant plugin ${pluginName}:`, error);
          throw error;
        }
      } else {
        throw new Error(`Package.json not found for plugin ${pluginName}`);
      }
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
  private handleRegisterMenuMessage(
    socket: Socket,
    message: RegisterMenuMessage
  ): void {
    console.log("Received register menu message:", message);

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
        this.startPlugin(pluginNameFromPayload).catch((error) => {
          console.error(
            `Failed to start plugin ${pluginNameFromPayload}:`,
            error
          );
        });
      }

      return;
    }

    console.log(
      `Registering menu items for plugin ${pluginName}:`,
      message.payload.menuItems
    );

    // Xóa các menu item cũ của plugin (nếu có)
    this.menuRegistry.unregisterMenuItemsByPlugin(pluginName);

    // Đăng ký các menu item mới
    for (const menuItem of message.payload.menuItems) {
      // Đảm bảo menuItem có đủ thông tin cần thiết
      if (!menuItem.id) {
        console.warn(
          `Menu item from plugin ${pluginName} is missing id, generating one...`
        );
        menuItem.id = `${pluginName}.${menuItem.label
          .toLowerCase()
          .replace(/\s+/g, "-")}`;
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
    }

    // Thông báo danh sách menu item đã thay đổi
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

    console.log(
      `File menu items: ${fileMenuItems.length}, Edit menu items: ${editMenuItems.length}, View menu items: ${viewMenuItems.length}`
    );

    // Gọi callback để thông báo thay đổi
    this.onMenuItemsChanged(allMenuItems);

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
      } catch (error) {
        console.error("Error sending events to renderer:", error);
      }
    }
  }

  /**
   * Xử lý thông điệp thực thi hành động menu
   */
  private handleExecuteMenuActionMessage(
    socket: Socket,
    message: ExecuteMenuActionMessage
  ): void {
    // Tìm plugin từ socket
    for (const plugin of this.plugins.values()) {
      if (plugin.socket === socket) {
        // Tìm menu item tương ứng
        const menuItems = this.menuRegistry.getMenuItems();
        const menuItem = menuItems.find(
          (item) => item.id === message.payload.menuItemId
        );

        if (!menuItem) {
          console.warn(
            `Menu item with ID ${message.payload.menuItemId} not found`
          );
          return;
        }

        // Thực thi hành động menu
        console.log(
          `Executing menu action for item ${menuItem.id} (${menuItem.label})`
        );

        // Gọi executePlugin với nội dung và tùy chọn từ message
        this.executePlugin(
          plugin.info.name,
          message.payload.content || "",
          message.payload.filePath,
          message.payload.options
        ).catch((error) => {
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
}
