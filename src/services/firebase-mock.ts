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
      name: 'prettier-plugin',
      ref: new MockStorageReference('/plugins/prettier-plugin.zip'),
      installed: false
    },
    {
      name: 'code-runner',
      ref: new MockStorageReference('/plugins/code-runner.zip'),
      installed: false
    },
    {
      name: 'ai-assistant',
      ref: new MockStorageReference('/plugins/ai-assistant.zip'),
      installed: false
    },
    {
      name: 'AutoSave_Plugin',
      ref: new MockStorageReference('/plugins/AutoSave_Plugin.zip'),
      installed: false
    }
  ];
}

export async function getPluginDownloadUrl(pluginRef: StorageReference): Promise<string> {
  console.log('Using mock getPluginDownloadUrl');

  // Extract plugin name from reference
  const pluginName = pluginRef.name.replace('.zip', '');
  console.log(`Mock: Getting download URL for plugin reference: ${pluginName}`);

  // Normalize plugin name (remove version suffix if present)
  const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');

  // Tạo URL động dựa trên tên plugin
  console.log(`Mock: Tạo URL động dựa trên tên plugin: ${normalizedName}`);

  // Sử dụng bucket mặc định cho môi trường mock
  const mockBucket = 'cosmic-text-editor.firebasestorage.app';

  // Tạo URL dựa trên tên plugin
  let fileName = '';

  // Xác định tên file dựa trên loại plugin
  if (normalizedName === 'ai-assistant' || normalizedName.includes('ai-assistant')) {
    fileName = 'ai-assistant-1.0.0.zip';
  } else if (normalizedName === 'prettier-plugin' || normalizedName.includes('prettier')) {
    fileName = 'prettier-plugin-1.0.0.zip';
  } else if (normalizedName === 'code-runner' || normalizedName.includes('code-runner')) {
    fileName = 'code-runner.zip';
  } else if (normalizedName === 'AutoSave_Plugin' || normalizedName.includes('AutoSave')) {
    fileName = 'AutoSave_Plugin.zip';
  } else {
    // Sử dụng tên plugin với phiên bản mặc định
    fileName = `${normalizedName}-1.0.0.zip`;
  }

  // Tạo URL
  const encodedPluginName = encodeURIComponent(`plugins/${fileName}`);
  const url = `https://firebasestorage.googleapis.com/v0/b/${mockBucket}/o/${encodedPluginName}?alt=media`;

  console.log(`Mock: Using URL for ${normalizedName}: ${url}`);
  return url;
}

export async function getPluginDownloadUrlByName(pluginName: string): Promise<string> {
  console.log(`Using mock getPluginDownloadUrlByName for ${pluginName}`);

  // Normalize plugin name (remove version suffix if present)
  const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');

  // Tạo URL động dựa trên tên plugin
  console.log(`Mock: Tạo URL động dựa trên tên plugin: ${normalizedName}`);

  // Sử dụng bucket mặc định cho môi trường mock
  const mockBucket = 'cosmic-text-editor.firebasestorage.app';

  // Tạo URL dựa trên tên plugin
  let fileName = '';

  // Xác định tên file dựa trên loại plugin
  if (normalizedName === 'ai-assistant' || normalizedName.includes('ai-assistant')) {
    fileName = 'ai-assistant-1.0.0.zip';
  } else if (normalizedName === 'prettier-plugin' || normalizedName.includes('prettier')) {
    fileName = 'prettier-plugin-1.0.0.zip';
  } else if (normalizedName === 'code-runner' || normalizedName.includes('code-runner')) {
    fileName = 'code-runner.zip';
  } else if (normalizedName === 'AutoSave_Plugin' || normalizedName.includes('AutoSave')) {
    fileName = 'AutoSave_Plugin.zip';
  } else {
    // Sử dụng tên plugin với phiên bản mặc định
    fileName = `${normalizedName}-1.0.0.zip`;
  }

  // Tạo URL
  const encodedPluginName = encodeURIComponent(`plugins/${fileName}`);
  const url = `https://firebasestorage.googleapis.com/v0/b/${mockBucket}/o/${encodedPluginName}?alt=media`;

  console.log(`Mock: Using URL for ${normalizedName}: ${url}`);
  return url;
}

// CommonJS exports for compatibility with require() in firebase.ts
export const getAvailablePluginsMock = getAvailablePlugins;
export const getPluginDownloadUrlMock = getPluginDownloadUrl;
export const getPluginDownloadUrlByNameMock = getPluginDownloadUrlByName;
