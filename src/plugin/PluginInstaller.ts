import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import extractZip from 'extract-zip';
import { getPluginDownloadUrl, getPluginDownloadUrlByName } from '../services/firebase';
import { StorageReference } from 'firebase/storage';
import { PluginInfo } from './PluginInterface';
import AdmZip from 'adm-zip';

/**
 * Class responsible for installing and managing plugins
 */
export class PluginInstaller {
  private pluginsDir: string;
  private installedPlugins: Map<string, PluginInfo> = new Map();

  constructor() {
    // Create plugins directory in user data folder
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins');
    this.ensurePluginsDirectory();
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
      const pluginName = pluginRef.name.replace('.zip', '');

      // Download and install the plugin
      return await this.downloadAndInstallPlugin(pluginName, downloadUrl);
    } catch (error) {
      console.error('Error installing plugin:', error);
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
      const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');
      console.log(`Normalized plugin name: ${normalizedName}`);

      // Get download URL
      const downloadUrl = await getPluginDownloadUrlByName(pluginName);
      console.log(`Got download URL for plugin: ${downloadUrl}`);

      // Download and install the plugin
      const pluginInfo = await this.downloadAndInstallPlugin(pluginName, downloadUrl);

      // If the plugin directory has version in name but the plugin info doesn't, create a symlink
      if (pluginName !== normalizedName) {
        const versionedDir = path.join(this.pluginsDir, pluginName);
        const normalizedDir = path.join(this.pluginsDir, normalizedName);

        console.log(`Creating directory for normalized name: ${normalizedDir}`);

        // If normalized directory exists, remove it
        if (fs.existsSync(normalizedDir)) {
          console.log(`Removing existing normalized directory: ${normalizedDir}`);
          fs.rmSync(normalizedDir, { recursive: true, force: true });
        }

        // Copy files from versioned directory to normalized directory
        console.log(`Copying files from ${versionedDir} to ${normalizedDir}`);
        fs.mkdirSync(normalizedDir, { recursive: true });

        const files = fs.readdirSync(versionedDir);
        for (const file of files) {
          const srcPath = path.join(versionedDir, file);
          const destPath = path.join(normalizedDir, file);

          if (fs.statSync(srcPath).isDirectory()) {
            fs.cpSync(srcPath, destPath, { recursive: true });
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }

        // Update plugin info with normalized name
        pluginInfo.name = normalizedName;
      }

      return pluginInfo;
    } catch (error) {
      console.error(`Error installing plugin ${pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Download and install a plugin from a URL - Theo cách của VS Code
   */
  private async downloadAndInstallPlugin(pluginName: string, downloadUrl: string): Promise<PluginInfo> {
    try {
      console.log(`Starting download and installation of plugin ${pluginName} from ${downloadUrl}`);

      // 1. Kiểm tra xem plugin đã được cài đặt chưa
      const existingDir = this.findPluginDirectory(pluginName);
      if (existingDir) {
        console.log(`Plugin ${pluginName} is already installed at ${existingDir}`);

        // Đọc package.json để lấy thông tin plugin
        const packageJsonPath = path.join(existingDir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            return {
              name: packageJson.name || pluginName,
              version: packageJson.version || '1.0.0',
              description: packageJson.description || `Plugin ${pluginName}`,
              author: packageJson.author || 'Unknown',
              installed: true
            };
          } catch (err) {
            console.error(`Error reading package.json for existing plugin:`, err);
          }
        }

        // Trả về thông tin mặc định nếu không đọc được package.json
        return {
          name: pluginName,
          version: '1.0.0',
          description: `Plugin ${pluginName}`,
          author: 'Unknown',
          installed: true
        };
      }

      // 2. Tạo thư mục tạm thời để tải về
      const tempDir = path.join(app.getPath('temp'), 'plugin-downloads');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // 3. Tải plugin về
      const zipPath = path.join(tempDir, `${pluginName}.zip`);
      console.log(`Downloading plugin to ${zipPath}`);
      await this.downloadFile(downloadUrl, zipPath);

      // 4. Kiểm tra file zip
      if (!fs.existsSync(zipPath)) {
        throw new Error(`Failed to download plugin: ${pluginName}.zip not found`);
      }

      const stats = fs.statSync(zipPath);
      if (stats.size === 0) {
        throw new Error(`Downloaded plugin file is empty: ${zipPath}`);
      }

      console.log(`Successfully downloaded plugin (${stats.size} bytes)`);

      // 5. Đọc package.json từ file zip để lấy thông tin plugin
      let zipPackageJson = null;
      try {
        zipPackageJson = await this.getPackageJsonFromZip(zipPath);
        console.log(`Read package.json from zip: ${JSON.stringify(zipPackageJson)}`);
      } catch (zipError) {
        console.error(`Error reading package.json from zip:`, zipError);
      }

      // 6. Xác định tên thư mục cài đặt
      let pluginDirName = pluginName;
      if (zipPackageJson && zipPackageJson.name) {
        // Sử dụng tên từ package.json nếu có
        pluginDirName = zipPackageJson.version ?
          `${zipPackageJson.name}-${zipPackageJson.version}` : zipPackageJson.name;
      }

      // 7. Tạo thư mục plugin
      const pluginDir = path.join(this.pluginsDir, pluginDirName);
      console.log(`Creating plugin directory at ${pluginDir}`);
      if (fs.existsSync(pluginDir)) {
        // Xóa thư mục plugin đã tồn tại
        console.log(`Removing existing plugin directory: ${pluginDir}`);
        fs.rmSync(pluginDir, { recursive: true, force: true });
      }
      fs.mkdirSync(pluginDir, { recursive: true });

      // Extract the zip file
      console.log(`Extracting plugin to ${pluginDir}`);
      await extractZip(zipPath, { dir: pluginDir });

      // List extracted files for debugging
      const extractedFiles = fs.readdirSync(pluginDir);
      console.log(`Extracted files: ${extractedFiles.join(', ')}`);

      // 9. Xóa file zip tạm thời
      try {
        fs.unlinkSync(zipPath);
      } catch (error) {
        console.warn(`Could not delete temporary zip file: ${zipPath}`, error);
      }

      // 10. Đọc package.json từ thư mục đã giải nén
      const packageJsonPath = path.join(pluginDir, 'package.json');
      console.log(`Looking for package.json at ${packageJsonPath}`);
      let packageJsonFound = false;

      if (fs.existsSync(packageJsonPath)) {
        packageJsonFound = true;
      } else {
        // Tìm package.json trong các thư mục con
        console.log('package.json not found in root directory, searching subdirectories...');
        const subdirs = extractedFiles.filter(file =>
          fs.statSync(path.join(pluginDir, file)).isDirectory()
        );

        for (const subdir of subdirs) {
          const subPackageJsonPath = path.join(pluginDir, subdir, 'package.json');
          if (fs.existsSync(subPackageJsonPath)) {
            console.log(`Found package.json in subdirectory: ${subdir}`);
            // Di chuyển tất cả các file từ thư mục con lên thư mục gốc
            const subDirPath = path.join(pluginDir, subdir);
            const subDirFiles = fs.readdirSync(subDirPath);

            for (const file of subDirFiles) {
              const srcPath = path.join(subDirPath, file);
              const destPath = path.join(pluginDir, file);

              if (fs.existsSync(destPath)) {
                fs.rmSync(destPath, { recursive: true, force: true });
              }

              if (fs.statSync(srcPath).isDirectory()) {
                fs.cpSync(srcPath, destPath, { recursive: true });
              } else {
                fs.copyFileSync(srcPath, destPath);
              }
            }

            packageJsonFound = true;
            break;
          }
        }
      }

      // Kiểm tra lại package.json sau khi có thể đã di chuyển file
      if (!packageJsonFound || !fs.existsSync(packageJsonPath)) {
        throw new Error(`Invalid plugin: ${pluginName} (missing package.json)`);
      }

      // 11. Cập nhật file extensions.json
      this.updateExtensionsJson(pluginName, true);

      // 12. Đọc nội dung package.json
      const extractedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      console.log(`Package.json content: ${JSON.stringify(extractedPackageJson, null, 2)}`);

      // 13. Cài đặt các dependencies nếu cần
      if (extractedPackageJson.dependencies && Object.keys(extractedPackageJson.dependencies).length > 0) {
        console.log(`Installing dependencies for plugin ${pluginName}`);
        try {
          // Tạo package.json tối thiểu chỉ với các dependencies cần thiết
          const minimalPackageJson: {
            name: string;
            version: string;
            description: string;
            main: string;
            dependencies: { [key: string]: string };
          } = {
            name: extractedPackageJson.name,
            version: extractedPackageJson.version,
            description: extractedPackageJson.description || 'Plugin for text editor',
            main: extractedPackageJson.main,
            dependencies: {}
          };

          // Chỉ bao gồm các dependencies cần thiết
          const essentialDeps = ['pdfmake', 'pdfkit'];
          for (const dep of essentialDeps) {
            if (extractedPackageJson.dependencies && extractedPackageJson.dependencies[dep]) {
              minimalPackageJson.dependencies[dep] = extractedPackageJson.dependencies[dep];
            }
          }

          // Bỏ qua dependency electron vì nó đã có trong ứng dụng chính
          console.log(`Using minimal dependencies: ${JSON.stringify(minimalPackageJson.dependencies)}`);

          // Ghi file package.json tối thiểu
          fs.writeFileSync(
            path.join(pluginDir, 'package.json'),
            JSON.stringify(minimalPackageJson, null, 2)
          );

          // Cài đặt dependencies
          const { execSync } = require('child_process');
          console.log(`Running npm install in ${pluginDir}`);
          execSync('npm install --no-fund --no-audit --loglevel=error', {
            cwd: pluginDir,
            stdio: 'inherit',
            timeout: 60000 // 60 giây timeout
          });
          console.log('Dependencies installed successfully');
        } catch (npmError) {
          console.error('Error installing dependencies:', npmError);
          console.log('Continuing without installing dependencies - plugin may not work correctly');
          // Tiếp tục ngay cả khi npm install thất bại
        }
      } else {
        console.log('No dependencies to install');
      }

      // 14. Tạo thông tin plugin
      const pluginInfo: PluginInfo = {
        name: extractedPackageJson.name || pluginName,
        version: extractedPackageJson.version || '1.0.0',
        description: extractedPackageJson.description || 'No description provided',
        author: extractedPackageJson.author || 'Unknown',
        installed: true
      };

      console.log(`Plugin info: ${JSON.stringify(pluginInfo)}`);

      // 15. Lưu thông tin plugin
      this.installedPlugins.set(pluginInfo.name, pluginInfo);

      // 16. Cập nhật file extensions.json
      this.updateExtensionsJson(pluginInfo.name, true);

      return pluginInfo;
    } catch (error) {
      console.error(`Error downloading and installing plugin ${pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Download a file from a URL
   */
  private async downloadFile(url: string, destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Downloading file from ${url} to ${destination}`);

      // Determine protocol (http or https)
      const protocol = url.startsWith('https:') ? require('https') : require('http');
      const file = fs.createWriteStream(destination);

      // Create request with proper error handling
      const request = protocol.get(url, (response: any) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          console.log(`Following redirect to: ${response.headers.location}`);
          fs.unlinkSync(destination);
          this.downloadFile(response.headers.location, destination)
            .then(resolve)
            .catch(reject);
          return;
        }

        // Check for successful response
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: Server returned status code ${response.statusCode}`));
          return;
        }

        // Pipe the response to the file
        response.pipe(file);

        // Handle file events
        file.on('finish', () => {
          file.close();
          console.log(`Download completed: ${destination}`);
          resolve();
        });

        file.on('error', (err: Error) => {
          console.error(`Error writing to file: ${err.message}`);
          fs.unlinkSync(destination);
          reject(err);
        });
      });

