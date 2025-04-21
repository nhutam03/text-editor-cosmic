import React, { useEffect, useState, useRef } from 'react';
import Editor from './components/Editor';
import Sidebar from './components/Sidebar';
import ContentArea from './components/ContentArea';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './components/ui/resizable';
import { ChevronLeft, ChevronRight, Search, X, Maximize2, Minimize2, Save, FolderOpen, FilePlus, Copy, Scissors, Clipboard, FileText } from 'lucide-react';
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
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
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
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const editMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
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
  };

  const closeAllMenus = () => {
    setShowFileMenu(false);
    setShowEditMenu(false);
    setShowViewMenu(false);
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

  // Hàm xử lý Export to PDF
  const handleExportToPdf = () => {
    if (activeFile && currentContent !== undefined) {
      console.log('Exporting to PDF:', activeFile, 'Content length:', currentContent.length);

      // Gọi plugin export-to-pdf để xử lý
      window.electron.ipcRenderer.send('apply-plugin', 'export-to-pdf', currentContent);
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

  const handleCloseFile = (fileName: string) => {
    // Find the index of the file being closed
    const fileIndex = openFiles.indexOf(fileName);

    // Create a new array without the file to close
    const newOpenFiles = openFiles.filter(file => file !== fileName);

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
      setActiveFile(nextActiveFile);

      // Load the content of the new active file
      loadFileContent(nextActiveFile);
    }
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
      // Esc để đóng tất cả menu
      if (e.key === 'Escape') {
        closeAllMenus();
      }
    };

    // Xử lý click bên ngoài menu để đóng menu
    const handleClickOutside = (e: MouseEvent) => {
      if (
        fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node) &&
        editMenuRef.current && !editMenuRef.current.contains(e.target as Node) &&
        viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)
      ) {
        closeAllMenus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleSaveFile, handleOpenFile, handleNewFile, toggleTerminal, closeAllMenus]);

  // Lấy danh sách plugins đã cài đặt
  useEffect(() => {
    const getInstalledPlugins = async () => {
      try {
        const plugins = await window.electron.ipcRenderer.invoke("get-plugins");
        setInstalledPlugins(plugins || []);

        // Đăng ký lắng nghe sự kiện khi danh sách plugin thay đổi
        window.electron.ipcRenderer.on("plugin-list", (event, pluginList) => {
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

  // Lắng nghe sự kiện từ main process
  useEffect(() => {
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
    window.electron.ipcRenderer.on('file-opened', (event, data) => {
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
    window.electron.ipcRenderer.on('folder-structure', (_event, data) => {
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
    };
  }, [openFiles, modifiedFiles, activeFile, currentContent]); // Include dependencies to ensure handlers have access to latest state

  useEffect(() => {
    setContentSize(isRightSidebarCollapsed ? 0 : defaultContentSize);
  }, [isRightSidebarCollapsed]);

  // Effect for plugin-related events
  useEffect(() => {
    // Listen for plugin list updates
    window.electron.ipcRenderer.on('plugin-list', handlePluginListUpdate);
    window.electron.ipcRenderer.on('menu-items-changed', handleMenuItemsChanged);
    window.electron.ipcRenderer.on('menu-action-result', handleMenuActionResult);

    // Load plugin menu items for File menu
    loadPluginMenuItems('file');

    return () => {
      window.electron.ipcRenderer.removeAllListeners('plugin-list');
      window.electron.ipcRenderer.removeAllListeners('menu-items-changed');
      window.electron.ipcRenderer.removeAllListeners('menu-action-result');
    };
  }, []);

  const handlePluginListUpdate = (event: any, plugins: string[]) => {
    console.log('Plugin list updated:', plugins);
    setInstalledPlugins(plugins || []);

    // Reload plugin menu items when plugin list changes
    loadPluginMenuItems('file');
  };

  const handleMenuItemsChanged = (event: any, menuItems: MenuItem[]) => {
    console.log('Menu items changed:', menuItems);
    setPluginMenuItems(menuItems || []);
  };

  const handleMenuActionResult = (event: any, result: { success: boolean, message: string, data?: any }) => {
    console.log('Menu action result:', result);
    if (result.success) {
      // Handle successful menu action
      console.log('Menu action executed successfully:', result.message);
    } else {
      // Handle failed menu action
      console.error('Menu action failed:', result.message);
    }
  };

  const loadPluginMenuItems = async (parentMenu: string) => {
    try {
      const menuItems = await window.electron.ipcRenderer.getMenuItems(parentMenu);
      console.log(`Menu items for ${parentMenu}:`, menuItems);
      setPluginMenuItems(menuItems || []);
    } catch (error) {
      console.error(`Error loading menu items for ${parentMenu}:`, error);
      setPluginMenuItems([]);
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
              className="hover:bg-[#505050] px-2 py-1 cursor-pointer"
              onClick={toggleFileMenu}
              ref={fileMenuRef}
            >
              File
            </span>
            {showFileMenu && (
              <div className="absolute top-full left-0 bg-[#252526] shadow-lg z-50 w-48">
                <div className="p-1">
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer"
                    onClick={handleNewFile}
                  >
                    <FilePlus size={16} className="mr-2" />
                    <span>New File</span>
                  </div>
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer"
                    onClick={handleOpenFile}
                  >
                    <FolderOpen size={16} className="mr-2" />
                    <span>Open File...</span>
                  </div>
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer"
                    onClick={handleSaveFile}
                  >
                    <Save size={16} className="mr-2" />
                    <span>Save</span>
                  </div>
                  {/* Chỉ hiển thị Export to PDF khi plugin đã được cài đặt */}
                  {installedPlugins.includes("export-to-pdf") && (
                    <div
                      className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer"
                      onClick={handleExportToPdf}
                    >
                      <FileText size={16} className="mr-2" />
                      <span>Export to PDF</span>
                    </div>
                  )}

                  {/* Hiển thị các menu item từ plugin */}
                  {pluginMenuItems
                    .filter(item => item.parentMenu.toLowerCase() === 'file')
                    .map(menuItem => (
                      <div
                        key={menuItem.id}
                        className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer"
                        onClick={() => handlePluginMenuItemClick(menuItem)}
                      >
                        {menuItem.icon ? (
                          <span className="mr-2">{menuItem.icon}</span>
                        ) : (
                          <FileText size={16} className="mr-2" />
                        )}
                        <span>{menuItem.label}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <span
              className="hover:bg-[#505050] px-2 py-1 cursor-pointer"
              onClick={toggleEditMenu}
              ref={editMenuRef}
            >
              Edit
            </span>
            {showEditMenu && (
              <div className="absolute top-full left-0 bg-[#252526] shadow-lg z-50 w-48">
                <div className="p-1">
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer"
                    onClick={handleCopy}
                  >
                    <Copy size={16} className="mr-2" />
                    <span>Copy</span>
                  </div>
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer"
                    onClick={handlePaste}
                  >
                    <Clipboard size={16} className="mr-2" />
                    <span>Paste</span>
                  </div>
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer"
                    onClick={handleCut}
                  >
                    <Scissors size={16} className="mr-2" />
                    <span>Cut</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <span
              className="hover:bg-[#505050] px-2 py-1 cursor-pointer"
              onClick={toggleViewMenu}
              ref={viewMenuRef}
            >
              View
            </span>
            {showViewMenu && (
              <div className="absolute top-full left-0 bg-[#252526] shadow-lg z-50 w-48">
                <div className="p-1">
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer"
                    onClick={toggleTerminal}
                  >
                    <span>Toggle Terminal</span>
                  </div>
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#505050] cursor-pointer"
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
          <span className="hover:bg-[#505050] px-2 py-1 cursor-pointer">Run</span>
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

            <div className="flex-1">
              {openFiles.length > 0 ? (
                <Editor
                  loadFileContent={loadFileContent}
                  updateContent={updateCurrentContent}
                  onStatsChange={updateEditorStats}
                  currentContent={currentContent}
                  activeFile={activeFile}
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
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Terminal Area - Chỉ hiển thị khi showTerminal = true */}
      {showTerminal && (
        <div className="bg-[#1e1e1e] border-t border-[#3c3c3c]" style={{ height: '35%' }}>
          <div className="flex bg-[#252526] text-sm">
            <div
              className={`px-3 py-1 border-r border-[#3c3c3c] cursor-pointer ${activeTerminalTab === 'PROBLEMS' ? 'bg-[#1e1e1e]' : ''}`}
              onClick={() => handleTerminalTabClick('PROBLEMS')}
            >
              PROBLEMS
            </div>
            <div
              className={`px-3 py-1 border-r border-[#3c3c3c] cursor-pointer ${activeTerminalTab === 'OUTPUT' ? 'bg-[#1e1e1e]' : ''}`}
              onClick={() => handleTerminalTabClick('OUTPUT')}
            >
              OUTPUT
            </div>
            <div
              className={`px-3 py-1 border-r border-[#3c3c3c] cursor-pointer ${activeTerminalTab === 'DEBUG CONSOLE' ? 'bg-[#1e1e1e]' : ''}`}
              onClick={() => handleTerminalTabClick('DEBUG CONSOLE')}
            >
              DEBUG CONSOLE
            </div>
            <div
              className={`px-3 py-1 border-r border-[#3c3c3c] cursor-pointer ${activeTerminalTab === 'TERMINAL' ? 'bg-[#1e1e1e]' : ''}`}
              onClick={() => handleTerminalTabClick('TERMINAL')}
            >
              TERMINAL
            </div>
            <div
              className={`px-3 py-1 border-r border-[#3c3c3c] cursor-pointer ${activeTerminalTab === 'PORTS' ? 'bg-[#1e1e1e]' : ''}`}
              onClick={() => handleTerminalTabClick('PORTS')}
            >
              PORTS
            </div>
            <div
              className={`px-3 py-1 cursor-pointer ${activeTerminalTab === 'AUGMENT NEXT EDIT' ? 'bg-[#1e1e1e]' : ''}`}
              onClick={() => handleTerminalTabClick('AUGMENT NEXT EDIT')}
            >
              AUGMENT NEXT EDIT
            </div>
            <div className="ml-auto px-3 py-1 cursor-pointer" onClick={toggleTerminal}>
              <X size={14} />
            </div>
          </div>
          {activeTerminalTab === 'TERMINAL' && (
            <div className="p-2 text-sm font-mono text-green-400 h-full overflow-auto">
              <div>$ cross-env ELECTRON=true concurrently "npm run dev" "node electron-dev.js"</div>
              <div className="text-white">[1] Core socket server running on port 5000</div>
              <div className="text-white">[0] {">"}text-editor-app@0.0.0 dev</div>
              <div className="text-white">[0] {">"}vite</div>
              <div className="text-white">[0]</div>
              <div className="text-white">[0] VITE v6.2.0 ready in 383 ms</div>
              <div className="text-white">[0]</div>
              <div className="text-white">[0] ➜ Local: <span className="text-blue-400">http://localhost:5173/</span></div>
              <div className="text-white">[0] ➜ Network: use --host to expose</div>
              <div className="text-white">[0]</div>
            </div>
          )}
          {activeTerminalTab === 'PROBLEMS' && (
            <div className="p-2 text-sm text-white h-full overflow-auto">
              <div className="flex items-center justify-center h-full text-gray-400">
                No problems have been detected in the workspace.
              </div>
            </div>
          )}
          {activeTerminalTab === 'OUTPUT' && (
            <div className="p-2 text-sm text-white h-full overflow-auto">
              <div className="flex items-center justify-center h-full text-gray-400">
                No output to show.
              </div>
            </div>
          )}
          {activeTerminalTab === 'DEBUG CONSOLE' && (
            <div className="p-2 text-sm text-white h-full overflow-auto">
              <div className="flex items-center justify-center h-full text-gray-400">
                Debug console is inactive.
              </div>
            </div>
          )}
          {activeTerminalTab === 'PORTS' && (
            <div className="p-2 text-sm text-white h-full overflow-auto">
              <div className="flex flex-col">
                <div className="flex justify-between p-2 border-b border-[#3c3c3c]">
                  <span>Port</span>
                  <span>Process</span>
                  <span>Status</span>
                </div>
                <div className="flex justify-between p-2">
                  <span>5173</span>
                  <span>Vite Dev Server</span>
                  <span className="text-green-500">Running</span>
                </div>
                <div className="flex justify-between p-2">
                  <span>5000</span>
                  <span>Core Socket Server</span>
                  <span className="text-green-500">Running</span>
                </div>
              </div>
            </div>
          )}
          {activeTerminalTab === 'AUGMENT NEXT EDIT' && (
            <div className="p-2 text-sm text-white h-full overflow-auto">
              <div className="flex items-center justify-center h-full text-gray-400">
                Augment Next Edit is ready.
              </div>
            </div>
          )}
        </div>
      )}

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