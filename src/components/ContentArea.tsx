import React, { useEffect, useState } from 'react';
import { Box, Button, List, Text } from '@chakra-ui/react';
//import { ipcRenderer } from 'electron';
import { File, FolderOpenDot } from 'lucide-react';
import { IpcRendererEvent } from 'electron';

interface ContentAreaProps {
    width: number;
    activeTab: string;
    onFileSelect: (filePath: string) => void;
}

const ContentArea: React.FC<ContentAreaProps> = ({ width, activeTab, onFileSelect }) => {
    const [folderStructure, setFolderStructure] = useState<any>(null); // Store folder/file structure
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);  
    const renderContent = () => {
        switch (activeTab) {
            case 'explorer':
                return (
                    <Box p={2}>
                        <Text>Explorer</Text>
                        <Box mt={2}>
                            {selectedFolder ? (
                                <List.Root>
                                    {renderFolderOrFiles(folderStructure)}
                                </List.Root>
                            ) : (
                                <Text>NO FOLDER OPENED</Text>
                            )}
                            <Button
                                variant="ghost"
                                p={2}
                                w="full"
                                justifyContent="center"
                                _hover={{ bg: 'gray.700' }}
                                rounded="md"
                                onClick={openFolder}
                                mt={2}
                            >
                             <File size={20} />
                            </Button>
                        </Box>
                    </Box>
                );
            case 'search':
                return <Box p={2}><Text>Search Content</Text></Box>;
            case 'extensions':
                return <Box p={2}><Text>Extensions Content</Text></Box>;
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
            <List.Item key={name} display="flex" alignItems="center" cursor="pointer" onClick={() => handleItemClick(name, type)}>
                {type === 'directory' ? <FolderOpenDot /> : <File />}
                <Text ml={2}>{name}</Text>
            </List.Item>
        ));
    };

    const handleItemClick = (name: string, type: any) => {
        if (type === 'file') {
            // onFileSelect(path.join(selectedFolder!, name)); // Use the full path
            onFileSelect(name);
        } else if (type === 'directory') {
            // Optionally, expand the directory (implement recursive folder structure if needed)
            console.log(`Expanding folder: ${name}`);
        }
    };

    // useEffect(() => {
    //     // ipcRenderer.on('folder-structure', (event, structure) => {
    //     //     setFolderStructure(structure);
    //     //     setSelectedFolder(structure.path); // Store the folder path
    //     // });

    //     return () => {
    //        // ipcRenderer.removeAllListeners('folder-structure');
    //     };
    // }, []);
    useEffect(() => {
        // const listener = (event: Electron.IpcRendererEvent, structure: any) => {
        //     setFolderStructure(structure);
        //     setSelectedFolder(structure.path); // Store the folder path
        // };

        // window.electron.ipcRenderer.on('folder-structure', listener);

        // return () => {
        //     window.electron.ipcRenderer.removeAllListeners('folder-structure');
        // };
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
        <Box
            w={`${width}px`}
            bg="#191B1C"
            transition="all 0.3s"
            overflowY={width === 0 ? 'hidden' : 'auto'}
            p={width === 0 ? 0 : 2}
            h="100%"
        >
            {renderContent()}
        </Box>
    );
};

export default ContentArea;

// interface ContentAreaProps {
//     width: number;
//     activeTab: string;
// }

// const ContentArea: React.FC<ContentAreaProps> = ({ width, activeTab }) => {
//     const renderContent = () => {
//         switch (activeTab) {
//             case 'explorer':
//                 return (
//                     <Box p={2}>
//                         <Text>Explorer</Text>
//                         <Box mt={2}>
//                             <Text>NO FOLDER OPENED</Text>
//                         </Box>
//                     </Box>
//                 );
//             case 'search':
//                 return <Box p={2}><Text>Search Content</Text></Box>;
//             case 'extensions':
//                 return <Box p={2}><Text>Extensions Content</Text></Box>;
//             default:
//                 return null;
//         }
//     };

//     return (
//         <Box
//             w={`${width}px`} 
//             bg="#191B1C"
//             transition="all 0.3s"
//             overflowY="auto"
//             h="100%"
//         >
//             {renderContent()}
//         </Box>
//     );
// };

// export default ContentArea;