import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';

interface PluginItem {
  name: string;
  installed: boolean;
}

interface PluginMarketplaceProps {
  onClose: () => void;
}

const PluginMarketplace: React.FC<PluginMarketplaceProps> = ({ onClose }) => {
  const [availablePlugins, setAvailablePlugins] = useState<PluginItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadAvailablePlugins();
  }, []);

  const loadAvailablePlugins = async () => {
    try {
      setLoading(true);
      const plugins = await window.electron.ipcRenderer.getAvailablePlugins();
      setAvailablePlugins(plugins);
      setError(null);
    } catch (err: any) {
      setError(`Failed to load plugins: ${err.message}`);
      console.error('Error loading available plugins:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (pluginName: string) => {
    try {
      setInstalling(pluginName);
      setError(null);
      setSuccess(null);
      
      const result = await window.electron.ipcRenderer.installPlugin(pluginName);
      
      if (result.success) {
        setSuccess(`Successfully installed ${pluginName}`);
        // Update the plugin list
        await loadAvailablePlugins();
      } else {
        setError(`Failed to install ${pluginName}: ${result.error}`);
      }
    } catch (err: any) {
      setError(`Error installing ${pluginName}: ${err.message}`);
      console.error(`Error installing plugin ${pluginName}:`, err);
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstall = async (pluginName: string) => {
    try {
      setInstalling(pluginName);
      setError(null);
      setSuccess(null);
      
      const result = await window.electron.ipcRenderer.uninstallPlugin(pluginName);
      
      if (result.success) {
        setSuccess(`Successfully uninstalled ${pluginName}`);
        // Update the plugin list
        await loadAvailablePlugins();
      } else {
        setError(`Failed to uninstall ${pluginName}: ${result.error}`);
      }
    } catch (err: any) {
      setError(`Error uninstalling ${pluginName}: ${err.message}`);
      console.error(`Error uninstalling plugin ${pluginName}:`, err);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#1e1e1e] text-white rounded-lg shadow-lg w-[600px] max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold">Plugin Marketplace</h2>
          <Button 
            variant="ghost" 
            className="text-gray-400 hover:text-white"
            onClick={onClose}
          >
            ✕
          </Button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : availablePlugins.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No plugins available
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="bg-red-900 bg-opacity-30 border border-red-800 text-red-200 p-3 rounded mb-4">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="bg-green-900 bg-opacity-30 border border-green-800 text-green-200 p-3 rounded mb-4">
                  {success}
                </div>
              )}
              
              {availablePlugins.map((plugin) => (
                <div 
                  key={plugin.name} 
                  className="bg-[#252526] p-4 rounded-md flex justify-between items-center"
                >
                  <div>
                    <h3 className="font-medium">{plugin.name}</h3>
                  </div>
                  <div>
                    {installing === plugin.name ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                    ) : plugin.installed ? (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleUninstall(plugin.name)}
                      >
                        Uninstall
                      </Button>
                    ) : (
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => handleInstall(plugin.name)}
                      >
                        Install
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

export default PluginMarketplace;
