import React, { useEffect, useState } from 'react';
import { File, FolderOpenDot } from 'lucide-react';
import { IpcRendererEvent } from 'electron';
import { Button } from './ui/button';

interface ContentAreaProps {
    //width: number;
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
                    <div className="flex flex-col items-start justify-between w-full">
                        <span className="text-white">Explorer</span>
                            {selectedFolder ? (
                                <ul className="space-y-1">
                                    {renderFolderOrFiles(folderStructure)}
                                </ul>
                            ) : (
                                <div className="flex flex-row justify-between w-full">
                                <span className="text-white">NO FOLDER OPENED</span>
                                    <Button
                                        className="bg-transparent hover:bg-gray-700 rounded-md"
                                        onClick={openFolder}
                                    >
                                        <File size={5} />
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

    const renderFolderOrFiles = (items: any) => {
        if (!items) return null;
        return Object.entries(items).map(([name, type]: [string, any]) => (
            <li
                key={name}
                className="flex items-center cursor-pointer text-white hover:bg-gray-700 p-1 rounded"
                onClick={() => handleItemClick(name, type)}
            >
                {type === "directory" ? <FolderOpenDot /> : <File />}
                <span className="ml-2">{name}</span>
            </li>
        ));
    };

    const handleItemClick = (name: string, type: any) => {
        if (type === 'file') {
            onFileSelect(name);
        } else if (type === 'directory') {
            console.log(`Expanding folder: ${name}`);
        }
    };

    useEffect(() => {
        const listener = (event: IpcRendererEvent, structure: any) => {
            setFolderStructure(structure);
            setSelectedFolder(structure.path); // Store the folder path
        };

        window.electron.ipcRenderer.on('folder-structure', listener);

        return () => {
            window.electron.ipcRenderer.removeAllListeners('folder-structure');
        };
    }, []);
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