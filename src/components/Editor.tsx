import React, { useEffect, useRef, useState} from 'react';
import Editor from '@monaco-editor/react';
// import { spellCheck } from '../plugins/spellCheck';
// import { wordCount } from '../plugins/wordCount';
import { Alert, Box, Button, Flex, Text } from '@chakra-ui/react';
//import { ipcRenderer } from 'electron';
import { IpcRendererEvent } from 'electron';
import { TriangleAlert } from 'lucide-react';
interface EditorProps {
    onContentChange: (stats: { line: number; column: number; wordCount: number }) => void;
    loadFileContent: (filePath: string) => void;
}
const EditorComponent: React.FC<EditorProps> = ({ onContentChange, loadFileContent }) => {
    //const [openFiles, setOpenFiles] = useState<string[]>(['File1.txt']);
    //const [activeFile, setActiveFile] = useState('File1.txt');
    const [openFiles, setOpenFiles] = useState<string[]>([]);
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [editorContent, setEditorContent] = useState<string>('');
    const [saveStatus, setSaveStatus] = useState<string | null>(null);
    const handleEditorChange = (value: string | undefined) => {
        if (value) {
            setEditorContent(value);
            const lines = value.split('\n');
            const line = lines.length;
            const words = value.trim().split(/\s+/).filter(Boolean).length;
            const column = value.split('\n').pop()?.length || 1;
            onContentChange({ line, column, wordCount: words });
        }
    };

    const handleFileClick = (file: string) => {
            setActiveFile(file);
            loadFileContent(file);
    };

    const handleCloseFile = (file: string) => {
        setOpenFiles(openFiles.filter(f => f !== file));
        if (activeFile === file && openFiles.length > 1) {
            setActiveFile(openFiles[0]);
            loadFileContent(openFiles[0]);
        } else if(openFiles.length === 1) {
            setActiveFile('');
            setEditorContent('');
        }
    };

//     const loadFileContent = (filePath: string) => {
// //        ipcRenderer.send('open-file-request', filePath);
//         window.electron.ipcRenderer.send('open-file-request', filePath);

//     };

    const createNewFile = () => {
        const newFileName = `NewFile_${Date.now()}.txt`;
        setOpenFiles([...openFiles, newFileName]);
        setActiveFile(newFileName);
        setEditorContent('');
    };

    const saveFile = () => {
        if (activeFile) {
            //ipcRenderer.send('save-file-request', { filePath: activeFile, content: editorContent });
            window.electron.ipcRenderer.send('save-file-request', { filePath: activeFile, content: editorContent });
        }
    };

    useEffect(() => {
        const fileContentListener = (event: IpcRendererEvent, data: { content?: string, filePath?: string, error?: string }) => {
            console.log('Received file-content:', data);
            if (data.error) {
                setSaveStatus(`Failed to load file: ${data.error}`);
                setTimeout(() => setSaveStatus(null), 3000);
                return;
            }
            const { content, filePath } = data;
            setEditorContent(content || '');
            if (!openFiles.includes(filePath || '')) {
                setOpenFiles([...openFiles, filePath || '']);
            }
            setActiveFile(filePath || '');
        };

        const fileSavedListener = (event: IpcRendererEvent, { success, filePath, error }: { success: boolean, filePath: string, error?: string }) => {
            if (success) {
                setSaveStatus(`File saved successfully: ${filePath}`);
                setOpenFiles(prevFiles => {
                    const updatedFiles = [...prevFiles.filter(f => f !== activeFile), filePath]; // Cập nhật file mới, loại bỏ file cũ nếu khác
                    return Array.from(new Set(updatedFiles)); // Loại bỏ trùng lặp
                });
                setActiveFile(filePath);
            } else {
                setSaveStatus(`Failed to save file: ${error || 'Unknown error'}`);
            }
            setTimeout(() => setSaveStatus(null), 3000);
        };

        const newFileListener = (event: IpcRendererEvent, { fileName, success, error }: { fileName: string, success: boolean, error?: string }) => {
            if (success) {
                setOpenFiles([...openFiles, fileName]);
                setActiveFile(fileName);
                setEditorContent('');
                setSaveStatus(`New file created: ${fileName}`);
            } else {
                setSaveStatus(`Failed to create file: ${error || 'Unknown error'}`);
            }
            setTimeout(() => setSaveStatus(null), 3000);
        };

        window.electron.ipcRenderer.on('file-content', fileContentListener);
        window.electron.ipcRenderer.on('file-saved', fileSavedListener);
        window.electron.ipcRenderer.on('new-file-created', newFileListener);

        return () => {
            window.electron.ipcRenderer.removeAllListeners('file-content');
            window.electron.ipcRenderer.removeAllListeners('file-saved');
            window.electron.ipcRenderer.removeAllListeners('new-file-created');
        };
        // const fileContentListener = (event: IpcRendererEvent, { content, filePath }: { content: string, filePath: string }) => {
        //     setEditorContent(content);
        //     if (!openFiles.includes(filePath)) {
        //         setOpenFiles([...openFiles, filePath]);
        //     }
        //     setActiveFile(filePath);
        // };
        // window.electron.ipcRenderer.on('file-content', fileContentListener);

        // return () => {
        //     window.electron.ipcRenderer.removeAllListeners('file-content');
        // };

        // const fileSavedListener = (event: IpcRendererEvent, { success, filePath, error }: { success: boolean, filePath: string, error?: string }) => {
        //     if (success) {
        //         setSaveStatus(`File saved successfully: ${filePath}`);
        //         setTimeout(() => setSaveStatus(null), 3000); // Ẩn thông báo sau 3 giây
        //     } else {
        //         setSaveStatus(`Failed to save file: ${error || 'Unknown error'}`);
        //         setTimeout(() => setSaveStatus(null), 3000);
        //     }
        // };

        // const newFileListener = (event: IpcRendererEvent, { fileName, success, error }: { fileName: string, success: boolean, error?: string }) => {
        //     if (success) {
        //         setOpenFiles([...openFiles, fileName]);
        //         setActiveFile(fileName);
        //         setEditorContent('');
        //         setSaveStatus(`New file created: ${fileName}`);
        //         setTimeout(() => setSaveStatus(null), 3000);
        //     } else {
        //         setSaveStatus(`Failed to create file: ${error || 'Unknown error'}`);
        //     }
        // };

        // window.electron.ipcRenderer.on('file-content', fileContentListener);
        // window.electron.ipcRenderer.on('file-saved', fileSavedListener);
        // window.electron.ipcRenderer.on('new-file-created', newFileListener);

        // return () => {
        //     window.electron.ipcRenderer.removeAllListeners('file-content');
        //     window.electron.ipcRenderer.removeAllListeners('file-saved');
        //     window.electron.ipcRenderer.removeAllListeners('new-file-created');
        // };
        // const listener = (event: Electron.IpcRendererEvent, { content, filePath }: { content: string, filePath: string }) => {
        //     setEditorContent(content);
        //     if (!openFiles.includes(filePath)) {
        //         setOpenFiles([...openFiles, filePath]);
        //     }
        //     setActiveFile(filePath);
        // };

        // window.electron.ipcRenderer.on('file-content', listener);

        // return () => {
        //     window.electron.ipcRenderer.removeAllListeners('file-content');
        // };
    }, [openFiles]);

    return (
        <Flex flex={1} flexDir="column" bg="gray.900">
            {/* Open Files Bar */}
            <Flex
                bg="gray.800"
                p={2}
                borderBottom="1px"
                borderColor="gray.700"
                h="30px"
                alignItems="center"
                overflowX="auto"
            >
                {openFiles.map((file) => (
                    <Flex
                        key={file}
                        bg={activeFile === file ? 'gray.700' : 'gray.800'}
                        p={1}
                        px={2}
                        mr={2}
                        borderRadius={4}
                        alignItems="center"
                        cursor="pointer"
                        onClick={() => handleFileClick(file)}
                    >
                        <Text fontSize="xs">{file}</Text>
                        <Button
                            size="xs"
                            variant="ghost"
                            colorScheme="red"
                            ml={1}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCloseFile(file);
                            }}
                        >
                            ×
                        </Button>
                    </Flex>
                ))}
                <Button size="xs" onClick={createNewFile} ml={2}>New File</Button>
                <Button size="xs" onClick={saveFile} ml={2}>Save</Button>
            </Flex>

            {saveStatus && (
                <Alert.Root status={saveStatus.includes('success') ? 'success' : 'error'} mb={2}>
                    <TriangleAlert />
                    {saveStatus}
                </Alert.Root>
            )}

            {/* Monaco Editor */}
            <Box flex={1}>
                <Editor
                    height="100%"
                    defaultLanguage="plaintext"
                    defaultValue="// Start coding here"
                    value={editorContent}
                    theme="vs-dark"
                    onChange={handleEditorChange}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        automaticLayout: true,
                    }}
                />
            </Box>
        </Flex>
    );
};

export default EditorComponent;
