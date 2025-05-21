// Mock implementation of Firebase Storage functions
import { StorageReference } from 'firebase/storage';

// Mock StorageReference
class MockStorageReference implements StorageReference {
  bucket: string;
  fullPath: string;
  name: string;
  parent: StorageReference | null;
  root: StorageReference;
  storage: any;

  constructor(path: string) {
    this.bucket = 'mock-bucket';
    this.fullPath = path;
    this.name = path.split('/').pop() || '';
    this.parent = null;
    this.root = this;
    this.storage = {};
  }
}

// Mock functions with both named exports and CommonJS exports for compatibility
export async function getAvailablePlugins(): Promise<{ name: string, ref: StorageReference, installed?: boolean }[]> {
  console.log('Using mock getAvailablePlugins');

  // Return mock plugins
  return [
    {
      name: 'export-to-pdf',
      ref: new MockStorageReference('/plugins/export-to-pdf.zip'),
      installed: false
    },
    {
      name: 'prettier-plugin',
      ref: new MockStorageReference('/plugins/prettier-plugin.zip'),
      installed: false
    },
    {
      name: 'code-runner',
      ref: new MockStorageReference('/plugins/code-runner.zip'),
      installed: false
    }
  ];
}

export async function getPluginDownloadUrl(pluginRef: StorageReference): Promise<string> {
  console.log('Using mock getPluginDownloadUrl');
  return 'mock://download-url';
}

export async function getPluginDownloadUrlByName(pluginName: string): Promise<string> {
  console.log(`Using mock getPluginDownloadUrlByName for ${pluginName}`);

  // For export-to-pdf, return a hardcoded URL
  if (pluginName === 'export-to-pdf' || pluginName.includes('export-to-pdf')) {
    return 'https://firebasestorage.googleapis.com/v0/b/cosmic-text-editor.appspot.com/o/plugins%2Fexport-to-pdf-1.0.0.zip?alt=media';
  }

  return 'mock://download-url';
}

// CommonJS exports for compatibility with require() in firebase.ts
export const getAvailablePluginsMock = getAvailablePlugins;
export const getPluginDownloadUrlMock = getPluginDownloadUrl;
export const getPluginDownloadUrlByNameMock = getPluginDownloadUrlByName;
