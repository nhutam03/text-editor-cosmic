import React, { useEffect, useState } from 'react';
import MonacoEditor, { monaco } from '@monaco-editor/react';
import { IpcRendererEvent } from 'electron';

interface EditorProps {
    loadFileContent: (filePath: string) => void;
    updateContent: (content: string) => void;
    onStatsChange?: (stats: any) => void;
    currentContent?: string; // Add prop for current content
    activeFile?: string; // Add prop for active file
    editorStats?: any; // Add prop for editor stats from parent
}

const Editor: React.FC<EditorProps> = ({ loadFileContent, updateContent, onStatsChange, currentContent, activeFile: propActiveFile, editorStats }) => {
    const [editor, setEditor] = useState<any>(null);
    const [openFiles, setOpenFiles] = useState<string[]>([]);
    // Use the activeFile prop from parent if available, otherwise use local state
    const [activeFile, setActiveFile] = useState<string | null>(propActiveFile || null);
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

    // Update activeFile when propActiveFile changes
    useEffect(() => {
        setActiveFile(propActiveFile || null);

        // Xác định ngôn ngữ dựa trên phần mở rộng của file
        if (propActiveFile) {
            const extension = propActiveFile.split('.').pop()?.toLowerCase() || '';
            const detectedLanguage = getLanguageFromExtension(extension);
            console.log('Detected language for', propActiveFile, ':', detectedLanguage);
            setLanguage(detectedLanguage);
            setStats(prev => ({
                ...prev,
                language: detectedLanguage
            }));

            // Focus lại vào editor khi file active thay đổi
            if (editor) {
                setTimeout(() => editor.focus(), 100);
            }
        }
    }, [propActiveFile, editor]);

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

    const handleEditorDidMount = (editor: any, monacoInstance: any) => {
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
            console.log('Language changed to:', e.newLanguage);
            setLanguage(e.newLanguage);
            setStats(prev => ({
                ...prev,
                language: e.newLanguage
            }));
        });

        // Thêm listener cho sự kiện focus và blur
        editor.onDidFocusEditorText(() => {
            console.log('Editor focused');
        });

        editor.onDidBlurEditorText(() => {
            console.log('Editor blurred');
            // Nếu lastAction là run-code, focus lại vào editor
            if (window.lastAction === 'run-code' || window.lastAction === 'stop-execution') {
                setTimeout(() => {
                    console.log('Trying to focus editor after blur in onDidBlurEditorText');
                    editor.focus();

                    // Thêm một lần nữa sau 300ms để đảm bảo editor được focus
                    setTimeout(() => {
                        console.log('Second attempt to focus editor after blur');
                        editor.focus();
                    }, 300);
                }, 200);
            }
        });

        // Thêm listener cho sự kiện keydown trên editor
        editor.onKeyDown((e: any) => {
            console.log('Editor key down:', e.browserEvent.key);
            // Nếu là phím F5, đặt timeout để focus lại vào editor
            if (e.browserEvent.key === 'F5') {
                setTimeout(() => {
                    console.log('Focusing editor after F5 key press in editor');
                    editor.focus();
                }, 300);
            }
        });

        // Cập nhật thông tin ban đầu
        const currentLanguage = editor.getModel()?.getLanguageId() || 'plaintext';
        console.log('Initial language:', currentLanguage);

        // Nếu activeFile tồn tại, xác định ngôn ngữ dựa trên phần mở rộng
        if (propActiveFile) {
            const extension = propActiveFile.split('.').pop()?.toLowerCase() || '';
            const detectedLanguage = getLanguageFromExtension(extension);
            console.log('Setting language for', propActiveFile, 'to', detectedLanguage);

            // Đặt ngôn ngữ cho editor
            const model = editor.getModel();
            if (model && monacoInstance) {
                monacoInstance.editor.setModelLanguage(model, detectedLanguage);
            }

            setLanguage(detectedLanguage);
        }

        setStats(prev => ({
            ...prev,
            language: currentLanguage,
            spaces: editor.getModel()?.getOptions().tabSize || 2
        }));

        // Focus vào editor sau khi mount
        setTimeout(() => {
            editor.focus();
        }, 100);

        // Lắng nghe sự kiện run-code-result từ main process
        window.electron.ipcRenderer.on('run-code-result', () => {
            console.log('Received run-code-result in editor, focusing editor...');
            setTimeout(() => {
                editor.focus();
            }, 200);
        });

        // Lắng nghe sự kiện stop-execution-result từ main process
        window.electron.ipcRenderer.on('stop-execution-result', () => {
            console.log('Received stop-execution-result in editor, focusing editor...');
            setTimeout(() => {
                editor.focus();
            }, 200);
        });
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
        // Sử dụng bảng ánh xạ để dễ dàng thêm các ngôn ngữ mới
        const languageMap: Record<string, string> = {
            // JavaScript
            'js': 'javascript',
            'jsx': 'javascript',
            'mjs': 'javascript',
            'cjs': 'javascript',

            // TypeScript
            'ts': 'typescript',
            'tsx': 'typescript',
            'mts': 'typescript',
            'cts': 'typescript',

            // Python
            'py': 'python',
            'pyw': 'python',
            'pyi': 'python',
            'pyx': 'python',

            // Web
            'html': 'html',
            'htm': 'html',
            'xhtml': 'html',
            'css': 'css',
            'scss': 'scss',
            'less': 'less',
            'json': 'json',
            'jsonc': 'jsonc',
            'xml': 'xml',
            'svg': 'xml',

            // Markdown
            'md': 'markdown',
            'markdown': 'markdown',

            // C/C++
            'c': 'c',
            'h': 'c',
            'cpp': 'cpp',  // Monaco sử dụng 'cpp' cho C++
            'hpp': 'cpp',
            'cc': 'cpp',
            'cxx': 'cpp',
            'c++': 'cpp',
            'hxx': 'cpp',
            'h++': 'cpp',

            // C#
            'cs': 'csharp',

            // Java
            'java': 'java',

            // PHP
            'php': 'php',

            // Ruby
            'rb': 'ruby',

            // Go
            'go': 'go',

            // Rust
            'rs': 'rust',

            // Shell
            'sh': 'shell',
            'bash': 'shell',
            'zsh': 'shell',

            // SQL
            'sql': 'sql',

            // YAML
            'yml': 'yaml',
            'yaml': 'yaml',

            // Text
            'txt': 'plaintext',
            'text': 'plaintext',
            'log': 'plaintext',

            // Lua
            'lua': 'lua',

            // PowerShell
            'ps1': 'powershell',
            'psm1': 'powershell',
            'psd1': 'powershell',

            // Perl
            'pl': 'perl',
            'pm': 'perl',

            // R
            'r': 'r',

            // Swift
            'swift': 'swift',

            // Objective-C
            'm': 'objective-c',
            'mm': 'objective-c',

            // Kotlin
            'kt': 'kotlin',
            'kts': 'kotlin',

            // Dart
            'dart': 'dart',

            // Scala
            'scala': 'scala',
            'sc': 'scala',

            // Haskell
            'hs': 'haskell',
            'lhs': 'haskell',
        };

        // Trả về ngôn ngữ tương ứng hoặc plaintext nếu không tìm thấy
        return languageMap[extension.toLowerCase()] || 'plaintext';
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

        // Focus lại vào editor sau khi tạo file mới
        if (editor) {
            setTimeout(() => editor.focus(), 100);
        }
    };

    const saveFile = () => {
        if (activeFile) {
            //ipcRenderer.send('save-file-request', { filePath: activeFile, content: editorContent });
            window.electron.ipcRenderer.send('save-file-request', { filePath: activeFile, content: editorContent });

            // Focus lại vào editor sau khi gửi yêu cầu lưu file
            if (editor) {
                setTimeout(() => editor.focus(), 100);
            }
        }
    };

    // Hàm để focus lại vào editor
    const focusEditor = () => {
        if (editor) {
            console.log('Focusing editor...');
            setTimeout(() => {
                editor.focus();
                // Đảm bảo rằng editor có thể nhận input
                const editorElement = document.querySelector('.monaco-editor');
                if (editorElement) {
                    (editorElement as HTMLElement).click();
                    (editorElement as HTMLElement).focus();
                }
            }, 100); // Đợi một chút để đảm bảo UI đã cập nhật
        }
    };

    // Thêm useEffect để lắng nghe sự kiện keydown và keyup để đảm bảo không có sự kiện nào đang bị chặn
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Kiểm tra xem editor có focus không
            const editorElement = document.querySelector('.monaco-editor');
            if (editorElement && document.activeElement !== editorElement) {
                console.log('Editor does not have focus, focusing it...');
                focusEditor();
            }
        };

        // Đăng ký sự kiện keydown
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [editor]);

    // Thêm useEffect để lắng nghe sự kiện focus và blur để đảm bảo editor luôn nhận được focus
    useEffect(() => {
        if (!editor) return;

        // Khi editor bị mất focus, kiểm tra xem có phải do chạy code không
        const handleEditorBlur = () => {
            console.log('Editor lost focus');
            if (window.lastAction === 'run-code') {
                // Đặt timeout để đảm bảo UI đã cập nhật
                setTimeout(() => {
                    console.log('Trying to focus editor after blur');
                    focusEditor();
                }, 300);
            }
        };

        // Thêm listener cho sự kiện blur của editor
        const editorElement = document.querySelector('.monaco-editor');
        if (editorElement) {
            editorElement.addEventListener('blur', handleEditorBlur);
        }

        return () => {
            if (editorElement) {
                editorElement.removeEventListener('blur', handleEditorBlur);
            }
        };
    }, [editor]);

    // Thêm useEffect để lắng nghe sự kiện run-code-result và focus lại vào editor
    useEffect(() => {
        // Hủy đăng ký các listener cũ trước khi đăng ký mới
        window.electron.ipcRenderer.removeAllListeners('run-code-result');

        const handleRunCodeResult = () => {
            console.log('Received run-code-result, focusing editor...');
            // Đặt timeout để đảm bảo UI đã cập nhật
            setTimeout(() => {
                focusEditor();

                // Thêm một lần nữa sau 500ms để đảm bảo editor được focus
                setTimeout(() => {
                    console.log('Second attempt to focus editor after run-code-result');
                    focusEditor();

                    // Thêm một lần nữa sau 1000ms để đảm bảo editor được focus
                    setTimeout(() => {
                        console.log('Third attempt to focus editor after run-code-result');
                        if (editor) {
                            editor.focus();
                        }

                        // Tìm editor và focus vào nó
                        const editorElement = document.querySelector('.monaco-editor');
                        if (editorElement) {
                            console.log('Final attempt to focus editor after run-code-result');
                            (editorElement as HTMLElement).click();
                            (editorElement as HTMLElement).focus();
                        }
                    }, 1000);
                }, 500);
            }, 200);
        };

        // Đăng ký listener
        window.electron.ipcRenderer.on('run-code-result', handleRunCodeResult);

        return () => {
            window.electron.ipcRenderer.removeAllListeners('run-code-result');
        };
    }, [editor]);

    useEffect(() => {
        // Hủy đăng ký các listener cũ trước khi đăng ký mới
        window.electron.ipcRenderer.removeAllListeners('file-content');
        window.electron.ipcRenderer.removeAllListeners('file-saved');
        window.electron.ipcRenderer.removeAllListeners('new-file-created');

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

            // Focus lại vào editor sau khi nội dung được cập nhật
            focusEditor();
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

                // Focus lại vào editor sau khi lưu file
                focusEditor();
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

                // Focus lại vào editor sau khi tạo file mới
                focusEditor();
            } else {
                setSaveStatus(`Failed to create file: ${error || 'Unknown error'}`);
            }
            setTimeout(() => setSaveStatus(null), 3000);
        };

        console.log('Registering IPC event listeners in Editor component');
        window.electron.ipcRenderer.on('file-content', fileContentListener);
        window.electron.ipcRenderer.on('file-saved', fileSavedListener);
        window.electron.ipcRenderer.on('new-file-created', newFileListener);

        return () => {
            console.log('Removing IPC event listeners in Editor component');
            window.electron.ipcRenderer.removeAllListeners('file-content');
            window.electron.ipcRenderer.removeAllListeners('file-saved');
            window.electron.ipcRenderer.removeAllListeners('new-file-created');
        };
    }, [openFiles, editor]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 bg-[#1e1e1e]">
                {/* Hiển thị editor khi có file đang mở hoặc đã chọn folder */}
                {activeFile ? (
                    <MonacoEditor
                        height="calc(100vh - 30px - 22px - 35px - 32px - 35px)"
                        defaultLanguage="plaintext"
                        value={currentContent || editorContent}
                        theme="vs-dark"
                        onChange={handleEditorChange}
                        onMount={handleEditorDidMount}
                        language={language} // Sử dụng ngôn ngữ đã xác định
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
                            },
                            emptySelectionClipboard: false,
                            folding: true,
                            lineDecorationsWidth: 10,
                            renderWhitespace: 'selection',
                            renderControlCharacters: true,
                            guides: { indentation: true },
                            fixedOverflowWidgets: true
                        }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="text-xl mb-4">Welcome to Text Editor</div>
                        <div className="text-sm mb-4">Open a folder or file to get started</div>
                        <div className="text-sm mb-6">
                            <div className="flex items-center justify-center mb-2">
                                <span className="bg-[#333] rounded px-2 py-1 mr-2 text-blue-400">Ctrl+N</span>
                                <span>Create a new file</span>
                            </div>
                            <div className="flex items-center justify-center mb-2">
                                <span className="bg-[#333] rounded px-2 py-1 mr-2 text-blue-400">Ctrl+O</span>
                                <span>Open a file</span>
                            </div>
                            <div className="flex items-center justify-center">
                                <span className="bg-[#333] rounded px-2 py-1 mr-2 text-blue-400">Ctrl+S</span>
                                <span>Save current file</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Editor;
