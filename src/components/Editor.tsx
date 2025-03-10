import React, { useEffect, useRef, useState} from 'react';
import Editor from '@monaco-editor/react';
// import { spellCheck } from '../plugins/spellCheck';
// import { wordCount } from '../plugins/wordCount';
//import { ipcRenderer } from 'electron';
import { IpcRendererEvent } from 'electron';
import { TriangleAlert } from 'lucide-react';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
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
    const [language, setLanguage] = useState<string>('text');
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
        // Xác định ngôn ngữ dựa trên phần mở rộng của file (ví dụ: .js, .py, .txt, v.v.)
        const extension = file.split('.').pop()?.toLowerCase() || 'txt';
        setLanguage(getLanguageFromExtension(extension));
    };
    // Hàm xác định ngôn ngữ dựa trên phần mở rộng file
    const getLanguageFromExtension = (extension: string): string => {
        switch (extension) {
            case 'js':
            case 'jsx':
                return 'javascript';
            case 'ts':
            case 'tsx':
                return 'typescript';
            case 'py':
                return 'python';
            case 'json':
                return 'json';
            case 'html':
                return 'html';
            case 'css':
                return 'css';
            case 'txt':
            default:
                return 'text';
        }
    };
    const handleCloseFile = (file: string) => {
        setOpenFiles(openFiles.filter(f => f !== file));
        if (activeFile === file && openFiles.length > 1) {
            const newActive = openFiles.find(f => f !== file) || '';
            setActiveFile(openFiles[0]);
            loadFileContent(openFiles[0]);
            const extension = newActive.split('.').pop()?.toLowerCase() || 'txt';
            setLanguage(getLanguageFromExtension(extension));
        } else if(openFiles.length === 1) {
            setActiveFile('');
            setEditorContent('');
            setLanguage('text')
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
        setLanguage('text');
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
            const extension = filePath?.split('.').pop()?.toLowerCase() || 'txt';
            setLanguage(getLanguageFromExtension(extension));
        };

        const fileSavedListener = (event: IpcRendererEvent, { success, filePath, error }: { success: boolean, filePath: string, error?: string }) => {
            if (success) {
                setSaveStatus(`File saved successfully: ${filePath}`);
                setOpenFiles(prevFiles => {
                    const updatedFiles = [...prevFiles.filter(f => f !== activeFile), filePath]; // Cập nhật file mới, loại bỏ file cũ nếu khác
                    return Array.from(new Set(updatedFiles)); // Loại bỏ trùng lặp
                });
                setActiveFile(filePath);
                const extension = filePath.split('.').pop()?.toLowerCase() || 'txt';
                setLanguage(getLanguageFromExtension(extension));
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
                setLanguage('markdown');
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
        <div className="flex flex-1 flex-col bg-gray-900">
            <div className="flex bg-gray-800 p-2 border-b border-gray-700 h-[30px] items-center overflow-x-auto">
                {openFiles.map((file) => (
                    <div
                        key={file}
                        className={`flex items-center bg-${activeFile === file ? "gray-700" : "gray-800"
                            } p-1 px-2 mr-2 rounded cursor-pointer`}
                        onClick={() => handleFileClick(file)}
                    >
                        <span className="text-xs">{file}</span>
                        <Button
                            className="ml-1 h-5 w-5 p-0 bg-transparent hover:bg-red-600 text-red-500 hover:text-white rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCloseFile(file);
                            }}
                        >
                            ×
                        </Button>
                    </div>
                ))}
                <Button
                    className="ml-2 h-6 px-2 text-xs bg-gray-700 hover:bg-gray-600"
                    onClick={createNewFile}
                >
                    New File
                </Button>
                <Button
                    className="ml-2 h-6 px-2 text-xs bg-gray-700 hover:bg-gray-600"
                    onClick={saveFile}
                >
                    Save
                </Button>
            </div>

            {saveStatus && (
                <Alert
                    className={`mb-2 ${saveStatus.includes("success")
                            ? "bg-green-900 text-green-100"
                            : "bg-red-900 text-red-100"
                        }`}
                >
                    <TriangleAlert className="h-4 w-4" />
                    <AlertDescription>{saveStatus}</AlertDescription>
                </Alert>
            )}
            <div className="flex-1">
                <Editor
                    height="100%"
                    language={language}
                    defaultLanguage="text"
                    defaultValue="// Start coding here"
                    value={editorContent}
                    theme="vs-dark"
                    onChange={handleEditorChange}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        automaticLayout: true,
                    }}
                    beforeMount={(monaco) => {
                        monaco.languages.register({ id: "text" });
                        monaco.languages.setLanguageConfiguration("text", {
                            autoClosingPairs: [
                                { open: '"', close: '"' },
                                { open: "(", close: ")" },
                                { open: "[", close: "]" },
                                { open: "{", close: "}" },
                            ],
                            brackets: [
                                ["(", ")"],
                                ["[", "]"],
                                ["{", "}"],
                            ],
                        });
                    }}
                />
            </div>
        </div>
    );
};

export default EditorComponent;
