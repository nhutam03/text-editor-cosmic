import fs from "fs";
import path from "path";
import { app } from "electron";
import extractZip from "extract-zip";
import {
  getPluginDownloadUrl,
  getPluginDownloadUrlByName,
} from "../services/firebase";
import { StorageReference } from "firebase/storage";
import { PluginInfo } from "./PluginInterface";
import AdmZip from "adm-zip";

/**
 * Class responsible for installing and managing plugins
 */
export class PluginInstaller {
  private pluginsDir: string;
  private installedPlugins: Map<string, PluginInfo> = new Map();

  constructor() {
    // Create plugins directory in user data folder
    this.pluginsDir = path.join(app.getPath("userData"), "plugins");
    this.ensurePluginsDirectory();
    console.log(`PluginInstaller: Using plugins directory: ${this.pluginsDir}`);
  }

  /**
   * Ensure the plugins directory exists
   */
  private ensurePluginsDirectory(): void {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
    }
  }

  /**
   * Get the path to the plugins directory
   */
  public getPluginsDirectory(): string {
    return this.pluginsDir;
  }

  /**
   * Install a plugin from Firebase Storage
   */
  public async installPlugin(pluginRef: StorageReference): Promise<PluginInfo> {
    try {
      // Get download URL
      const downloadUrl = await getPluginDownloadUrl(pluginRef);

      // Extract plugin name from reference
      const pluginName = pluginRef.name.replace(".zip", "");

      // Download and install the plugin
      return await this.downloadAndInstallPlugin(pluginName, downloadUrl);
    } catch (error) {
      console.error("Error installing plugin:", error);
      throw error;
    }
  }

  /**
   * Install a plugin by name
   */
  public async installPluginByName(pluginName: string): Promise<PluginInfo> {
    try {
      console.log(`Installing plugin by name: ${pluginName}`);

      // Normalize plugin name (remove version suffix if present)
      const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");
      console.log(`Normalized plugin name: ${normalizedName}`);

      // Get download URL
      const downloadUrl = await getPluginDownloadUrlByName(pluginName);
      console.log(`Got download URL for plugin: ${downloadUrl}`);

      // Use the normalized name for installation to avoid directory issues
      const pluginInfo = await this.downloadAndInstallPlugin(
        normalizedName, // Use normalized name for installation
        downloadUrl
      );

      // Update plugin info with normalized name to ensure consistency
      pluginInfo.name = normalizedName;

      // Update extensions.json with the normalized name
      this.updateExtensionsJson(normalizedName, true);

      console.log(`Plugin installed successfully with normalized name: ${normalizedName}`);
      return pluginInfo;
    } catch (error) {
      console.error(`Error installing plugin ${pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Download and install a plugin from a URL - Theo cách của VS Code
   */
  private async downloadAndInstallPlugin(
    pluginName: string,
    downloadUrl: string
  ): Promise<PluginInfo> {
    try {
      console.log(
        `Starting download and installation of plugin ${pluginName} from ${downloadUrl}`
      );

      // 1. Kiểm tra xem plugin đã được cài đặt chưa
      const existingDir = this.findPluginDirectory(pluginName);
      if (existingDir) {
        console.log(
          `Plugin ${pluginName} is already installed at ${existingDir}`
        );

        try {
          // Đọc package.json để lấy thông tin plugin
          const packageJsonPath = path.join(existingDir, "package.json");
          if (fs.existsSync(packageJsonPath)) {
            try {
              const packageJson = JSON.parse(
                fs.readFileSync(packageJsonPath, "utf8")
              );
              return {
                name: packageJson.name || pluginName,
                version: packageJson.version || "1.0.0",
                description: packageJson.description || `Plugin ${pluginName}`,
                author: packageJson.author || "Unknown",
                installed: true,
              };
            } catch (err) {
              console.error(
                `Error reading package.json for existing plugin:`,
                err
              );
            }
          }

          // Trả về thông tin mặc định nếu không đọc được package.json
          return {
            name: pluginName,
            version: "1.0.0",
            description: `Plugin ${pluginName}`,
            author: "Unknown",
            installed: true,
          };
        } catch (existingDirError) {
          console.error(`Error accessing existing plugin directory: ${existingDirError}`);
          // Continue with installation if we can't access the existing directory
          console.log(`Will reinstall plugin ${pluginName}`);
        }
      }

      // 2. Tạo thư mục tạm thời để tải về
      const tempDir = path.join(app.getPath("temp"), "plugin-downloads");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // 3. Tải plugin về
      const zipPath = path.join(tempDir, `${pluginName}.zip`);
      console.log(`Downloading plugin to ${zipPath}`);
      await this.downloadFile(downloadUrl, zipPath);

      // 4. Kiểm tra file zip
      if (!fs.existsSync(zipPath)) {
        throw new Error(
          `Failed to download plugin: ${pluginName}.zip not found`
        );
      }

      const stats = fs.statSync(zipPath);
      if (stats.size === 0) {
        throw new Error(`Downloaded plugin file is empty: ${zipPath}`);
      }

      console.log(`Successfully downloaded plugin (${stats.size} bytes)`);

      // 5. Đọc package.json từ file zip để lấy thông tin plugin
      let zipPackageJson: any = null;
      try {
        zipPackageJson = await this.getPackageJsonFromZip(zipPath);
        console.log(
          `Read package.json from zip: ${JSON.stringify(zipPackageJson)}`
        );
      } catch (zipError) {
        console.error(`Error reading package.json from zip:`, zipError);
        // Continue without package.json from zip
      }

      // 6. Xác định tên thư mục cài đặt - always use the normalized name
      // Chuẩn hóa tên plugin (loại bỏ phiên bản nếu có)
      const normalizedPluginName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");
      const pluginDir = path.join(this.pluginsDir, normalizedPluginName);
      console.log(`Creating plugin directory at ${pluginDir}`);

      // Ensure the plugins directory exists
      this.ensurePluginsDirectory();

      // Remove existing directory if it exists
      if (fs.existsSync(pluginDir)) {
        try {
          console.log(`Removing existing plugin directory: ${pluginDir}`);
          fs.rmSync(pluginDir, { recursive: true, force: true });
        } catch (rmError) {
          console.error(`Error removing existing plugin directory: ${rmError}`);
          // Try to continue anyway
        }
      }

      // Create the plugin directory
      try {
        fs.mkdirSync(pluginDir, { recursive: true });
      } catch (error) {
        const mkdirError = error as Error;
        console.error(`Error creating plugin directory: ${mkdirError}`);
        throw new Error(`Failed to create plugin directory: ${mkdirError.message}`);
      }

      // Extract the zip file
      try {
        console.log(`Extracting plugin to ${pluginDir}`);
        await extractZip(zipPath, { dir: pluginDir });
      } catch (error) {
        const extractError = error as Error;
        console.error(`Error extracting plugin: ${extractError}`);
        throw new Error(`Failed to extract plugin: ${extractError.message}`);
      }

      // List extracted files for debugging
      let extractedFiles: string[] = [];
      try {
        extractedFiles = fs.readdirSync(pluginDir);
        console.log(`Extracted files: ${extractedFiles.join(", ")}`);
      } catch (error) {
        const readDirError = error as Error;
        console.error(`Error reading extracted files: ${readDirError}`);
        throw new Error(`Failed to read extracted files: ${readDirError.message}`);
      }

      // Xử lý cấu trúc thư mục lồng nhau
      // Kiểm tra xem có thư mục con duy nhất chứa tất cả nội dung không
      if (extractedFiles.length === 1) {
        const singleItem = extractedFiles[0];
        const singleItemPath = path.join(pluginDir, singleItem);

        try {
          const stats = fs.statSync(singleItemPath);

          // Nếu đây là thư mục và có tên giống với tên plugin hoặc tên chuẩn hóa
          if (stats.isDirectory() &&
              (singleItem === pluginName ||
               singleItem === normalizedPluginName ||
               singleItem.includes(normalizedPluginName))) {

            console.log(`Found single nested directory: ${singleItem}, flattening structure`);

            // Đọc các file trong thư mục con
            const nestedFiles = fs.readdirSync(singleItemPath);

            // Di chuyển tất cả các file từ thư mục con lên thư mục cha
            for (const file of nestedFiles) {
              const sourcePath = path.join(singleItemPath, file);
              const destPath = path.join(pluginDir, file);

              // Kiểm tra xem đích đến đã tồn tại chưa
              if (fs.existsSync(destPath)) {
                console.log(`Destination path already exists: ${destPath}, removing it`);
                if (fs.statSync(destPath).isDirectory()) {
                  fs.rmSync(destPath, { recursive: true, force: true });
                } else {
                  fs.unlinkSync(destPath);
                }
              }

              // Di chuyển file/thư mục
              try {
                if (fs.statSync(sourcePath).isDirectory()) {
                  fs.cpSync(sourcePath, destPath, { recursive: true });
                  fs.rmSync(sourcePath, { recursive: true, force: true });
                } else {
                  fs.copyFileSync(sourcePath, destPath);
                  fs.unlinkSync(sourcePath);
                }
                console.log(`Moved ${sourcePath} to ${destPath}`);
              } catch (moveError) {
                console.error(`Error moving ${sourcePath} to ${destPath}: ${moveError}`);
                // Tiếp tục với file tiếp theo
              }
            }

            // Xóa thư mục con rỗng
            try {
              fs.rmdirSync(singleItemPath);
              console.log(`Removed empty directory: ${singleItemPath}`);
            } catch (rmdirError) {
              console.error(`Error removing directory: ${rmdirError}`);
            }

            // Cập nhật danh sách file đã giải nén
            extractedFiles = fs.readdirSync(pluginDir);
            console.log(`Updated extracted files after flattening: ${extractedFiles.join(", ")}`);
          }
        } catch (flattenError) {
          console.error(`Error flattening directory structure: ${flattenError}`);
          // Tiếp tục với cấu trúc hiện tại
        }
      }

      // 9. Xóa file zip tạm thời
      try {
        fs.unlinkSync(zipPath);
      } catch (error) {
        console.warn(`Could not delete temporary zip file: ${zipPath}`, error);
        // Continue even if we can't delete the temp file
      }

      // 10. Đọc package.json từ thư mục đã giải nén
      const packageJsonPath = path.join(pluginDir, "package.json");
      console.log(`Looking for package.json at ${packageJsonPath}`);
      let packageJsonFound = false;
      let foundPackageJsonPath = "";

      if (fs.existsSync(packageJsonPath)) {
        packageJsonFound = true;
        foundPackageJsonPath = packageJsonPath;
      } else {
        // Tìm package.json trong các thư mục con
        console.log(
          "package.json not found in root directory, searching subdirectories..."
        );

        try {
          const subdirs = extractedFiles.filter((file) => {
            try {
              return fs.statSync(path.join(pluginDir, file)).isDirectory();
            } catch (statError) {
              console.error(`Error checking if ${file} is a directory: ${statError}`);
              return false;
            }
          });

          // Đặc biệt ưu tiên thư mục có tên giống với tên plugin
          const priorityDirs = subdirs.filter(dir =>
            dir === pluginName ||
            dir === pluginName.replace(/(-\d+\.\d+\.\d+)$/, "") ||
            dir.includes(pluginName.replace(/(-\d+\.\d+\.\d+)$/, ""))
          );

          // Sắp xếp lại danh sách thư mục để ưu tiên các thư mục có tên liên quan đến plugin
          const sortedSubdirs = [...priorityDirs, ...subdirs.filter(dir => !priorityDirs.includes(dir))];

          console.log(`Searching subdirectories in priority order: ${sortedSubdirs.join(', ')}`);

          for (const subdir of sortedSubdirs) {
            const subPackageJsonPath = path.join(
              pluginDir,
              subdir,
              "package.json"
            );
            if (fs.existsSync(subPackageJsonPath)) {
              console.log(`Found package.json in subdirectory: ${subdir}`);
              foundPackageJsonPath = subPackageJsonPath;

              // Đọc nội dung package.json từ thư mục con
              try {
                const packageJsonContent = fs.readFileSync(subPackageJsonPath, "utf8");
                const packageJson = JSON.parse(packageJsonContent);

                // Sao chép package.json lên thư mục gốc
                console.log(`Copying package.json from ${subPackageJsonPath} to ${packageJsonPath}`);
                fs.writeFileSync(packageJsonPath, packageJsonContent);

                // Đánh dấu là đã tìm thấy package.json
                packageJsonFound = true;
              } catch (packageJsonError) {
                console.error(`Error reading or copying package.json from subdirectory: ${packageJsonError}`);
                // Tiếp tục với thư mục con tiếp theo nếu không thể đọc package.json
                continue;
              }

              // Di chuyển tất cả các file từ thư mục con lên thư mục gốc
              const subDirPath = path.join(pluginDir, subdir);

              try {
                const subDirFiles = fs.readdirSync(subDirPath);

                for (const file of subDirFiles) {
                  // Bỏ qua package.json vì đã được sao chép
                  if (file === "package.json") continue;

                  const srcPath = path.join(subDirPath, file);
                  const destPath = path.join(pluginDir, file);

                  try {
                    // Kiểm tra xem đích đến đã tồn tại chưa
                    if (fs.existsSync(destPath)) {
                      console.log(`Destination path already exists: ${destPath}, removing it`);
                      if (fs.statSync(destPath).isDirectory()) {
                        fs.rmSync(destPath, { recursive: true, force: true });
                      } else {
                        fs.unlinkSync(destPath);
                      }
                    }

                    // Di chuyển file/thư mục
                    if (fs.statSync(srcPath).isDirectory()) {
                      fs.cpSync(srcPath, destPath, { recursive: true });
                      fs.rmSync(srcPath, { recursive: true, force: true });
                    } else {
                      fs.copyFileSync(srcPath, destPath);
                      fs.unlinkSync(srcPath);
                    }
                    console.log(`Moved ${srcPath} to ${destPath}`);
                  } catch (copyError) {
                    console.error(`Error moving file ${file}: ${copyError}`);
                    // Continue with next file
                  }
                }

                // Xóa thư mục con rỗng
                try {
                  fs.rmdirSync(subDirPath);
                  console.log(`Removed empty directory: ${subDirPath}`);
                } catch (rmdirError) {
                  console.error(`Error removing directory: ${rmdirError}`);
                }

                break;
              } catch (readSubDirError) {
                console.error(`Error reading subdirectory ${subdir}: ${readSubDirError}`);
                // Continue with next subdirectory
              }
            }
          }
        } catch (subdirError) {
          console.error(`Error processing subdirectories: ${subdirError}`);
          // Continue without package.json
        }
      }

      // If no package.json was found, create a minimal one
      if (!packageJsonFound) {
        console.log(`No package.json found, creating a minimal one for ${pluginName}`);
        const minimalPackageJson = {
          name: pluginName,
          version: "1.0.0",
          description: `Plugin ${pluginName}`,
          main: "index.js",
          author: "Unknown",
        };

        try {
          fs.writeFileSync(
            packageJsonPath,
            JSON.stringify(minimalPackageJson, null, 2)
          );
          packageJsonFound = true;
          foundPackageJsonPath = packageJsonPath;
        } catch (writePackageJsonError) {
          console.error(`Error creating minimal package.json: ${writePackageJsonError}`);
          // Continue without package.json
        }
      }

      // 11. Cập nhật file extensions.json
      this.updateExtensionsJson(pluginName, true);

      // 12. Đọc nội dung package.json
      let extractedPackageJson: any = {
        name: pluginName,
        version: "1.0.0",
        description: `Plugin ${pluginName}`,
        author: "Unknown"
      };

      if (packageJsonFound && foundPackageJsonPath) {
        try {
          extractedPackageJson = JSON.parse(
            fs.readFileSync(foundPackageJsonPath, "utf-8")
          );
          console.log(
            `Package.json content: ${JSON.stringify(extractedPackageJson, null, 2)}`
          );

          // Đảm bảo package.json ở thư mục gốc
          if (foundPackageJsonPath !== packageJsonPath) {
            console.log(`Copying package.json from ${foundPackageJsonPath} to ${packageJsonPath}`);
            fs.copyFileSync(foundPackageJsonPath, packageJsonPath);
          }
        } catch (readPackageJsonError) {
          console.error(`Error reading package.json: ${readPackageJsonError}`);
          // Continue with default package.json
        }
      }

      // 13. Cài đặt các dependencies nếu cần
      if (
        extractedPackageJson.dependencies &&
        Object.keys(extractedPackageJson.dependencies).length > 0
      ) {
        console.log(`Installing dependencies for plugin ${pluginName}`);
        try {
          // Tạo package.json tối thiểu chỉ với các dependencies cần thiết
          const minimalPackageJson: {
            name: string;
            version: string;
            description: string;
            main: string;
            scripts?: { [key: string]: string };
            dependencies: { [key: string]: string };
          } = {
            name: extractedPackageJson.name || pluginName,
            version: extractedPackageJson.version || "1.0.0",
            description:
              extractedPackageJson.description || "Plugin for text editor",
            main: extractedPackageJson.main || "index.js",
            dependencies: {},
          };

          // Giữ lại scripts nếu có
          if (extractedPackageJson.scripts) {
            minimalPackageJson.scripts = extractedPackageJson.scripts;
          }

          // Chỉ bao gồm các dependencies cần thiết
          const essentialDeps = ["pdfmake", "pdfkit", "tar", "7zip-bin"];
          for (const dep of essentialDeps) {
            if (
              extractedPackageJson.dependencies &&
              extractedPackageJson.dependencies[dep]
            ) {
              minimalPackageJson.dependencies[dep] =
                extractedPackageJson.dependencies[dep];
            }
          }

          // Nếu là code-runner plugin, đảm bảo có tar và 7zip-bin
          if (extractedPackageJson.name === "code-runner") {
            if (
              extractedPackageJson.dependencies &&
              extractedPackageJson.dependencies["tar"]
            ) {
              minimalPackageJson.dependencies["tar"] =
                extractedPackageJson.dependencies["tar"];
            } else {
              minimalPackageJson.dependencies["tar"] = "^6.1.15";
            }

            if (
              extractedPackageJson.dependencies &&
              extractedPackageJson.dependencies["7zip-bin"]
            ) {
              minimalPackageJson.dependencies["7zip-bin"] =
                extractedPackageJson.dependencies["7zip-bin"];
            } else {
              minimalPackageJson.dependencies["7zip-bin"] = "^5.1.1";
            }
          }

          // Bỏ qua dependency electron vì nó đã có trong ứng dụng chính
          console.log(
            `Using minimal dependencies: ${JSON.stringify(
              minimalPackageJson.dependencies
            )}`
          );

          // Ghi file package.json tối thiểu
          fs.writeFileSync(
            path.join(pluginDir, "package.json"),
            JSON.stringify(minimalPackageJson, null, 2)
          );

          // Cài đặt dependencies
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
          // Tiếp tục ngay cả khi npm install thất bại
        }
      } else {
        console.log("No dependencies to install");
      }

      // 14. Tạo thông tin plugin
      const pluginInfo: PluginInfo = {
        name: extractedPackageJson.name || pluginName,
        version: extractedPackageJson.version || "1.0.0",
        description:
          extractedPackageJson.description || "No description provided",
        author: extractedPackageJson.author || "Unknown",
        installed: true,
      };

      console.log(`Plugin info: ${JSON.stringify(pluginInfo)}`);

      // 15. Lưu thông tin plugin
      this.installedPlugins.set(pluginInfo.name, pluginInfo);

      // 16. Cập nhật file extensions.json
      this.updateExtensionsJson(pluginInfo.name, true);

      return pluginInfo;
    } catch (error) {
      console.error(
        `Error downloading and installing plugin ${pluginName}:`,
        error
      );

      // Clean up any partial installation
      try {
        const pluginDir = path.join(this.pluginsDir, pluginName);
        if (fs.existsSync(pluginDir)) {
          console.log(`Cleaning up failed installation: ${pluginDir}`);
          fs.rmSync(pluginDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.error(`Error cleaning up failed installation: ${cleanupError}`);
      }

      throw error;
    }
  }

  /**
   * Download a file from a URL
   */
  private async downloadFile(url: string, destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Downloading file from ${url} to ${destination}`);

      // Validate URL protocol
      if (!url.startsWith('http:') && !url.startsWith('https:')) {
        console.error(`Unsupported protocol in URL: ${url}`);
        reject(new Error(`Protocol not supported. Expected "http:" or "https:", got: ${url.split(':')[0]}`));
        return;
      }

      // Determine protocol (http or https)
      const protocol = url.startsWith("https:")
        ? require("https")
        : require("http");

      // Create write stream
      let file: fs.WriteStream;
      try {
        // Ensure the directory exists
        const destDir = path.dirname(destination);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        file = fs.createWriteStream(destination);
      } catch (error) {
        console.error(`Error creating write stream: ${error}`);
        reject(error);
        return;
      }

      // Create request with proper error handling
      const request = protocol.get(url, (response: any) => {
        // Log response details for debugging
        console.log(`Download response status: ${response.statusCode}`);
        console.log(`Response headers: ${JSON.stringify(response.headers)}`);

        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          console.log(`Following redirect to: ${response.headers.location}`);
          file.close();
          if (fs.existsSync(destination)) {
            fs.unlinkSync(destination);
          }

          // Use a fallback URL if the redirect fails
          if (!response.headers.location) {
            console.error('Redirect without location header');

            // Tạo URL động dựa trên tên plugin và bucket
            const pluginName = path.basename(destination, '.zip');
            let fallbackUrl = '';

            try {
              const { firebaseConfig } = require('../services/firebase-config');
              const bucket = firebaseConfig.storageBucket;

              // Xác định tên file dựa trên loại plugin
              let fileName = '';
              if (pluginName.includes('prettier')) {
                fileName = 'prettier-plugin-1.0.0.zip';
              } else if (pluginName.includes('ai-assistant')) {
                fileName = 'ai-assistant-1.0.0.zip';
              } else if (pluginName.includes('code-runner')) {
                fileName = 'code-runner.zip';
              } else if (pluginName.includes('AutoSave')) {
                fileName = 'AutoSave_Plugin.zip';
              } else {
                // Sử dụng tên plugin với phiên bản mặc định
                fileName = `${pluginName}-1.0.0.zip`;
              }

              // Tạo URL
              const encodedPluginName = encodeURIComponent(`plugins/${fileName}`);
              fallbackUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPluginName}?alt=media`;

              console.log(`Tạo URL động cho plugin ${pluginName}: ${fallbackUrl}`);
            } catch (error) {
              console.error(`Lỗi tạo URL động: ${error}`);
              // Tạo URL với bucket mặc định
              const mockBucket = 'cosmic-text-editor.appspot.com';
              const encodedPluginName = encodeURIComponent(`plugins/${pluginName}-1.0.0.zip`);
              fallbackUrl = `https://firebasestorage.googleapis.com/v0/b/${mockBucket}/o/${encodedPluginName}?alt=media`;
              console.log(`Sử dụng URL mặc định: ${fallbackUrl}`);
            }

            console.log(`Using fallback URL: ${fallbackUrl}`);

            // Retry with the fallback URL
            this.downloadFile(fallbackUrl, destination)
              .then(resolve)
              .catch(reject);
            return;
          }

          this.downloadFile(response.headers.location, destination)
            .then(resolve)
            .catch(reject);
          return;
        }

        // Check for successful response
        if (response.statusCode !== 200) {
          file.close();
          if (fs.existsSync(destination)) {
            fs.unlinkSync(destination);
          }

          // Try a fallback URL for common plugins
          const pluginName = path.basename(destination, '.zip');
          console.log(`Download failed with status ${response.statusCode}, trying fallback for ${pluginName}`);

          // Tạo URL động dựa trên tên plugin và bucket
          let fallbackUrl = '';

          try {
            const { firebaseConfig } = require('../services/firebase-config');
            const bucket = firebaseConfig.storageBucket;

            // Xác định tên file dựa trên loại plugin
            let fileName = '';
            if (pluginName.includes('prettier')) {
              fileName = 'prettier-plugin-1.0.0.zip';
            } else if (pluginName.includes('ai-assistant')) {
              fileName = 'ai-assistant-1.0.0.zip';
            } else if (pluginName.includes('code-runner')) {
              fileName = 'code-runner.zip';
            } else if (pluginName.includes('AutoSave')) {
              fileName = 'AutoSave_Plugin.zip';
            } else {
              // Nếu không có fallback cụ thể, reject với lỗi gốc
              reject(
                new Error(
                  `Failed to download file: Server returned status code ${response.statusCode}`
                )
              );
              return;
            }

            // Tạo URL
            const encodedPluginName = encodeURIComponent(`plugins/${fileName}`);
            fallbackUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPluginName}?alt=media`;

            console.log(`Tạo URL động cho plugin ${pluginName}: ${fallbackUrl}`);
          } catch (error) {
            console.error(`Lỗi tạo URL động: ${error}`);
            // Reject với lỗi gốc
            reject(
              new Error(
                `Failed to download file: Server returned status code ${response.statusCode}`
              )
            );
            return;
          }

          console.log(`Using fallback URL: ${fallbackUrl}`);
          this.downloadFile(fallbackUrl, destination)
            .then(resolve)
            .catch(reject);
          return;
        }

        // Pipe the response to the file
        response.pipe(file);

        // Handle file events
        file.on("finish", () => {
          file.close();

          // Verify the downloaded file
          try {
            const stats = fs.statSync(destination);
            console.log(`Download completed: ${destination} (${stats.size} bytes)`);

            if (stats.size === 0) {
              console.error('Downloaded file is empty');
              fs.unlinkSync(destination);
              reject(new Error('Downloaded file is empty'));
              return;
            }

            resolve();
          } catch (error) {
            console.error(`Error verifying downloaded file: ${error}`);
            reject(error);
          }
        });

        file.on("error", (err: Error) => {
          console.error(`Error writing to file: ${err.message}`);
          file.close();
          if (fs.existsSync(destination)) {
            fs.unlinkSync(destination);
          }
          reject(err);
        });
      });

      // Handle request errors
      request.on("error", (err: Error) => {
        console.error(`Error downloading file: ${err.message}`);
        file.close();
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }

        // Try a fallback URL for common plugins
        const pluginName = path.basename(destination, '.zip');
        console.log(`Download error, trying fallback for ${pluginName}`);

        // Tạo URL động dựa trên tên plugin và bucket
        let fallbackUrl = '';

        try {
          const { firebaseConfig } = require('../services/firebase-config');
          const bucket = firebaseConfig.storageBucket;

          // Xác định tên file dựa trên loại plugin
          let fileName = '';
          if (pluginName.includes('prettier')) {
            fileName = 'prettier-plugin-1.0.0.zip';
          } else if (pluginName.includes('ai-assistant')) {
            fileName = 'ai-assistant-1.0.0.zip';
          } else if (pluginName.includes('code-runner')) {
            fileName = 'code-runner.zip';
          } else if (pluginName.includes('AutoSave')) {
            fileName = 'AutoSave_Plugin.zip';
          } else {
            // Nếu không có fallback cụ thể, reject với lỗi gốc
            reject(err);
            return;
          }

          // Tạo URL
          const encodedPluginName = encodeURIComponent(`plugins/${fileName}`);
          fallbackUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPluginName}?alt=media`;

          console.log(`Tạo URL động cho plugin ${pluginName}: ${fallbackUrl}`);
        } catch (error) {
          console.error(`Lỗi tạo URL động: ${error}`);
          // Reject với lỗi gốc
          reject(err);
          return;
        }

        console.log(`Using fallback URL: ${fallbackUrl}`);
        this.downloadFile(fallbackUrl, destination)
          .then(resolve)
          .catch(reject);
      });

      // Set timeout - tăng thời gian timeout lên 120 giây
      request.setTimeout(120000, () => {
        console.error('Download timed out after 120 seconds');
        request.abort();
        file.close();
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }

        // Try a fallback URL for common plugins
        const pluginName = path.basename(destination, '.zip');
        console.log(`Download timeout, trying fallback for ${pluginName}`);

        // Sử dụng URL cục bộ nếu có thể
        const localPluginPath = path.join(process.cwd(), 'plugins', `${pluginName}.zip`);
        if (fs.existsSync(localPluginPath)) {
          console.log(`Found local plugin at ${localPluginPath}, using it instead`);
          try {
            fs.copyFileSync(localPluginPath, destination);
            resolve();
            return;
          } catch (copyError) {
            console.error(`Error copying local plugin: ${copyError}`);
            // Tiếp tục với URL dự phòng
          }
        }

        // Tạo URL dự phòng dựa trên tên plugin và bucket
        try {
          const { firebaseConfig } = require('../services/firebase-config');
          const bucket = firebaseConfig.storageBucket;

          // Xác định tên file dựa trên loại plugin
          let fileName = '';
          if (pluginName.includes('prettier')) {
            fileName = 'prettier-plugin-1.0.0.zip';
          } else if (pluginName.includes('ai-assistant')) {
            fileName = 'ai-assistant-1.0.0.zip';
          } else if (pluginName.includes('code-runner')) {
            fileName = 'code-runner.zip';
          } else if (pluginName.includes('AutoSave')) {
            fileName = 'AutoSave_Plugin.zip';
          } else {
            fileName = `${pluginName}.zip`;
          }

          const encodedPluginName = encodeURIComponent(`plugins/${fileName}`);
          const fallbackUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPluginName}?alt=media`;

          console.log(`Using dynamically constructed fallback URL: ${fallbackUrl}`);

          this.downloadFile(fallbackUrl, destination)
            .then(resolve)
            .catch((error) => {
              console.error(`Error with fallback URL: ${error}`);
              reject(error);
            });
          return;
        } catch (error) {
          console.error(`Error creating fallback URL: ${error}`);
          reject(error);
        }
      });
    });
  }

  /**
   * Uninstall a plugin - Đơn giản hóa tối đa
   */
  public uninstallPlugin(pluginName: string): boolean {
    if (!pluginName) {
      console.error(`PluginInstaller: Invalid plugin name: ${pluginName}`);
      return true; // Vẫn trả về true để tránh lỗi UI
    }

    console.log(`PluginInstaller: Uninstalling plugin: ${pluginName}`);

    try {
      // 1. Chuẩn hóa tên plugin
      const normalizedName = String(pluginName).replace(
        /(-\d+\.\d+\.\d+)$/,
        ""
      );
      console.log(`PluginInstaller: Normalized name: ${normalizedName}`);

      // 2. Tìm tất cả các thư mục liên quan
      const dirsToRemove: string[] = [];

      // Kiểm tra thư mục với tên chính xác
      const exactDir = path.join(this.pluginsDir, pluginName);
      if (fs.existsSync(exactDir)) {
        dirsToRemove.push(exactDir);
      }

      // Kiểm tra thư mục với tên chuẩn hóa
      const normalizedDir = path.join(this.pluginsDir, normalizedName);
      if (fs.existsSync(normalizedDir) && normalizedDir !== exactDir) {
        dirsToRemove.push(normalizedDir);
      }

      // Tìm các thư mục có phiên bản
      try {
        const allDirs = fs
          .readdirSync(this.pluginsDir, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name);

        for (const dir of allDirs) {
          if (dir.startsWith(normalizedName + "-")) {
            const versionedDir = path.join(this.pluginsDir, dir);
            if (!dirsToRemove.includes(versionedDir)) {
              dirsToRemove.push(versionedDir);
            }
          }
        }
      } catch (error) {
        console.error(
          `PluginInstaller: Error reading plugins directory:`,
          error
        );
      }

      console.log(
        `PluginInstaller: Directories to remove: ${dirsToRemove.join(", ")}`
      );

      // 3. Xóa tất cả các thư mục liên quan
      for (const dir of dirsToRemove) {
        try {
          console.log(`PluginInstaller: Removing directory: ${dir}`);
          fs.rmSync(dir, { recursive: true, force: true });

          // Xóa khỏi danh sách plugin đã cài đặt
          const dirName = path.basename(dir);
          this.installedPlugins.delete(dirName);
        } catch (error) {
          console.error(
            `PluginInstaller: Error removing directory ${dir}:`,
            error
          );
          // Tiếp tục với các thư mục khác
        }
      }

      // 4. Cập nhật file extensions.json
      try {
        this.updateExtensionsJson(pluginName, false);
        this.updateExtensionsJson(normalizedName, false);
      } catch (error) {
        console.error(
          `PluginInstaller: Error updating extensions.json:`,
          error
        );
      }

      // 5. Cập nhật danh sách plugin đã cài đặt
      this.refreshInstalledPlugins();

      return true; // Luôn trả về true để tránh lỗi UI
    } catch (error) {
      console.error(
        `PluginInstaller: Error uninstalling plugin ${pluginName}:`,
        error
      );
      return true; // Luôn trả về true để tránh lỗi UI
    }
  }

  /**
   * Tìm thư mục plugin dựa trên tên plugin
   */
  public findPluginDirectory(pluginName: string): string | null {
    try {
      // Normalize plugin name (remove version suffix if present)
      const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");

      // Kiểm tra trực tiếp với tên plugin
      const exactDir = path.join(this.pluginsDir, pluginName);
      if (fs.existsSync(exactDir)) {
        return exactDir;
      }

      // Kiểm tra với tên chuẩn hóa
      const normalizedDir = path.join(this.pluginsDir, normalizedName);
      if (fs.existsSync(normalizedDir)) {
        return normalizedDir;
      }

      // Tìm kiếm trong tất cả các thư mục
      const allDirs = fs
        .readdirSync(this.pluginsDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      // Tìm thư mục phù hợp nhất
      for (const dir of allDirs) {
        // Kiểm tra thư mục có phiên bản
        if (dir.startsWith(normalizedName + "-")) {
          return path.join(this.pluginsDir, dir);
        }

        // Kiểm tra package.json để xác định tên plugin
        try {
          const packageJsonPath = path.join(
            this.pluginsDir,
            dir,
            "package.json"
          );
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(
              fs.readFileSync(packageJsonPath, "utf8")
            );
            if (
              packageJson.name === pluginName ||
              packageJson.name === normalizedName
            ) {
              return path.join(this.pluginsDir, dir);
            }
          }
        } catch (err) {
          // Bỏ qua lỗi và tiếp tục kiểm tra
        }
      }

      return null; // Không tìm thấy thư mục plugin
    } catch (error) {
      console.error(`Error finding plugin directory for ${pluginName}:`, error);
      return null;
    }
  }

  /**
   * Cập nhật file extensions.json (giống VS Code)
   */
  private updateExtensionsJson(pluginName: string, isInstalled: boolean): void {
    try {
      const extensionsJsonPath = path.join(
        this.pluginsDir,
        "..",
        "extensions.json"
      );
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
      if (isInstalled) {
        // Thêm plugin vào danh sách đã cài đặt
        extensions[pluginName] = {
          enabled: true,
          installedTimestamp: Date.now(),
        };
      } else {
        // Xóa plugin khỏi danh sách đã cài đặt
        if (extensions[pluginName]) {
          delete extensions[pluginName];
        }
      }

      // Ghi file extensions.json
      fs.writeFileSync(
        extensionsJsonPath,
        JSON.stringify(extensions, null, 2),
        "utf8"
      );
      console.log(
        `Updated extensions.json for plugin ${pluginName}, installed: ${isInstalled}`
      );
    } catch (error) {
      console.error(
        `Error updating extensions.json for plugin ${pluginName}:`,
        error
      );
    }
  }





  /**
   * Get a list of installed plugins - Cải tiến để đảm bảo trả về danh sách đầy đủ và tránh trùng lặp
   */
  public getInstalledPlugins(): PluginInfo[] {
    console.log('PluginInstaller: Getting installed plugins');

    // Refresh the list of installed plugins
    this.refreshInstalledPlugins();

    // Tránh trùng lặp plugin names bằng cách sử dụng Map với tên plugin làm key
    const uniquePlugins = new Map<string, PluginInfo>();

    for (const [key, plugin] of this.installedPlugins.entries()) {
      // Đảm bảo plugin có tên hợp lệ
      if (!plugin.name) {
        console.warn('PluginInstaller: Found plugin without name, skipping');
        continue;
      }

      // Đảm bảo plugin được đánh dấu là đã cài đặt
      plugin.installed = true;

      // Sử dụng tên plugin từ package.json làm key để tránh trùng lặp
      const pluginKey = plugin.name;

      // Chỉ thêm plugin nếu chưa có hoặc plugin hiện tại có thông tin đầy đủ hơn
      if (!uniquePlugins.has(pluginKey) ||
          (uniquePlugins.get(pluginKey)?.description === `Plugin ${pluginKey}` &&
           plugin.description !== `Plugin ${pluginKey}`)) {
        uniquePlugins.set(pluginKey, plugin);
      }
    }

    const plugins = Array.from(uniquePlugins.values());
    console.log(
      "getInstalledPlugins returning:",
      plugins.map((p) => `${p.name} (installed: ${p.installed})`)
    );
    return plugins;
  }

  /**
   * Check if a plugin is installed - Cải tiến để kiểm tra chính xác hơn
   */
  public isPluginInstalled(pluginName: string): boolean {
    if (!pluginName) {
      console.warn('PluginInstaller: isPluginInstalled called with empty plugin name');
      return false;
    }

    console.log(`PluginInstaller: Checking if plugin is installed: ${pluginName}`);

    // Normalize plugin name (remove version suffix if present)
    const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');
    console.log(`PluginInstaller: Normalized name: ${normalizedName}`);

    // Refresh the list of installed plugins
    this.refreshInstalledPlugins();

    // Check if either the original name or normalized name is installed
    return (
      this.installedPlugins.has(pluginName) ||
      this.installedPlugins.has(normalizedName)
    );
  }

  /**
   * Refresh the list of installed plugins - Cải tiến để xử lý lỗi tốt hơn
   */
  private refreshInstalledPlugins(): void {
    try {
      console.log(`PluginInstaller: Refreshing installed plugins list`);

      // Clear the current list
      this.installedPlugins.clear();

      // Ensure the plugins directory exists
      this.ensurePluginsDirectory();

      // Read all plugin directories
      let pluginDirs: string[] = [];
      try {
        pluginDirs = fs
          .readdirSync(this.pluginsDir, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name);

        console.log(`Found plugin directories: ${pluginDirs.join(", ")}`);
      } catch (error) {
        console.error(`Error reading plugin directories: ${error}`);
        // Return early if we can't read the plugins directory
        return;
      }

      // Process each plugin directory with improved error handling
      for (const pluginDir of pluginDirs) {
        try {
          const pluginDirPath = path.join(this.pluginsDir, pluginDir);

          // Skip if we can't access the directory
          if (!fs.existsSync(pluginDirPath)) {
            console.log(`Plugin directory does not exist or is inaccessible: ${pluginDirPath}`);
            continue;
          }

          const packageJsonPath = path.join(pluginDirPath, "package.json");
          console.log(`Checking for package.json at: ${packageJsonPath}`);

          if (fs.existsSync(packageJsonPath)) {
            // Process package.json in the root directory
            this.processPackageJson(packageJsonPath, pluginDir);
          } else {
            console.log(
              `No package.json found in root directory, searching subdirectories...`
            );

            // Check for subdirectories that might contain the plugin
            try {
              // Get subdirectories with error handling
              let subdirs: string[] = [];
              try {
                subdirs = fs.readdirSync(pluginDirPath).filter((file) => {
                  try {
                    const filePath = path.join(pluginDirPath, file);
                    return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
                  } catch (statError) {
                    console.error(`Error checking if ${file} is a directory: ${statError}`);
                    return false;
                  }
                });
              } catch (readdirError) {
                console.error(`Error reading subdirectories of ${pluginDir}: ${readdirError}`);
                // Continue with next plugin directory
                continue;
              }

              // Normalize plugin name (remove version suffix if present)
              const normalizedDirName = pluginDir.replace(
                /(-\d+\.\d+\.\d+)$/,
                ""
              );

              // First, look for a subdirectory with the same name as the plugin
              const pluginNameSubdir = subdirs.find(
                (dir) => dir === normalizedDirName || dir === pluginDir
              );
              const subdirsToCheck = pluginNameSubdir
                ? [
                    pluginNameSubdir,
                    ...subdirs.filter((dir) => dir !== pluginNameSubdir),
                  ]
                : subdirs;

              let foundInSubdir = false;

              for (const subdir of subdirsToCheck) {
                try {
                  const subdirPath = path.join(pluginDirPath, subdir);

                  // Skip if we can't access the subdirectory
                  if (!fs.existsSync(subdirPath)) {
                    console.log(`Subdirectory does not exist or is inaccessible: ${subdirPath}`);
                    continue;
                  }

                  const subPackageJsonPath = path.join(subdirPath, "package.json");

                  if (fs.existsSync(subPackageJsonPath)) {
                    console.log(`PluginInstaller: Found package.json in subdirectory: ${subdir}`);
                    foundInSubdir = true;

                    // Process package.json in the subdirectory
                    this.processPackageJson(subPackageJsonPath, pluginDir, subdir);
                    break; // Process only the first valid package.json found
                  }
                } catch (subdirError) {
                  console.error(`PluginInstaller: Error processing subdirectory ${subdir}:`, subdirError);
                  continue;
                }
              }

              if (!foundInSubdir) {
                console.log(
                  `No package.json found in any subdirectory of ${pluginDir}`
                );

                // Create a default plugin info for directories without package.json
                const pluginInfo: PluginInfo = {
                  name: pluginDir,
                  version: "1.0.0",
                  description: `Plugin ${pluginDir}`,
                  author: "Unknown",
                  installed: true,
                };

                // Register the plugin with the directory name
                this.installedPlugins.set(pluginDir, pluginInfo);

                // Also register with normalized name if different
                const normalizedName = pluginDir.replace(/(-\d+\.\d+\.\d+)$/, "");
                if (normalizedName !== pluginDir) {
                  this.installedPlugins.set(normalizedName, pluginInfo);
                }
              }
            } catch (error) {
              console.error(
                `Error searching subdirectories of ${pluginDir}:`,
                error
              );

              // Create a default plugin info even if there was an error
              const pluginInfo: PluginInfo = {
                name: pluginDir,
                version: "1.0.0",
                description: `Plugin ${pluginDir}`,
                author: "Unknown",
                installed: true,
              };

              // Register the plugin with the directory name
              this.installedPlugins.set(pluginDir, pluginInfo);
            }
          }
        } catch (pluginDirError) {
          console.error(`Error processing plugin directory ${pluginDir}:`, pluginDirError);
          // Continue with next plugin directory
        }
      }

      // Special handling for prettier-plugin
      if (pluginDirs.some(dir => dir.includes('prettier'))) {
        console.log('PluginInstaller: Ensuring prettier-plugin is registered');

        // If we have a prettier plugin directory but it's not registered, create a default entry
        if (!this.installedPlugins.has('prettier-plugin')) {
          const prettierDir = pluginDirs.find(dir => dir.includes('prettier'));
          if (prettierDir) {
            const pluginInfo: PluginInfo = {
              name: 'prettier-plugin',
              version: "1.0.0",
              description: "Code formatting plugin using Prettier",
              author: "Text Editor Team",
              installed: true,
            };
            this.installedPlugins.set('prettier-plugin', pluginInfo);
          }
        }
      }

      console.log(
        `Refreshed installed plugins: ${Array.from(
          this.installedPlugins.keys()
        ).join(", ")}`
      );
    } catch (error) {
      console.error("Error refreshing installed plugins:", error);
    }
  }

  /**
   * Process a package.json file and register the plugin - Cải tiến với xử lý lỗi tốt hơn
   */
  private processPackageJson(
    packageJsonPath: string,
    pluginDir: string,
    subdir?: string
  ): void {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      console.log(
        `Found package.json for plugin ${
          subdir ? `${pluginDir}/${subdir}` : pluginDir
        }: ${JSON.stringify(packageJson, null, 2)}`
      );

      // Normalize plugin name (remove version suffix if present)
      let pluginName = packageJson.name || pluginDir;
      const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");

      // If the directory name has version but the package.json name doesn't, use the normalized name
      if (
        pluginDir.includes(normalizedName) &&
        pluginDir !== normalizedName &&
        !pluginName.includes("-")
      ) {
        pluginName = normalizedName;
      }

      console.log(
        `Using plugin name: ${pluginName} (normalized from ${
          packageJson.name || pluginDir
        })`
      );

      // Tạo thông tin plugin
      const pluginInfo: PluginInfo = {
        name: pluginName,
        version: packageJson.version || "1.0.0",
        description: packageJson.description || "No description provided",
        author: packageJson.author || "Unknown",
        installed: true,
      };

      // Đăng ký plugin với tên từ package.json
      console.log(`PluginInstaller: Registering plugin with name from package.json: ${pluginInfo.name}`);
      this.installedPlugins.set(pluginInfo.name, pluginInfo);

      // Đăng ký plugin với tên thư mục nếu khác
      if (pluginDir !== pluginInfo.name) {
        console.log(
          `Also registering plugin with directory name: ${pluginDir}`
        );
        this.installedPlugins.set(pluginDir, pluginInfo);
      }

      // Đăng ký plugin với tên chuẩn hóa nếu khác
      if (normalizedName !== pluginInfo.name && normalizedName !== pluginDir) {
        console.log(`PluginInstaller: Also registering plugin with normalized name: ${normalizedName}`);
        this.installedPlugins.set(normalizedName, pluginInfo);
      }

      // Đặc biệt xử lý cho plugin prettier
      if (pluginInfo.name.includes('prettier') || pluginDir.includes('prettier') ||
          (packageJson.keywords && packageJson.keywords.includes('prettier'))) {
        console.log(`PluginInstaller: Detected prettier plugin, ensuring it's registered as 'prettier-plugin'`);
        this.installedPlugins.set('prettier-plugin', pluginInfo);
      }
    } catch (error) {
      console.error(
        `Error processing package.json at ${packageJsonPath}:`,
        error
      );
    }
  }

  /**
   * Get the main script path for a plugin
   */
  public getPluginMainPath(pluginName: string): string | null {
    try {
      console.log(`Finding main script for plugin: ${pluginName}`);

      // Normalize plugin name (remove version suffix if present)
      const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, "");
      console.log(`Normalized plugin name: ${normalizedName}`);

      // Đặc biệt xử lý cho plugin ai-assistant
      if (pluginName === 'ai-assistant' || normalizedName === 'ai-assistant') {
        return this.findAIAssistantMainScript();
      }

      // Try both the original name and normalized name
      const pluginDirs = [
        path.join(this.pluginsDir, pluginName),
        path.join(this.pluginsDir, normalizedName),
      ];

      // Try each plugin directory
      for (const pluginDir of pluginDirs) {
        console.log(`Checking plugin directory: ${pluginDir}`);

        if (!fs.existsSync(pluginDir)) {
          console.log(`Plugin directory does not exist: ${pluginDir}`);
          continue; // Try next directory
        }

        // First check for package.json in the root directory
        const packageJsonPath = path.join(pluginDir, "package.json");
        console.log(`Looking for package.json at: ${packageJsonPath}`);

        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, "utf-8")
          );
          console.log(
            `Package.json found with content: ${JSON.stringify(
              packageJson,
              null,
              2
            )}`
          );

          // Get main script path from package.json
          const mainScript = packageJson.main || "index.js";
          console.log(`Main script from package.json: ${mainScript}`);

          // Try multiple possible locations for the main script
          const possiblePaths = [
            path.join(pluginDir, mainScript),
            path.join(pluginDir, "dist", mainScript),
            path.join(pluginDir, "dist", "index.js"),
            path.join(pluginDir, "src", mainScript),
            path.join(pluginDir, "lib", mainScript),
            path.join(pluginDir, "build", mainScript),
            path.join(pluginDir, "index.js"),
          ];

          for (const mainPath of possiblePaths) {
            console.log(`Checking for main script at: ${mainPath}`);
            if (fs.existsSync(mainPath)) {
              console.log(`Found main script at: ${mainPath}`);
              return mainPath;
            }
          }

          // If we still haven't found the main script, search for any .js file
          console.log(
            "Main script not found in expected locations, searching for any .js file..."
          );
          const findJsFiles = (dir: string): string[] => {
            const results: string[] = [];
            const files = fs.readdirSync(dir);

            for (const file of files) {
              const filePath = path.join(dir, file);
              const stat = fs.statSync(filePath);

              if (stat.isDirectory()) {
                results.push(...findJsFiles(filePath));
              } else if (file.endsWith(".js")) {
                results.push(filePath);
              }
            }

            return results;
          };

          const jsFiles = findJsFiles(pluginDir);
          console.log(`Found ${jsFiles.length} .js files in plugin directory`);

          if (jsFiles.length > 0) {
            // Prioritize files with names like 'index.js', 'main.js', or matching the plugin name
            const priorityFiles = jsFiles.filter((file) => {
              const fileName = path.basename(file);
              return (
                fileName === "index.js" ||
                fileName === "main.js" ||
                fileName === `${normalizedName}.js`
              );
            });

            if (priorityFiles.length > 0) {
              console.log(
                `Using priority file as main script: ${priorityFiles[0]}`
              );
              return priorityFiles[0];
            }

            console.log(
              `Using first found .js file as main script: ${jsFiles[0]}`
            );
            return jsFiles[0];
          }
        } else {
          console.log(
            `Package.json not found in root directory, searching subdirectories...`
          );

          // Check for subdirectories that might contain the plugin
          const subdirs = fs.readdirSync(pluginDir).filter((file) => {
            const filePath = path.join(pluginDir, file);
            return fs.statSync(filePath).isDirectory();
          });

          // First, look for a subdirectory with the same name as the plugin
          const pluginNameSubdir = subdirs.find(
            (dir) => dir === normalizedName || dir === pluginName
          );
          const subdirsToCheck = pluginNameSubdir
            ? [
                pluginNameSubdir,
                ...subdirs.filter((dir) => dir !== pluginNameSubdir),
              ]
            : subdirs;

          for (const subdir of subdirsToCheck) {
            const subdirPath = path.join(pluginDir, subdir);
            console.log(`Checking subdirectory: ${subdirPath}`);

            const subPackageJsonPath = path.join(subdirPath, "package.json");
            if (fs.existsSync(subPackageJsonPath)) {
              console.log(`Found package.json in subdirectory: ${subdir}`);

              try {
                const packageJson = JSON.parse(
                  fs.readFileSync(subPackageJsonPath, "utf-8")
                );
                console.log(
                  `Subdirectory package.json content: ${JSON.stringify(
                    packageJson,
                    null,
                    2
                  )}`
                );

                // Get main script path from package.json
                const mainScript = packageJson.main || "index.js";
                console.log(
                  `Main script from subdirectory package.json: ${mainScript}`
                );

                // Check if the main script exists in the subdirectory
                const mainPath = path.join(subdirPath, mainScript);
                if (fs.existsSync(mainPath)) {
                  console.log(
                    `Found main script in subdirectory at: ${mainPath}`
                  );
                  return mainPath;
                }

                // Try index.js in the subdirectory
                const indexPath = path.join(subdirPath, "index.js");
                if (fs.existsSync(indexPath)) {
                  console.log(
                    `Found index.js in subdirectory at: ${indexPath}`
                  );
                  return indexPath;
                }

                // Search for any .js file in the subdirectory
                const findJsFiles = (dir: string): string[] => {
                  const results: string[] = [];
                  const files = fs.readdirSync(dir);

                  for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stat = fs.statSync(filePath);

                    if (stat.isDirectory()) {
                      results.push(...findJsFiles(filePath));
                    } else if (file.endsWith(".js")) {
                      results.push(filePath);
                    }
                  }

                  return results;
                };

                const jsFiles = findJsFiles(subdirPath);
                if (jsFiles.length > 0) {
                  // Prioritize files with names like 'index.js', 'main.js', or matching the plugin name
                  const priorityFiles = jsFiles.filter((file) => {
                    const fileName = path.basename(file);
                    return (
                      fileName === "index.js" ||
                      fileName === "main.js" ||
                      fileName === `${normalizedName}.js`
                    );
                  });

                  if (priorityFiles.length > 0) {
                    console.log(
                      `Using priority file from subdirectory as main script: ${priorityFiles[0]}`
                    );
                    return priorityFiles[0];
                  }

                  console.log(
                    `Using first found .js file from subdirectory as main script: ${jsFiles[0]}`
                  );
                  return jsFiles[0];
                }
              } catch (error) {
                console.error(
                  `Error processing package.json in subdirectory ${subdir}:`,
                  error
                );
              }
            }
          }
        }
      }

      console.error(`No main script found for plugin: ${pluginName}`);
      return null;
    } catch (error) {
      console.error(`Error getting main path for plugin ${pluginName}:`, error);
      return null;
    }
  }



  /**
   * Đọc package.json từ file zip
   */
  private async getPackageJsonFromZip(zipFilePath: string): Promise<any> {
    return new Promise((resolve, _reject) => {
      try {
        const zip = new AdmZip(zipFilePath);
        const zipEntries = zip.getEntries();

        // Tìm file package.json trong zip
        for (const entry of zipEntries) {
          if (
            entry.entryName === "package.json" ||
            entry.entryName.endsWith("/package.json")
          ) {
            try {
              const content = entry.getData().toString("utf8");
              const packageJson = JSON.parse(content);
              return resolve(packageJson);
            } catch (err) {
              console.error("Error parsing package.json from zip:", err);
            }
          }
        }

        resolve(null); // Không tìm thấy package.json
      } catch (error) {
        console.error("Error reading zip file:", error);
        resolve(null);
      }
    });
  }

  /**
   * Tìm main script cho plugin AI Assistant
   */
  private findAIAssistantMainScript(): string | null {
    try {
      console.log('Finding main script for AI Assistant plugin');

      // Tìm thư mục plugin
      const pluginDir = this.findPluginDirectory('ai-assistant');
      if (!pluginDir) {
        console.error('AI Assistant plugin directory not found');
        return null;
      }

      console.log(`Found AI Assistant plugin directory at: ${pluginDir}`);

      // Kiểm tra các vị trí phổ biến cho main script
      const possiblePaths = [
        path.join(pluginDir, 'dist', 'index.js'),
        path.join(pluginDir, 'index.js'),
        path.join(pluginDir, 'dist', 'main.js'),
        path.join(pluginDir, 'main.js'),
        path.join(pluginDir, 'ai-assistant', 'dist', 'index.js'),
        path.join(pluginDir, 'ai-assistant', 'index.js')
      ];

      for (const mainPath of possiblePaths) {
        console.log(`Checking for AI Assistant main script at: ${mainPath}`);
        if (fs.existsSync(mainPath)) {
          console.log(`Found AI Assistant main script at: ${mainPath}`);
          return mainPath;
        }
      }

      // Tìm kiếm trong thư mục dist
      const distDir = path.join(pluginDir, 'dist');
      if (fs.existsSync(distDir)) {
        console.log('Searching in dist directory');
        const distFiles = fs.readdirSync(distDir);
        const jsFiles = distFiles.filter(file => file.endsWith('.js'));

        if (jsFiles.length > 0) {
          const mainPath = path.join(distDir, jsFiles[0]);
          console.log(`Found AI Assistant main script in dist directory: ${mainPath}`);
          return mainPath;
        }
      }

      // Tìm kiếm trong thư mục ai-assistant nếu có
      const aiAssistantDir = path.join(pluginDir, 'ai-assistant');
      if (fs.existsSync(aiAssistantDir)) {
        console.log('Searching in ai-assistant subdirectory');

        // Kiểm tra dist trong thư mục ai-assistant
        const aiDistDir = path.join(aiAssistantDir, 'dist');
        if (fs.existsSync(aiDistDir)) {
          const distFiles = fs.readdirSync(aiDistDir);
          const jsFiles = distFiles.filter(file => file.endsWith('.js'));

          if (jsFiles.length > 0) {
            const mainPath = path.join(aiDistDir, jsFiles[0]);
            console.log(`Found AI Assistant main script in ai-assistant/dist directory: ${mainPath}`);
            return mainPath;
          }
        }

        // Kiểm tra các file js trong thư mục ai-assistant
        const aiFiles = fs.readdirSync(aiAssistantDir);
        const jsFiles = aiFiles.filter(file => file.endsWith('.js'));

        if (jsFiles.length > 0) {
          const mainPath = path.join(aiAssistantDir, jsFiles[0]);
          console.log(`Found AI Assistant main script in ai-assistant directory: ${mainPath}`);
          return mainPath;
        }
      }

      // Tìm kiếm bất kỳ file js nào trong thư mục gốc
      console.log('Searching for any JS file in root directory');
      const rootFiles = fs.readdirSync(pluginDir);
      const jsFiles = rootFiles.filter(file => file.endsWith('.js'));

      if (jsFiles.length > 0) {
        const mainPath = path.join(pluginDir, jsFiles[0]);
        console.log(`Found AI Assistant main script in root directory: ${mainPath}`);
        return mainPath;
      }

      console.error('No main script found for AI Assistant plugin');
      return null;
    } catch (error) {
      console.error('Error finding AI Assistant main script:', error);
      return null;
    }
  }
}
