
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

// Add uncaught exception handler to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);

  // Log socket-related errors specifically
  if (error.message && error.message.includes('ERR_SOCKET_CLOSED')) {
    console.error('Socket closed error detected - this is usually due to plugin disconnection');
    // Don't exit the process for socket errors, just log them
    return;
  }

  // For other errors, log but don't crash the application
  console.error('Non-socket error detected:', error);
});

// Add unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
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
  : 5001; // Default fallback only if environment variable is not set

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

    // Đăng ký AI Assistant menu items tích hợp sẵn
    try {
      // AI Chat trong View menu
      pluginManager.registerBuiltInMenuItem({
        id: 'built-in-ai-assistant.aiChat',
        label: 'AI Chat',
        parentMenu: 'view',
        shortcut: 'Alt+A',
        pluginId: 'built-in-ai-assistant'
      });

      // Complete Code trong Edit menu
      pluginManager.registerBuiltInMenuItem({
        id: 'built-in-ai-assistant.completeCode',
        label: 'Complete Code',
        parentMenu: 'edit',
        shortcut: 'Alt+C',
        pluginId: 'built-in-ai-assistant'
      });

      // Explain Code trong Edit menu
      pluginManager.registerBuiltInMenuItem({
        id: 'built-in-ai-assistant.explainCode',
        label: 'Explain Code',
        parentMenu: 'edit',
        shortcut: 'Alt+E',
        pluginId: 'built-in-ai-assistant'
      });

      // Generate Code trong Edit menu
      pluginManager.registerBuiltInMenuItem({
        id: 'built-in-ai-assistant.generateCode',
        label: 'Generate Code',
        parentMenu: 'edit',
        shortcut: 'Alt+G',
        pluginId: 'built-in-ai-assistant'
      });

      console.log("Built-in AI Assistant menu items registered");
    } catch (menuError) {
      console.error("Error registering built-in AI Assistant menu items:", menuError);
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

// // Hàm đăng ký tất cả IPC handlers
// function registerAllIpcHandlers() {
//   // Đăng ký các handlers quan trọng trước

//   // Lấy danh sách plugin đã cài đặt - Đảm bảo không có plugin trùng lặp
//   ipcMain.handle("get-plugins", async () => {
//     try {
//       if (!pluginManager) {
//         console.warn("PluginManager not initialized yet, returning empty array");
//         return [];
//       }

//       // Lấy danh sách plugin
//       const plugins = pluginManager.getPlugins();

//       // Tạo Map để lọc các plugin trùng lặp dựa trên tên chuẩn hóa
//       const uniquePlugins = new Map<string, string>();

//       // Lọc các plugin trùng lặp
//       for (const plugin of plugins) {
//         if (!plugin || !plugin.name) continue;

//         // Chuẩn hóa tên plugin
//         const normalizedName = plugin.name.replace(/(-\d+\.\d+\.\d+)$/, "");

//         // Chỉ giữ lại plugin mới nhất cho mỗi tên chuẩn hóa
//         if (!uniquePlugins.has(normalizedName)) {
//           uniquePlugins.set(normalizedName, plugin.name);
//         }
//       }

//       // Trả về danh sách tên plugin duy nhất
//       return Array.from(uniquePlugins.values());
//     } catch (error) {
//       console.error("Error in get-plugins handler:", error);
//       return [];
//     }
//   });

//   // Lấy danh sách menu item cho menu cha cụ thể
//   ipcMain.handle("get-menu-items", async (_event, parentMenu: string) => {
//     try {
//       if (!pluginManager) {
//         console.warn("PluginManager not initialized yet, returning empty array");
//         return [];
//       }

//       const menuItems = pluginManager.getMenuItemsForParent(parentMenu);
//       console.log(
//         `Menu items for ${parentMenu}:`,
//         menuItems.map((item) => ({
//           id: item.id,
//           label: item.label,
//           pluginId: item.pluginId,
//         }))
//       );
//       return menuItems;
//     } catch (error) {
//       console.error(`Error getting menu items for ${parentMenu}:`, error);
//       return [];
//     }
//   });

//   // Handler đã được định nghĩa ở trên
// }

app.whenReady().then(async () => {
  try {
    // Tạo cửa sổ chính trước
    mainWindow = createWindow();

    // Đăng ký các IPC handlers quan trọng TRƯỚC khi khởi tạo PluginManager
    console.log("Registering critical IPC handlers...");

    // Lấy danh sách plugin đã cài đặt - Đảm bảo không có plugin trùng lặp
    ipcMain.handle("get-plugins", async () => {
      try {
        if (!pluginManager) {
          console.warn("PluginManager not initialized yet, returning empty array");
          return [];
        }
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
      } catch (error) {
        console.error("Error in get-plugins handler:", error);
        return [];
      }
    });

    // Lấy danh sách menu item cho menu cha cụ thể
    ipcMain.handle("get-menu-items", async (_event, parentMenu: string) => {
      try {
        if (!pluginManager) {
          console.warn("PluginManager not initialized yet, returning empty array");
          return [];
        }
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

    console.log("Critical IPC handlers registered successfully");

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
    ipcMain.on('open-folder-request', async (event) => {
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory']
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
    ipcMain.on('open-file-dialog', async (event) => {
        console.log('Received open-file-dialog event');
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [
                    { name: 'Text Files', extensions: ['txt', 'md', 'js', 'ts', 'html', 'css', 'json'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
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

        // Thông báo cho plugin khi file được mở
        if (pluginManager) {
          pluginManager.notifyFileOpened(content, filePath);
        }
      }
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to open file";
      event.sender.send("file-opened", { error: errorMessage });
    }
  });

  // Handle opening a file
  ipcMain.on("open-file-request", async (event, filePath: string) => {
    try {
      console.log("Nhận yêu cầu mở file:", filePath);

      // Xử lý đường dẫn
      let absolutePath = filePath;
      if (!path.isAbsolute(filePath) && selectedFolder) {
        absolutePath = path.join(selectedFolder, filePath);
      }

      console.log("Đường dẫn tuyệt đối:", absolutePath);

      // Kiểm tra file có tồn tại không
      if (!fs.existsSync(absolutePath)) {
        console.error(`File không tồn tại: ${absolutePath}`);
        throw new Error(`File không tồn tại: ${absolutePath}`);
      }

      const content = fs.readFileSync(absolutePath, "utf-8");
      const fileName = path.basename(absolutePath);

      console.log("Gửi nội dung file:", fileName, "độ dài:", content.length);

      // Gửi cả hai sự kiện để đảm bảo tương thích
      event.sender.send("file-content", {
        content,
        filePath: absolutePath,
        fileName,
      });

      event.sender.send("file-opened", {
        content,
        filePath: absolutePath,
        fileName,
      });

      // Thông báo cho plugin khi file được mở
      if (pluginManager) {
        pluginManager.notifyFileOpened(content, absolutePath);
      }
    } catch (error: any) {
      console.error("Lỗi khi mở file:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Không thể mở file";

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
    ipcMain.on('save-file-request', async (event, data: { filePath: string, content: string }) => {
        try {
            const { filePath, content } = data;
            const result = await dialog.showSaveDialog({
                defaultPath: filePath,
                filters: [
                    { name: 'Text Files', extensions: ['txt', 'md', 'js', 'ts', 'html', 'css', 'json'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
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

  // Handlers đã được di chuyển lên registerAllIpcHandlers()

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



  // Cài đặt plugin - Cải thiện với error handling tốt hơi và timeout
  ipcMain.handle("install-plugin", async (event, pluginName) => {
    console.log(`Main process: Installing plugin ${pluginName}`);

    // Validate input
    if (!pluginName || typeof pluginName !== 'string') {
      console.error(`Main process: Invalid plugin name: ${pluginName}`);
      return { success: false, message: "Invalid plugin name" };
    }

    try {
      // Đảm bảo pluginManager tồn tại
      if (!pluginManager) {
        console.error(`Main process: PluginManager not initialized`);
        return { success: false, message: "Plugin system not available" };
      }

      // Gọi installPlugin với timeout để tránh hang
      console.log(`Main process: Calling pluginManager.installPlugin for ${pluginName}`);

      const installPromise = pluginManager.installPlugin(pluginName);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Installation timeout after 120 seconds')), 120000);
      });

      const result = await Promise.race([installPromise, timeoutPromise]);
      console.log(`Main process: Plugin ${pluginName} installed successfully`, result);

      // Gửi danh sách plugin mới cho renderer với error handling cải tiến
      try {
        const plugins = pluginManager.getPlugins();
        console.log(`Main process: Sending updated plugin list with ${plugins.length} plugins`);

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

      // Send success event to renderer
      try {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('plugin-install-success', {
            pluginName,
            message: `Plugin ${pluginName} installed successfully`,
            progress: 100
          });
        }
      } catch (sendError) {
        console.error(`Main process: Error sending install success event:`, sendError);
      }

      // Trả về kết quả cài đặt
      return {
        success: true,
        message: `Plugin ${pluginName} installed successfully`,
        ...(result && typeof result === 'object' ? result : {})
      };
    } catch (error) {
      console.error(`Main process: Error installing plugin ${pluginName}:`, error);

      // Send error event to renderer
      try {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('plugin-install-error', {
            pluginName,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } catch (sendError) {
        console.error(`Main process: Error sending install error event:`, sendError);
      }

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

  // Gỡ cài đặt plugin - Cải thiện với timeout và error handling tốt hơn
  ipcMain.handle(
    "uninstall-plugin",
    async (
      event,
      pluginName: string
    ): Promise<{ success: boolean; message?: string }> => {
      console.log(`Main process: Uninstalling plugin ${pluginName}`);

      // Validate input
      if (!pluginName || typeof pluginName !== 'string') {
        console.error(`Main process: Invalid plugin name: ${pluginName}`);
        return { success: false, message: "Invalid plugin name" };
      }

      try {
        // Đảm bảo pluginManager tồn tại
        if (!pluginManager) {
          console.error(`Main process: PluginManager not initialized`);
          return { success: false, message: "Plugin system not available" };
        }

        // Gọi uninstallPlugin với timeout để tránh hang
        console.log(`Main process: Calling pluginManager.uninstallPlugin for ${pluginName}`);

        const uninstallPromise = pluginManager.uninstallPlugin(pluginName);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Uninstall timeout after 60 seconds')), 60000);
        });

        await Promise.race([uninstallPromise, timeoutPromise]);
        console.log(`Main process: Plugin ${pluginName} uninstalled successfully`);

      } catch (error) {
        console.error(`Main process: Error in uninstallPlugin for ${pluginName}:`, error);

        // Send error event to renderer với error handling cải thiện
        try {
          if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('plugin-uninstall-error', {
              pluginName,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        } catch (sendError) {
          console.error(`Main process: Error sending uninstall error event:`, sendError);
        }

        // Trả về lỗi nhưng vẫn tiếp tục cập nhật plugin list
        // return { success: false, message: error instanceof Error ? error.message : String(error) };
      }

      // Gửi danh sách plugin mới cho renderer với error handling
      try {
        const plugins = pluginManager.getPlugins();
        console.log(`Main process: Sending updated plugin list with ${plugins.length} plugins`);

        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send(
            "plugin-list",
            plugins.map((p) => p.name)
          );
        } else {
          console.warn(`Main process: Event sender is destroyed, cannot send plugin list`);
        }

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

      // Luôn trả về success để tránh lỗi UI
      return { success: true, message: "Plugin uninstall operation completed" };
    }
  );

    // Kiểm tra trạng thái cài đặt của plugin - Cải thiện để xử lý nhiều biến thể tên
    ipcMain.handle("check-plugin-status", async (event, pluginName: string): Promise<{ pluginName: string; isInstalled: boolean; error?: string }> => {
        try {
            if (typeof pluginName !== 'string') {
                console.error(`Invalid plugin name: ${pluginName}`);
                return { pluginName: String(pluginName), isInstalled: false, error: 'Invalid plugin name' };
            }

        console.log(`Main process: Checking plugin status for: ${pluginName}`);

        const plugins = pluginManager.getPlugins();
        const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");

        // Tạo danh sách các biến thể tên có thể có
        const nameVariants = [
          pluginName,
          normalizedName,
          pluginName.replace(/_/g, '-'),
          pluginName.replace(/-/g, '_'),
          normalizedName.replace(/_/g, '-'),
          normalizedName.replace(/-/g, '_'),
          pluginName.toLowerCase(),
          normalizedName.toLowerCase()
        ];

        console.log(`Main process: Checking name variants: ${nameVariants.join(', ')}`);

        const isInstalled = plugins.some((p) => {
          if (!p || !p.name) return false;

          const pNormalizedName =
            typeof p.name === "string"
              ? p.name.replace(/(-\d+\.\d+\.\d+)$/, "")
              : String(p.name);

          // Tạo biến thể tên cho plugin hiện tại
          const pNameVariants = [
            p.name,
            pNormalizedName,
            p.name.replace(/_/g, '-'),
            p.name.replace(/-/g, '_'),
            pNormalizedName.replace(/_/g, '-'),
            pNormalizedName.replace(/-/g, '_'),
            p.name.toLowerCase(),
            pNormalizedName.toLowerCase()
          ];

          // Kiểm tra xem có biến thể nào khớp không
          return nameVariants.some(variant => pNameVariants.includes(variant));
        });

        console.log(`Main process: Plugin ${pluginName} installation status: ${isInstalled}`);
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
            const result = await dialog.showSaveDialog(mainWindow!, {
                title: "Export to PDF",
                defaultPath: filePath ? filePath.replace(/\.[^.]+$/, '.pdf') : "output.pdf",
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

  // Áp dụng plugin (giữ lại cho các plugin khác, không bao gồm export-to-pdf)
  ipcMain.on(
    "apply-plugin",
    async (event, pluginName: string, content: string) => {
      try {
        console.log(`Applying plugin: ${pluginName}`);

        // Export to PDF không còn là plugin nữa, nó được xử lý bởi handler riêng
        if (pluginName === "export-to-pdf") {
          event.reply("plugin-applied", "Export to PDF is now a built-in feature. Please use the File menu.");
          return;
        }

        // Xử lý các plugin khác
        // Hiển thị SaveDialog để chọn nơi lưu file nếu cần
        const result = dialog.showSaveDialog(mainWindow!, {
          title: "Save Output",
          defaultPath: "output.txt",
          filters: [{ name: "All Files", extensions: ["*"] }],
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
            systemPrompt: data.options?.systemPrompt || 'Bạn là một trợ lý AI hữu ích về lập trình. Hãy trả lời bằng tiếng Việt. Bạn có thể sử dụng markdown formatting: **chữ đậm**, *chữ nghiêng*, `code inline`, ```code blocks```, __gạch dưới__, ~~gạch ngang~~.',
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
          console.log(`🤖 [Main] Executing built-in AI Assistant menu action: ${menuItemId}`);

          // Xử lý các menu actions khác nhau
          switch (menuItemId) {
            case 'built-in-ai-assistant.aiChat':
              // Mở AI Chat dialog
              event.reply("menu-action-result", {
                success: true,
                message: `AI Chat opened successfully`,
                data: { action: 'open-ai-chat' },
              });
              return;

            case 'built-in-ai-assistant.completeCode':
              // Xử lý Complete Code với AI Service
              try {
                const aiService = AIService.getInstance();
                const aiRequest = {
                  prompt: content,
                  systemPrompt: 'You are a helpful coding assistant. Complete the code below in the same style and language. Only provide the completed code, no explanations.',
                  maxTokens: 1000,
                  temperature: 0.7
                };
                const aiResponse = await aiService.sendMessage(aiRequest);

                if (aiResponse.success) {
                  event.reply("menu-action-result", {
                    success: true,
                    message: `Code completed successfully`,
                    data: { formattedText: aiResponse.content },
                  });
                } else {
                  event.reply("menu-action-result", {
                    success: false,
                    message: aiResponse.error || 'Failed to complete code',
                  });
                }
              } catch (error: any) {
                event.reply("menu-action-result", {
                  success: false,
                  message: `Error completing code: ${error.message}`,
                });
              }
              return;

            case 'built-in-ai-assistant.explainCode':
              // Xử lý Explain Code với AI Service
              try {
                const aiService = AIService.getInstance();
                const aiRequest = {
                  prompt: content,
                  systemPrompt: 'You are a helpful coding assistant. Explain the following code in detail, including what it does and how it works. Respond in Vietnamese.',
                  maxTokens: 1000,
                  temperature: 0.7
                };
                const aiResponse = await aiService.sendMessage(aiRequest);

                if (aiResponse.success) {
                  // Mở AI Chat với explanation
                  event.reply("menu-action-result", {
                    success: true,
                    message: `Code explained successfully`,
                    data: {
                      action: 'open-ai-chat-with-response',
                      response: aiResponse.content,
                      title: 'Code Explanation'
                    },
                  });
                } else {
                  event.reply("menu-action-result", {
                    success: false,
                    message: aiResponse.error || 'Failed to explain code',
                  });
                }
              } catch (error: any) {
                event.reply("menu-action-result", {
                  success: false,
                  message: `Error explaining code: ${error.message}`,
                });
              }
              return;

            case 'built-in-ai-assistant.generateCode':
              // Mở AI Chat với prompt cho Generate Code
              event.reply("menu-action-result", {
                success: true,
                message: `Generate Code dialog opened successfully`,
                data: {
                  action: 'open-ai-chat-with-prompt',
                  initialPrompt: 'Generate code for:',
                  title: 'Generate Code'
                },
              });
              return;

            default:
              event.reply("menu-action-result", {
                success: false,
                message: `Unknown AI Assistant menu action: ${menuItemId}`,
              });
              return;
          }
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

// Mở terminal để gõ lệnh (thay thế cho run-code)
ipcMain.on("open-terminal", (event, data: { fileName?: string; language?: string }) => {
  try {
    console.log("Opening terminal for manual command input");

    // Gửi thông báo để mở terminal panel
    event.reply("terminal-opened", {
      success: true,
      message: "Terminal ready for commands",
      fileName: data.fileName,
      language: data.language
    });
  } catch (error: any) {
    console.error("Error opening terminal:", error);
    event.reply("terminal-opened", {
      success: false,
      message: `Error: ${error.message || String(error)}`
    });
  }
});

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

// Thực thi lệnh terminal
ipcMain.on("execute-terminal-command", (event, data: { command: string; workingDirectory?: string }) => {
  try {
    console.log(`Executing terminal command: ${data.command}`);
    console.log(`Working directory: ${data.workingDirectory || process.cwd()}`);

    const workingDir = data.workingDirectory || process.cwd();

    // Phân tích lệnh để tách command và arguments
    const commandParts = data.command.trim().split(/\s+/);
    const command = commandParts[0];
    const args = commandParts.slice(1);

    // Tạo child process để thực thi lệnh
    const childProcess = spawn(command, args, {
      cwd: workingDir,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = "";
    let errorOutput = "";

    // Lưu trữ process để có thể dừng nó sau này
    const processKey = `terminal-${Date.now()}`;
    runningProcesses.set(processKey, childProcess);

    // Xử lý stdout
    childProcess.stdout.on("data", (data) => {
      const text = data.toString();
      output += text;
      // Gửi kết quả trực tiếp đến renderer
      event.reply("terminal-output", {
        type: "stdout",
        text: text,
      });
    });

    // Xử lý stderr
    childProcess.stderr.on("data", (data) => {
      const text = data.toString();
      errorOutput += text;
      // Gửi lỗi trực tiếp đến renderer
      event.reply("terminal-output", {
        type: "stderr",
        text: text,
      });
    });

    // Xử lý khi process kết thúc
    childProcess.on("close", (code) => {
      console.log(`Terminal command exited with code ${code}`);
      runningProcesses.delete(processKey);

      // Gửi kết quả cuối cùng
      event.reply("terminal-result", {
        success: code === 0,
        message: code === 0
          ? "Command executed successfully"
          : `Command failed with exit code ${code}`,
        output: output,
        error: errorOutput,
        exitCode: code,
      });
    });

    // Xử lý lỗi khi spawn process
    childProcess.on("error", (error) => {
      console.error(`Error executing terminal command:`, error);
      runningProcesses.delete(processKey);

      event.reply("terminal-result", {
        success: false,
        message: `Error: ${error.message}`,
        output: "",
        error: error.message,
        exitCode: 1,
      });
    });

  } catch (error: any) {
    console.error(`Error executing terminal command:`, error);
    event.reply("terminal-result", {
      success: false,
      message: `Error: ${error.message || String(error)}`,
      output: "",
      error: error.message || String(error),
      exitCode: 1,
    });
  }
});

// Xử lý auto-save từ plugin
ipcMain.on("auto-save-file", async (event, data: { content: string; filePath: string }) => {
  try {
    console.log(`Auto-saving file: ${data.filePath}`);

    // Kiểm tra xem file có tồn tại không
    if (!fs.existsSync(data.filePath)) {
      console.warn(`Auto-save: File ${data.filePath} does not exist, skipping auto-save`);
      return;
    }

    // Lưu file
    fs.writeFileSync(data.filePath, data.content, "utf-8");
    console.log(`Auto-saved file: ${data.filePath}`);

    // Thông báo cho renderer process (tùy chọn)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("file-auto-saved", {
        filePath: data.filePath,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    console.error(`Error auto-saving file ${data.filePath}:`, error);
  }
});

// Xử lý thông báo thay đổi nội dung từ renderer để gửi đến plugin
ipcMain.on("content-changed", (event, data: { content: string; filePath: string }) => {
  try {
    if (pluginManager && data.filePath) {
      console.log(`Content changed for file: ${data.filePath}`);
      pluginManager.notifyContentChanged(data.content, data.filePath);
    }
  } catch (error) {
    console.error("Error notifying plugins of content change:", error);
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

// Add this IPC handler for file searching
ipcMain.on(
  "search-in-files",
  async (event, data: { query: string; folder: string }) => {
    try {
      const { query, folder } = data;
      console.log(`Searching for "${query}" in ${folder}`);

      const results: Array<{
        filePath: string;
        line: number;
        preview: string;
      }> = [];

      // Function to search in a file
      const searchInFile = (filePath: string) => {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const lines = content.split("\n");

          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
              results.push({
                filePath: path.relative(folder, filePath),
                line: index + 1,
                preview: line.trim(),
              });
            }
          });
        } catch (error) {
          console.error(`Error searching in file ${filePath}:`, error);
        }
      };

      // Function to recursively search in directories
      const searchInDir = (dirPath: string) => {
        const files = fs.readdirSync(dirPath);

        files.forEach((file) => {
          const fullPath = path.join(dirPath, file);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            searchInDir(fullPath);
          } else if (stat.isFile()) {
            searchInFile(fullPath);
          }
        });
      };

      searchInDir(folder);
      event.reply("search-results", results);
    } catch (error) {
      console.error("Error searching in files:", error);
      event.reply("search-results", []);
    }
  }
);

// Thêm IPC handler để di chuyển đến dòng cụ thể trong file
ipcMain.on(
  "goto-line",
  async (event, data: { filePath: string; line: number }) => {
    try {
      const { filePath, line } = data;

      // Đọc nội dung file
      const content = fs.readFileSync(filePath, "utf-8");

      // Gửi nội dung file và thông tin dòng cần di chuyển đến
      event.sender.send("file-opened", {
        content,
        fileName: path.basename(filePath),
        filePath,
        gotoLine: line,
      });
    } catch (error) {
      console.error("Error opening file at specific line:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to open file";
      event.sender.send("file-opened", { error: errorMessage });
    }
  }
);
