import React, { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { PluginInfo } from '../plugin/PluginInterface';
import ExtensionCard from './ExtensionCard';
import ExtensionDetail from './ExtensionDetail';

interface PluginMarketplaceProps {
  onClose: () => void;
}

const PluginMarketplace: React.FC<PluginMarketplaceProps> = ({ onClose }) => {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlugin, setSelectedPlugin] = useState<PluginInfo | null>(null);

  // Add effect to log when selectedPlugin changes
  useEffect(() => {
    if (selectedPlugin) {
      console.log('Selected plugin changed:', {
        name: selectedPlugin.name,
        installed: selectedPlugin.installed,
        displayName: selectedPlugin.displayName
      });
    } else {
      console.log('Selected plugin cleared');
    }
  }, [selectedPlugin]);

  useEffect(() => {
    loadPlugins();

    // Đăng ký lắng nghe sự kiện cài đặt plugin
    window.electron.ipcRenderer.onPluginInstallError((data) => {
      console.log('Received plugin install error:', data);
      setInstalling(null);
      setError(`Failed to install ${data.pluginName}: ${data.error}`);

      // Clear error message after 5 seconds
      setTimeout(() => setError(null), 5000);
    });

    // Đăng ký lắng nghe sự kiện cài đặt plugin thành công
    if (window.electron.ipcRenderer.onPluginInstallSuccess) {
      window.electron.ipcRenderer.onPluginInstallSuccess((data) => {
        console.log('Received plugin install success:', data);
        setInstalling(null);
        setSuccess(`Successfully installed ${data.pluginName}`);

        // Clear selected plugin if it was the one installed
        if (selectedPlugin && selectedPlugin.name === data.pluginName) {
          setSelectedPlugin({ ...selectedPlugin, installed: true });
        }

        // Reload plugins list
        loadPlugins().catch(error => {
          console.error('Error reloading plugins after install success:', error);
        });

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      });
    }

    // Đăng ký lắng nghe sự kiện gỡ cài đặt plugin thành công
    window.electron.ipcRenderer.onPluginUninstallSuccess((data) => {
      console.log('Received plugin uninstall success:', data);
      setInstalling(null);
      setSuccess(`Successfully uninstalled ${data.pluginName}`);

      // Clear selected plugin if it was the one uninstalled
      if (selectedPlugin && selectedPlugin.name === data.pluginName) {
        setSelectedPlugin(null);
      }

      // Reload plugins list
      loadPlugins().catch(error => {
        console.error('Error reloading plugins after uninstall success:', error);
      });

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    });

    // Đăng ký lắng nghe sự kiện lỗi gỡ cài đặt plugin
    window.electron.ipcRenderer.onPluginUninstallError((data) => {
      console.log('Received plugin uninstall error:', data);
      setInstalling(null);
      setError(`Failed to uninstall ${data.pluginName}: ${data.error}`);

      // Clear error message after 5 seconds
      setTimeout(() => setError(null), 5000);
    });

    // Đăng ký lắng nghe sự kiện AI Assistant đã được gỡ cài đặt
    window.electron.ipcRenderer.onAIAssistantUninstalled((data) => {
      console.log('Received AI Assistant uninstalled:', data);
      setInstalling(null);
      setSuccess('AI Assistant has been completely removed from the system');

      // Clear selected plugin if it was AI Assistant
      if (selectedPlugin && (selectedPlugin.name.includes('ai-assistant') || selectedPlugin.name.includes('AI Assistant'))) {
        setSelectedPlugin(null);
      }

      // Reload plugins list
      loadPlugins().catch(error => {
        console.error('Error reloading plugins after AI Assistant uninstall:', error);
      });

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    });
  }, []);

  const loadPlugins = async (): Promise<void> => {
    try {
      setLoading(true);

      // Lấy danh sách plugin có sẵn
      const pluginsData = await window.electron.ipcRenderer.getAvailablePlugins();
      console.log('Available plugins:', pluginsData);

      // Kiểm tra dữ liệu plugin có hợp lệ không
      if (!Array.isArray(pluginsData)) {
        console.error('Invalid plugins data, expected array but got:', typeof pluginsData);
        setPlugins([]);
        setError('Failed to load plugins: Invalid data format');
        return;
      }

      // Lấy danh sách plugin đã cài đặt
      const installedPluginNames = await window.electron.ipcRenderer.getPlugins();
      console.log('Installed plugins:', installedPluginNames);

      // Kiểm tra danh sách plugin đã cài đặt có hợp lệ không
      const validInstalledPlugins: string[] = Array.isArray(installedPluginNames) ?
        installedPluginNames : [];

      if (!Array.isArray(installedPluginNames)) {
        console.error('Invalid installed plugins data, expected array but got:', typeof installedPluginNames);
      }

      // Tạo một mảng mới để chứa các đối tượng PluginInfo hợp lệ
      const enhancedPlugins: PluginInfo[] = [];

      // Xử lý từng plugin
      for (const plugin of pluginsData) {
        // Kiểm tra plugin có hợp lệ không
        if (!plugin || typeof plugin !== 'object' || !plugin.name) {
          console.error('Invalid plugin object:', plugin);
          continue; // Bỏ qua plugin không hợp lệ
        }

        // Chuẩn hóa tên plugin (loại bỏ phiên bản nếu có)
        const pluginName = typeof plugin.name === 'string' ? plugin.name : String(plugin.name);
        const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');

        // Kiểm tra trạng thái cài đặt của plugin
        let isInstalled = Boolean(plugin.installed) ||
                         validInstalledPlugins.includes(pluginName) ||
                         validInstalledPlugins.includes(normalizedName);

        // Kiểm tra trạng thái cài đặt chi tiết hơn bằng API
        try {
          // Sử dụng invoke trực tiếp thay vì checkPluginStatus
          const statusResult = await window.electron.ipcRenderer.invoke('check-plugin-status', pluginName);
          if (statusResult && typeof statusResult === 'object' && typeof statusResult.isInstalled === 'boolean') {
            isInstalled = statusResult.isInstalled;
            console.log(`Plugin ${pluginName} installation status: ${isInstalled}`);
          }
        } catch (statusError) {
          console.error(`Error checking status for ${pluginName}:`, statusError);
          // Giữ nguyên trạng thái đã xác định trước đó
        }

        // Sử dụng lại pluginName đã được khai báo trước đó

        // Tạo displayName từ pluginName
        let displayName = pluginName;
        try {
          displayName = pluginName.split('-')
            .filter(word => word) // Lọc các phần rỗng
            .map((word: string) => {
              if (typeof word !== 'string' || !word) return '';
              return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(' ');
        } catch (error) {
          console.error(`Error creating displayName for ${pluginName}:`, error);
          // Sử dụng pluginName làm displayName nếu có lỗi
        }

        // Tạo đối tượng PluginInfo mới với các giá trị mặc định an toàn
        const newPlugin: PluginInfo = {
          name: pluginName,
          displayName: displayName || pluginName, // Fallback nếu displayName rỗng
          version: '1.0.0',
          description: `This is the ${normalizedName} plugin for the text editor.`,
          author: 'Text Editor Team',
          publisher: 'Text Editor',
          publisherUrl: 'https://example.com',
          downloadCount: Math.floor(Math.random() * 100000),
          rating: (Math.random() * 3) + 2, // Random rating between 2-5
          ratingCount: Math.floor(Math.random() * 100),
          lastUpdated: new Date().toISOString().split('T')[0],
          categories: ['Formatters', 'Other'],
          installed: isInstalled,
        };

        // Thêm plugin mới vào danh sách
        enhancedPlugins.push(newPlugin);
      }

      // Lọc các plugin trùng lặp (chỉ giữ lại phiên bản mới nhất)
      const uniquePlugins = new Map<string, PluginInfo>();

      console.log(`Processing ${enhancedPlugins.length} plugins for uniqueness`);

      // Bước 1: Tạo danh sách các tên chuẩn hóa và plugin tương ứng
      const normalizedNameMap = new Map<string, string[]>();

      for (const plugin of enhancedPlugins) {
        if (!plugin || !plugin.name) continue;

        const normalizedName = typeof plugin.name === 'string' ?
          plugin.name.replace(/(-\d+\.\d+\.\d+)$/, '') :
          String(plugin.name);

        if (!normalizedNameMap.has(normalizedName)) {
          normalizedNameMap.set(normalizedName, []);
        }

        normalizedNameMap.get(normalizedName)!.push(plugin.name);
      }

      console.log('Normalized name mapping:', Object.fromEntries(normalizedNameMap));

      // Bước 2: Chỉ giữ lại một plugin cho mỗi tên chuẩn hóa
      for (const [normalizedName, pluginNames] of normalizedNameMap.entries()) {
        // Sắp xếp các tên theo thứ tự phiên bản
        pluginNames.sort((a, b) => b.localeCompare(a)); // Phiên bản mới nhất lên đầu

        // Lấy plugin đầu tiên (phiên bản mới nhất)
        const selectedPluginName = pluginNames[0];
        console.log(`Selected plugin for ${normalizedName}: ${selectedPluginName}`);

        // Tìm plugin tương ứng trong danh sách gốc
        const selectedPlugin = enhancedPlugins.find(p => p.name === selectedPluginName);
        if (selectedPlugin) {
          uniquePlugins.set(normalizedName, selectedPlugin);
        }
      }

      console.log(`Filtered to ${uniquePlugins.size} unique plugins`);

      setPlugins(Array.from(uniquePlugins.values()));
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load plugins: ${errorMessage}`);
      console.error('Error loading available plugins:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (pluginName: string): Promise<void> => {
    console.log(`PluginMarketplace: Starting install for ${pluginName}`);

    // Validate plugin name
    if (!pluginName || typeof pluginName !== 'string') {
      console.error(`PluginMarketplace: Invalid plugin name: ${pluginName}`);
      setError('Invalid plugin name');
      return;
    }

    try {
      setInstalling(pluginName);
      setError(null);
      setSuccess(null);

      // Chuẩn hóa tên plugin (loại bỏ phiên bản nếu có)
      const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');
      console.log(`PluginMarketplace: Installing plugin: ${pluginName} (normalized: ${normalizedName})`);

      const result = await window.electron.ipcRenderer.installPlugin(pluginName);
      console.log(`PluginMarketplace: Install API call completed for ${pluginName}`, result);

      // Kiểm tra kết quả trả về
      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success) {
          console.log(`PluginMarketplace: Plugin ${pluginName} installed successfully`);

          // Reload plugins to update the UI
          await loadPlugins();

          // Cập nhật trạng thái plugin trong danh sách hiện tại
          setPlugins(prevPlugins =>
            prevPlugins.map(plugin => {
              const pluginNormalizedName = plugin.name.replace(/(-\d+\.\d+\.\d+)$/, '');
              if (plugin.name === pluginName ||
                  plugin.name === normalizedName ||
                  pluginNormalizedName === pluginName ||
                  pluginNormalizedName === normalizedName) {
                return { ...plugin, installed: true };
              }
              return plugin;
            })
          );

          setSuccess(`Plugin ${normalizedName} installed successfully!`);

          // Clear success message after 3 seconds
          setTimeout(() => setSuccess(null), 3000);

        } else {
          const errorMessage = result.message || result.error || 'Unknown error';
          console.error(`PluginMarketplace: Plugin installation failed: ${errorMessage}`);
          setError(`Failed to install ${normalizedName}: ${errorMessage}`);

          // Clear error message after 5 seconds
          setTimeout(() => setError(null), 5000);
        }
      } else {
        console.warn('PluginMarketplace: Unexpected result format from installPlugin:', result);
        setError(`Failed to install ${normalizedName}: Unexpected response format`);

        // Clear error message after 5 seconds
        setTimeout(() => setError(null), 5000);
      }
    } catch (err: unknown) {
      console.error(`PluginMarketplace: Error in handleInstall for ${pluginName}:`, err);

      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to install ${pluginName}: ${errorMessage}`);

      // Clear error message after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      // Luôn đặt trạng thái installing về null sau một khoảng thời gian ngắn
      // để đảm bảo UI được cập nhật đúng cách
      setTimeout(() => {
        setInstalling(null);
      }, 100);
    }
  };

  // Hàm xử lý sự kiện khi nhấn nút Uninstall - Cải thiện với error handling tốt hơn
  const handleUninstall = async (pluginName: string): Promise<void> => {
    console.log(`PluginMarketplace: Starting uninstall for ${pluginName}`);

    // Validate plugin name
    if (!pluginName || typeof pluginName !== 'string') {
      console.error(`PluginMarketplace: Invalid plugin name: ${pluginName}`);
      setError('Invalid plugin name');
      return;
    }

    // Đặt trạng thái
    setInstalling(pluginName);
    setError(null);
    setSuccess(null);

    // Đặt selectedPlugin về null trước khi gỡ cài đặt để tránh màn hình trắng
    if (selectedPlugin && selectedPlugin.name === pluginName) {
      console.log(`PluginMarketplace: Clearing selected plugin before uninstall`);
      setSelectedPlugin(null);
    }

    try {
      // Gọi API uninstall với error handling cải thiện
      console.log(`PluginMarketplace: Calling uninstallPlugin API for ${pluginName}`);
      const result = await window.electron.ipcRenderer.uninstallPlugin(pluginName);

      // Check if result indicates success
      if (result && typeof result === 'object' && result.success === false) {
        throw new Error(result.message || 'Uninstall failed');
      }

      console.log(`PluginMarketplace: Uninstall API call completed for ${pluginName}`);

      // Reload plugins to update the UI
      await loadPlugins();

      // Cập nhật trạng thái plugin trong danh sách hiện tại
      const normalizedName = pluginName.replace(/(-\d+\.\d+\.\d+)$/, '');
      setPlugins(prevPlugins =>
        prevPlugins.map(plugin => {
          const pluginNormalizedName = plugin.name.replace(/(-\d+\.\d+\.\d+)$/, '');
          if (plugin.name === pluginName ||
              plugin.name === normalizedName ||
              pluginNormalizedName === pluginName ||
              pluginNormalizedName === normalizedName) {
            return { ...plugin, installed: false };
          }
          return plugin;
        })
      );

      setSuccess(`Plugin ${normalizedName} uninstalled successfully!`);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

    } catch (error) {
      // Xử lý lỗi với logging chi tiết hơn
      console.error(`PluginMarketplace: Error in handleUninstall for ${pluginName}:`, error);

      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Failed to uninstall ${pluginName}: ${errorMessage}`);

      // Vẫn cố gắng cập nhật danh sách plugin
      try {
        await loadPlugins();
      } catch (loadError) {
        console.error(`PluginMarketplace: Error reloading plugins after uninstall error:`, loadError);
      }

      // Ẩn thông báo lỗi sau 5 giây
      setTimeout(() => {
        setError(null);
      }, 5000);
    } finally {
      // Luôn đặt trạng thái installing về null sau một khoảng thời gian ngắn
      // để đảm bảo UI được cập nhật đúng cách
      setTimeout(() => {
        setInstalling(null);
      }, 100);
    }
  };

  // Filter plugins based on search query
  const filteredPlugins = plugins.filter(plugin => {
    // Kiểm tra plugin có hợp lệ không
    if (!plugin || typeof plugin !== 'object') {
      console.error('Invalid plugin object:', plugin);
      return false;
    }

    // Kiểm tra các trường cần thiết
    if (!plugin.name || typeof plugin.name !== 'string') {
      console.error('Plugin missing name or invalid name:', plugin);
      return false;
    }

    const searchLower = searchQuery.toLowerCase();
    return (
      plugin.name.toLowerCase().includes(searchLower) ||
      (plugin.displayName && plugin.displayName.toLowerCase().includes(searchLower)) ||
      (plugin.description && plugin.description.toLowerCase().includes(searchLower)) ||
      (plugin.author && plugin.author.toLowerCase().includes(searchLower))
    );
  });

  // Separate installed and not installed plugins - Đảm bảo các plugin hợp lệ
  const installedPlugins = filteredPlugins
    .filter(plugin => plugin && typeof plugin === 'object' && plugin.installed === true);

  const notInstalledPlugins = filteredPlugins
    .filter(plugin => plugin && typeof plugin === 'object' && plugin.installed !== true);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#1e1e1e] text-white rounded-lg shadow-lg w-[1000px] h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold">EXTENSIONS</h2>
          <Button
            variant="ghost"
            className="text-gray-400 hover:text-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel - Extension list */}
          <div className="w-1/3 border-r border-gray-700 flex flex-col">
            {/* Search bar */}
            <div className="p-3 border-b border-gray-700">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search Extensions"
                  className="pl-8 bg-[#3c3c3c] border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Extensions list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : filteredPlugins.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No extensions found
                </div>
              ) : (
                <div>
                  {/* Notifications */}
                  {error && (
                    <div className="bg-red-900 bg-opacity-30 border border-red-800 text-red-200 p-3 mx-2 my-2 rounded text-sm">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="bg-green-900 bg-opacity-30 border border-green-800 text-green-200 p-3 mx-2 my-2 rounded text-sm">
                      {success}
                    </div>
                  )}

                  {/* Installed extensions section */}
                  {installedPlugins.length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        INSTALLED
                      </div>
                      {installedPlugins.map((plugin) => {
                        console.log(`Rendering installed plugin card: ${plugin.name}`);
                        return (
                          <ExtensionCard
                            key={plugin.name}
                            plugin={plugin}
                            onClick={() => {
                              console.log(`Installed plugin clicked: ${plugin.name}`);
                              setSelectedPlugin(plugin);
                            }}
                            onUninstall={() => handleUninstall(plugin.name)}
                            installing={installing === plugin.name}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Recommended/Available extensions section */}
                  {notInstalledPlugins.length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-4">
                        RECOMMENDED
                      </div>
                      {notInstalledPlugins.map((plugin) => {
                        console.log(`Rendering not installed plugin card: ${plugin.name}`);
                        return (
                          <ExtensionCard
                            key={plugin.name}
                            plugin={plugin}
                            onClick={() => {
                              console.log(`Not installed plugin clicked: ${plugin.name}`);
                              setSelectedPlugin(plugin);
                            }}
                            onInstall={() => handleInstall(plugin.name)}
                            installing={installing === plugin.name}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right panel - Extension details */}
          <div className="w-2/3 flex flex-col">
            {selectedPlugin ? (
              <ExtensionDetail
                plugin={selectedPlugin}
                onClose={() => setSelectedPlugin(null)}
                onInstall={() => handleInstall(selectedPlugin.name)}
                onUninstall={() => handleUninstall(selectedPlugin.name)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <div className="text-center p-8">
                  <h3 className="text-lg font-semibold mb-2">No extension selected</h3>
                  <p>Click on an extension to view its details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PluginMarketplace;
