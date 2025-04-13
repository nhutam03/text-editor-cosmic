import React, { useEffect, useState } from 'react';
import { File, FolderOpen, ChevronDown, ChevronRight, RefreshCw, FilePlus, FolderPlus, MoreHorizontal, Download, Search } from 'lucide-react';
import { IpcRendererEvent } from 'electron';
import { Button } from './ui/button';
import { Input } from './ui/input';
import PluginMarketplace from './PluginMarketplace';

interface FolderStructureItem {
    name: string;
    type: 'directory' | 'file';
    children?: FolderStructureItem[];
}

interface ContentAreaProps {
    activeTab: string;
    onFileSelect: (filePath: string) => void;
    currentContent: string;
}

const ContentArea: React.FC<ContentAreaProps> = ({  activeTab, onFileSelect, currentContent }) => {
    const [folderStructure, setFolderStructure] = useState<FolderStructureItem | null>(null); // Store folder/file structure
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [plugins, setPlugins] = useState<string[]>([]);
    const [availablePlugins, setAvailablePlugins] = useState<{name: string, installed: boolean}[]>([]);
    const [pluginMessage, setPluginMessage] = useState<string | null>(null); // Thông báo từ plugin
    const [showChildren, setShowChildren] = useState<boolean>(true); // Control visibility of children
    const [showMarketplace, setShowMarketplace] = useState<boolean>(false);
    const [loadingAvailablePlugins, setLoadingAvailablePlugins] = useState<boolean>(false);
    const renderContent = () => {
        switch (activeTab) {
            case 'explorer':
                return (
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between p-2 text-xs">
                            <div className="flex items-center space-x-2">
                                <RefreshCw size={14} className="text-gray-400 hover:text-white cursor-pointer" />
                                <FilePlus size={14} className="text-gray-400 hover:text-white cursor-pointer"/>
                                <FolderPlus size={14} className="text-gray-400 hover:text-white cursor-pointer" onClick={openFolder} />
                                <MoreHorizontal size={14} className="text-gray-400 hover:text-white cursor-pointer" />
                            </div>
                        </div>
                        {selectedFolder ? (
                            <div className="overflow-y-auto">
                                <div className="text-sm">
                                    <div
                                        className="flex items-center px-2 py-1 hover:bg-[#2a2d2e] cursor-pointer"
                                        onClick={() => toggleRootFolder()}
                                    >
                                        {showChildren ?
                                            <ChevronDown size={16} className="text-gray-400" /> :
                                            <ChevronRight size={16} className="text-gray-400" />
                                        }
                                        <span className="ml-1 font-semibold">{folderStructure?.name || 'No folder'}</span>
                                    </div>
                                    {showChildren && (
                                        <div className="pl-4">
                                            {folderStructure?.children?.map((child: FolderStructureItem) => renderFolderOrFiles(child))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                                <span className="text-gray-400 text-sm mb-4">You have not yet opened a folder</span>
                                <Button
                                    className="bg-[#0e639c] hover:bg-[#1177bb] text-white px-4 py-2 rounded-sm text-sm"
                                    onClick={openFolder}
                                >
                                    <span>Open Folder</span>
                                </Button>
                            </div>
                        )}
                    </div>
                );
            case 'search':
                return (
                    <div className="p-2">
                        <div className="flex flex-col items-center justify-between">
                            <span className="text-white">Search</span>
                            <input
                                type="text"
                                className="w-full p-2 bg-gray-800 text-white rounded-md"
                                placeholder="Search..."
                            />
                        </div>
                    </div>
                );
            case 'extensions':
                return (
                    <div className="flex flex-col h-full">
                        {/* Extensions header */}
                        <div className="flex items-center justify-between p-3 border-b border-gray-700">
                            <div className="relative w-full">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    type="text"
                                    placeholder="Search Extensions in Marketplace"
                                    className="pl-8 bg-[#3c3c3c] border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="ml-2 flex items-center gap-1 text-xs"
                                onClick={() => setShowMarketplace(true)}
                            >
                                <span className="sr-only">More options</span>
                                <span>...</span>
                            </Button>
                        </div>

                        {/* Extensions content */}
                        <div className="flex-1 overflow-y-auto p-2">
                            {/* Installed extensions section */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">INSTALLED</h3>
                                    <ChevronDown size={16} className="text-gray-400" />
                                </div>

                                {plugins.length > 0 ? (
                                    <div className="space-y-1">
                                        {plugins.map((plugin) => (
                                            <div key={plugin} className="flex items-center justify-between p-2 hover:bg-[#2a2d2e] rounded cursor-pointer">
                                                <div>
                                                    <div className="font-medium text-sm">{plugin}</div>
                                                    <div className="text-xs text-gray-400">Text Editor Team</div>
                                                </div>
                                                <div className="flex items-center">
                                                    {plugin === "pdf-export" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 px-2 text-xs mr-2"
                                                            onClick={() => handleApplyPlugin(plugin)}
                                                        >
                                                            Apply
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2 text-xs"
                                                        onClick={() => handleUninstallPlugin(plugin)}
                                                    >
                                                        Uninstall
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-sm text-gray-400">
                                        No extensions installed
                                    </div>
                                )}
                            </div>

                            {/* Recommended extensions section */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">RECOMMENDED</h3>
                                    <ChevronDown size={16} className="text-gray-400" />
                                </div>

                                {loadingAvailablePlugins ? (
                                    <div className="flex justify-center items-center py-4">
                                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                                    </div>
                                ) : availablePlugins.filter(p => !p.installed).length > 0 ? (
                                    <div className="space-y-1">
                                        {availablePlugins
                                            .filter(plugin => !plugin.installed)
                                            .map((plugin) => (
                                                <div
                                                    key={plugin.name}
                                                    className="flex items-center justify-between p-2 hover:bg-[#2a2d2e] rounded cursor-pointer"
                                                    onClick={() => setShowMarketplace(true)}
                                                >
                                                    <div>
                                                        <div className="font-medium text-sm">{plugin.name}</div>
                                                        <div className="text-xs text-gray-400">Text Editor Team</div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2 text-xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleInstallPlugin(plugin.name);
                                                        }}
                                                    >
                                                        Install
                                                    </Button>
                                                </div>
                                            ))
                                        }
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-gray-400 mb-4 text-sm">No recommended extensions</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex items-center gap-1 text-xs"
                                            onClick={() => setShowMarketplace(true)}
                                        >
                                            <Download size={14} />
                                            Browse Extensions in Marketplace
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    const openFolder = () => {
        window.electron.ipcRenderer.send('open-folder-request');
       // ipcRenderer.send('open-folder-request');
    };
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    const toggleFolder = (folderName: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderName)) {
                newSet.delete(folderName);
            } else {
                newSet.add(folderName);
            }
            return newSet;
        });
    };

    const toggleRootFolder = () => {
        setShowChildren(prev => !prev);
    };

    const renderFolderOrFiles = (node: FolderStructureItem) => {
        if (!node) return null;

        return (
            <ul className="pl-4">
                <li key={node.name} className="flex flex-col">
                    <div
                        className="flex items-center cursor-pointer text-white hover:bg-gray-700 p-1 rounded"
                        onClick={() => handleItemClick(node)}
                    >
                        {node.type === "directory" ? (
                            expandedFolders.has(node.name) ?
                            <ChevronDown size={16} className="text-gray-400" /> :
                            <ChevronRight size={16} className="text-gray-400" />
                        ) : (
                            <File size={16} className="text-blue-400" />
                        )}
                        <span className="ml-2">{node.name}</span>
                    </div>
                    {node.type === "directory" && expandedFolders.has(node.name) && node.children && (
                        <div>{node.children.map(child => renderFolderOrFiles(child))}</div>
                    )}
                </li>
            </ul>
        );
    };

    const handleItemClick = (node: any) => {
        if (node.type === "file") {
            const filePath = selectedFolder ? `${selectedFolder}/${node.name}` : node.name;
            // Instead of directly sending the IPC message, notify the parent component
            onFileSelect(filePath);
        } else if (node.type === "directory") {
            toggleFolder(node.name);
        }
    };

    // const handleApplyPlugin = (plugin: string, content: string) => {
    //     if (plugin === "pdf-export") {
    //         if (!content) {
    //             alert("No content to export. Please open a file first.");
    //             return;
    //         }
    //         console.log("Exporting PDF with content:", content);
    //         window.electron.ipcRenderer.invoke("export-pdf", content).then((result) => {
    //             console.log("Export PDF result:", result);
    //             if (result) {
    //                 alert(`PDF saved at: ${result}`);
    //             } else {
    //                 alert("PDF export cancelled or failed.");
    //             }
    //         }).catch((error) => {
    //             console.error("Error exporting PDF:", error);
    //             alert("Failed to export PDF: " + error.message);
    //         });
    //     }
    // };
    const handleApplyPlugin = (plugin: string) => {
        if (plugin === "pdf-export") {
            if (!currentContent) {
                alert("No content to export. Please open a file first.");
                return;
            }
            window.electron.ipcRenderer.send("apply-plugin", plugin, currentContent);
        }
    };

    // Hàm cài đặt plugin
    const handleInstallPlugin = async (pluginName: string) => {
        try {
            let result;
            try {
                // Thử sử dụng invoke trước
                result = await window.electron.ipcRenderer.invoke("install-plugin", pluginName);
            } catch (invokeError) {
                // Nếu invoke không hoạt động, thử sử dụng hàm trực tiếp
                console.log("Falling back to direct method call for installPlugin");
                result = await window.electron.ipcRenderer.installPlugin(pluginName);
            }

            if (result && result.success) {
                setPluginMessage(`Successfully installed ${pluginName}`);
                // Cập nhật lại danh sách plugin
                await loadAvailablePlugins();
                // Tải lại danh sách plugin đã cài đặt
                const pluginList = await window.electron.ipcRenderer.invoke("get-plugins");
                setPlugins(pluginList || []);
            } else {
                setPluginMessage(`Failed to install ${pluginName}: ${result?.error || 'Unknown error'}`);
            }
        } catch (error: any) {
            setPluginMessage(`Error installing ${pluginName}: ${error.message}`);
            console.error(`Error installing plugin ${pluginName}:`, error);
        }
    };

    // Hàm gỡ cài đặt plugin
    const handleUninstallPlugin = async (pluginName: string) => {
        try {
            let result;
            try {
                // Thử sử dụng invoke trước
                result = await window.electron.ipcRenderer.invoke("uninstall-plugin", pluginName);
            } catch (invokeError) {
                // Nếu invoke không hoạt động, thử sử dụng hàm trực tiếp
                console.log("Falling back to direct method call for uninstallPlugin");
                result = await window.electron.ipcRenderer.uninstallPlugin(pluginName);
            }

            if (result && result.success) {
                setPluginMessage(`Successfully uninstalled ${pluginName}`);
                // Cập nhật lại danh sách plugin
                await loadAvailablePlugins();
                // Tải lại danh sách plugin đã cài đặt
                const pluginList = await window.electron.ipcRenderer.invoke("get-plugins");
                setPlugins(pluginList || []);
            } else {
                setPluginMessage(`Failed to uninstall ${pluginName}: ${result?.error || 'Unknown error'}`);
            }
        } catch (error: any) {
            setPluginMessage(`Error uninstalling ${pluginName}: ${error.message}`);
            console.error(`Error uninstalling plugin ${pluginName}:`, error);
        }
    };

    // We don't need to listen for file-content here anymore
    // The App component will handle file content loading
    useEffect(() => {
        window.electron.ipcRenderer.on('folder-structure', (event, structure) => {
            setFolderStructure(structure);
            setSelectedFolder(structure.name); // Lưu thư mục đã chọn
        });

        return () => {
            window.electron.ipcRenderer.removeAllListeners('folder-structure');
        };
    }, []);
    // Lấy danh sách plugin khi tab extensions được mở
    // useEffect(() => {
    //     if (activeTab === "extensions") {
    //         if (window.electron && window.electron.ipcRenderer && typeof window.electron.ipcRenderer.getPlugins === "function") {
    //             window.electron.ipcRenderer.getPlugins().then((pluginList) => {
    //                 setPlugins(pluginList || []);
    //             }).catch((error) => {
    //                 console.error("Failed to fetch plugins:", error);
    //                 setPlugins([]);
    //             });
    //         } else {
    //             console.error("electron.ipcRenderer.getPlugins is not available");
    //             setPlugins([]);
    //         }
    //     }
    // }, [activeTab]);
    // Hàm tải danh sách plugin có sẵn từ marketplace
    const loadAvailablePlugins = async () => {
        try {
            setLoadingAvailablePlugins(true);
            const plugins = await window.electron.ipcRenderer.invoke("get-available-plugins");
            setAvailablePlugins(plugins || []);
        } catch (error) {
            console.error("Failed to fetch available plugins:", error);
            setAvailablePlugins([]);
        } finally {
            setLoadingAvailablePlugins(false);
        }
    };

    useEffect(() => {
        if (activeTab === "extensions") {
            // Tải danh sách plugin đã cài đặt
            window.electron.ipcRenderer.invoke("get-plugins").then((pluginList: string[]) => {
                setPlugins(pluginList || []);
            }).catch((error) => {
                console.error("Failed to fetch plugins:", error);
                setPlugins([]);
            });

            // Tải danh sách plugin có sẵn từ marketplace
            loadAvailablePlugins();

            window.electron.ipcRenderer.on("plugin-list", (event, pluginList: string[]) => {
                setPlugins(pluginList || []);
                // Cập nhật lại danh sách plugin có sẵn khi danh sách plugin đã cài đặt thay đổi
                loadAvailablePlugins();
            });

            window.electron.ipcRenderer.on("plugin-applied", (event, message: string) => {
                setPluginMessage(message);
                setTimeout(() => setPluginMessage(null), 5000); // Ẩn thông báo sau 5 giây
            });
        }

        return () => {
            window.electron.ipcRenderer.removeAllListeners("plugin-list");
            window.electron.ipcRenderer.removeAllListeners("plugin-applied");
        };
    }, [activeTab]);

    return (
        <div
            className="bg-[#252526] h-full overflow-hidden relative"
        >
            {renderContent()}
            {pluginMessage && (
                <div className="absolute bottom-4 right-4 bg-gray-800 text-white p-3 rounded shadow-lg">
                    {pluginMessage}
                </div>
            )}
            {showMarketplace && (
                <PluginMarketplace onClose={() => setShowMarketplace(false)} />
            )}
        </div>
    );
};

export default ContentArea;