import React, { useEffect, useState } from 'react';
import { File, FolderOpenDot } from 'lucide-react';
import { IpcRendererEvent } from 'electron';
import { Button } from './ui/button';

interface ContentAreaProps {
    activeTab: string;
    onFileSelect: (filePath: string) => void;
    currentContent: string;
}

const ContentArea: React.FC<ContentAreaProps> = ({  activeTab, onFileSelect, currentContent }) => {
    const [folderStructure, setFolderStructure] = useState<any>(null); // Store folder/file structure
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);  
    const [plugins, setPlugins] = useState<string[]>([]);
    const renderContent = () => {
        switch (activeTab) {
            case 'explorer':
                return (
                    <div className="flex flex-col items-start justify-between w-full p-2">
                        <span className="text-white">Explorer</span>
                            {selectedFolder ? (
                                <ul className="space-y-1">
                                    {renderFolderOrFiles(folderStructure)}
                                </ul>
                            ) : (
                                <div className="flex flex-col justify-center w-full">
                                <span className="text-white text-sm">You have not yet opened a folder</span>
                                    <Button
                                        className="bg-transparent hover:bg-gray-700 bg-gray-800 text-white p-2 mt-2"
                                        onClick={openFolder}
                                    >
                                        <File size={5} />
                                        <span className="ml-2">Open Folder</span>
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
                                                    onClick={() => handleApplyPlugin(plugin, currentContent)}
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

    const renderFolderOrFiles = (node: any) => {
        if (!node) return null;

        return (
            <ul className="pl-4">
                <li key={node.name} className="flex flex-col">
                    <div
                        className="flex items-center cursor-pointer text-white hover:bg-gray-700 p-1 rounded"
                        onClick={() => handleItemClick(node)}
                    >
                        {node.type === "directory" ? (
                            <FolderOpenDot
                                className={`transition-transform ${expandedFolders.has(node.name) ? "rotate-90" : ""
                                    }`}
                            />
                        ) : (
                            <File />
                        )}
                        <span className="ml-2">{node.name}</span>
                    </div>
                    {node.type === "directory" && expandedFolders.has(node.name) && (
                        <div>{node.children.map(renderFolderOrFiles)}</div>
                    )}
                </li>
            </ul>
        );
    };

    const handleItemClick = (node: any) => {
        if (node.type === "file") {
            const filePath = selectedFolder ? `${selectedFolder}/${node.name}` : node.name;
            window.electron.ipcRenderer.send("open-file-request", filePath);
        } else if (node.type === "directory") {
            toggleFolder(node.name);
        }
    };

    const handleApplyPlugin = (plugin: string, content: string) => {
        // if (plugin === "pdf-export" && content) {
        //     window.electron.ipcRenderer.invoke("export-pdf", content).then((result) => {
        //         if (result) {
        //             alert(`PDF saved at: ${result}`);
        //         } else {
        //             alert("PDF export cancelled or failed.");
        //         }
        //     }).catch((error) => {
        //         console.error("Error exporting PDF:", error);
        //         alert("Failed to export PDF.");
        //     });
        // }
        if (plugin === "pdf-export") {
            if (!content) {
                alert("No content to export. Please open a file first.");
                return;
            }
            console.log("Exporting PDF with content:", content);
            window.electron.ipcRenderer.invoke("export-pdf", content).then((result) => {
                console.log("Export PDF result:", result);
                if (result) {
                    alert(`PDF saved at: ${result}`);
                } else {
                    alert("PDF export cancelled or failed.");
                }
            }).catch((error) => {
                console.error("Error exporting PDF:", error);
                alert("Failed to export PDF: " + error.message);
            });
        }
    };

    useEffect(() => {
        window.electron.ipcRenderer.on("file-content", (event: IpcRendererEvent, data: any) => {
            if (data.error) {
                console.error("Failed to open file:", data.error);
            } else {
                console.log("Opened file:", data.filePath);
                onFileSelect(data.content); // Gửi nội dung file lên cha
            }
        });

        return () => {
            window.electron.ipcRenderer.removeAllListeners("file-content");
        };
    }, []);
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
    useEffect(() => {
        if (activeTab === "extensions") {
            if (window.electron && window.electron.ipcRenderer && typeof window.electron.ipcRenderer.getPlugins === "function") {
                window.electron.ipcRenderer.getPlugins().then((pluginList) => {
                    setPlugins(pluginList || []);
                }).catch((error) => {
                    console.error("Failed to fetch plugins:", error);
                    setPlugins([]);
                });
            } else {
                console.error("electron.ipcRenderer.getPlugins is not available");
                setPlugins([]);
            }
        }
    }, [activeTab]);

    return (
        <div
            className={` bg-[#191B1C] transition-all duration-300 "
                } h-full`}
        >
            {renderContent()}
        </div>
    );
};

export default ContentArea;