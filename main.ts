
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  SaveDialogReturnValue,
  shell,
} from "electron";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { OpenDialogReturnValue } from "electron";
import { PluginManager } from "./src/plugin/PluginManager";
import { AIService } from "./src/services/ai-service";
// Load environment variables from .env file
// This handles both development and production environments
function loadEnvVariables() {
  // Import dotenv trong hàm để tránh warning không sử dụng
  const dotenv = require('dotenv');

  // Tìm file .env trong thư mục gốc của ứng dụng
  const envPath = path.join(__dirname, '../.env');

  // Nếu file .env tồn tại, load nó
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('Loaded environment variables from:', envPath);
  } else {
    // Nếu không tìm thấy, sử dụng cấu hình mặc định
    dotenv.config();
    console.log('Using default environment variables');
  }
}

loadEnvVariables();

let selectedFolder: string | null = null;
let mainWindow: BrowserWindow | null = null;
// Mở rộng kiểu PluginManager để bao gồm phương thức startPlugin
interface ExtendedPluginManager extends PluginManager {
  startPlugin(pluginName: string): Promise<void>;
}

let pluginManager: ExtendedPluginManager;



// Map để lưu trữ các process đang chạy
const runningProcesses = new Map<string, ChildProcess>();
const PORT = process.env.VITE_PLUGIN_PORT
  ? parseInt(process.env.VITE_PLUGIN_PORT)
  : 5001; // Thay đổi từ 5000 thành 5001 để khớp với Firebase emulator và PluginManager default

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "../public/logo.ico"),
    autoHideMenuBar: true, // Ẩn thanh menu mặc định
    webPreferences: {
      nodeIntegration: false, // Tắt nodeIntegration
      contextIsolation: true, // Bật contextIsolation cho bảo mật
      preload: path.join(__dirname, "../preload.js"), // Sử dụng preload script
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    // DevTools chỉ mở khi cần debug trong môi trường development
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "/index.html"));
    // Không mở DevTools trong môi trường production
    // mainWindow.webContents.openDevTools();
  }
  return mainWindow;
}

async function initializePluginManager() {
  try {
    console.log("Initializing Plugin Manager...");

    // Khởi tạo Plugin Manager
    pluginManager = new PluginManager(PORT) as ExtendedPluginManager;

    // Đặt tham chiếu đến mainWindow
    if (mainWindow) {
      pluginManager.setMainWindow(mainWindow);
      console.log("Main window reference set in Plugin Manager");
    } else {
      console.warn("Main window not available when initializing Plugin Manager");
    }

    // Đăng ký AI Assistant menu item tích hợp sẵn
    try {
      pluginManager.registerBuiltInMenuItem({
        id: 'built-in-ai-assistant.aiChat',
        label: 'AI Chat',
        parentMenu: 'view',
        shortcut: 'Alt+A',
        pluginId: 'built-in-ai-assistant'
      });
      console.log("Built-in AI Assistant menu item registered");
    } catch (menuError) {
      console.error("Error registering built-in AI Assistant menu item:", menuError);
    }

    // Đăng ký callback khi danh sách plugin thay đổi
    pluginManager.setPluginListChangedCallback((plugins) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log("Sending updated plugin list to renderer");
        mainWindow.webContents.send("plugin-list", plugins);
      }
    });

    // Đăng ký callback khi danh sách menu item thay đổi
    pluginManager.setMenuItemsChangedCallback((menuItems) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log("Sending updated menu items to renderer");
        mainWindow.webContents.send("menu-items-changed", menuItems);
      }
    });

    // Khởi động Plugin Manager với xử lý lỗi
    try {
      console.log("Starting Plugin Manager...");
      // Tự động khởi động AI Assistant plugin nếu đã được cài đặt
      await pluginManager.start(true);
      console.log("Plugin Manager started successfully with AI Assistant auto-start enabled");
    } catch (startError) {
      console.error("Error starting Plugin Manager:", startError);
      // Vẫn tiếp tục chạy ứng dụng ngay cả khi không thể khởi động Plugin Manager
    }

    return pluginManager;
  } catch (error) {
    console.error("Error initializing Plugin Manager:", error);
    // Tạo một Plugin Manager giả để tránh lỗi null reference
    pluginManager = new PluginManager(PORT) as ExtendedPluginManager;
    return pluginManager;
  }
}



