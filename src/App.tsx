import React, { useEffect, useState, useRef } from 'react';
import Editor from './components/Editor';
import Sidebar from './components/Sidebar';
import ContentArea from './components/ContentArea';
import Terminal from './components/Terminal';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './components/ui/resizable';
import { ChevronLeft, ChevronRight, Search, X, Maximize2, Minimize2, Save, FolderOpen, FilePlus, Copy, Scissors, Clipboard, FileText, Play, Square } from 'lucide-react';
import { MenuItem } from './plugin/MenuContribution';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('explorer');
  const [contentSize, setContentSize] = useState(20);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [currentContent, setCurrentContent] = useState("");
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');
  const [modifiedFiles, setModifiedFiles] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [showTerminal, setShowTerminal] = useState(false);
  const [activeTerminalTab, setActiveTerminalTab] = useState('TERMINAL');
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showRunMenu, setShowRunMenu] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  // Vẫn giữ lại state này để sử dụng cho các plugin khác
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const [installedPlugins, setInstalledPlugins] = useState<string[]>([]);
  const [pluginMenuItems, setPluginMenuItems] = useState<MenuItem[]>([]);
  const [editorStats, setEditorStats] = useState({
    line: 24,
    column: 5,
    spaces: 2,
    encoding: 'UTF-8',
    lineEnding: 'CRLF',
    language: 'TypeScript JSX'
  });
  // terminalOutput đã được khai báo ở trên
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const editMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const runMenuRef = useRef<HTMLDivElement>(null);
  const defaultContentSize = 20;

  const toggleRightSidebar = () => {
    setIsRightSidebarCollapsed((prev) => !prev);
  };
  const handleTabClick = (tab: string) => {
    if (tab === activeTab) {
      toggleRightSidebar(); // Đảo trạng thái sidebar
    } else {
      setActiveTab(tab);
      setIsRightSidebarCollapsed(false); // Mở sidebar khi đổi tab
    }
  };
  // Track original content to detect modifications
  const [originalContent, setOriginalContent] = useState<{[key: string]: string}>({});

  const updateCurrentContent = (content: string) => {
    setCurrentContent(content);

    // Mark the active file as modified if content changed from original
    if (activeFile) {
      if (originalContent[activeFile] !== content) {
        if (!modifiedFiles.includes(activeFile)) {
          setModifiedFiles([...modifiedFiles, activeFile]);
        }
      } else {
        // Content matches original, remove from modified list
        setModifiedFiles(modifiedFiles.filter(file => file !== activeFile));
      }
    }
  };
  const handleFileSelect = (filePath: string) => {
    // This is called when a file is selected from ContentArea
    console.log('File selected from ContentArea:', filePath);

    // Load the file content
    loadFileContent(filePath);

    // The file will be added to openFiles in the handleFileOpened function
    // when the 'file-opened' event is received
  };
  const loadFileContent = (fileName: string) => {
    console.log('Loading file content for:', fileName);

    // Gửi yêu cầu mở file
    window.electron.ipcRenderer.send('open-file-request', fileName);
  };

  const toggleTerminal = () => {
    setShowTerminal(prev => !prev);
  };

  const handleTerminalTabClick = (tab: string) => {
    setActiveTerminalTab(tab);
  };

  const toggleFileMenu = () => {
    setShowFileMenu(prev => !prev);
    setShowEditMenu(false);
    setShowViewMenu(false);
  };

  const toggleEditMenu = () => {
    setShowEditMenu(prev => !prev);
    setShowFileMenu(false);
    setShowViewMenu(false);
  };

  const toggleViewMenu = () => {
    setShowViewMenu(prev => !prev);
    setShowFileMenu(false);
    setShowEditMenu(false);
    setShowRunMenu(false);
  };

  const toggleRunMenu = () => {
    setShowRunMenu(prev => !prev);
    setShowFileMenu(false);
    setShowEditMenu(false);
    setShowViewMenu(false);
  };

  const closeAllMenus = () => {
    setShowFileMenu(false);
    setShowEditMenu(false);
    setShowViewMenu(false);
    setShowRunMenu(false);
  };

  const handleNewFile = () => {
    const newFileName = `new-file-${openFiles.length + 1}.txt`;

    // Create a new array for openFiles
    const newOpenFiles = [...openFiles];

    // Limit to 5 open files - remove oldest if needed
    if (newOpenFiles.length >= 5) {
      newOpenFiles.shift(); // Remove the oldest file
    }

    // Add the new file
    newOpenFiles.push(newFileName);

    // Update states
    setOpenFiles(newOpenFiles);
    setActiveFile(newFileName);
    setCurrentContent(''); // Xóa nội dung hiện tại để tạo file mới trống

    // Set original content for the new file (empty string)
    setOriginalContent(prev => ({
      ...prev,
      [newFileName]: ''
    }));

    // Mark the new file as modified
    const newModifiedFiles = [...modifiedFiles, newFileName];
    setModifiedFiles(newModifiedFiles);

    closeAllMenus();

    // Nếu đã có thư mục được chọn, tạo file mới trong thư mục đó
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.send('create-new-file-request', newFileName);
    }
  };

  const handleOpenFile = () => {
    console.log('Sending open-file-dialog event');
    window.electron.ipcRenderer.send('open-file-dialog');
    closeAllMenus();
  };

  const handleSaveFile = () => {
    if (activeFile && currentContent !== undefined) {
      console.log('Saving file:', activeFile, 'Content length:', currentContent.length);

      // If it's a new file (starts with 'new-file-'), show save dialog
      if (activeFile.startsWith('new-file-')) {
        window.electron.ipcRenderer.send('save-file-request', { filePath: activeFile, content: currentContent });
      } else {
        window.electron.ipcRenderer.send('save-file', { content: currentContent, fileName: activeFile });
      }
    } else {
      console.warn('Cannot save file: No active file or content is undefined', { activeFile, contentLength: currentContent?.length });

      // If there's content but no active file, create a new file
      if (!activeFile && currentContent !== undefined && currentContent.trim() !== '') {
        handleNewFile();
      }
    }
    closeAllMenus();
  };

  // Hàm xử lý Export to PDF - Chức năng tích hợp trực tiếp
  const handleExportToPdf = () => {
    console.log('handleExportToPdf called');

    if (activeFile && currentContent !== undefined) {
      console.log('Exporting to PDF:', activeFile, 'Content length:', currentContent.length);

      // Hủy đăng ký listener cũ trước khi đăng ký mới
      window.electron.ipcRenderer.removeAllListeners('export-to-pdf-result');

      // Đăng ký listener mới
      window.electron.ipcRenderer.on('export-to-pdf-result', (_event: any, result: any) => {
        if (result.success) {
          console.log('Export to PDF successful:', result.message);
          // Hiển thị thông báo thành công
          alert(result.message);
        } else {
          console.error('Export to PDF failed:', result.message);
          // Hiển thị thông báo lỗi
          alert(`Export to PDF failed: ${result.message}`);
        }
      });

      // Sử dụng chức năng export-to-pdf tích hợp trực tiếp
      console.log('Using built-in Export to PDF function');
      window.electron.ipcRenderer.send('export-to-pdf', currentContent, activeFile);
    } else {
      // Hiển thị thông báo nếu không có file nào đang mở
      alert('No file is currently open. Please open a file before exporting to PDF.');
    }
    closeAllMenus();
  };

  const handleCopy = () => {
    // Sử dụng Clipboard API thay vì document.execCommand
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      navigator.clipboard.writeText(selection.toString())
        .catch(err => console.error('Failed to copy text: ', err));
    }
    closeAllMenus();
  };

  const handlePaste = async () => {
    // Sử dụng Clipboard API thay vì document.execCommand
    try {
      const text = await navigator.clipboard.readText();
      // Để chèn văn bản, cần có tương tác với editor
      console.log('Text from clipboard:', text);
    } catch (err) {
      console.error('Failed to paste text: ', err);
    }
    closeAllMenus();
  };

  const handleCut = () => {
    // Sử dụng Clipboard API thay vì document.execCommand
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      navigator.clipboard.writeText(selection.toString())
        .then(() => {
          // Xóa văn bản đã chọn (cần có tương tác với editor)
          console.log('Text cut to clipboard');
        })
        .catch(err => console.error('Failed to cut text: ', err));
    }
    closeAllMenus();
  };

  // Hàm xử lý Run Code
  const handleRunCode = () => {
    if (activeFile) {
      const extension = activeFile.split('.').pop()?.toLowerCase();

      // Xử lý đặc biệt cho file C++
      let language = extension;
      if (extension === 'cpp' || extension === 'cc' || extension === 'cxx' || extension === 'c++') {
        language = 'cpp';
      }

      // Thêm output vào terminal
      setTerminalOutput(`$ Running ${activeFile}...\n[${new Date().toLocaleTimeString()}] Starting execution...\n[${new Date().toLocaleTimeString()}] Processing file: ${activeFile}\n`);

      // Hiển thị terminal nếu chưa hiển thị
      if (!showTerminal) {
        setShowTerminal(true);
      }

      // Chuyển sang tab TERMINAL
      setActiveTerminalTab('TERMINAL');

      // Đánh dấu đang chạy code
      setIsRunning(true);

      // Gọi hàm chạy code tương ứng với ngôn ngữ
      console.log(`Sending file content for: ${activeFile}`);
      console.log(`Menu items for file: ${JSON.stringify(pluginMenuItems.filter(item => item.parentMenu.toLowerCase() === 'file').map(item => item.label))}`);
      console.log(`Menu items for edit: ${JSON.stringify(pluginMenuItems.filter(item => item.parentMenu.toLowerCase() === 'edit').map(item => item.label))}`);
      console.log(`Running code in ${language} language, code length: ${currentContent?.length || 0}`);

      // Lưu trạng thái để biết rằng chúng ta vừa chạy code
      // Điều này sẽ được sử dụng để focus lại vào editor sau khi nhận kết quả
      window.lastAction = 'run-code';

      // Lưu lại editor element trước khi gửi yêu cầu chạy code
      const editorElement = document.querySelector('.monaco-editor');

      // Gửi yêu cầu chạy code
      window.electron.ipcRenderer.send('run-code', {
        code: currentContent,
        fileName: activeFile,
        language: language
      });

      // Đặt timeout để focus lại vào editor sau khi terminal được hiển thị
      setTimeout(() => {
        if (editorElement) {
          console.log('Focusing editor after run code request');
          (editorElement as HTMLElement).click();
          (editorElement as HTMLElement).focus();
        }
      }, 500);
    } else {
      alert('No file is currently open. Please open a file before running code.');
    }
    closeAllMenus();
  };

  // Hàm xử lý Stop Execution
  const handleStopExecution = () => {
    if (isRunning) {
      console.log('Stopping code execution');
      window.electron.ipcRenderer.send('stop-execution');
      setIsRunning(false);

      // Lưu trạng thái để biết rằng chúng ta vừa dừng chạy code
      window.lastAction = 'stop-execution';

      // Lưu lại editor element trước khi gửi yêu cầu dừng chạy code
      const editorElement = document.querySelector('.monaco-editor');

      // Đặt timeout để focus lại vào editor sau khi terminal được cập nhật
      setTimeout(() => {
        if (editorElement) {
          console.log('Focusing editor after stop execution request');
          (editorElement as HTMLElement).click();
          (editorElement as HTMLElement).focus();
        }
      }, 500);
    }
    closeAllMenus();
  };

  const handleCloseFile = (fileName: string) => {
    console.log('handleCloseFile called for:', fileName);

    // Find the index of the file being closed
    const fileIndex = openFiles.indexOf(fileName);
    console.log('File index in openFiles array:', fileIndex);

    // Create a new array without the file to close
    const newOpenFiles = openFiles.filter(file => file !== fileName);
    console.log('New openFiles array after removal:', newOpenFiles);

    // Update the openFiles state
    setOpenFiles(newOpenFiles);

    // If there are no more files open, clear the active file to show welcome screen
    if (newOpenFiles.length === 0) {
      console.log('No more files open, showing welcome screen');
      setActiveFile('');
      setCurrentContent('');
    }
    // If the closed file was the active file, set a new active file
    else if (activeFile === fileName) {
      console.log('Closed file was the active file, selecting new active file');
      // Determine which file to activate next
      let nextActiveFileIndex;

      if (fileIndex > 0) {
        // If not the first file, activate the previous file
        nextActiveFileIndex = fileIndex - 1;
      } else {
        // If it was the first file, activate the new first file
        nextActiveFileIndex = 0;
      }

      // Make sure the index is valid
      if (nextActiveFileIndex >= newOpenFiles.length) {
        nextActiveFileIndex = newOpenFiles.length - 1;
      }

      const nextActiveFile = newOpenFiles[nextActiveFileIndex];
      console.log('Setting new active file to:', nextActiveFile);
      setActiveFile(nextActiveFile);

      // Load the content of the new active file
      loadFileContent(nextActiveFile);
    } else {
      console.log('Closed file was not the active file, active file remains:', activeFile);
    }

    // Remove the file from originalContent and modifiedFiles
    setOriginalContent(prev => {
      const newContent = {...prev};
      delete newContent[fileName];
      return newContent;
    });

    setModifiedFiles(prev => prev.filter(file => file !== fileName));
  };

  const updateEditorStats = (stats: any) => {
    setEditorStats(stats);
  };

  // Xử lý phím tắt
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+` để hiển thị/ẩn terminal
      if (e.ctrlKey && e.shiftKey && e.key === '`') {
        toggleTerminal();
      }
      // Ctrl+S để lưu file
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveFile();
      }
      // Ctrl+O để mở file
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        handleOpenFile();
      }
      // Ctrl+N để tạo file mới
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
      }
      // Ctrl+E để Export to PDF
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        handleExportToPdf();
      }
      // F5 để chạy code
      if (e.key === 'F5') {
        e.preventDefault();
        handleRunCode();

        // Đặt timeout để focus lại vào editor sau khi chạy code
        setTimeout(() => {
          // Tìm editor và focus vào nó
          const editorElement = document.querySelector('.monaco-editor');
          if (editorElement) {
            console.log('Focusing editor after F5 key press');
            (editorElement as HTMLElement).click();
            (editorElement as HTMLElement).focus();
          }
        }, 300);
      }
      // Shift+F5 để dừng chạy code
      if (e.shiftKey && e.key === 'F5') {
        e.preventDefault();
        handleStopExecution();

        // Đặt timeout để focus lại vào editor sau khi dừng chạy code
        setTimeout(() => {
          // Tìm editor và focus vào nó
          const editorElement = document.querySelector('.monaco-editor');
          if (editorElement) {
            console.log('Focusing editor after Shift+F5 key press');
            (editorElement as HTMLElement).click();
            (editorElement as HTMLElement).focus();
          }
        }, 300);
      }
      // Shift+Alt+F để định dạng mã với Prettier
      if (e.shiftKey && e.altKey && e.key === 'F') {
        e.preventDefault();
        // Tìm menu item Format Document
        const formatMenuItem = pluginMenuItems.find(
          item => item.id === 'prettier-plugin.formatDocument' && item.parentMenu.toLowerCase() === 'edit'
        );

        if (formatMenuItem && activeFile && currentContent) {
          console.log('Executing Format Document shortcut');
          window.electron.ipcRenderer.executeMenuAction(formatMenuItem.id, currentContent, activeFile);
        } else {
          console.log('Format Document menu item not found or no active file');
        }
      }
      // Esc để đóng tất cả menu
      if (e.key === 'Escape') {
        closeAllMenus();
      }
    };

    // Xử lý click bên ngoài menu để đóng menu
    const handleClickOutside = (e: MouseEvent) => {
      // Kiểm tra xem click có phải là trên menu item không
      const target = e.target as HTMLElement;
      const isMenuItemClick = target.closest('.menu-item');

      // Nếu là click trên menu item, không đóng menu
      if (isMenuItemClick) {
        console.log('Click on menu item detected, not closing menu');
        return;
      }

      // Kiểm tra xem click có phải là trên menu header không
      const isMenuHeaderClick = target.closest('.menu-header');
      if (isMenuHeaderClick) {
        console.log('Click on menu header detected');
        return;
      }

      // Nếu click bên ngoài menu, đóng menu
      if (
        fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node) &&
        editMenuRef.current && !editMenuRef.current.contains(e.target as Node) &&
        viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node) &&
        runMenuRef.current && !runMenuRef.current.contains(e.target as Node)
      ) {
        console.log('Click outside menu detected, closing all menus');
        closeAllMenus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleSaveFile, handleOpenFile, handleNewFile, toggleTerminal, closeAllMenus, pluginMenuItems, activeFile, currentContent, handleRunCode, handleStopExecution, handleExportToPdf]);

  // Lấy danh sách plugins đã cài đặt
  useEffect(() => {
    const getInstalledPlugins = async () => {
      try {
        const plugins = await window.electron.ipcRenderer.invoke("get-plugins");
        setInstalledPlugins(plugins || []);

        // Đăng ký lắng nghe sự kiện khi danh sách plugin thay đổi
        window.electron.ipcRenderer.on("plugin-list", (_event: Electron.IpcRendererEvent, pluginList: string[]) => {
          setInstalledPlugins(pluginList || []);
        });
      } catch (error) {
        console.error("Failed to fetch installed plugins:", error);
        setInstalledPlugins([]);
      }
    };

    getInstalledPlugins();

    return () => {
      window.electron.ipcRenderer.removeAllListeners("plugin-list");
    };
  }, []);

  // Hàm để focus lại vào editor
  const focusEditorAfterAction = () => {
    // Đặt timeout để đảm bảo UI đã cập nhật
    setTimeout(() => {
      // Tìm editor và focus vào nó
      const editorElement = document.querySelector('.monaco-editor');
      if (editorElement) {
        console.log('Focusing editor after action');
        // Click trước để đảm bảo editor nhận được focus
        (editorElement as HTMLElement).click();
        (editorElement as HTMLElement).focus();
        // Xóa trạng thái lastAction
        window.lastAction = '';
      }
    }, 200);
  };

  // Lắng nghe kết quả chạy code
  useEffect(() => {
    // Hủy đăng ký các listener cũ trước khi đăng ký mới
    window.electron.ipcRenderer.removeAllListeners('run-code-output');
    window.electron.ipcRenderer.removeAllListeners('run-code-result');
    window.electron.ipcRenderer.removeAllListeners('stop-execution-result');

    const handleRunCodeOutput = (_event: any, data: { type: string, text: string }) => {
      console.log(`Run code output (${data.type}):`, data.text);
      setTerminalOutput(prev => prev + data.text);
    };

    const handleRunCodeResult = (_event: any, result: any) => {
      console.log('Run code result:', result);
      setIsRunning(false);

      // Thêm thông báo kết thúc
      setTerminalOutput(prev => prev + `\n\n--- ${result.success ? 'SUCCESS' : 'ERROR'} ---\n${result.message}\n`);

      // Focus lại vào editor sau khi nhận kết quả chạy code
      if (window.lastAction === 'run-code' || window.lastAction === 'stop-execution') {
        // Đặt timeout để đảm bảo UI đã cập nhật
        setTimeout(() => {
          focusEditorAfterAction();

          // Thêm một lần nữa sau 500ms để đảm bảo editor được focus
          setTimeout(() => {
            focusEditorAfterAction();
          }, 500);
        }, 200);
      }
    };

    const handleStopExecutionResult = (_event: any, result: any) => {
      console.log('Stop execution result:', result);
      setIsRunning(false);

      // Thêm thông báo dừng chạy
      setTerminalOutput(prev => prev + `\n\n--- STOPPED ---\n${result.message}\n`);

      // Focus lại vào editor sau khi dừng chạy code
      // Đặt timeout để đảm bảo UI đã cập nhật
      setTimeout(() => {
        focusEditorAfterAction();

        // Thêm một lần nữa sau 500ms để đảm bảo editor được focus
        setTimeout(() => {
          focusEditorAfterAction();

          // Thêm một lần nữa sau 1000ms để đảm bảo editor được focus
          setTimeout(() => {
            // Tìm editor và focus vào nó
            const editorElement = document.querySelector('.monaco-editor');
            if (editorElement) {
              console.log('Final attempt to focus editor after stop execution');
              (editorElement as HTMLElement).click();
              (editorElement as HTMLElement).focus();
            }
          }, 1000);
        }, 500);
      }, 200);
    };

    // Đăng ký các listener
    window.electron.ipcRenderer.on('run-code-output', handleRunCodeOutput);
    window.electron.ipcRenderer.on('run-code-result', handleRunCodeResult);
    window.electron.ipcRenderer.on('stop-execution-result', handleStopExecutionResult);

    return () => {
      // Hủy đăng ký các listener
      window.electron.ipcRenderer.removeAllListeners('run-code-output');
      window.electron.ipcRenderer.removeAllListeners('run-code-result');
      window.electron.ipcRenderer.removeAllListeners('stop-execution-result');
    };
  }, []);

  // Lắng nghe sự kiện từ main process
  useEffect(() => {
    // Hủy đăng ký các listener cũ trước khi đăng ký mới
    // Điều này giúp tránh việc đăng ký nhiều lần cùng một listener
    window.electron.ipcRenderer.removeAllListeners('file-opened');
    window.electron.ipcRenderer.removeAllListeners('file-content');
    window.electron.ipcRenderer.removeAllListeners('file-saved');
    window.electron.ipcRenderer.removeAllListeners('folder-structure');
    window.electron.ipcRenderer.removeAllListeners('export-to-pdf-result');

    // Lắng nghe sự kiện khi file được mở
    const handleFileOpened = (_event: any, data: any) => {
      console.log('File opened event received:', data);

      if (data.error) {
        console.error('Error opening file:', data.error);
        return;
      }

      if (data.content !== undefined) {
        console.log('Setting content, length:', data.content.length);
        setCurrentContent(data.content);

        // Store original content for modification tracking
        if (data.fileName) {
          setOriginalContent(prev => ({
            ...prev,
            [data.fileName]: data.content
          }));
        }
      } else {
        console.warn('Received file data without content');
      }

      if (data.fileName) {
        // Check if the file is already in the openFiles array
        console.log('Current openFiles array:', openFiles);
        const fileIndex = openFiles.findIndex(file => file === data.fileName);

        if (fileIndex === -1) {
          console.log('Adding file to open files:', data.fileName);

          // Create a new array with the new file added
          const newOpenFiles = [...openFiles];

          // Limit to 5 open files
          if (newOpenFiles.length >= 5) {
            newOpenFiles.shift(); // Remove the oldest file
          }

          // Add the new file
          newOpenFiles.push(data.fileName);

          // Update the state
          setOpenFiles(newOpenFiles);
          console.log('Updated openFiles array:', newOpenFiles);
        }

        // Always set the active file to the one that was just opened
        console.log('Setting active file to:', data.fileName);
        setActiveFile(data.fileName);
      } else {
        console.warn('Received file data without fileName');
      }
    };

    // Lắng nghe sự kiện khi file được lưu
    const handleFileSaved = (_event: any, data: any) => {
      console.log('File saved event received:', data);

      if (data.error) {
        console.error('Error saving file:', data.error);
        alert(`Error saving file: ${data.error}`);
        return;
      }

      console.log('File saved successfully:', data.filePath);

      // Remove the file from modifiedFiles list
      setModifiedFiles(modifiedFiles.filter(file => file !== activeFile));

      // Update original content with the saved content
      setOriginalContent(prev => ({
        ...prev,
        [data.filePath]: currentContent
      }));

      // If this was a new file, update the file name in openFiles
      if (activeFile.startsWith('new-file-')) {
        // Create a new array with the updated file name
        const updatedOpenFiles = openFiles.map(file =>
          file === activeFile ? data.filePath : file
        );

        // Update the state
        setOpenFiles(updatedOpenFiles);
        setActiveFile(data.filePath);
      }

      // Hiển thị thông báo khi lưu file thành công
      alert(`File ${data.filePath} saved successfully!`);
    };

    // Đăng ký các listener
    console.log('Registering event listeners');

    // Listener for file-opened event
    window.electron.ipcRenderer.on('file-opened', (event: Electron.IpcRendererEvent, data: { filePath?: string, fileName?: string, content?: string, error?: string }) => {
      console.log('file-opened event received in wrapper:', data);
      handleFileOpened(event, data);

      // If the file has a path, update the selected folder
      if (data.filePath) {
        const folderPath = data.filePath.split('\\').slice(0, -1).join('\\');
        if (folderPath) {
          setSelectedFolder(folderPath);
        }
      }
    });

    // Listener for file-content event
    window.electron.ipcRenderer.on('file-content', handleFileOpened);

    // Listener for file-saved event
    window.electron.ipcRenderer.on('file-saved', handleFileSaved);

    // Listener for folder-structure event
    window.electron.ipcRenderer.on('folder-structure', (_event: Electron.IpcRendererEvent, data: { name?: string }) => {
      console.log('folder-structure event received:', data);
      if (data.name) {
        setSelectedFolder(data.name);
      }
    });

    // Thêm log để debug
    console.log('Registered IPC event listeners');

    return () => {
      // Hủy đăng ký các listener khi component unmount
      window.electron.ipcRenderer.removeAllListeners('file-opened');
      window.electron.ipcRenderer.removeAllListeners('file-content');
      window.electron.ipcRenderer.removeAllListeners('file-saved');
      window.electron.ipcRenderer.removeAllListeners('folder-structure');
      window.electron.ipcRenderer.removeAllListeners('export-to-pdf-result');
    };
  }, [openFiles, modifiedFiles, activeFile, currentContent]); // Include dependencies to ensure handlers have access to latest state

  useEffect(() => {
    setContentSize(isRightSidebarCollapsed ? 0 : defaultContentSize);
  }, [isRightSidebarCollapsed]);

  // Effect for plugin-related events
  useEffect(() => {
    // Hủy đăng ký các listener cũ trước khi đăng ký mới
    window.electron.ipcRenderer.removeAllListeners('plugin-list');
    window.electron.ipcRenderer.removeAllListeners('menu-items-changed');
    window.electron.ipcRenderer.removeAllListeners('menu-action-result');

    // Listen for plugin list updates
    window.electron.ipcRenderer.on('plugin-list', handlePluginListUpdate);
    window.electron.ipcRenderer.on('menu-items-changed', handleMenuItemsChanged);
    window.electron.ipcRenderer.on('menu-action-result', handleMenuActionResult);

    // Load plugin menu items for File, Edit and Run menus
    loadPluginMenuItems('file');
    loadPluginMenuItems('edit');
    loadPluginMenuItems('run');

    // Log installed plugins for debugging
    console.log('Currently installed plugins:', installedPlugins);

    return () => {
      window.electron.ipcRenderer.removeAllListeners('plugin-list');
      window.electron.ipcRenderer.removeAllListeners('menu-items-changed');
      window.electron.ipcRenderer.removeAllListeners('menu-action-result');
    };
  }, [activeFile, currentContent, installedPlugins]); // Add dependencies to ensure handler has access to latest state

  const handlePluginListUpdate = (_event: Electron.IpcRendererEvent, plugins: string[]) => {
    console.log('Plugin list updated:', plugins);
    setInstalledPlugins(plugins || []);

    // Reload plugin menu items when plugin list changes
    setTimeout(() => {
      console.log('Reloading menu items after plugin list update');
      loadPluginMenuItems('file');
      loadPluginMenuItems('edit');
      loadPluginMenuItems('run');
    }, 500); // Đợi 500ms để đảm bảo plugin đã đăng ký menu items
  };

  const handleMenuItemsChanged = (_event: Electron.IpcRendererEvent, menuItems: MenuItem[]) => {
    console.log('Menu items changed:', menuItems);
    if (menuItems && menuItems.length > 0) {
      // Cập nhật trực tiếp danh sách menu items
      setPluginMenuItems(menuItems);

      // Hiển thị thông tin chi tiết về các menu items
      const fileMenuItems = menuItems.filter(item => item.parentMenu.toLowerCase() === 'file');
      const editMenuItems = menuItems.filter(item => item.parentMenu.toLowerCase() === 'edit');
      const runMenuItems = menuItems.filter(item => item.parentMenu.toLowerCase() === 'run');

      console.log('File menu items:', fileMenuItems.map(item => `${item.label} (${item.id})`))
      console.log('Edit menu items:', editMenuItems.map(item => `${item.label} (${item.id})`))
      console.log('Run menu items:', runMenuItems.map(item => `${item.label} (${item.id})`))

      // Reload menu items to ensure they are properly displayed
      setTimeout(() => {
        loadPluginMenuItems('file');
        loadPluginMenuItems('edit');
        loadPluginMenuItems('run');
      }, 100);
    }
  };

  const handleMenuActionResult = (_event: Electron.IpcRendererEvent, result: { success: boolean, message: string, data?: { formattedText?: string, [key: string]: any } }) => {
    console.log('Menu action result:', result);
    if (result.success) {
      // Handle successful menu action
      console.log('Menu action executed successfully:', result.message);

      // Check if the result contains formatted text (from Prettier plugin)
      if (result.data && result.data.formattedText !== undefined) {
        console.log('Updating editor content with formatted text');
        // Update the editor content with the formatted text
        const formattedText = result.data.formattedText;
        setCurrentContent(formattedText);

        // If this is a saved file, update the original content to avoid showing it as modified
        if (activeFile && !activeFile.startsWith('new-file-') && result.data && result.data.formattedText) {
          setOriginalContent(prev => ({
            ...prev,
            [activeFile]: formattedText
          }));
        }
      }
    } else {
      // Handle failed menu action
      console.error('Menu action failed:', result.message);
      // Show error message to user
      alert(`Error: ${result.message}`);
    }
  };

  const loadPluginMenuItems = async (parentMenu: string) => {
    try {
      const menuItems = await window.electron.ipcRenderer.getMenuItems(parentMenu);
      console.log(`Menu items for ${parentMenu}:`, menuItems);

      // Merge with existing menu items from other menus
      setPluginMenuItems(prevItems => {
        // Filter out items from the current menu (we'll replace them)
        const otherMenuItems = prevItems.filter(item => item.parentMenu.toLowerCase() !== parentMenu.toLowerCase());
        // Add the new menu items
        const newItems = [...otherMenuItems, ...(menuItems || [])];
        console.log(`Updated plugin menu items:`, newItems);
        return newItems;
      });
    } catch (error) {
      console.error(`Error loading menu items for ${parentMenu}:`, error);
    }
  };

  const handlePluginMenuItemClick = (menuItem: MenuItem) => {
    console.log(`Executing plugin menu item: ${menuItem.id} (${menuItem.label})`);
    window.electron.ipcRenderer.executeMenuAction(menuItem.id, currentContent, activeFile);
    closeAllMenus();
  };

  // We've moved the file limit logic to the main handleFileOpened function

  // Add a useEffect to log file tabs information
  useEffect(() => {
    console.log('File tabs updated, current openFiles:', openFiles);
  }, [openFiles]);

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white">
      {/* Top Menu Bar */}
      <div className="flex items-center bg-[#3c3c3c] h-[32px] px-2 text-sm">
        <div className="flex space-x-4 relative">
          <div className="relative">
            <span
              className="hover:bg-[#505050] px-2 py-1 cursor-pointer menu-header"
              onClick={toggleFileMenu}
              ref={fileMenuRef}
            >
              File
            </span>
            {showFileMenu && (
              <div className="absolute top-full left-0 bg-[#252526] shadow-lg z-50 w-48">
                <div className="p-1">
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer menu-item"
                    onClick={handleNewFile}
                  >
                    <FilePlus size={16} className="mr-2" />
                    <span>New File</span>
                  </div>
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer menu-item"
                    onClick={handleOpenFile}
                  >
                    <FolderOpen size={16} className="mr-2" />
                    <span>Open File...</span>
                  </div>
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer menu-item"
                    onClick={handleSaveFile}
                  >
                    <Save size={16} className="mr-2" />
                    <span>Save</span>
                  </div>
                  {/* Luôn hiển thị Export to PDF vì đã là chức năng tích hợp */}
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Export to PDF menu item clicked');
                      handleExportToPdf();
                    }}
                  >
                    <FileText size={16} className="mr-2" />
                    <span>Export to PDF</span>
                    <span className="ml-auto text-xs text-gray-400">Ctrl+E</span>
                  </div>

                  {/* Hiển thị các menu item từ plugin */}
                  {pluginMenuItems
                    .filter(item => item.parentMenu.toLowerCase() === 'file')
                    .map(menuItem => (
                      <div
                        key={menuItem.id}
                        className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer menu-item"
                        onClick={() => handlePluginMenuItemClick(menuItem)}
                      >
                        {menuItem.icon ? (
                          <span className="mr-2">{menuItem.icon}</span>
                        ) : (
                          <FileText size={16} className="mr-2" />
                        )}
                        <span>{menuItem.label}</span>
                        {menuItem.shortcut && (
                          <span className="ml-auto text-xs text-gray-400">{menuItem.shortcut}</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <span
              className="hover:bg-[#505050] px-2 py-1 cursor-pointer menu-header"
              onClick={toggleEditMenu}
              ref={editMenuRef}
            >
              Edit
            </span>
            {showEditMenu && (
              <div className="absolute top-full left-0 bg-[#252526] shadow-lg z-50 w-48">
                <div className="p-1">
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer menu-item"
                    onClick={handleCopy}
                  >
                    <Copy size={16} className="mr-2" />
                    <span>Copy</span>
                  </div>
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer menu-item"
                    onClick={handlePaste}
                  >
                    <Clipboard size={16} className="mr-2" />
                    <span>Paste</span>
                  </div>
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer menu-item"
                    onClick={handleCut}
                  >
                    <Scissors size={16} className="mr-2" />
                    <span>Cut</span>
                  </div>

                  {/* Display plugin menu items for Edit menu */}
                  {pluginMenuItems
                    .filter(item => item.parentMenu.toLowerCase() === 'edit')
                    .map(menuItem => (
                      <div
                        key={menuItem.id}
                        className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer menu-item"
                        onClick={() => handlePluginMenuItemClick(menuItem)}
                      >
                        {menuItem.icon ? (
                          <span className="mr-2">{menuItem.icon}</span>
                        ) : (
                          <FileText size={16} className="mr-2" />
                        )}
                        <span>{menuItem.label}</span>
                        {menuItem.shortcut && (
                          <span className="ml-auto text-xs text-gray-400">{menuItem.shortcut}</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <span
              className="hover:bg-[#505050] px-2 py-1 cursor-pointer menu-header"
              onClick={toggleViewMenu}
              ref={viewMenuRef}
            >
              View
            </span>
            {showViewMenu && (
              <div className="absolute top-full left-0 bg-[#252526] shadow-lg z-50 w-48">
                <div className="p-1">
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer menu-item"
                    onClick={toggleTerminal}
                  >
                    <span>Toggle Terminal</span>
                  </div>
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer menu-item"
                    onClick={() => {
                      toggleRightSidebar();
                      closeAllMenus();
                    }}
                  >
                    <span>Toggle Explorer</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <span className="hover:bg-[#505050] px-2 py-1 cursor-pointer">Selection</span>
          <span className="hover:bg-[#505050] px-2 py-1 cursor-pointer">Go</span>
          <div className="relative">
            <span
              className="hover:bg-[#505050] px-2 py-1 cursor-pointer menu-header"
              onClick={toggleRunMenu}
              ref={runMenuRef}
            >
              Run
            </span>
            {showRunMenu && (
              <div className="absolute top-full left-0 bg-[#252526] shadow-lg z-50 w-48">
                <div className="p-1">
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Run Code menu item clicked');
                      handleRunCode();
                    }}
                  >
                    <Play size={16} className="mr-2" />
                    <span>Run Code</span>
                    <span className="ml-auto text-xs text-gray-400">F5</span>
                  </div>
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Stop Execution menu item clicked');
                      handleStopExecution();
                    }}
                  >
                    <Square size={16} className="mr-2" />
                    <span>Stop Execution</span>
                    <span className="ml-auto text-xs text-gray-400">Shift+F5</span>
                  </div>

                  {/* Hiển thị các menu item từ plugin */}
                  {pluginMenuItems
                    .filter(item => item.parentMenu.toLowerCase() === 'run')
                    .map(menuItem => (
                      <div
                        key={menuItem.id}
                        className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer menu-item"
                        onClick={() => handlePluginMenuItemClick(menuItem)}
                      >
                        {menuItem.icon ? (
                          <span className="mr-2">{menuItem.icon}</span>
                        ) : (
                          <Play size={16} className="mr-2" />
                        )}
                        <span>{menuItem.label}</span>
                        {menuItem.accelerator && (
                          <span className="ml-auto text-xs text-gray-400">{menuItem.accelerator}</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
          <span className="hover:bg-[#505050] px-2 py-1 cursor-pointer">...</span>
        </div>
        <div className="flex items-center ml-4">
          <ChevronLeft className="w-4 h-4 mx-1 cursor-pointer" />
          <ChevronRight className="w-4 h-4 mx-1 cursor-pointer" />
          <div className="flex items-center bg-[#252526] rounded mx-2 px-2 py-1 w-[200px]">
            <Search className="w-4 h-4 mr-2" />
            <input
              type="text"
              placeholder={selectedFolder || 'Search in workspace'}
              className="bg-transparent border-none outline-none text-sm w-full"
            />
          </div>
        </div>
        <div className="flex ml-auto space-x-2">
          <Minimize2 className="w-4 h-4 cursor-pointer" />
          <Maximize2 className="w-4 h-4 cursor-pointer" />
          <X className="w-4 h-4 cursor-pointer" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar setActiveTab={setActiveTab} activeTab={activeTab} onTabClick={handleTabClick} />

        {/* Resizable layout */}
        <ResizablePanelGroup direction="horizontal" className="flex flex-1"
          key={contentSize}
        >
          {/* Content Area */}
          <ResizablePanel
            defaultSize={isRightSidebarCollapsed ? 0 : contentSize}
            className="bg-[#252526]"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-2 text-xs uppercase tracking-wider">
                <span>Explorer</span>
                <span>...</span>
              </div>
              <div className="flex items-center p-2 text-sm">
                <span className="font-semibold">{selectedFolder || 'No folder opened'}</span>
                <span className="ml-auto text-xs">▾</span>
              </div>
              <ContentArea
                activeTab={activeTab}
                onFileSelect={handleFileSelect}
                onFileDeleted={handleCloseFile}
                currentContent={currentContent}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Editor Area */}
          <ResizablePanel
            defaultSize={100 - contentSize} minSize={30}
            className="bg-[#1e1e1e] flex flex-col"
          >
            {/* Add a useEffect to log file tabs info */}
            {openFiles.length > 0 && (
              <div className="flex bg-[#252526] h-[35px] text-sm overflow-x-auto">
                {openFiles.map(file => (
                  <div
                    key={file}
                    className={`flex items-center px-3 py-1 border-r border-[#3c3c3c] cursor-pointer ${activeFile === file ? 'bg-[#1e1e1e]' : 'bg-[#2d2d2d]'}`}
                    onClick={() => {
                      console.log('File tab clicked:', file);

                      // Set this file as the active file
                      setActiveFile(file);

                      // Load the file content
                      loadFileContent(file);
                    }}
                  >
                    <span className={`${modifiedFiles.includes(file) ? 'text-blue-400' : 'text-gray-400'} mr-2`}>•</span>
                    <span>{file}</span>
                    <span
                      className="ml-2 text-gray-500 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseFile(file);
                      }}
                    >×</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 relative">
              {/* Editor */}
              <div className="absolute inset-0">
                {openFiles.length > 0 ? (
                  <Editor
                    loadFileContent={loadFileContent}
                    updateContent={updateCurrentContent}
                    onStatsChange={updateEditorStats}
                    currentContent={currentContent}
                    activeFile={activeFile}
                    editorStats={editorStats}
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

              {/* Terminal - Nằm chồng lên editor */}
              {showTerminal && (
                <div className="absolute bottom-0 left-0 right-0 z-10" style={{ height: '40%', boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                  <Terminal
                    activeTab={activeTerminalTab}
                    isRunning={isRunning}
                    terminalOutput={terminalOutput}
                    onTabClick={handleTerminalTabClick}
                    onClose={toggleTerminal}
                  />
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Terminal đã được di chuyển vào bên trong editor */}

      {/* Status Bar */}
      <div className="flex items-center justify-between bg-[#007acc] text-white text-xs h-[22px] px-2">
        <div className="flex items-center space-x-2">
          <span>Go Live</span>
          <span>Augment</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>Ln {editorStats.line}, Col {editorStats.column}</span>
          <span>Spaces: {editorStats.spaces}</span>
          <span>{editorStats.encoding}</span>
          <span>{editorStats.lineEnding}</span>
          <span>{editorStats.language}</span>
        </div>
      </div>
    </div>
  );
}

export default App;
