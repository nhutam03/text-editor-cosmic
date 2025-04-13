import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import extractZip from 'extract-zip';
import { getPluginDownloadUrl, getPluginDownloadUrlByName } from '../services/firebase';
import { StorageReference } from 'firebase/storage';
import { PluginInfo } from './PluginInterface';

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
      // Get download URL
      const downloadUrl = await getPluginDownloadUrlByName(pluginName);

      // Download and install the plugin
      return await this.downloadAndInstallPlugin(pluginName, downloadUrl);
    } catch (error) {
      console.error(`Error installing plugin ${pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Download and install a plugin from a URL
   */
  private async downloadAndInstallPlugin(pluginName: string, downloadUrl: string): Promise<PluginInfo> {
    try {
      // Create temporary directory for download
      const tempDir = path.join(app.getPath('temp'), 'plugin-downloads');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Download the plugin zip file
      const zipPath = path.join(tempDir, `${pluginName}.zip`);
      await this.downloadFile(downloadUrl, zipPath);

      // Create plugin directory
      const pluginDir = path.join(this.pluginsDir, pluginName);
      if (fs.existsSync(pluginDir)) {
        // Remove existing plugin directory
        fs.rmSync(pluginDir, { recursive: true, force: true });
      }
      fs.mkdirSync(pluginDir, { recursive: true });

      // Extract the zip file
      await extractZip(zipPath, { dir: pluginDir });

      // Clean up the zip file
      fs.unlinkSync(zipPath);

      // Read plugin info from package.json
      const packageJsonPath = path.join(pluginDir, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        throw new Error(`Invalid plugin: ${pluginName} (missing package.json)`);
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Create plugin info
      const pluginInfo: PluginInfo = {
        name: packageJson.name || pluginName,
        version: packageJson.version || '1.0.0',
        description: packageJson.description || 'No description provided',
        author: packageJson.author || 'Unknown'
      };

      // Store plugin info
      this.installedPlugins.set(pluginInfo.name, pluginInfo);

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
      const https = require('https');
      const file = fs.createWriteStream(destination);

      https.get(url, (response: any) => {
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err: Error) => {
        fs.unlinkSync(destination);
        reject(err);
      });
    });
  }

  /**
   * Uninstall a plugin
   */
  public uninstallPlugin(pluginName: string): boolean {
    try {
      const pluginDir = path.join(this.pluginsDir, pluginName);

      if (fs.existsSync(pluginDir)) {
        fs.rmSync(pluginDir, { recursive: true, force: true });
        this.installedPlugins.delete(pluginName);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error uninstalling plugin ${pluginName}:`, error);
      return false;
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

      // Process each plugin directory
      for (const pluginDir of pluginDirs) {
        const packageJsonPath = path.join(this.pluginsDir, pluginDir, 'package.json');

        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

            const pluginInfo: PluginInfo = {
              name: packageJson.name || pluginDir,
              version: packageJson.version || '1.0.0',
              description: packageJson.description || 'No description provided',
              author: packageJson.author || 'Unknown'
            };

            this.installedPlugins.set(pluginInfo.name, pluginInfo);
          } catch (error) {
            console.error(`Error reading package.json for plugin ${pluginDir}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing installed plugins:', error);
    }
  }

  /**
   * Get the main script path for a plugin
   */
  public getPluginMainPath(pluginName: string): string | null {
    try {
      const pluginDir = path.join(this.pluginsDir, pluginName);
      const packageJsonPath = path.join(pluginDir, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const mainScript = packageJson.main || 'index.js';

        const mainPath = path.join(pluginDir, mainScript);
        if (fs.existsSync(mainPath)) {
          return mainPath;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error getting main path for plugin ${pluginName}:`, error);
      return null;
    }
  }
}
