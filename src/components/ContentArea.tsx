import React, { useEffect, useState } from 'react';
import { File, FolderOpenDot } from 'lucide-react';
import { IpcRendererEvent } from 'electron';
import { Button } from './ui/button';

interface ContentAreaProps {
    activeTab: string;
    onFileSelect: (filePath: string) => void;
}

const ContentArea: React.FC<ContentAreaProps> = ({  activeTab, onFileSelect }) => {
    const [folderStructure, setFolderStructure] = useState<any>(null); // Store folder/file structure
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);  
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
                        <span className="text-white">Extensions Content</span>
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

    // const renderFolderOrFiles = (items: any) => {
    //     if (!items) return null;
    //     return Object.entries(items).map(([name, type]: [string, any]) => (

    //         <li
    //             key={name}
    //             className="flex items-center cursor-pointer text-white hover:bg-gray-700 p-1 rounded"
    //             onClick={() => handleItemClick(name, type)}
    //         >
    //             {type === "directory" ? <FolderOpenDot /> : <File />}
    //             <span className="ml-2">{name}</span>
    //         </li>
    //     ));
    // };

    // const handleItemClick = (name: string, type: any) => {
    //     if (type === 'file') {
    //         onFileSelect(name);
    //     } else if (type === 'directory') {
    //         console.log(`Expanding folder: ${name}`);
    //     }
    // };

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


    // useEffect(() => {
    //     const listener = (event: IpcRendererEvent, structure: any) => {
    //         setFolderStructure(structure);
    //         setSelectedFolder(structure.path); // Store the folder path
    //     };

    //     window.electron.ipcRenderer.on('folder-structure', listener);

    //     return () => {
    //         window.electron.ipcRenderer.removeAllListeners('folder-structure');
    //     };
    // }, []);
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