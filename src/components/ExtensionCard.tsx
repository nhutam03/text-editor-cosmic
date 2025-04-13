import React from 'react';
import { Star, Download } from 'lucide-react';
import { Button } from './ui/button';
import { PluginInfo } from '../plugin/PluginInterface';

interface ExtensionCardProps {
  plugin: PluginInfo;
  onClick: () => void;
  onInstall?: () => void;
  onUninstall?: () => void;
  installing?: boolean;
}

const ExtensionCard: React.FC<ExtensionCardProps> = ({
  plugin,
  onClick,
  onInstall,
  onUninstall,
  installing = false
}) => {
  const handleInstallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInstall?.();
  };

  // Đơn giản hóa hàm xử lý uninstall
  const handleUninstallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Đảm bảo plugin.name là chuỗi hợp lệ
    const pluginName = typeof plugin.name === 'string' ? plugin.name : 'this plugin';
    console.log(`ExtensionCard: Uninstall button clicked for ${pluginName}`);

    // Thông báo cho người dùng trước khi uninstall
    if (window.confirm(`Are you sure you want to uninstall ${pluginName}?`)) {
      console.log(`ExtensionCard: User confirmed uninstall for ${pluginName}`);

      // Gọi hàm uninstall được truyền từ component cha
      if (onUninstall) {
        try {
          onUninstall();
        } catch (error) {
          console.error(`ExtensionCard: Error in onUninstall for ${pluginName}:`, error);
          alert(`Failed to uninstall ${pluginName}. Please try again.`);
        }
      }
    } else {
      console.log(`ExtensionCard: User cancelled uninstall for ${pluginName}`);
    }
  };

  return (
    <div
      className="flex items-start p-2 hover:bg-[#2a2d2e] rounded cursor-pointer group"
      onClick={onClick}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mr-3">
        {plugin.iconUrl && typeof plugin.iconUrl === 'string' ? (
          <img
            src={plugin.iconUrl}
            alt={typeof plugin.displayName === 'string' ? plugin.displayName :
                 typeof plugin.name === 'string' ? plugin.name : 'Unknown Plugin'}
            className="w-8 h-8 rounded"
          />
        ) : (
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">
            {(typeof plugin.displayName === 'string' ? plugin.displayName :
              typeof plugin.name === 'string' ? plugin.name : 'U').charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm truncate">
            {typeof plugin.displayName === 'string' ? plugin.displayName :
             typeof plugin.name === 'string' ? plugin.name : 'Unknown Plugin'}
          </h3>

          {/* Install/Uninstall button */}
          <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {installing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
            ) : plugin.installed ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleUninstallClick}
              >
                Uninstall
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleInstallClick}
              >
                Install
              </Button>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-400 mt-1 truncate">
          {typeof plugin.publisher === 'string' ? plugin.publisher :
           typeof plugin.author === 'string' ? plugin.author : 'Unknown Publisher'}
        </div>

        <div className="flex items-center mt-1 text-xs text-gray-400">
          {plugin.rating && typeof plugin.rating === 'number' && (
            <div className="flex items-center mr-2">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-1" />
              <span>{plugin.rating.toFixed(1)}</span>
              {plugin.ratingCount && typeof plugin.ratingCount === 'number' && (
                <span className="ml-1">({plugin.ratingCount})</span>
              )}
            </div>
          )}

          {plugin.downloadCount && typeof plugin.downloadCount === 'number' && (
            <div className="flex items-center">
              <Download className="w-3 h-3 mr-1" />
              <span>{plugin.downloadCount.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExtensionCard;
