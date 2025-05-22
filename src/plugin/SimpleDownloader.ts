import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

export class SimpleDownloader {
  /**
   * Download a file with better error handling and retry logic
   */
  static async downloadFile(url: string, destination: string, maxRetries: number = 3): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Download attempt ${attempt}/${maxRetries}: ${url}`);
        await this.downloadFileOnce(url, destination);
        console.log(`✅ Download successful: ${destination}`);
        return;
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Download attempt ${attempt} failed:`, error);
        
        // Clean up partial file
        this.cleanupFile(destination);
        
        if (attempt < maxRetries) {
          const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
          console.log(`⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError || new Error('Download failed after all retries');
  }

  /**
   * Single download attempt
   */
  private static downloadFileOnce(url: string, destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Ensure destination directory exists
      const destinationDir = path.dirname(destination);
      if (!fs.existsSync(destinationDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
      }

      // Create write stream
      const file = fs.createWriteStream(destination);
      let downloadCompleted = false;

      // Handle file stream errors
      file.on('error', (err) => {
        if (!downloadCompleted) {
          downloadCompleted = true;
          file.close();
          reject(err);
        }
      });

      // Make HTTPS request
      const request = https.get(url, (response) => {
        console.log(`Response status: ${response.statusCode}`);

        if (response.statusCode !== 200) {
          if (!downloadCompleted) {
            downloadCompleted = true;
            file.close();
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage || 'Unknown error'}`));
          }
          return;
        }

        // Pipe response to file
        response.pipe(file);

        // Handle successful completion
        file.on('finish', () => {
          if (!downloadCompleted) {
            downloadCompleted = true;
            file.close();
            
            // Verify file was downloaded
            try {
              const stats = fs.statSync(destination);
              if (stats.size === 0) {
                reject(new Error('Downloaded file is empty'));
                return;
              }
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        });

        // Handle response errors
        response.on('error', (err) => {
          if (!downloadCompleted) {
            downloadCompleted = true;
            file.close();
            reject(err);
          }
        });
      });

      // Handle request errors
      request.on('error', (err) => {
        if (!downloadCompleted) {
          downloadCompleted = true;
          file.close();
          reject(err);
        }
      });

      // Set timeout (3 minutes)
      request.setTimeout(180000, () => {
        if (!downloadCompleted) {
          downloadCompleted = true;
          request.abort();
          file.close();
          reject(new Error('Download timeout after 3 minutes'));
        }
      });
    });
  }

  /**
   * Clean up partial download files
   */
  private static cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🧹 Cleaned up partial file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error cleaning up file ${filePath}:`, error);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the correct Firebase Storage URL for a plugin
   */
  static getPluginUrl(pluginName: string): string {
    const bucket = 'cosmic-text-editor.firebasestorage.app';
    
    // Map plugin names to their correct file names
    const pluginFileMap: { [key: string]: string } = {
      'ai-assistant': 'ai-assistant-1.0.0.zip',
      'ai-assistant-1.0.0': 'ai-assistant-1.0.0.zip',
      'code-runner': 'code-runner.zip',
      'prettier-plugin': 'prettier-plugin-1.0.0.zip',
      'prettier-plugin-1.0.0': 'prettier-plugin-1.0.0.zip',
      'autosave-plugin': 'autosave-plugin.zip',
      'AutoSave': 'autosave-plugin.zip',
      'AutoSave_Plugin': 'autosave-plugin.zip'
    };

    // Normalize plugin name
    const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');
    
    // Get the correct file name
    const fileName = pluginFileMap[pluginName] || 
                    pluginFileMap[normalizedName] || 
                    `${normalizedName}.zip`;

    // Create the URL
    const encodedPath = encodeURIComponent(`plugins/${fileName}`);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
  }
}
