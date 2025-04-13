import React from 'react';
import { Star, StarHalf, Info, Calendar, Tag, Check, X, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { PluginInfo } from '../plugin/PluginInterface';

interface ExtensionDetailProps {
  plugin: PluginInfo;
  onClose: () => void;
  onInstall?: () => void;
  onUninstall?: () => void;
}

const ExtensionDetail: React.FC<ExtensionDetailProps> = ({
  plugin,
  onClose,
  onInstall,
  onUninstall
}) => {
  // Generate star rating display
  const renderRating = () => {
    if (!plugin.rating || typeof plugin.rating !== 'number') return null;

    const fullStars = Math.floor(plugin.rating);
    const hasHalfStar = plugin.rating % 1 >= 0.5;
    const stars = [];

    // Add full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={`star-${i}`} className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    }

    // Add half star if needed
    if (hasHalfStar) {
      stars.push(<StarHalf key="half-star" className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    }

    // Add empty stars
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="w-4 h-4 text-gray-400" />);
    }

    return (
      <div className="flex items-center gap-1">
        {stars}
        <span className="text-sm text-gray-400 ml-1">
          ({typeof plugin.ratingCount === 'number' ? plugin.ratingCount : 0})
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start p-4 border-b border-gray-700">
        <div className="flex-shrink-0 mr-4">
          {plugin.iconUrl && typeof plugin.iconUrl === 'string' ? (
            <img
              src={plugin.iconUrl}
              alt={typeof plugin.displayName === 'string' ? plugin.displayName :
                   typeof plugin.name === 'string' ? plugin.name : 'Unknown Plugin'}
              className="w-16 h-16 rounded"
            />
          ) : (
            <div className="w-16 h-16 bg-blue-600 rounded flex items-center justify-center text-white text-2xl font-bold">
              {(typeof plugin.displayName === 'string' ? plugin.displayName :
                typeof plugin.name === 'string' ? plugin.name : 'U').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1">
          <h2 className="text-xl font-bold">
            {typeof plugin.displayName === 'string' ? plugin.displayName :
             typeof plugin.name === 'string' ? plugin.name : 'Unknown Plugin'}
          </h2>
          <div className="flex items-center mt-1">
            <span className="text-sm text-gray-400">
              {typeof plugin.publisher === 'string' ? plugin.publisher :
               typeof plugin.author === 'string' ? plugin.author : 'Unknown Publisher'}
            </span>
            {plugin.publisherUrl && typeof plugin.publisherUrl === 'string' && (
              <a
                href={plugin.publisherUrl}
                className="ml-2 text-blue-400 hover:text-blue-300 text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Publisher Website
              </a>
            )}
          </div>
          <div className="flex items-center mt-2">
            {renderRating()}
            <span className="text-sm text-gray-400 ml-4">
              {typeof plugin.downloadCount === 'number' ?
                plugin.downloadCount.toLocaleString() : '0'} downloads
            </span>
          </div>

          <div className="flex gap-2 mt-3">
            {plugin.installed ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                  onClick={(e) => {
                    e.preventDefault();
                    console.log(`ExtensionDetail: Uninstall button clicked for ${plugin.name}`);

                    // Thông báo cho người dùng trước khi uninstall
                    if (window.confirm(`Are you sure you want to uninstall ${plugin.name}?`)) {
                      console.log(`ExtensionDetail: User confirmed uninstall for ${plugin.name}`);

                      // Gọi hàm uninstall được truyền từ component cha
                      if (onUninstall) {
                        try {
                          onUninstall();
                        } catch (error) {
                          console.error(`ExtensionDetail: Error in onUninstall for ${plugin.name}:`, error);
                          alert(`Failed to uninstall ${plugin.name}. Please try again.`);
                        }
                      }
                    } else {
                      console.log(`ExtensionDetail: User cancelled uninstall for ${plugin.name}`);
                    }
                  }}
                >
                  <X className="w-3 h-3" />
                  Uninstall
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Auto Update
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Disable
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="flex items-center gap-1"
                onClick={() => onInstall?.()}
              >
                Install
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 text-sm">
        <div className="px-4 py-2 border-b-2 border-blue-500 text-white">DETAILS</div>
        <div className="px-4 py-2 text-gray-400 hover:text-white cursor-pointer">FEATURES</div>
        <div className="px-4 py-2 text-gray-400 hover:text-white cursor-pointer">CHANGELOG</div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="prose prose-invert max-w-none">
          <h3 className="text-lg font-semibold mb-2">{plugin.displayName || plugin.name}</h3>
          <p className="text-gray-300">{plugin.description}</p>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div>
              <h4 className="text-md font-semibold mb-2">Installation</h4>
              <div className="bg-gray-800 rounded p-3 text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-400">Identifier:</span>
                  <span>{plugin.name}</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-400">Version:</span>
                  <span>{plugin.version}</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-400">Publisher:</span>
                  <span>{plugin.publisher || plugin.author}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Runtime:</span>
                  <span>Node.js</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-md font-semibold mb-2">Marketplace</h4>
              <div className="bg-gray-800 rounded p-3 text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-400">Published:</span>
                  <span>{plugin.lastUpdated || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-400">Last Updated:</span>
                  <span>{plugin.lastUpdated || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Downloads:</span>
                  <span>{plugin.downloadCount?.toLocaleString() || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {plugin.categories && plugin.categories.length > 0 && (
            <div className="mt-6">
              <h4 className="text-md font-semibold mb-2">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {plugin.categories.map((category, index) => (
                  <span
                    key={index}
                    className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>
          )}

          {plugin.tags && plugin.tags.length > 0 && (
            <div className="mt-4">
              <h4 className="text-md font-semibold mb-2">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {plugin.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExtensionDetail;