app.whenReady().then(async () => {
  try {
    // Tạo cửa sổ chính trước
    mainWindow = createWindow();

    // Đợi cửa sổ được tạo hoàn toàn
    await new Promise<void>((resolve) => {
      if (
        mainWindow &&
        mainWindow.webContents &&
        mainWindow.webContents.isLoading()
      ) {
        mainWindow.webContents.once("did-finish-load", () => resolve());
      } else {
        resolve();
      }
    });

    // Khởi tạo PluginManager sau khi cửa sổ đã sẵn sàng
    try {
      await initializePluginManager();
      console.log("Plugin manager initialized successfully");
    } catch (pluginError) {
      console.error("Error initializing plugin manager:", pluginError);
      // Tiếp tục chạy ứng dụng ngay cả khi có lỗi với plugin manager
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    console.error("Error during app initialization:", error);
    // Nếu có lỗi nghiêm trọng, hiển thị thông báo và tạo cửa sổ mới
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('initialization-error', {
        error: error instanceof Error ? error.message : 'Unknown error during startup'
      });
    } else {
      // Nếu cửa sổ chính bị hủy, tạo cửa sổ mới
      mainWindow = createWindow();
    }
  }

  // Handler cho load dictionary
  ipcMain.handle("load-dictionary", async () => {
    const dictPath = path.join(__dirname, "public", "en_US.dic");
    try {
      const dictContent = fs.readFileSync(dictPath, "utf-8");
      return dictContent;
    } catch (error) {
      console.error("Failed to load dictionary:", error);
      return null;
    }
  });

  // Xử lý mở hộp thoại chọn thư mục
  ipcMain.on("open-folder-request", async (event) => {
    try {

      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      }) as unknown as OpenDialogReturnValue;

      if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        selectedFolder = folderPath;

        // Đọc cấu trúc thư mục
        const folderStructure = getFolderStructure(folderPath);
        event.sender.send("folder-structure", folderStructure);
      }
    } catch (error: any) {
      console.error("Error opening folder:", error);
    }
  });

  // Xử lý mở hộp thoại chọn file
  ipcMain.on("open-file-dialog", async (event) => {
    console.log("Received open-file-dialog event");
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
          {
            name: "Text Files",
            extensions: ["txt", "md", "js", "ts", "html", "css", "json"],
          },
          { name: "All Files", extensions: ["*"] },
        ],
      }) as unknown as OpenDialogReturnValue;

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        selectedFolder = path.dirname(filePath);
        const fileName = path.basename(filePath);
        const content = fs.readFileSync(filePath, "utf-8");
        // Đổi tên sự kiện thành 'file-opened' để phù hợp với App.tsx
        console.log("Sending file-opened event with:", {
          fileName,
          contentLength: content.length,
        });
        event.sender.send("file-opened", { content, fileName, filePath });
      }
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to open file";
      event.sender.send("file-opened", { error: errorMessage });
    }
  });

  // Handle opening a file
  ipcMain.on("open-file-request", async (event, fileName: string) => {
    try {
      if (!selectedFolder) {
        throw new Error("No folder selected");
      }
      // Lấy tên file từ đường dẫn được truyền vào
      const fileBaseName = path.basename(fileName);
      const absolutePath = path.join(selectedFolder, fileBaseName);

      // Kiểm tra xem file có tồn tại không
      if (!fs.existsSync(absolutePath)) {
        throw new Error("File does not exist");
      }

      const content = fs.readFileSync(absolutePath, "utf-8");
      console.log("Sending file content for:", fileBaseName);
      // Gửi cả hai sự kiện để đảm bảo tương thích
      event.sender.send("file-content", {
        content,
        filePath: absolutePath,
        fileName: fileBaseName,
      });
      event.sender.send("file-opened", {
        content,
        filePath: absolutePath,
        fileName: fileBaseName,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "File not found or inaccessible";
      console.error("Error reading file:", errorMessage);
      // Gửi cả hai sự kiện để đảm bảo tương thích
      event.sender.send("file-content", { error: errorMessage });
      event.sender.send("file-opened", { error: errorMessage });
    }
  });

  // Handle saving a file
  ipcMain.on(
    "save-file",
    async (event, data: { content: string; fileName: string }) => {
      try {
        if (!selectedFolder) {
          throw new Error("No folder selected");
        }
        const { content, fileName } = data;
        const filePath = path.join(selectedFolder, fileName);
        fs.writeFileSync(filePath, content, "utf-8");
        event.sender.send("file-saved", { success: true, filePath });
      } catch (error: any) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to save file";
        event.sender.send("file-saved", { error: errorMessage });
      }
    }
  );

  // Handle save file dialog
  ipcMain.on(
    "save-file-request",
    async (event, data: { filePath: string; content: string }) => {
      try {
        const { filePath, content } = data;
        const result = await dialog.showSaveDialog({
          defaultPath: filePath,
          filters: [
            {
              name: "Text Files",
              extensions: ["txt", "md", "js", "ts", "html", "css", "json"],
            },
            { name: "All Files", extensions: ["*"] },
          ],
        }) as unknown as SaveDialogReturnValue;

        if (!result.canceled && result.filePath) {
          fs.writeFileSync(result.filePath, content, "utf-8");
          selectedFolder = path.dirname(result.filePath);
          const fileName = path.basename(result.filePath);
          event.sender.send("file-saved", {
            success: true,
            filePath: result.filePath,
            fileName,
          });
        } else {
          event.sender.send("file-saved", { error: "Save operation canceled" });
        }
      } catch (error: any) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to save file";
        event.sender.send("file-saved", { error: errorMessage });
      }
    }
  );

  // Handle creating a new file
  ipcMain.on("create-new-file-request", async (event, filePath: string) => {
    try {
      // Nếu filePath là đường dẫn đầy đủ, sử dụng nó
      // Nếu không, sử dụng selectedFolder
      let absolutePath = filePath;
      if (!path.isAbsolute(filePath)) {
        if (!selectedFolder) {
          throw new Error("No folder selected");
        }
        absolutePath = path.join(selectedFolder, filePath);
      }

      // Đảm bảo thư mục cha tồn tại
      const parentDir = path.dirname(absolutePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Kiểm tra xem file đã tồn tại chưa
      if (!fs.existsSync(absolutePath)) {
        fs.writeFileSync(absolutePath, "", "utf-8"); // Tạo file mới rỗng
        event.sender.send("new-file-created", {
          fileName: path.basename(absolutePath),
          success: true,
          error: undefined,
        });
      } else {
        throw new Error("File already exists");
      }
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create new file";
      event.sender.send("new-file-created", {
        fileName: path.basename(filePath),
        success: false,
        error: errorMessage,
      });
    }
  });

  // Handle creating a new folder
  ipcMain.on("create-new-folder-request", async (event, folderPath: string) => {
    try {
      // Nếu folderPath là đường dẫn đầy đủ, sử dụng nó
      // Nếu không, sử dụng selectedFolder
      let absolutePath = folderPath;
      if (!path.isAbsolute(folderPath)) {
        if (!selectedFolder) {
          throw new Error("No folder selected");
        }
        absolutePath = path.join(selectedFolder, folderPath);
      }

      // Kiểm tra xem thư mục đã tồn tại chưa
      if (!fs.existsSync(absolutePath)) {
        fs.mkdirSync(absolutePath, { recursive: true }); // Tạo thư mục mới
        event.sender.send("new-folder-created", {
          folderName: path.basename(absolutePath),
          success: true,
          error: undefined,
        });
      } else {
        throw new Error("Folder already exists");
      }
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create new folder";
      event.sender.send("new-folder-created", {
        folderName: path.basename(folderPath),
        success: false,
        error: errorMessage,
      });
    }
  });

  // Handle deleting a file or folder
  ipcMain.on(
    "delete-item-request",
    async (event, itemPath: string, isDirectory: boolean) => {
      console.log("Delete item request received:", { itemPath, isDirectory });
      try {
        if (!fs.existsSync(itemPath)) {
          console.error("Item does not exist:", itemPath);
          throw new Error("Item does not exist");
        }

        if (isDirectory) {
          // Xóa thư mục và tất cả nội dung bên trong
          console.log("Deleting directory:", itemPath);
          fs.rmSync(itemPath, { recursive: true, force: true });
        } else {
          // Xóa file
          console.log("Deleting file:", itemPath);
          fs.unlinkSync(itemPath);
        }

        console.log("Item deleted successfully");
        event.sender.send("item-deleted", {
          success: true,
          error: undefined,
          path: itemPath,
          isDirectory,
        });
      } catch (error: any) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to delete item";
        console.error("Error deleting item:", errorMessage);
        event.sender.send("item-deleted", {
          success: false,
          error: errorMessage,
          path: itemPath,
        });
      }
    }
  );

  // Handle renaming a file or folder
  ipcMain.on(
    "rename-item-request",
    async (event, itemPath: string, newName: string) => {
      console.log("Rename item request received:", { itemPath, newName });
      try {
        if (!fs.existsSync(itemPath)) {
          console.error("Item does not exist:", itemPath);
          throw new Error("Item does not exist");
        }

        const parentDir = path.dirname(itemPath);
        const newPath = path.join(parentDir, newName);
        console.log("Renaming from", itemPath, "to", newPath);

        if (fs.existsSync(newPath)) {
          console.error("An item with that name already exists:", newPath);
          throw new Error("An item with that name already exists");
        }

        fs.renameSync(itemPath, newPath);
        console.log("Rename successful");
        event.sender.send("item-renamed", {
          success: true,
          error: undefined,
          oldPath: itemPath,
          newPath,
        });
      } catch (error: any) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to rename item";
        console.error("Error renaming item:", errorMessage);
        event.sender.send("item-renamed", {
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  // Handle refreshing folder structure
  ipcMain.on("refresh-folder-structure", async (event, folderPath: string) => {
    console.log("Refreshing folder structure for:", folderPath);
    try {
      if (!fs.existsSync(folderPath)) {
        console.error("Folder does not exist:", folderPath);
        throw new Error("Folder does not exist");
      }

      const folderStructure = getFolderStructure(folderPath);
      event.sender.send("folder-structure", folderStructure);
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error refreshing folder structure:", errorMessage);
      // Gửi thông báo lỗi về renderer
      event.sender.send("folder-structure-error", errorMessage);
    }
  });

  // Lấy danh sách plugin đã cài đặt - Đảm bảo không có plugin trùng lặp
  ipcMain.handle("get-plugins", async () => {
    // Lấy danh sách plugin
    const plugins = pluginManager.getPlugins();

    // Tạo Map để lọc các plugin trùng lặp dựa trên tên chuẩn hóa
    const uniquePlugins = new Map<string, string>();

    // Lọc các plugin trùng lặp
    for (const plugin of plugins) {
      if (!plugin || !plugin.name) continue;

      // Chuẩn hóa tên plugin
      const normalizedName = plugin.name.replace(/(-\d+\.\d+\.\d+)$/, "");

      // Chỉ giữ lại plugin mới nhất cho mỗi tên chuẩn hóa
      if (!uniquePlugins.has(normalizedName)) {
        uniquePlugins.set(normalizedName, plugin.name);
      }
    }

    // Trả về danh sách tên plugin duy nhất
    return Array.from(uniquePlugins.values());
  });

  // Lấy danh sách plugin có sẵn từ Firebase - Sử dụng TypeScript đúng cách
  ipcMain.handle(
    "get-available-plugins",
    async (): Promise<Array<{ name: string; installed: boolean }>> => {
      try {
        const plugins = await pluginManager.getAvailablePlugins();

        // Đảm bảo trả về một mảng đối tượng đơn giản
        return plugins.map((plugin) => ({
          name:
            typeof plugin.name === "string" ? plugin.name : String(plugin.name),
          installed: Boolean(plugin.installed),
        }));
      } catch (error: unknown) {
        console.error("Error getting available plugins:", error);
        return []; // Trả về mảng rỗng nếu có lỗi
      }
    }
  );



  // Cài đặt plugin - Đơn giản hóa tối đa
  ipcMain.handle("install-plugin", async (event, pluginName) => {
    console.log(`Main process: Installing plugin ${pluginName}`);

    try {
      // Gọi installPlugin và bắt lỗi
      const result = await pluginManager.installPlugin(pluginName);
      console.log(`Main process: Plugin ${pluginName} installed successfully`);

      // Gửi danh sách plugin mới cho renderer với error handling cải tiến
      try {
        const plugins = pluginManager.getPlugins();

        // Kiểm tra xem event.sender vẫn còn hợp lệ không
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send(
            "plugin-list",
            plugins.map((p) => p.name)
          );
        } else {
          console.warn(`Main process: Event sender is destroyed, cannot send plugin list`);
        }

        // Gửi danh sách menu items mới cho renderer với error handling
        setTimeout(() => {
          try {
            // Kiểm tra lại event.sender trước khi gửi
            if (event.sender && !event.sender.isDestroyed()) {
              // Lấy danh sách menu items cho các menu cha với error handling
              let fileMenuItems: any[] = [];
              let editMenuItems: any[] = [];
              let runMenuItems: any[] = [];

              try {
                fileMenuItems = pluginManager.getMenuItemsForParent("file");
                editMenuItems = pluginManager.getMenuItemsForParent("edit");
                runMenuItems = pluginManager.getMenuItemsForParent("run");
              } catch (menuGetError) {
                console.error(`Main process: Error getting menu items:`, menuGetError);
                // Sử dụng arrays rỗng nếu có lỗi
              }

              console.log(
                `Main process: Sending updated menu items after plugin installation`
              );
              console.log(
                `File menu items: ${fileMenuItems.length}, Edit menu items: ${editMenuItems.length}, Run menu items: ${runMenuItems.length}`
              );

              // Gửi danh sách menu items mới cho renderer
              const allMenuItems = [
                ...fileMenuItems,
                ...editMenuItems,
                ...runMenuItems,
              ];
              event.sender.send("menu-items-changed", allMenuItems);
            } else {
              console.warn(`Main process: Event sender is destroyed, cannot send menu items`);
            }
          } catch (menuError) {
            console.error(`Main process: Error sending menu items:`, menuError);
          }
        }, 1000); // Đợi 1 giây để plugin có thời gian đăng ký menu items
      } catch (listError) {
        console.error(`Main process: Error sending plugin list:`, listError);
      }

      // Trả về kết quả cài đặt
      return {
        success: true,
        message: `Plugin ${pluginName} installed successfully`,
        ...result
      };
    } catch (error) {
      console.error(`Main process: Error installing plugin:`, error);

      // Gửi thông báo lỗi cho renderer
      event.sender.send('plugin-install-error', {
        pluginName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Luôn trả về đối tượng hợp lệ để tránh màn hình trắng
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        name: pluginName,
        version: "1.0.0",
        description: `Plugin ${pluginName}`,
        author: "Unknown",
        installed: false
      };
    }
  });

  // Gỡ cài đặt plugin - Đơn giản hóa tối đa
  ipcMain.handle(
    "uninstall-plugin",
    async (
      event,
      pluginName: string
    ): Promise<{ success: boolean; message?: string }> => {
      console.log(`Main process: Uninstalling plugin ${pluginName}`);

      // Gọi uninstallPlugin và bắt lỗi
      try {
        await pluginManager.uninstallPlugin(pluginName);
      } catch (error) {
        console.error(`Main process: Error in uninstallPlugin:`, error);
        // Không ném lỗi, chỉ ghi log
      }

      // Gửi danh sách plugin mới cho renderer
      try {
        const plugins = pluginManager.getPlugins();
        event.sender.send(
          "plugin-list",
          plugins.map((p) => p.name)
        );

        // Gửi danh sách menu items mới cho renderer
        setTimeout(() => {
          try {
            // Lấy danh sách menu items cho các menu cha
            const fileMenuItems = pluginManager.getMenuItemsForParent("file");
            const editMenuItems = pluginManager.getMenuItemsForParent("edit");
            const runMenuItems = pluginManager.getMenuItemsForParent("run");

            console.log(
              `Main process: Sending updated menu items after plugin uninstallation`
            );
            console.log(
              `File menu items: ${fileMenuItems.length}, Edit menu items: ${editMenuItems.length}, Run menu items: ${runMenuItems.length}`
            );

            // Gửi danh sách menu items mới cho renderer
            const allMenuItems = [
              ...fileMenuItems,
              ...editMenuItems,
              ...runMenuItems,
            ];
            event.sender.send("menu-items-changed", allMenuItems);
          } catch (menuError) {
            console.error(`Main process: Error sending menu items:`, menuError);
          }
        }, 500);
      } catch (error) {
        console.error(`Main process: Error sending plugin list:`, error);
      }

      // Luôn trả về success: true để tránh màn hình trắng
      return {
        success: true,
        message: `Plugin ${pluginName} uninstalled successfully`,
      };
    }
  );

  // Kiểm tra trạng thái cài đặt của plugin - Sử dụng TypeScript đúng cách
  ipcMain.handle(
    "check-plugin-status",
    async (
      _event,
      pluginName: string
    ): Promise<{
      pluginName: string;
      isInstalled: boolean;
      error?: string;
    }> => {
      try {
        if (typeof pluginName !== "string") {
          console.error(`Invalid plugin name: ${pluginName}`);
          return {
            pluginName: String(pluginName),
            isInstalled: false,
            error: "Invalid plugin name",
          };
        }

        const plugins = pluginManager.getPlugins();
        const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");

        const isInstalled = plugins.some((p) => {
          if (!p || !p.name) return false;

          const pNormalizedName =
            typeof p.name === "string"
              ? p.name.replace(/(-\d+\.\d+\.\d+)$/, "")
              : String(p.name);

          return (
            p.name === pluginName ||
            p.name === normalizedName ||
            pNormalizedName === pluginName ||
            pNormalizedName === normalizedName
          );
        });

        return { pluginName, isInstalled };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Error checking plugin status: ${errorMessage}`);
        return {
          pluginName: String(pluginName),
          isInstalled: false,
          error: errorMessage,
        };
      }
    }
  );

  // Khởi động AI Assistant plugin theo yêu cầu
  ipcMain.handle("start-ai-assistant", async (event) => {
    console.log("Main process: Manual start AI Assistant requested");

    try {
      await pluginManager.startAIAssistant();
      console.log("Main process: AI Assistant started successfully");
      return { success: true, message: "AI Assistant started successfully" };
    } catch (error: unknown) {
      console.error("Main process: Error starting AI Assistant:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Kiểm tra trạng thái AI Assistant
  ipcMain.handle("check-ai-assistant-status", async (event) => {
    console.log("Main process: Checking AI Assistant status");

    try {
      const status = pluginManager.getAIAssistantStatus();
      console.log("Main process: AI Assistant status:", status);
      return { success: true, status };
    } catch (error: unknown) {
      console.error("Main process: Error checking AI Assistant status:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        status: { installed: false, running: false, registered: false, port: 5001 }
      };
    }
  });

  // Kiểm tra xem AI Assistant có đang chạy không
  ipcMain.handle("is-ai-assistant-running", async (event) => {
    try {
      const isRunning = pluginManager.isAIAssistantRunning();
      console.log("Main process: AI Assistant running status:", isRunning);
      return { success: true, isRunning };
    } catch (error: unknown) {
      console.error("Main process: Error checking if AI Assistant is running:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        isRunning: false
      };
    }
  });

  // Export to PDF - Chức năng tích hợp trực tiếp vào ứng dụng
  ipcMain.on(
    "export-to-pdf",
    async (event, content: string, filePath?: string) => {
      try {
        console.log(
          `Exporting to PDF, content length: ${content?.length || 0}`
        );

        // Hiển thị SaveDialog để chọn nơi lưu file
        const result = dialog.showSaveDialog(mainWindow!, {
          title: "Export to PDF",
          defaultPath: filePath
            ? filePath.replace(/\.[^.]+$/, ".pdf")
            : "output.pdf",
          filters: [{ name: "PDF Files", extensions: ["pdf"] }],
        }) as unknown as SaveDialogReturnValue;

        if (!result.canceled && result.filePath) {
          try {
            // Sử dụng PDFKit để tạo file PDF
            const PDFDocument = require("pdfkit");

            // Tạo PDF document với các tùy chọn
            const doc = new PDFDocument({
              margin: 50, // Margin lớn hơn để dễ đọc
              size: "A4", // Kích thước A4
              info: {
                // Thông tin metadata
                Title: filePath ? path.basename(filePath) : "Exported Document",
                Author: "Text Editor App",
                Subject: "Exported Document",
                Keywords: "text, editor, export, pdf",
                Creator: "Text Editor App",
                Producer: "PDFKit",
              },
            });

            const stream = fs.createWriteStream(result.filePath);

            // Pipe PDF to file
            doc.pipe(stream);

            // Sử dụng font mặc định của PDFKit (Helvetica) vì nó hỗ trợ nhiều ký tự Unicode
            // Tuy nhiên, Helvetica không hỗ trợ đầy đủ tiếng Việt
            // Sử dụng font Times-Roman thay thế, nó hỗ trợ tiếng Việt tốt hơn
            doc.font("Times-Roman");

            // Thêm tiêu đề và ngày xuất
            const title = filePath
              ? path.basename(filePath)
              : "Exported Document";
            const date = new Date().toLocaleDateString();

            doc.fontSize(18).text(title, { align: "center" });
            doc.fontSize(10).text(date, { align: "center" });
            doc.moveDown(2);

            // Xử lý nội dung để giữ định dạng tốt hơn
            // Tách nội dung thành các dòng
            const lines = content.split("\n");

            // Thêm nội dung với các tùy chỉnh
            doc.fontSize(12);

            // Xử lý từng dòng
            lines.forEach((line, index) => {
              // Nếu là dòng trống, thêm khoảng cách
              if (line.trim() === "") {
                doc.moveDown(0.5);
              } else {
                // Nếu không phải dòng đầu tiên, thêm khoảng cách nhỏ
                if (index > 0) {
                  doc.moveDown(0.2);
                }

                // Thêm nội dung của dòng
                doc.text(line, {
                  align: "left",
                  continued: false,
                  width: 500, // Chiều rộng tối đa của văn bản
                });
              }
            });

            // Thêm số trang
            const totalPages = doc.bufferedPageRange().count;
            for (let i = 0; i < totalPages; i++) {
              doc.switchToPage(i);
              doc
                .fontSize(10)
                .text(
                  `Page ${i + 1} of ${totalPages}`,
                  50,
                  doc.page.height - 50,
                  { align: "center" }
                );
            }

            // Finalize PDF
            doc.end();

            // Wait for PDF to be written
            stream.on("finish", () => {
              console.log("PDF created successfully at:", result.filePath);
              event.reply("export-to-pdf-result", {
                success: true,
                message: `File exported successfully to ${result.filePath}`,
                filePath: result.filePath,
              });
            });

            stream.on("error", (err) => {
              console.error("Error creating PDF:", err);
              event.reply("export-to-pdf-result", {
                success: false,
                message: `Error creating PDF: ${err.message}`,
                error: err,
              });
            });
          } catch (error: any) {
            console.error(`Error creating PDF:`, error);

            // Fallback to simple text export if PDFKit fails
            try {
              fs.writeFileSync(result.filePath, content);
              event.reply("export-to-pdf-result", {
                success: true,
                message: `File exported successfully to ${result.filePath} (basic export)`,
                filePath: result.filePath,
              });
            } catch (fallbackError: any) {
              event.reply("export-to-pdf-result", {
                success: false,
                message: `Error exporting file: ${
                  fallbackError.message || String(fallbackError)
                }`,
                error: fallbackError,
              });
            }
          }
        } else {
          event.reply("export-to-pdf-result", {
            success: false,
            message: "Export cancelled by user",
          });
        }
      } catch (error: any) {
        console.error(`Unexpected error in export-to-pdf handler:`, error);
        event.reply("export-to-pdf-result", {
          success: false,
          message: `Error: ${error.message || String(error)}`,
          error: error,
        });
      }
    }
  );

  // Áp dụng plugin (giữ lại cho các plugin khác)
  ipcMain.on(
    "apply-plugin",
    async (event, pluginName: string, content: string) => {
      try {
        console.log(`Applying plugin: ${pluginName}`);

        // Xử lý các plugin khác
        // Hiển thị SaveDialog để chọn nơi lưu file nếu cần
        const result = dialog.showSaveDialog(mainWindow!, {
          title: "Save Output",
          defaultPath: "output.pdf",
          filters: [{ name: "PDF Files", extensions: ["pdf"] }],
        }) as unknown as SaveDialogReturnValue;

        if (!result.canceled && result.filePath) {
          try {
            // Kiểm tra xem plugin đã được cài đặt chưa
            const installedPlugins = pluginManager
              .getPlugins()
              .map((p) => p.name);
            const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");

            if (
              !installedPlugins.includes(pluginName) &&
              !installedPlugins.includes(normalizedName)
            ) {
              try {
                // Thử cài đặt plugin
                await pluginManager.installPlugin(pluginName);
                console.log(`Successfully installed plugin ${pluginName}`);
              } catch (installError: any) {
                console.error(
                  `Failed to install plugin ${pluginName}:`,
                  installError
                );
                event.reply(
                  "plugin-applied",
                  `Error: Failed to install plugin ${pluginName}: ${
                    installError.message || String(installError)
                  }`
                );
                return;
              }
            }

            // Thực thi plugin
            await pluginManager.executePlugin(
              pluginName,
              content,
              result.filePath
            );
            event.reply(
              "plugin-applied",
              `File exported successfully to ${result.filePath}`
            );
          } catch (error: any) {
            console.error(`Error executing plugin ${pluginName}:`, error);
            event.reply(
              "plugin-applied",
              `Error: ${error.message || String(error)}`
            );
          }
        } else {
          event.reply("plugin-applied", "Operation cancelled by user");
        }
      } catch (error: any) {
        console.error(`Unexpected error in apply-plugin handler:`, error);
        event.reply(
          "plugin-applied",
          `Error: ${error.message || String(error)}`
        );
      }
    }
  );

  // Lấy danh sách menu item cho menu cha cụ thể
  ipcMain.handle("get-menu-items", async (_event, parentMenu: string) => {
    try {
      const menuItems = pluginManager.getMenuItemsForParent(parentMenu);
      console.log(
        `Menu items for ${parentMenu}:`,
        menuItems.map((item) => ({
          id: item.id,
          label: item.label,
          pluginId: item.pluginId,
        }))
      );
      return menuItems;
    } catch (error) {
      console.error(`Error getting menu items for ${parentMenu}:`, error);
      return [];
    }
  });

  // Thực thi plugin trực tiếp (cho AI Chat) - Với xử lý AI Assistant tích hợp
  ipcMain.on(
    "execute-plugin",
    async (event, data: { pluginName: string; content: string; options?: any }) => {
      console.log(`🚀 [Main] Executing plugin directly: ${data.pluginName}`);
      console.log(`📝 [Main] Content length: ${data.content?.length || 0}`);
      console.log(`⚙️ [Main] Options:`, JSON.stringify(data.options, null, 2));

      try {
        // Kiểm tra xem có phải AI Assistant plugin không
        if (data.pluginName === 'ai-assistant' || data.pluginName.includes('ai-assistant')) {
          console.log(`🤖 [Main] Using built-in AI Assistant service`);

          // Sử dụng AI Service tích hợp thay vì plugin
          const aiService = AIService.getInstance();

          const aiRequest = {
            prompt: data.content,
            systemPrompt: data.options?.systemPrompt || 'Bạn là một trợ lý AI hữu ích về lập trình. Hãy trả lời bằng tiếng Việt.',
            maxTokens: data.options?.maxTokens || 1000,
            temperature: data.options?.temperature || 0.7
          };

          const aiResponse = await aiService.sendMessage(aiRequest);

          if (aiResponse.success) {
            console.log(`✅ [Main] AI Assistant execution successful`);
            console.log(`📤 [Main] Sending plugin-executed event with data:`, aiResponse.content);
            event.reply("plugin-executed", {
              success: true,
              message: `AI Assistant executed successfully`,
              data: aiResponse.content,
            });
          } else {
            console.error(`❌ [Main] AI Assistant execution failed:`, aiResponse.error);
            event.reply("plugin-executed", {
              success: false,
              message: aiResponse.error || 'AI Assistant execution failed',
            });
          }
          return;
        }

        // Xử lý các plugin khác như bình thường
        const result = await pluginManager.executePlugin(
          data.pluginName,
          data.content,
          undefined, // filePath
          data.options
        );

        console.log(`✅ [Main] Plugin execution successful`);
        console.log(`📤 [Main] Result:`, result);

        // Trả kết quả về renderer
        event.reply("plugin-executed", {
          success: true,
          message: `Plugin ${data.pluginName} executed successfully`,
          data: result,
        });
      } catch (executeError: any) {
        console.error(`❌ [Main] Error executing plugin ${data.pluginName}:`, executeError);
        event.reply("plugin-executed", {
          success: false,
          message: `Error executing plugin: ${executeError.message || String(executeError)}`,
        });
      }
    }
  );

  // Thực thi hành động menu
  ipcMain.on(
    "execute-menu-action",
    async (event, menuItemId: string, content: string, filePath?: string) => {
      try {
        console.log(`Executing menu action: ${menuItemId}`);
        console.log(
          `Content length: ${content?.length || 0}, filePath: ${
            filePath || "none"
          }`
        );

        // Tìm menu item tương ứng từ tất cả các menu
        const fileMenuItems = pluginManager.getMenuItemsForParent("file");
        const editMenuItems = pluginManager.getMenuItemsForParent("edit");
        const viewMenuItems = pluginManager.getMenuItemsForParent("view");
        const runMenuItems = pluginManager.getMenuItemsForParent("run");

        console.log(
          `Found menu items - File: ${fileMenuItems.length}, Edit: ${editMenuItems.length}, View: ${viewMenuItems.length}, Run: ${runMenuItems.length}`
        );
        console.log(
          `File menu items: ${JSON.stringify(
            fileMenuItems.map((item) => ({
              id: item.id,
              label: item.label,
              pluginId: item.pluginId,
            }))
          )}`
        );
        console.log(
          `Edit menu items: ${JSON.stringify(
            editMenuItems.map((item) => ({
              id: item.id,
              label: item.label,
              pluginId: item.pluginId,
            }))
          )}`
        );
        console.log(
          `Run menu items: ${JSON.stringify(
            runMenuItems.map((item) => ({
              id: item.id,
              label: item.label,
              pluginId: item.pluginId,
            }))
          )}`
        );

        // Kết hợp tất cả menu items
        const allMenuItems = [
          ...fileMenuItems,
          ...editMenuItems,
          ...viewMenuItems,
          ...runMenuItems,
        ];
        const menuItem = allMenuItems.find((item) => item.id === menuItemId);
        console.log(
          `Found menu item: ${menuItem ? JSON.stringify(menuItem) : "null"}`
        );

        // Kiểm tra danh sách plugin đã đăng ký
        const registeredPlugins = pluginManager.getPlugins();
        console.log(
          `Registered plugins: ${JSON.stringify(
            registeredPlugins.map((p) => p.name)
          )}`
        );

        if (!menuItem) {
          console.error(`Menu item with ID ${menuItemId} not found`);



          event.reply("menu-action-result", {
            success: false,
            message: `Menu item with ID ${menuItemId} not found`,
          });
          return;
        }

        // Lấy plugin ID từ menu item
        const pluginId = menuItem.pluginId;
        console.log(`Plugin ID from menu item: ${pluginId}`);

        if (!pluginId) {
          console.error(`Menu item ${menuItemId} does not have a plugin ID`);
          event.reply("menu-action-result", {
            success: false,
            message: `Menu item does not have a plugin ID`,
          });
          return;
        }

        // Kiểm tra xem có phải AI Assistant tích hợp không
        if (pluginId === 'built-in-ai-assistant') {
          console.log(`🤖 [Main] Executing built-in AI Assistant menu action`);

          // Mở AI Chat dialog
          event.reply("menu-action-result", {
            success: true,
            message: `AI Chat opened successfully`,
            data: { action: 'open-ai-chat' },
          });
          return;
        }

        // Kiểm tra xem plugin có được đăng ký không
        const plugin = registeredPlugins.find((p) => p.name === pluginId);
        if (!plugin) {
          console.error(`Plugin ${pluginId} is not registered`);

          // Thử cài đặt lại plugin
          try {
            console.log(`Attempting to reinstall plugin ${pluginId}...`);
            await pluginManager.installPlugin(pluginId);
            console.log(`Plugin ${pluginId} reinstalled successfully`);
          } catch (installError) {
            console.error(
              `Failed to reinstall plugin ${pluginId}:`,
              installError
            );
            event.reply("menu-action-result", {
              success: false,
              message: `Plugin ${pluginId} is not registered and could not be reinstalled`,
            });
            return;
          }
        }

        // Thực thi plugin
        try {
          console.log(
            `Executing plugin ${pluginId} with content length ${
              content?.length || 0
            }`
          );
          const result = await pluginManager.executePlugin(
            pluginId,
            content,
            filePath
          );
          console.log(`Plugin execution result:`, result);

          // Trả kết quả về renderer
          event.reply("menu-action-result", {
            success: true,
            message: `Menu action ${menuItem.label} executed successfully`,
            data: result,
          });
        } catch (executeError: any) {
          console.error(`Error executing plugin ${pluginId}:`, executeError);
          event.reply("menu-action-result", {
            success: false,
            message: `Error executing plugin: ${
              executeError.message || String(executeError)
            }`,
          });
        }
      } catch (error: any) {
        console.error("Error executing menu action:", error);
        event.reply("menu-action-result", {
          success: false,
          message: `Error: ${error.message || String(error)}`,
        });
      }
    }
  );
});

// Chạy code
ipcMain.on(
  "run-code",
  async (event, data: { code: string; fileName: string; language: string }) => {
    try {
      console.log(
        `Running code in ${data.language} language, code length: ${
          data.code?.length || 0
        }`
      );

      // Tạo file tạm thời để chạy code
      const tempDir = path.join(app.getPath("temp"), "text-editor-code-runner");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Xác định tên file và lệnh chạy dựa trên ngôn ngữ
      let tempFile = "";
      let command = "";
      let args: string[] = [];

      switch (data.language) {
        case "js":
          tempFile = path.join(tempDir, "temp.js");
          command = "node";
          args = [tempFile];
          break;
        case "py":
          tempFile = path.join(tempDir, "temp.py");
          command = "python";
          args = [tempFile];
          break;
        case "ts":
          tempFile = path.join(tempDir, "temp.ts");
          command = "npx";
          args = ["ts-node", tempFile];
          break;
        case "cpp":
          tempFile = path.join(tempDir, "temp.cpp");
          // Biên dịch và chạy file C++
          // Đầu tiên, biên dịch file C++ thành file thực thi
          const executableFile = path.join(tempDir, "temp.exe");
          fs.writeFileSync(tempFile, data.code);

          // Kiểm tra xem có trình biên dịch tích hợp không
          // Danh sách các đường dẫn có thể có trình biên dịch
          const possibleCompilerPaths = [
            // Thư mục plugins trong project
            path.join(
              __dirname,
              "..",
              "plugins",
              "code-runner",
              "bin",
              "win32",
              "bin",
              "g++.exe"
            ),

            // Thư mục plugins trong AppData
            path.join(
              app.getPath("userData"),
              "plugins",
              "code-runner",
              "bin",
              "win32",
              "bin",
              "g++.exe"
            ),
            path.join(
              app.getPath("userData"),
              "plugins",
              "code-runner-1.1.0",
              "bin",
              "win32",
              "bin",
              "g++.exe"
            ),

            // Đường dẫn mặc định của MinGW
            "C:\\MinGW\\bin\\g++.exe",
            "C:\\msys64\\mingw64\\bin\\g++.exe",
          ];

          // Tìm trình biên dịch trong các đường dẫn có thể
          let integratedCompilerPath = "";
          for (const compilerPath of possibleCompilerPaths) {
            console.log(`Checking for compiler at: ${compilerPath}`);
            if (fs.existsSync(compilerPath)) {
              console.log(`Found compiler at: ${compilerPath}`);
              integratedCompilerPath = compilerPath;
              break;
            }
          }

          // Sử dụng trình biên dịch tích hợp nếu có, nếu không thì sử dụng g++ hệ thống
          let gppPath = "g++";

          if (integratedCompilerPath) {
            gppPath = integratedCompilerPath;
            console.log(`Using integrated compiler: ${gppPath}`);
          } else {
            console.log("No integrated compiler found, using system g++");
          }
          console.log(`Using C++ compiler: ${gppPath}`);

          // Sử dụng g++ để biên dịch
          const compileProcess = spawn(gppPath, [
            tempFile,
            "-o",
            executableFile,
          ]);
          let compileError = "";

          compileProcess.stderr.on("data", (data) => {
            compileError += data.toString();
          });

          compileProcess.on("close", (code) => {
            if (code !== 0) {
              // Biên dịch thất bại
              event.reply("run-code-result", {
                success: false,
                message: `Compilation failed with exit code ${code}`,
                output: "",
                error: compileError,
                exitCode: code,
              });
              return;
            }

            // Biên dịch thành công, chạy file thực thi
            const runProcess = spawn(executableFile, []);
            let output = "";
            let errorOutput = "";

            // Lưu trữ process để có thể dừng nó sau này
            runningProcesses.set(data.fileName, runProcess);

            runProcess.stdout.on("data", (data) => {
              const text = data.toString();
              output += text;
              // Gửi kết quả trực tiếp đến renderer
              event.reply("run-code-output", {
                type: "stdout",
                text: text,
              });
            });

            runProcess.stderr.on("data", (data) => {
              const text = data.toString();
              errorOutput += text;
              // Gửi lỗi trực tiếp đến renderer
              event.reply("run-code-output", {
                type: "stderr",
                text: text,
              });
            });

            runProcess.on("close", (code) => {
              console.log(`C++ process exited with code ${code}`);
              runningProcesses.delete(data.fileName);

              // Gửi kết quả cuối cùng
              event.reply("run-code-result", {
                success: code === 0,
                message:
                  code === 0
                    ? "Code executed successfully"
                    : `Code execution failed with exit code ${code}`,
                output: output,
                error: errorOutput,
                exitCode: code,
              });
            });
          });
          return;
        case "html":
          tempFile = path.join(tempDir, "temp.html");
          // Mở file HTML trong trình duyệt mặc định
          fs.writeFileSync(tempFile, data.code);
          shell.openExternal(`file://${tempFile}`);
          event.reply("run-code-result", {
            success: true,
            message: `Opened HTML file in default browser`,
            output: "",
          });
          return;
        default:
          event.reply("run-code-result", {
            success: false,
            message: `Unsupported language: ${data.language}`,
            output: "",
          });
          return;
      }

      // Ghi code vào file tạm thời
      fs.writeFileSync(tempFile, data.code);

      // Chạy code
      const childProcess = spawn(command, args);
      let output = "";
      let errorOutput = "";

      // Lưu trữ process để có thể dừng nó sau này
      runningProcesses.set(data.fileName, childProcess);

      childProcess.stdout.on("data", (data) => {
        const text = data.toString();
        output += text;
        // Gửi kết quả trực tiếp đến renderer
        event.reply("run-code-output", {
          type: "stdout",
          text: text,
        });
      });

      childProcess.stderr.on("data", (data) => {
        const text = data.toString();
        errorOutput += text;
        // Gửi lỗi trực tiếp đến renderer
        event.reply("run-code-output", {
          type: "stderr",
          text: text,
        });
      });

      childProcess.on("close", (code) => {
        console.log(`Child process exited with code ${code}`);
        runningProcesses.delete(data.fileName);

        // Gửi kết quả cuối cùng
        event.reply("run-code-result", {
          success: code === 0,
          message:
            code === 0
              ? "Code executed successfully"
              : `Code execution failed with exit code ${code}`,
          output: output,
          error: errorOutput,
          exitCode: code,
        });
      });
    } catch (error: any) {
      console.error(`Error running code:`, error);
      event.reply("run-code-result", {
        success: false,
        message: `Error: ${error.message || String(error)}`,
        output: "",
        error: error.message || String(error),
        exitCode: 1,
      });
    }
  }
);

// Dừng chạy code
ipcMain.on("stop-execution", (event, fileName?: string) => {
  try {
    if (fileName && runningProcesses.has(fileName)) {
      // Dừng process cụ thể
      const process = runningProcesses.get(fileName);
      if (process) {
        process.kill();
        runningProcesses.delete(fileName);
        event.reply("run-code-output", {
          type: "system",
          text: `Execution of ${fileName} stopped by user`,
        });
      }
    } else {
      // Dừng tất cả các process đang chạy
      for (const [file, process] of runningProcesses.entries()) {
        process.kill();
        event.reply("run-code-output", {
          type: "system",
          text: `Execution of ${file} stopped by user`,
        });
      }
      runningProcesses.clear();
    }

    event.reply("stop-execution-result", {
      success: true,
      message: "Execution stopped",
    });
  } catch (error: any) {
    console.error(`Error stopping execution:`, error);
    event.reply("stop-execution-result", {
      success: false,
      message: `Error: ${error.message || String(error)}`,
    });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Dừng Plugin Manager trước khi thoát
    if (pluginManager) {
      pluginManager.stop();
    }
    app.quit();
  }
});

// Hàm đệ quy để đọc cấu trúc thư mục
function getFolderStructure(folderPath: string) {
  const name = path.basename(folderPath);
  const structure: any = {
    name,
    type: "directory",
    path: folderPath,
    children: [],
  };

  const items = fs.readdirSync(folderPath);
  for (const item of items) {
    const itemPath = path.join(folderPath, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      structure.children.push(getFolderStructure(itemPath));
    } else {
      structure.children.push({
        name: item,
        type: "file",
        path: itemPath,
      });
    }
  }

  return structure;
}
