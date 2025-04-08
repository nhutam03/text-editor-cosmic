import React, { useEffect, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { IpcRendererEvent } from 'electron';

interface EditorProps {
    loadFileContent: (filePath: string) => void;
    updateContent: (content: string) => void;
    onStatsChange?: (stats: any) => void;
    currentContent?: string; // Add prop for current content
}

const Editor: React.FC<EditorProps> = ({ loadFileContent, updateContent, onStatsChange, currentContent }) => {
    const [editor, setEditor] = useState<any>(null);
    const [openFiles, setOpenFiles] = useState<string[]>([]);
    const [activeFile, setActiveFile] = useState<string | null>(null);
    // Use the currentContent prop from parent instead of maintaining our own state
    const [editorContent, setEditorContent] = useState<string>(currentContent || '');
    const [language, setLanguage] = useState<string>('text');
    const [saveStatus, setSaveStatus] = useState<string | null>(null);
    const [stats, setStats] = useState({
        line: 1,
        column: 1,
        wordCount: 0,
        page: 1,
        language: 'text',
        spaces: 2,
        encoding: 'UTF-8',
        lineEnding: 'CRLF'
    });

    // Gửi stats lên component cha khi stats thay đổi
    useEffect(() => {
        if (onStatsChange) {
            onStatsChange(stats);
        }
    }, [stats, onStatsChange]);

    // Update editor content when currentContent prop changes
    useEffect(() => {
        if (currentContent !== undefined) {
            setEditorContent(currentContent);
        }
    }, [currentContent]);

    // State cho StatusBar component - để tương thích với component StatusBar
    const [statusBarStats] = useState({
        line: 1,
        column: 1,
        wordCount: 0,
        page: 1,
        language: 'text'
    });

    const handleEditorChange = (value: string | undefined) => {
        const content = value || '';
        setEditorContent(content);
        updateContent(content);

        // Cập nhật stats
        const currentLine = editor?.getPosition()?.lineNumber || 1;
        const currentColumn = editor?.getPosition()?.column || 1;
        const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

        setStats(prev => ({
            ...prev,
            line: currentLine,
            column: currentColumn,
            wordCount: wordCount,
            page: Math.ceil(wordCount / 250),
            language: language
        }));
    };

    const handleEditorDidMount = (editor: any) => {
        setEditor(editor);

        editor.onDidChangeCursorPosition((e: any) => {
            setStats(prev => ({
                ...prev,
                line: e.position.lineNumber,
                column: e.position.column
            }));
        });

        // Theo dõi các thay đổi về ngôn ngữ
        editor.onDidChangeModelLanguage((e: any) => {
            setLanguage(e.newLanguage);
            setStats(prev => ({
                ...prev,
                language: e.newLanguage
            }));
        });

        // Cập nhật thông tin ban đầu
        setStats(prev => ({
            ...prev,
            language: editor.getModel()?.getLanguageId() || 'text',
            spaces: editor.getModel()?.getOptions().tabSize || 2
        }));
    };

    const handleFileClick = (file: string) => {
            setActiveFile(file);
            loadFileContent(file);
        // Xác định ngôn ngữ dựa trên phần mở rộng của file (ví dụ: .js, .py, .txt, v.v.)
        const extension = file.split('.').pop()?.toLowerCase() || 'txt';
        const detectedLanguage = getLanguageFromExtension(extension);
        setLanguage(detectedLanguage);
        setStats(prev => ({
            ...prev,
            language: detectedLanguage
        }));
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
            const detectedLanguage = getLanguageFromExtension(extension);
            setLanguage(detectedLanguage);
            setStats(prev => ({
                ...prev,
                language: detectedLanguage
            }));
        } else if(openFiles.length === 1) {
            setActiveFile('');
            setEditorContent('');
            const defaultLanguage = 'text';
            setLanguage(defaultLanguage);
            setStats(prev => ({
                ...prev,
                language: defaultLanguage
            }));
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
        const defaultLanguage = 'text';
        setLanguage(defaultLanguage);
        setStats(prev => ({
            ...prev,
            language: defaultLanguage
        }));
        updateContent('');
    };

    const saveFile = () => {
        if (activeFile) {
            //ipcRenderer.send('save-file-request', { filePath: activeFile, content: editorContent });
            window.electron.ipcRenderer.send('save-file-request', { filePath: activeFile, content: editorContent });
        }
    };

    useEffect(() => {
        const fileContentListener = (_event: IpcRendererEvent, data: { content?: string, filePath?: string, error?: string }) => {
            console.log('Received file-content:', data);
            if (data.error) {
                setSaveStatus(`Failed to load file: ${data.error}`);
                setTimeout(() => setSaveStatus(null), 3000);
                return;
            }
            const { content, filePath } = data;
            setEditorContent(content || '');
            updateContent(content || '');
            if (!openFiles.includes(filePath || '')) {
                setOpenFiles([...openFiles, filePath || '']);
            }
            setActiveFile(filePath || '');
            const extension = filePath?.split('.').pop()?.toLowerCase() || 'txt';
            const detectedLanguage = getLanguageFromExtension(extension);
            setLanguage(detectedLanguage);
            setStats(prev => ({
                ...prev,
                language: detectedLanguage
            }));
        };

        const fileSavedListener = (_event: IpcRendererEvent, { success, filePath, error }: { success: boolean, filePath: string, error?: string }) => {
            if (success) {
                setSaveStatus(`File saved successfully: ${filePath}`);
                setOpenFiles(prevFiles => {
                    const updatedFiles = [...prevFiles.filter(f => f !== activeFile), filePath]; // Cập nhật file mới, loại bỏ file cũ nếu khác
                    return Array.from(new Set(updatedFiles)); // Loại bỏ trùng lặp
                });
                setActiveFile(filePath);
                const extension = filePath.split('.').pop()?.toLowerCase() || 'txt';
                const detectedLanguage = getLanguageFromExtension(extension);
                setLanguage(detectedLanguage);
                setStats(prev => ({
                    ...prev,
                    language: detectedLanguage
                }));
            } else {
                setSaveStatus(`Failed to save file: ${error || 'Unknown error'}`);
            }
            setTimeout(() => setSaveStatus(null), 3000);
        };

        const newFileListener = (_event: IpcRendererEvent, { fileName, success, error }: { fileName: string, success: boolean, error?: string }) => {
            if (success) {
                setOpenFiles([...openFiles, fileName]);
                setActiveFile(fileName);
                setEditorContent('');
                setSaveStatus(`New file created: ${fileName}`);
                const detectedLanguage = 'markdown';
                setLanguage(detectedLanguage);
                setStats(prev => ({
                    ...prev,
                    language: detectedLanguage
                }));
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
        <div className="flex flex-col h-full">
            <div className="flex-1 bg-[#1e1e1e]">
                {(currentContent !== undefined && currentContent !== '') || (editorContent && editorContent !== '') ? (
                    <MonacoEditor
                        height="calc(100vh - 30px - 22px - 35px - 32px - 35px)"
                        defaultLanguage="text"
                        value={currentContent || editorContent}
                        theme="vs-dark"
                        onChange={handleEditorChange}
                        onMount={handleEditorDidMount}
                        language={language}
                        options={{
                            minimap: { enabled: true, scale: 0.8, side: 'right' },
                            fontSize: 14,
                            wordWrap: 'on',
                            lineNumbers: 'on',
                            renderLineHighlight: 'all',
                            automaticLayout: true,
                            scrollBeyondLastLine: false,
                            cursorBlinking: 'smooth',
                            cursorSmoothCaretAnimation: 'on',
                            scrollbar: {
                                vertical: 'visible',
                                horizontal: 'visible',
                                verticalScrollbarSize: 10,
                                horizontalScrollbarSize: 10
                            }
                        }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="text-xl mb-4">Welcome to Text Editor</div>
                        <div className="text-sm mb-2">Open a file from the explorer or create a new file to get started</div>
                        <div className="text-xs">
                            <span className="text-blue-400">Ctrl+N</span> - New File |
                            <span className="text-blue-400">Ctrl+O</span> - Open File |
                            <span className="text-blue-400">Ctrl+S</span> - Save File
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Editor;
