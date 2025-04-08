import React, { useEffect, useState } from 'react';
import { File, FolderOpen, ChevronDown, ChevronRight, RefreshCw, FilePlus, FolderPlus, MoreHorizontal } from 'lucide-react';
import { IpcRendererEvent } from 'electron';
import { Button } from './ui/button';

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
    const [pluginMessage, setPluginMessage] = useState<string | null>(null); // Thông báo từ plugin
    const [showChildren, setShowChildren] = useState<boolean>(true); // Control visibility of children
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
                    <div className="p-2">
                        <span className="text-white">Extensions</span>
                        {plugins.length > 0 ? (
                            <div>
                                <ul className="mt-2 space-y-2">
                                    {plugins.map((plugin) => (
                                        <li key={plugin} className="text-white bg-gray-800 p-2 rounded flex justify-between items-center">
                                            {plugin}
                                            {plugin === "pdf-export" && (
                                                <Button
                                                    className="ml-2 bg-blue-600 hover:bg-blue-700 text-white p-1 rounded"
                                                    onClick={() => handleApplyPlugin(plugin)}
                                                >
                                                    Apply
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                {plugins.includes("pdf-export") && (
                                    <p className="text-gray-400 text-xs mt-2">
                                        Click "Apply" on pdf-export to export the current file to PDF.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-white text-sm mt-2">No plugins available</p>
                        )}
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
    useEffect(() => {
        if (activeTab === "extensions") {
            window.electron.ipcRenderer.invoke("get-plugins").then((pluginList: string[]) => {
                setPlugins(pluginList || []);
            }).catch((error) => {
                console.error("Failed to fetch plugins:", error);
                setPlugins([]);
            });

            window.electron.ipcRenderer.on("plugin-list", (event, pluginList: string[]) => {
                setPlugins(pluginList || []);
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
            className="bg-[#252526] h-full overflow-hidden"
        >
            {renderContent()}
        </div>
    );
};

export default ContentArea;