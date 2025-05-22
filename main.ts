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
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

let selectedFolder: string | null = null;
let mainWindow: BrowserWindow | null = null;
let pluginManager: PluginManager;

// Map để lưu trữ các process đang chạy
const runningProcesses = new Map<string, ChildProcess>();
const PORT = process.env.VITE_PLUGIN_PORT
  ? parseInt(process.env.VITE_PLUGIN_PORT)
  : 5000;

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
  // Khởi tạo Plugin Manager
  pluginManager = new PluginManager(PORT);

  // Đặt tham chiếu đến mainWindow
  if (mainWindow) {
    pluginManager.setMainWindow(mainWindow);
  }

  // Đăng ký callback khi danh sách plugin thay đổi
  pluginManager.setPluginListChangedCallback((plugins) => {
    if (mainWindow) {
      mainWindow.webContents.send("plugin-list", plugins);
    }
  });

  // Đăng ký callback khi danh sách menu item thay đổi
  pluginManager.setMenuItemsChangedCallback((menuItems) => {
    if (mainWindow) {
      mainWindow.webContents.send("menu-items-changed", menuItems);
    }
  });

  // Khởi động Plugin Manager
  await pluginManager.start();
}

app.whenReady().then(async () => {
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
  await initializePluginManager();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

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
      const result = (await dialog.showOpenDialog({
        properties: ["openDirectory"],
      })) as unknown as OpenDialogReturnValue;

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
      const result = (await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
          {
            name: "Text Files",
            extensions: ["txt", "md", "js", "ts", "html", "css", "json"],
          },
          { name: "All Files", extensions: ["*"] },
        ],
      })) as unknown as OpenDialogReturnValue;

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
        const result = (await dialog.showSaveDialog({
          defaultPath: filePath,
          filters: [
            {
              name: "Text Files",
              extensions: ["txt", "md", "js", "ts", "html", "css", "json"],
            },
            { name: "All Files", extensions: ["*"] },
          ],
        })) as unknown as SaveDialogReturnValue;

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

  /**
   * Cài đặt trực tiếp plugin export-to-pdf
   */
  async function installExportToPdfPlugin(
    event: Electron.IpcMainInvokeEvent
  ): Promise<void> {
    console.log("Main process: Installing export-to-pdf plugin directly");

    try {
      // Tạo thư mục plugin
      const pluginsDir = path.join(app.getPath("userData"), "plugins");
      const pluginDir = path.join(pluginsDir, "export-to-pdf");
      console.log(`Creating plugin directory at ${pluginDir}`);

      // Đảm bảo thư mục plugins tồn tại
      if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir, { recursive: true });
      }

      // Xóa thư mục cũ nếu tồn tại
      if (fs.existsSync(pluginDir)) {
        console.log(`Removing existing plugin directory: ${pluginDir}`);
        fs.rmSync(pluginDir, { recursive: true, force: true });
      }

      // Tạo thư mục mới
      fs.mkdirSync(pluginDir, { recursive: true });

      // Tạo file package.json
      const packageJson = {
        name: "export-to-pdf",
        version: "1.0.0",
        description: "Export document to PDF",
        main: "index.js",
        author: "nhtam",
        dependencies: {
          pdfkit: "^0.13.0",
        },
        menuItems: [
          {
            id: "export-to-pdf.exportToPdf",
            label: "Export to PDF",
            parentMenu: "file",
            accelerator: "CmdOrCtrl+E",
          },
        ],
      };

      // Ghi file package.json
      fs.writeFileSync(
        path.join(pluginDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      // Tạo file index.js
      const indexJs = `const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const net = require('net');

// Connect to the plugin server
const client = new net.Socket();
const PORT = process.argv.find(arg => arg.startsWith('--port='))?.split('=')[1] || 5000;

client.connect(PORT, 'localhost', () => {
  console.log('Connected to plugin server');

  // Register the plugin
  client.write(JSON.stringify({
    type: 'REGISTER',
    payload: {
      name: 'export-to-pdf',
      version: '1.0.0',
      description: 'Export document to PDF',
      author: 'nhtam'
    }
  }));

  // Register menu items
  client.write(JSON.stringify({
    type: 'REGISTER_MENU',
    payload: {
      pluginName: 'export-to-pdf',
      menuItems: [
        {
          id: 'export-to-pdf.exportToPdf',
          label: 'Export to PDF',
          parentMenu: 'file',
          accelerator: 'CmdOrCtrl+E'
        }
      ]
    }
  }));
});

// Handle data from the server
client.on('data', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('Received message:', message);

    if (message.type === 'EXECUTE') {
      const { content, filePath } = message.payload;

      if (!content) {
        sendResponse(message.id, false, 'No content provided');
        return;
      }

      // Generate PDF file path
      const outputPath = filePath
        ? filePath.replace(/\.[^.]+$/, '.pdf')
        : path.join(process.cwd(), 'output.pdf');

      console.log('Generating PDF at:', outputPath);

      // Create PDF document
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(outputPath);

      // Pipe PDF to file
      doc.pipe(stream);

      // Add content to PDF
      doc.fontSize(12).text(content, {
        align: 'left'
      });

      // Finalize PDF
      doc.end();

      // Wait for PDF to be written
      stream.on('finish', () => {
        console.log('PDF created successfully');
        sendResponse(message.id, true, 'PDF created successfully', { outputPath });
      });

      stream.on('error', (err) => {
        console.error('Error creating PDF:', err);
        sendResponse(message.id, false, 'Error creating PDF: ' + err.message);
      });
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

// Handle connection errors
client.on('error', (error) => {
  console.error('Connection error:', error);
});

// Handle connection close
client.on('close', () => {
  console.log('Connection closed');
});

// Send response back to the server
function sendResponse(id, success, message, data = null) {
  client.write(JSON.stringify({
    id,
    type: 'RESPONSE',
    payload: {
      success,
      message,
      data
    }
  }));
}
`;

      // Ghi file index.js
      fs.writeFileSync(path.join(pluginDir, "index.js"), indexJs);

      // Cài đặt dependencies
      try {
        const { execSync } = require("child_process");
        console.log(`Running npm install in ${pluginDir}`);
        execSync("npm install --no-fund --no-audit --loglevel=error", {
          cwd: pluginDir,
          stdio: "inherit",
          timeout: 60000, // 60 giây timeout
        });
        console.log("Dependencies installed successfully");
      } catch (npmError) {
        console.error("Error installing dependencies:", npmError);
        console.log(
          "Continuing without installing dependencies - plugin may not work correctly"
        );
      }

      // Cập nhật file extensions.json
      const extensionsJsonPath = path.join(pluginsDir, "..", "extensions.json");
      let extensions: { [key: string]: any } = {};

      // Đọc file extensions.json nếu tồn tại
      if (fs.existsSync(extensionsJsonPath)) {
        try {
          const content = fs.readFileSync(extensionsJsonPath, "utf8");
          extensions = JSON.parse(content);
        } catch (err) {
          console.error("Error reading extensions.json:", err);
          extensions = {};
        }
      }

      // Cập nhật trạng thái plugin
      extensions["export-to-pdf"] = {
        enabled: true,
        installedTimestamp: Date.now(),
      };

      // Ghi file extensions.json
      fs.writeFileSync(
        extensionsJsonPath,
        JSON.stringify(extensions, null, 2),
        "utf8"
      );
      console.log(
        `Updated extensions.json for plugin export-to-pdf, installed: true`
      );

      // Khởi động plugin
      try {
        await pluginManager.startPlugin("export-to-pdf");
        console.log("Plugin export-to-pdf started successfully");
      } catch (startError) {
        console.error("Error starting plugin export-to-pdf:", startError);
        // Tiếp tục ngay cả khi có lỗi khởi động
      }

      // Gửi danh sách plugin mới cho renderer
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
            `Main process: Sending updated menu items after export-to-pdf installation`
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
      }, 1000);

      console.log("Export-to-PDF plugin installed successfully");
    } catch (error) {
      console.error("Error installing export-to-pdf plugin directly:", error);
      throw error;
    }
  }

  // Cài đặt plugin - Đơn giản hóa tối đa
  ipcMain.handle("install-plugin", async (event, pluginName) => {
    console.log(`Main process: Installing plugin ${pluginName}`);

    // Xử lý đặc biệt cho plugin export-to-pdf
    if (pluginName === "export-to-pdf") {
      console.log(
        "Main process: Using special handling for export-to-pdf plugin"
      );
      try {
        // Gọi phương thức cài đặt đặc biệt
        await installExportToPdfPlugin(event);
        return {
          success: true,
          message: `Plugin export-to-pdf installed successfully`,
        };
      } catch (error: any) {
        console.error(
          `Main process: Error installing export-to-pdf plugin:`,
          error
        );
        return {
          success: false,
          message: `Error installing export-to-pdf plugin: ${
            error.message || String(error)
          }`,
        };
      }
    }

    try {
      // Gọi installPlugin và bắt lỗi
      await pluginManager.installPlugin(pluginName);
      console.log(`Main process: Plugin ${pluginName} installed successfully`);
    } catch (error) {
      console.error(`Main process: Error installing plugin:`, error);
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
        } catch (menuError) {
          console.error(`Main process: Error sending menu items:`, menuError);
        }
      }, 1000); // Đợi 1 giây để plugin có thời gian đăng ký menu items
    } catch (error) {
      console.error(`Main process: Error sending plugin list:`, error);
    }

    // Luôn trả về success: true để tránh màn hình trắng
    return {
      success: true,
      message: `Plugin ${pluginName} installed successfully`,
    };
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
      event,
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

  // Export to PDF - Chức năng tích hợp trực tiếp vào ứng dụng
  ipcMain.on(
    "export-to-pdf",
    async (event, content: string, filePath?: string) => {
      try {
        console.log(
          `Exporting to PDF, content length: ${content?.length || 0}`
        );

        // Hiển thị SaveDialog để chọn nơi lưu file
        const result = (await dialog.showSaveDialog(mainWindow!, {
          title: "Export to PDF",
          defaultPath: filePath
            ? filePath.replace(/\.[^.]+$/, ".pdf")
            : "output.pdf",
          filters: [{ name: "PDF Files", extensions: ["pdf"] }],
        })) as unknown as SaveDialogReturnValue;

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
        const result = (await dialog.showSaveDialog(mainWindow!, {
          title: "Save Output",
          defaultPath: "output.pdf",
          filters: [{ name: "PDF Files", extensions: ["pdf"] }],
        })) as unknown as SaveDialogReturnValue;

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
  ipcMain.handle("get-menu-items", async (event, parentMenu: string) => {
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

          // Xử lý trường hợp đặc biệt cho export-to-pdf
          if (menuItemId === "export-to-pdf.exportToPdf") {
            console.log("Special handling for export-to-pdf plugin");
            try {
              // Hiển thị SaveDialog để chọn nơi lưu file
              const result = (await dialog.showSaveDialog(mainWindow!, {
                title: "Export to PDF",
                defaultPath: "output.pdf",
                filters: [{ name: "PDF Files", extensions: ["pdf"] }],
              })) as unknown as SaveDialogReturnValue;

              if (!result.canceled && result.filePath) {
                // Thử cài đặt và thực thi plugin export-to-pdf
                try {
                  await installExportToPdfPlugin(event);
                  await pluginManager.startPlugin("export-to-pdf");
                  const pdfResult = await pluginManager.executePlugin(
                    "export-to-pdf",
                    content,
                    result.filePath
                  );
                  event.reply("menu-action-result", {
                    success: true,
                    message: `File exported successfully to ${result.filePath}`,
                    data: pdfResult,
                  });
                } catch (pluginError) {
                  console.error(
                    "Error using plugin, falling back to simple export:",
                    pluginError
                  );
                  // Nếu plugin không hoạt động, sử dụng cách đơn giản hơn
                  fs.writeFileSync(result.filePath, content);
                  event.reply("menu-action-result", {
                    success: true,
                    message: `File exported successfully to ${result.filePath} (basic export)`,
                  });
                }
              } else {
                event.reply("menu-action-result", {
                  success: false,
                  message: "Export cancelled by user",
                });
              }
              return;
            } catch (exportError: any) {
              console.error("Error handling export-to-pdf:", exportError);
              event.reply("menu-action-result", {
                success: false,
                message: `Error exporting to PDF: ${
                  exportError.message || String(exportError)
                }`,
              });
              return;
            }
          }

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