      // Handle request errors
      request.on('error', (err: Error) => {
        console.error(`Error downloading file: ${err.message}`);
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }
        reject(err);
      });

      // Set timeout
      request.setTimeout(30000, () => {
        request.abort();
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }
        reject(new Error('Download timed out after 30 seconds'));
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
      const normalizedName = String(pluginName).replace(/(-\d+\.\d+\.\d+)$/, '');
      console.log(`PluginInstaller: Normalized name: ${normalizedName}`);

      // 2. Tìm tất cả các thư mục liên quan
      const dirsToRemove = [];

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
        const allDirs = fs.readdirSync(this.pluginsDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        for (const dir of allDirs) {
          if (dir.startsWith(normalizedName + '-')) {
            const versionedDir = path.join(this.pluginsDir, dir);
            if (!dirsToRemove.includes(versionedDir)) {
              dirsToRemove.push(versionedDir);
            }
          }
        }
      } catch (error) {
        console.error(`PluginInstaller: Error reading plugins directory:`, error);
      }

      console.log(`PluginInstaller: Directories to remove: ${dirsToRemove.join(', ')}`);

      // 3. Xóa tất cả các thư mục liên quan
      for (const dir of dirsToRemove) {
        try {
          console.log(`PluginInstaller: Removing directory: ${dir}`);
          fs.rmSync(dir, { recursive: true, force: true });

          // Xóa khỏi danh sách plugin đã cài đặt
          const dirName = path.basename(dir);
          this.installedPlugins.delete(dirName);
        } catch (error) {
          console.error(`PluginInstaller: Error removing directory ${dir}:`, error);
          // Tiếp tục với các thư mục khác
        }
      }

      // 4. Cập nhật file extensions.json
      try {
        this.updateExtensionsJson(pluginName, false);
        this.updateExtensionsJson(normalizedName, false);
      } catch (error) {
        console.error(`PluginInstaller: Error updating extensions.json:`, error);
      }

      // 5. Cập nhật danh sách plugin đã cài đặt
      this.refreshInstalledPlugins();

      return true; // Luôn trả về true để tránh lỗi UI
    } catch (error) {
      console.error(`PluginInstaller: Error uninstalling plugin ${pluginName}:`, error);
      return true; // Luôn trả về true để tránh lỗi UI
    }
  }

  /**
   * Tìm thư mục plugin dựa trên tên plugin
   */
  private findPluginDirectory(pluginName: string): string | null {
    try {
      // Normalize plugin name (remove version suffix if present)
      const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');

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
      const allDirs = fs.readdirSync(this.pluginsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      // Tìm thư mục phù hợp nhất
      for (const dir of allDirs) {
        // Kiểm tra thư mục có phiên bản
        if (dir.startsWith(normalizedName + '-')) {
          return path.join(this.pluginsDir, dir);
        }

        // Kiểm tra package.json để xác định tên plugin
        try {
          const packageJsonPath = path.join(this.pluginsDir, dir, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (packageJson.name === pluginName || packageJson.name === normalizedName) {
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
      const extensionsJsonPath = path.join(this.pluginsDir, '..', 'extensions.json');
      let extensions: { [key: string]: any } = {};

      // Đọc file extensions.json nếu tồn tại
      if (fs.existsSync(extensionsJsonPath)) {
        try {
          const content = fs.readFileSync(extensionsJsonPath, 'utf8');
          extensions = JSON.parse(content);
        } catch (err) {
          console.error('Error reading extensions.json:', err);
          extensions = {};
        }
      }

      // Cập nhật trạng thái plugin
      if (isInstalled) {
        // Thêm plugin vào danh sách đã cài đặt
        extensions[pluginName] = { enabled: true, installedTimestamp: Date.now() };
      } else {
        // Xóa plugin khỏi danh sách đã cài đặt
        if (extensions[pluginName]) {
          delete extensions[pluginName];
        }
      }

      // Ghi file extensions.json
      fs.writeFileSync(extensionsJsonPath, JSON.stringify(extensions, null, 2), 'utf8');
      console.log(`Updated extensions.json for plugin ${pluginName}, installed: ${isInstalled}`);
    } catch (error) {
      console.error(`Error updating extensions.json for plugin ${pluginName}:`, error);
    }
  }

  /**
   * Get a list of installed plugins
   */
  public getInstalledPlugins(): PluginInfo[] {
    // Refresh the list of installed plugins
    this.refreshInstalledPlugins();

    return Array.from(this.installedPlugins.values());
  }

  /**
   * Check if a plugin is installed
   */
  public isPluginInstalled(pluginName: string): boolean {
    // Normalize plugin name (remove version suffix if present)
    const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');

    // Refresh the list of installed plugins
    this.refreshInstalledPlugins();

    // Check if either the original name or normalized name is installed
    return this.installedPlugins.has(pluginName) || this.installedPlugins.has(normalizedName);
  }

  /**
   * Refresh the list of installed plugins
   */
  private refreshInstalledPlugins(): void {
    try {
      // Clear the current list
      this.installedPlugins.clear();

      // Ensure the plugins directory exists
      this.ensurePluginsDirectory();

      // Read all plugin directories
      const pluginDirs = fs.readdirSync(this.pluginsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      console.log(`Found plugin directories: ${pluginDirs.join(', ')}`);

      // Process each plugin directory
      for (const pluginDir of pluginDirs) {
        const packageJsonPath = path.join(this.pluginsDir, pluginDir, 'package.json');
        console.log(`Checking for package.json at: ${packageJsonPath}`);

        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            console.log(`Found package.json for plugin ${pluginDir}: ${JSON.stringify(packageJson, null, 2)}`);

            // Normalize plugin name (remove version suffix if present)
            let pluginName = packageJson.name || pluginDir;
            const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');

            // If the directory name has version but the package.json name doesn't, use the normalized name
            if (pluginDir.includes(normalizedName) && pluginDir !== normalizedName && !pluginName.includes('-')) {
              pluginName = normalizedName;
            }

            console.log(`Using plugin name: ${pluginName} (normalized from ${packageJson.name || pluginDir})`);

            const pluginInfo: PluginInfo = {
              name: pluginName,
              version: packageJson.version || '1.0.0',
              description: packageJson.description || 'No description provided',
              author: packageJson.author || 'Unknown'
            };

            this.installedPlugins.set(pluginInfo.name, pluginInfo);

            // Also register with the directory name if it's different
            if (pluginDir !== pluginInfo.name) {
              console.log(`Also registering plugin with directory name: ${pluginDir}`);
              this.installedPlugins.set(pluginDir, pluginInfo);
            }
          } catch (error) {
            console.error(`Error reading package.json for plugin ${pluginDir}:`, error);
          }
        } else {
          console.log(`No package.json found for plugin directory: ${pluginDir}`);
        }
      }

      console.log(`Refreshed installed plugins: ${Array.from(this.installedPlugins.keys()).join(', ')}`);
    } catch (error) {
      console.error('Error refreshing installed plugins:', error);
    }
  }

  /**
   * Get the main script path for a plugin
   */
  public getPluginMainPath(pluginName: string): string | null {
    try {
      console.log(`Finding main script for plugin: ${pluginName}`);

      // Normalize plugin name (remove version suffix if present)
      const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');
      console.log(`Normalized plugin name: ${normalizedName}`);

      // Try both the original name and normalized name
      const pluginDirs = [
        path.join(this.pluginsDir, pluginName),
        path.join(this.pluginsDir, normalizedName)
      ];

      // Try each plugin directory
      for (const pluginDir of pluginDirs) {
        console.log(`Checking plugin directory: ${pluginDir}`);

        if (!fs.existsSync(pluginDir)) {
          console.log(`Plugin directory does not exist: ${pluginDir}`);
          continue; // Try next directory
        }

        const packageJsonPath = path.join(pluginDir, 'package.json');
        console.log(`Looking for package.json at: ${packageJsonPath}`);

        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          console.log(`Package.json found with content: ${JSON.stringify(packageJson, null, 2)}`);

          // Get main script path from package.json
          const mainScript = packageJson.main || 'index.js';
          console.log(`Main script from package.json: ${mainScript}`);

          // Try multiple possible locations for the main script
          const possiblePaths = [
            path.join(pluginDir, mainScript),
            path.join(pluginDir, 'dist', mainScript),
            path.join(pluginDir, 'dist', 'index.js'),
            path.join(pluginDir, 'src', mainScript),
            path.join(pluginDir, 'lib', mainScript),
            path.join(pluginDir, 'build', mainScript),
            path.join(pluginDir, 'index.js')
          ];

          for (const mainPath of possiblePaths) {
            console.log(`Checking for main script at: ${mainPath}`);
            if (fs.existsSync(mainPath)) {
              console.log(`Found main script at: ${mainPath}`);
              return mainPath;
            }
          }

          // If we still haven't found the main script, search for any .js file
          console.log('Main script not found in expected locations, searching for any .js file...');
          const findJsFiles = (dir: string): string[] => {
            const results: string[] = [];
            const files = fs.readdirSync(dir);

            for (const file of files) {
              const filePath = path.join(dir, file);
              const stat = fs.statSync(filePath);

              if (stat.isDirectory()) {
                results.push(...findJsFiles(filePath));
              } else if (file.endsWith('.js')) {
                results.push(filePath);
              }
            }

            return results;
          };

          const jsFiles = findJsFiles(pluginDir);
          console.log(`Found ${jsFiles.length} .js files in plugin directory`);

          if (jsFiles.length > 0) {
            // Prioritize files with names like 'index.js', 'main.js', or matching the plugin name
            const priorityFiles = jsFiles.filter(file => {
              const fileName = path.basename(file);
              return fileName === 'index.js' ||
                     fileName === 'main.js' ||
                     fileName === `${normalizedName}.js`;
            });

            if (priorityFiles.length > 0) {
              console.log(`Using priority file as main script: ${priorityFiles[0]}`);
              return priorityFiles[0];
            }

            console.log(`Using first found .js file as main script: ${jsFiles[0]}`);
            return jsFiles[0];
          }
        } else {
          console.log(`Package.json not found for plugin in directory: ${pluginDir}`);
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
    return new Promise((resolve, reject) => {
      try {
        const zip = new AdmZip(zipFilePath);
        const zipEntries = zip.getEntries();

        // Tìm file package.json trong zip
        for (const entry of zipEntries) {
          if (entry.entryName === 'package.json' || entry.entryName.endsWith('/package.json')) {
            try {
              const content = entry.getData().toString('utf8');
              const packageJson = JSON.parse(content);
              return resolve(packageJson);
            } catch (err) {
              console.error('Error parsing package.json from zip:', err);
            }
          }
        }

        resolve(null); // Không tìm thấy package.json
      } catch (error) {
        console.error('Error reading zip file:', error);
        resolve(null);
      }
    });
  }
}
