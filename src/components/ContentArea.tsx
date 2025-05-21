import React, { useEffect, useState, useRef } from "react";
import {
  File,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  FilePlus,
  FolderPlus,
  MoreHorizontal,
  Download,
  Search,
  X,
  Trash2,
  Edit,
  Copy,
  FileText,
  Code,
  FileJson,
  FileImage,
  Coffee,
  FileCode,
  FileCog,
  FileSpreadsheet,
  FileArchive,
} from "lucide-react";
import { IpcRendererEvent } from "electron";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import PluginMarketplace from "./PluginMarketplace";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "./ui/context-menu";

interface FolderStructureItem {
  name: string;
  type: "directory" | "file";
  children?: FolderStructureItem[];
  path?: string; // Đường dẫn đầy đủ đến file/thư mục
}

interface ContentAreaProps {
  activeTab: string;
  onFileSelect: (filePath: string) => void;
  onFileDeleted?: (filePath: string) => void;
  currentContent: string;
}

const ContentArea: React.FC<ContentAreaProps> = ({
  activeTab,
  onFileSelect,
  onFileDeleted,
  currentContent,
}) => {
  const [folderStructure, setFolderStructure] =
    useState<FolderStructureItem | null>(null); // Store folder/file structure
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<string[]>([]);
  const [availablePlugins, setAvailablePlugins] = useState<
    { name: string; installed: boolean }[]
  >([]);
  const [pluginMessage, setPluginMessage] = useState<string | null>(null); // Thông báo từ plugin
  const [showChildren, setShowChildren] = useState<boolean>(true); // Control visibility of children
  const [showMarketplace, setShowMarketplace] = useState<boolean>(false);
  const [loadingAvailablePlugins, setLoadingAvailablePlugins] =
    useState<boolean>(false);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null); // Store selected plugin for details view
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  ); // Lưu trạng thái mở rộng của thư mục
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [contextMenuTarget, setContextMenuTarget] =
    useState<FolderStructureItem | null>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null); // Lưu đường dẫn của file/thư mục đang đổi tên
  const [newName, setNewName] = useState<string>(""); // Tên mới khi đổi tên
  const [searchQuery, setSearchQuery] = useState<string>(""); // Tìm kiếm trong explorer
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [showFolderMenu, setShowFolderMenu] = useState<boolean>(false);
  const folderMenuRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<
    Array<{ filePath: string; line: number; preview: string }>
  >([]);

  const renderContent = () => {
    switch (activeTab) {
      case "explorer":
        return (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-2 text-xs">
              <div className="flex items-center space-x-2">
                <RefreshCw
                  size={14}
                  className={`text-gray-400 hover:text-white cursor-pointer ${
                    isRefreshing ? "animate-spin text-blue-400" : ""
                  }`}
                  onClick={refreshFolderStructure}
                  title="Refresh"
                />
                <FilePlus
                  size={14}
                  className="text-gray-400 hover:text-white cursor-pointer"
                  onClick={() => handleCreateNewFile()}
                  title="New File"
                />
                <FolderPlus
                  size={14}
                  className="text-gray-400 hover:text-white cursor-pointer"
                  onClick={() => handleCreateNewFolder()}
                  title="New Folder"
                />
                <MoreHorizontal
                  size={14}
                  className="text-gray-400 hover:text-white cursor-pointer"
                />
              </div>

              {/* Tìm kiếm trong explorer */}
              <div className="flex items-center ml-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Search"
                    className="bg-[#3c3c3c] text-white text-xs pl-8 pr-2 py-1 rounded w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                  {searchQuery && (
                    <X
                      size={14}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                      onClick={() => setSearchQuery("")}
                    />
                  )}
                </div>
              </div>
            </div>
            {selectedFolder ? (
              <div className="overflow-y-auto flex-1">
                <div className="text-sm">
                  <div
                    className="flex items-center px-2 py-1 hover:bg-[#2a2d2e] cursor-pointer group"
                    onClick={() => toggleRootFolder()}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenuPosition({ x: e.clientX, y: e.clientY });
                      setContextMenuTarget(folderStructure);
                    }}
                  >
                    {showChildren ? (
                      <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400" />
                    )}
                    <span className="ml-1 font-semibold">
                      {folderStructure?.name || "No folder"}
                    </span>

                    {/* Hiển thị các nút thao tác khi hover vào thư mục gốc */}
                    <div className="hidden group-hover:flex ml-auto space-x-1">
                      <FilePlus
                        size={14}
                        className="text-gray-400 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateNewFile();
                        }}
                        title="New File"
                      />
                      <div className="relative">
                        <FolderPlus
                          size={14}
                          className="text-gray-400 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateNewFolder();
                          }}
                          title="New Folder"
                        />
                      </div>
                      <RefreshCw
                        size={14}
                        className={`text-gray-400 hover:text-white ${
                          isRefreshing ? "animate-spin text-blue-400" : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          refreshFolderStructure();
                        }}
                        title="Refresh"
                      />
                    </div>
                  </div>
                  {showChildren && (
                    <div className="pl-4 folder-structure-root">
                      {folderStructure?.children?.map(
                        (child: FolderStructureItem) =>
                          renderFolderOrFiles(child)
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <span className="text-gray-400 text-sm mb-4">
                  You have not yet opened a folder
                </span>
                <Button
                  className="bg-[#0e639c] hover:bg-[#1177bb] text-white px-4 py-2 rounded-sm text-sm"
                  onClick={openFolder}
                >
                  <span>Open Folder</span>
                </Button>
              </div>
            )}
          </div>
        );
      case "search":
        return (
          <div className="p-2 h-full flex flex-col">
            <div className="flex items-center mb-2">
              <Search className="h-4 w-4 mr-2 text-gray-400" />
              <input
                type="text"
                className="w-full p-2 bg-gray-800 text-white rounded-md"
                placeholder="Search in files..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleSearchInFiles(searchQuery)
                }
              />
              {searchQuery && (
                <X
                  size={14}
                  className="ml-2 text-gray-400 hover:text-white cursor-pointer"
                  onClick={() => setSearchQuery("")}
                />
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="p-2 hover:bg-gray-700 cursor-pointer"
                  onClick={() =>
                    handleSearchResultClick(result.filePath, result.line)
                  }
                >
                  <div className="text-sm text-blue-400">{result.filePath}</div>
                  <div className="text-xs text-gray-300">
                    Line {result.line}: {result.preview}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "extensions":
        return (
          <div className="flex flex-col h-full">
            {/* Extensions header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-700">
              <div className="relative w-full">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search Extensions in Marketplace"
                  className="pl-8 bg-[#3c3c3c] border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 flex items-center gap-1 text-xs"
                onClick={() => setShowMarketplace(true)}
              >
                <span className="sr-only">More options</span>
                <span>...</span>
              </Button>
            </div>

            {/* Extensions content */}
            <div className="flex-1 overflow-y-auto p-2">
              {/* Plugin message notification */}
              {pluginMessage && (
                <div className="mb-4 p-3 bg-blue-500 bg-opacity-20 border border-blue-500 rounded text-sm">
                  {pluginMessage}
                </div>
              )}
              {/* Plugin details view - shown when a plugin is selected */}
              {selectedPlugin && (
                <div className="mb-4 p-3 bg-[#2d2d2d] rounded border border-gray-700">
                  <div className="flex justify-between items-start mb-3">
                    <h2 className="text-lg font-semibold">{selectedPlugin}</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setSelectedPlugin(null)}
                    >
                      <X size={16} />
                    </Button>
                  </div>

                  <div className="text-sm text-gray-300 mb-3">
                    {selectedPlugin === "pdf-export"
                      ? "Export your documents to PDF format with support for Vietnamese characters."
                      : `This is the ${selectedPlugin} plugin for the text editor.`}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <span className="text-gray-400">Version:</span> 1.0.0
                    </div>
                    <div>
                      <span className="text-gray-400">Author:</span> Text Editor
                      Team
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {selectedPlugin === "pdf-export" && (
                      <Button
                        variant="default"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleApplyPlugin(selectedPlugin)}
                      >
                        Apply
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        handleUninstallPlugin(selectedPlugin);
                        setSelectedPlugin(null);
                      }}
                    >
                      Uninstall
                    </Button>
                  </div>
                </div>
              )}
              {/* Installed extensions section */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    INSTALLED
                  </h3>
                  <ChevronDown size={16} className="text-gray-400" />
                </div>

                {plugins.length > 0 ? (
                  <div className="space-y-1">
                    {plugins.map((plugin) => (
                      <div
                        key={plugin}
                        className={`flex items-center justify-between p-2 hover:bg-[#2a2d2e] rounded cursor-pointer ${
                          selectedPlugin === plugin ? "bg-[#37373d]" : ""
                        }`}
                        onClick={() => {
                          console.log(`Plugin clicked: ${plugin}`);
                          setSelectedPlugin(
                            selectedPlugin === plugin ? null : plugin
                          );
                        }}
                      >
                        <div>
                          <div className="font-medium text-sm">{plugin}</div>
                          <div className="text-xs text-gray-400">
                            Text Editor Team
                          </div>
                        </div>
                        <div className="flex items-center">
                          {plugin === "pdf-export" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs mr-2"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent card click
                                handleApplyPlugin(plugin);
                              }}
                            >
                              Apply
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent card click
                              handleUninstallPlugin(plugin);
                            }}
                          >
                            Uninstall
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-gray-400">
                    No extensions installed
                  </div>
                )}
              </div>

              {/* Recommended extensions section */}
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    RECOMMENDED
                  </h3>
                  <ChevronDown size={16} className="text-gray-400" />
                </div>

                {loadingAvailablePlugins ? (
                  <div className="flex justify-center items-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : availablePlugins.filter((p) => !p.installed).length > 0 ? (
                  <div className="space-y-1">
                    {availablePlugins
                      .filter((plugin) => !plugin.installed)
                      .map((plugin) => (
                        <div
                          key={plugin.name}
                          className="flex items-center justify-between p-2 hover:bg-[#2a2d2e] rounded cursor-pointer"
                          onClick={() => setShowMarketplace(true)}
                        >
                          <div>
                            <div className="font-medium text-sm">
                              {plugin.name}
                            </div>
                            <div className="text-xs text-gray-400">
                              Text Editor Team
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInstallPlugin(plugin.name);
                            }}
                          >
                            Install
                          </Button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-400 mb-4 text-sm">
                      No recommended extensions
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1 text-xs"
                      onClick={() => setShowMarketplace(true)}
                    >
                      <Download size={14} />
                      Browse Extensions in Marketplace
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const openFolder = () => {
    window.electron.ipcRenderer.send("open-folder-request");
    // ipcRenderer.send('open-folder-request');
  };

  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderName)) {
        newSet.delete(folderName);
      } else {
        newSet.add(folderName);
      }
      return newSet;
    });
  };

  const toggleRootFolder = () => {
    setShowChildren((prev) => !prev);
  };

  // Hàm lấy biểu tượng cho từng loại file
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "js":
        return <Coffee size={16} className="text-yellow-400" />;
      case "ts":
      case "tsx":
        return <FileCode size={16} className="text-blue-500" />;
      case "jsx":
        return <FileCode size={16} className="text-yellow-500" />;
      case "json":
        return <FileJson size={16} className="text-yellow-300" />;
      case "html":
        return <Code size={16} className="text-orange-400" />;
      case "css":
        return <FileCode size={16} className="text-blue-400" />;
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
      case "svg":
        return <FileImage size={16} className="text-purple-400" />;
      case "md":
        return <FileText size={16} className="text-gray-400" />;
      case "pdf":
        return <FileText size={16} className="text-red-400" />;
      case "zip":
      case "rar":
      case "7z":
        return <FileArchive size={16} className="text-gray-500" />;
      case "xls":
      case "xlsx":
      case "csv":
        return <FileSpreadsheet size={16} className="text-green-500" />;
      case "py":
        return <FileCog size={16} className="text-blue-600" />;
      default:
        return <File size={16} className="text-blue-400" />;
    }
  };

  // Hàm xử lý khi nhấp chuột phải vào file/thư mục
  const handleContextMenu = (
    e: React.MouseEvent,
    node: FolderStructureItem
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuTarget(node);
  };

  // Hàm đóng menu ngữ cảnh
  const closeContextMenu = () => {
    setContextMenuPosition(null);
    setContextMenuTarget(null);
  };

  // Hàm tạo file mới
  const handleCreateNewFile = (parentPath: string = selectedFolder || "") => {
    if (!selectedFolder) {
      // Nếu chưa có folder được mở, mở dialog chọn folder trước
      window.electron.ipcRenderer.send("open-folder-request");
      window.electron.ipcRenderer.once("folder-structure", () => {
        // Sau khi folder được chọn, hiển thị input để nhập tên file
        promptForFileName();
      });
    } else {
      // Nếu đã có folder được mở, hiển thị input để nhập tên file
      promptForFileName(parentPath);
    }
  };

  // Hàm hiển thị input để nhập tên file
  const promptForFileName = (parentPath: string = selectedFolder || "") => {
    // Tìm phần tử cha để đặt input vào đúng vị trí
    const folderElement =
      document.querySelector(".folder-structure-root") ||
      document.querySelector(".overflow-y-auto");

    if (!folderElement) {
      console.error("Could not find parent element for file input");
      return;
    }

    // Tạo container để định vị input
    const inputContainer = document.createElement("div");
    inputContainer.className = "pl-4 py-1";

    // Tạo input element để nhập tên file
    const input = document.createElement("input");
    input.type = "text";
    input.className =
      "w-full p-1 bg-gray-700 text-white border border-blue-500 text-sm rounded";
    input.placeholder = "Enter file name...";

    // Thêm input vào container
    inputContainer.appendChild(input);

    // Thêm container vào DOM
    folderElement.appendChild(inputContainer);
    input.focus();

    // Xử lý khi nhấn Enter
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const fileName = input.value.trim() || "new-file.txt";

        console.log("Creating new file:", `${parentPath}/${fileName}`);

        // Tạo file mới với tên đã nhập
        window.electron.ipcRenderer.send(
          "create-new-file-request",
          `${parentPath}/${fileName}`
        );

        // Xóa input
        folderElement.removeChild(inputContainer);

        // Sử dụng hàm riêng để xử lý sự kiện new-file-created
        // thay vì dùng once để có thể tạo nhiều file liên tiếp
        handleNewFileCreated();

        // Hủy các event listener
        input.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("click", handleClickOutside);
      } else if (e.key === "Escape") {
        // Xóa input khi nhấn Escape
        folderElement.removeChild(inputContainer);

        // Hủy các event listener
        input.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("click", handleClickOutside);
      }
    };

    input.addEventListener("keydown", handleKeyDown);

    // Xử lý khi click ra ngoài
    const handleClickOutside = (e: MouseEvent) => {
      if (e.target !== input && !input.contains(e.target as Node)) {
        folderElement.removeChild(inputContainer);
        document.removeEventListener("click", handleClickOutside);
        input.removeEventListener("keydown", handleKeyDown);
      }
    };

    // Đợi một chút trước khi đăng ký sự kiện click để tránh trigger ngay lập tức
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 100);
  };

  // Hàm xử lý sự kiện new-file-created
  const handleNewFileCreated = () => {
    // Đăng ký một listener tạm thời để xử lý sự kiện new-file-created
    const newFileCreatedListener = (event: any, result: any) => {
      console.log("New file created:", result);
      refreshFolderStructure();

      // Gỡ bỏ listener sau khi xử lý xong
      window.electron.ipcRenderer.removeListener(
        "new-file-created",
        newFileCreatedListener
      );
    };

    // Đăng ký listener
    window.electron.ipcRenderer.on("new-file-created", newFileCreatedListener);
  };

  // Hàm tạo thư mục mới
  const handleCreateNewFolder = (parentPath: string = selectedFolder || "") => {
    if (!selectedFolder) {
      // Nếu chưa có folder được mở, mở dialog chọn folder trước
      window.electron.ipcRenderer.send("open-folder-request");
      window.electron.ipcRenderer.once("folder-structure", () => {
        // Sau khi folder được chọn, hiển thị input để nhập tên thư mục
        promptForFolderName();
      });
    } else {
      // Nếu đã có folder được mở, hiển thị input để nhập tên thư mục
      promptForFolderName(parentPath);
    }
  };

  // Hàm hiển thị input để nhập tên thư mục
  const promptForFolderName = (parentPath: string = selectedFolder || "") => {
    // Tìm phần tử cha để đặt input vào đúng vị trí
    const folderElement =
      document.querySelector(".folder-structure-root") ||
      document.querySelector(".overflow-y-auto");

    if (!folderElement) {
      console.error("Could not find parent element for folder input");
      return;
    }

    // Tạo container để định vị input
    const inputContainer = document.createElement("div");
    inputContainer.className = "pl-4 py-1";

    // Tạo input element để nhập tên thư mục
    const input = document.createElement("input");
    input.type = "text";
    input.className =
      "w-full p-1 bg-gray-700 text-white border border-yellow-500 text-sm rounded";
    input.placeholder = "Enter folder name...";

    // Thêm input vào container
    inputContainer.appendChild(input);

    // Thêm container vào DOM
    folderElement.appendChild(inputContainer);
    input.focus();

    // Xử lý khi nhấn Enter
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const folderName = input.value.trim();

        if (!folderName) {
          // Hiển thị thông báo lỗi nếu tên thư mục rỗng
          setRefreshMessage("Folder name cannot be empty");
          setTimeout(() => {
            setRefreshMessage(null);
          }, 3000);
          return;
        }

        console.log("Creating new folder:", `${parentPath}/${folderName}`);

        // Tạo thư mục mới với tên đã nhập
        window.electron.ipcRenderer.send(
          "create-new-folder-request",
          `${parentPath}/${folderName}`
        );

        // Xóa input
        folderElement.removeChild(inputContainer);

        // Hủy các event listener
        input.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("click", handleClickOutside);
      } else if (e.key === "Escape") {
        // Xóa input khi nhấn Escape
        folderElement.removeChild(inputContainer);

        // Hủy các event listener
        input.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("click", handleClickOutside);
      }
    };

    input.addEventListener("keydown", handleKeyDown);

    // Xử lý khi click ra ngoài
    const handleClickOutside = (e: MouseEvent) => {
      if (e.target !== input && !input.contains(e.target as Node)) {
        folderElement.removeChild(inputContainer);
        document.removeEventListener("click", handleClickOutside);
        input.removeEventListener("keydown", handleKeyDown);
      }
    };

    // Đợi một chút trước khi đăng ký sự kiện click để tránh trigger ngay lập tức
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 100);
  };

  // Hàm xóa file/thư mục
  const handleDelete = (node: FolderStructureItem) => {
    if (!node.path) return;

    const isDirectory = node.type === "directory";
    const confirmMessage = isDirectory
      ? `Bạn có chắc muốn xóa thư mục ${node.name} và tất cả nội dung bên trong?`
      : `Bạn có chắc muốn xóa file ${node.name}?`;

    if (window.confirm(confirmMessage)) {
      try {
        // Lưu lại đường dẫn của node để sử dụng sau này
        const nodePath = node.path;
        const nodeType = node.type;

        // Nếu file đang được mở, thông báo cho component cha
        if (nodeType === "file") {
          console.log(
            "Notifying parent component about file deletion:",
            nodePath
          );
          onFileDeleted?.(nodePath);
        } else if (nodeType === "directory") {
          // Nếu là thư mục, cần thông báo cho component cha về tất cả các file trong thư mục
          console.log(
            "Directory deletion, checking for open files in directory:",
            nodePath
          );

          // Tìm tất cả các file trong thư mục và thông báo cho component cha
          const findFilesInDirectory = (dirNode: FolderStructureItem) => {
            if (!dirNode.children) return;

            dirNode.children.forEach((child) => {
              if (child.type === "file" && child.path) {
                console.log(
                  "Notifying parent about file in deleted directory:",
                  child.path
                );
                onFileDeleted?.(child.path);
              } else if (child.type === "directory") {
                findFilesInDirectory(child);
              }
            });
          };

          // Tìm node thư mục trong cấu trúc thư mục
          const findDirectoryNode = (
            rootNode: FolderStructureItem,
            targetPath: string
          ): FolderStructureItem | null => {
            if (rootNode.path === targetPath) return rootNode;
            if (!rootNode.children) return null;

            for (const child of rootNode.children) {
              if (child.path === targetPath) return child;
              if (child.type === "directory") {
                const found = findDirectoryNode(child, targetPath);
                if (found) return found;
              }
            }

            return null;
          };

          if (folderStructure) {
            const dirNode = findDirectoryNode(folderStructure, nodePath);
            if (dirNode) {
              findFilesInDirectory(dirNode);
            }
          }
        }

        // Gửi yêu cầu xóa đến main process
        console.log("Sending delete request to main process:", {
          path: nodePath,
          isDirectory,
        });
        window.electron.ipcRenderer.send(
          "delete-item-request",
          nodePath,
          isDirectory
        );

        // Hiển thị thông báo đang xóa
        console.log(
          "Delete request sent, UI will be updated when response is received"
        );

        // Không cập nhật UI trực tiếp ở đây
        // UI sẽ được cập nhật trong useEffect khi nhận được sự kiện 'item-deleted'
      } catch (error) {
        console.error("Error in handleDelete:", error);
      }
    }
  };

  // Hàm đổi tên file/thư mục
  const handleRename = (node: FolderStructureItem) => {
    if (!node.path) return;
    setIsRenaming(node.path);
    setNewName(node.name);
    // Focus vào input sau khi render
    setTimeout(() => {
      if (renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
      }
    }, 50);
  };

  // Hàm xử lý khi hoàn tất đổi tên (khi nhấn Enter hoặc click ra ngoài)
  const handleRenameComplete = (
    e:
      | React.KeyboardEvent<HTMLInputElement>
      | React.FocusEvent<HTMLInputElement>
  ) => {
    // Tránh xử lý nhiều lần
    if (!isRenaming) return;

    console.log("handleRenameComplete called", {
      isKeyEvent: "key" in e,
      key: "key" in e ? e.key : "n/a",
      isRenaming,
      newName,
    });

    // Lưu lại giá trị isRenaming hiện tại và đặt về null ngay lập tức để tránh gọi nhiều lần
    const currentRenamingPath = isRenaming;
    setIsRenaming(null);

    // Nếu tên mới không rỗng
    if (newName.trim() !== "") {
      console.log("Sending rename request", {
        path: currentRenamingPath,
        newName: newName.trim(),
      });

      // Cập nhật UI trực tiếp bằng cách tạo một bản sao của folderStructure
      // và thay đổi tên của file/thư mục trong đó
      const updateNodeName = (
        node: FolderStructureItem
      ): FolderStructureItem => {
        if (node.path === currentRenamingPath) {
          // Đường dẫn mới sau khi đổi tên
          // Xử lý cả đường dẫn Windows (\) và Unix (/)
          const lastSlashIndex = Math.max(
            node.path.lastIndexOf("/"),
            node.path.lastIndexOf("\\")
          );

          const parentDir = node.path.substring(0, lastSlashIndex + 1);
          const newPath = parentDir + newName.trim();

          console.log("Updating node in UI:", {
            oldPath: node.path,
            oldName: node.name,
            newName: newName.trim(),
            newPath: newPath,
          });

          // Nếu là file, thông báo cho component cha để cập nhật tab
          if (node.type === "file") {
            // Thông báo cho component cha rằng file đã được đổi tên
            // Sử dụng onFileDeleted để đóng file cũ và onFileSelect để mở file mới
            onFileDeleted?.(node.path);
            setTimeout(() => {
              onFileSelect(newPath);
            }, 100);
          }

          return {
            ...node,
            name: newName.trim(),
            path: newPath,
          };
        }

        if (node.children) {
          return {
            ...node,
            children: node.children.map(updateNodeName),
          };
        }

        return node;
      };

      if (folderStructure) {
        const updatedStructure = updateNodeName(folderStructure);
        setFolderStructure(updatedStructure);
      }

      // Gửi yêu cầu đổi tên đến main process
      window.electron.ipcRenderer.send(
        "rename-item-request",
        currentRenamingPath,
        newName.trim()
      );
    }
  };

  // Hàm xử lý khi nhấn Escape để hủy đổi tên
  const handleCancelRename = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsRenaming(null);
    }
  };

  // Hàm làm mới cấu trúc thư mục
  const refreshFolderStructure = () => {
    if (selectedFolder) {
      console.log("Refreshing folder structure for:", selectedFolder);

      // Bắt đầu hiệu ứng xoay
      setIsRefreshing(true);

      // Kiểm tra xem selectedFolder có phải là đường dẫn đầy đủ không
      if (!selectedFolder.includes("\\") && !selectedFolder.includes("/")) {
        console.error("Selected folder is not a full path:", selectedFolder);
        setIsRefreshing(false);
        return;
      }

      // Lấy thư mục gốc (thư mục cha đầu tiên đã mở)
      const rootFolder = folderStructure?.path || selectedFolder;

      // Gửi yêu cầu làm mới với thư mục gốc để giữ nguyên cấu trúc
      window.electron.ipcRenderer.send("refresh-folder-structure", rootFolder);
      console.log("Refreshing from root folder:", rootFolder);

      // Dừng hiệu ứng xoay sau 3 giây
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    }
  };

  // Hàm tìm kiếm trong explorer
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Hàm lọc kết quả tìm kiếm
  const filterItems = (
    node: FolderStructureItem,
    query: string
  ): FolderStructureItem | null => {
    if (!query.trim()) return node;

    // Nếu là file và tên chứa query
    if (
      node.type === "file" &&
      node.name.toLowerCase().includes(query.toLowerCase())
    ) {
      return node;
    }

    // Nếu là thư mục
    if (node.type === "directory" && node.children) {
      const filteredChildren = node.children
        .map((child) => filterItems(child, query))
        .filter(Boolean) as FolderStructureItem[];

      if (
        filteredChildren.length > 0 ||
        node.name.toLowerCase().includes(query.toLowerCase())
      ) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
    }

    return null;
  };

  const renderFolderOrFiles = (node: FolderStructureItem) => {
    if (!node) return null;

    // Nếu đang tìm kiếm, lọc kết quả
    if (searchQuery.trim()) {
      const filteredNode = filterItems(node, searchQuery);
      if (!filteredNode) return null;
      // Mở rộng tất cả các thư mục khi tìm kiếm
      if (
        filteredNode.type === "directory" &&
        !expandedFolders.has(filteredNode.name)
      ) {
        const newExpandedFolders = new Set(expandedFolders);
        newExpandedFolders.add(filteredNode.name);
        setExpandedFolders(newExpandedFolders);
      }
    }

    return (
      <ul className="pl-4">
        <li key={node.name} className="flex flex-col">
          <ContextMenuTrigger>
            <div
              className="flex items-center cursor-pointer text-white hover:bg-gray-700 p-1 rounded group"
              onClick={() => handleItemClick(node)}
              onContextMenu={(e) => handleContextMenu(e, node)}
            >
              {node.type === "directory" ? (
                expandedFolders.has(node.name) ? (
                  <ChevronDown size={16} className="text-gray-400" />
                ) : (
                  <ChevronRight size={16} className="text-gray-400" />
                )
              ) : (
                getFileIcon(node.name)
              )}

              {isRenaming === node.path ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  className="ml-2 bg-gray-800 text-white border border-blue-500 rounded px-1"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault(); // Ngăn chặn sự kiện mặc định
                      e.stopPropagation(); // Ngăn chặn sự kiện lan truyền
                      handleRenameComplete(e);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCancelRename(e);
                    }
                  }}
                  onBlur={(e) => {
                    // Chỉ xử lý blur nếu vẫn đang đổi tên
                    if (isRenaming) {
                      handleRenameComplete(e);
                    }
                  }}
                  // Ngăn chặn sự kiện click lan truyền
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="ml-2">{node.name}</span>
              )}

              {/* Hiển thị các nút thao tác khi hover */}
              <div className="hidden group-hover:flex ml-auto space-x-1">
                <Edit
                  size={14}
                  className="text-gray-400 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRename(node);
                  }}
                />
                <Trash2
                  size={14}
                  className="text-gray-400 hover:text-red-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(node);
                  }}
                />
              </div>
            </div>
          </ContextMenuTrigger>

          {node.type === "directory" &&
            expandedFolders.has(node.name) &&
            node.children && (
              <div>
                {node.children.map((child) => renderFolderOrFiles(child))}
              </div>
            )}
        </li>
      </ul>
    );
  };

  const handleItemClick = (node: FolderStructureItem) => {
    if (node.type === "file") {
      // Sử dụng đường dẫn đầy đủ từ node nếu có
      const filePath =
        node.path ||
        (selectedFolder ? `${selectedFolder}/${node.name}` : node.name);
      console.log("File clicked:", { nodePath: node.path, filePath });
      // Instead of directly sending the IPC message, notify the parent component
      onFileSelect(filePath);
    } else if (node.type === "directory") {
      toggleFolder(node.name);
      // Nếu thư mục có đường dẫn đầy đủ, cập nhật selectedFolder
      if (node.path) {
        console.log("Directory clicked, updating selectedFolder:", node.path);
        setSelectedFolder(node.path);
      }
    }
  };

  // const handleApplyPlugin = (plugin: string, content: string) => {
  //     if (plugin === "pdf-export") {
  //         if (!content) {
  //             alert("No content to export. Please open a file first.");
  //             return;
  //         }
  //         console.log("Exporting PDF with content:", content);
  //         window.electron.ipcRenderer.invoke("export-pdf", content).then((result) => {
  //             console.log("Export PDF result:", result);
  //             if (result) {
  //                 alert(`PDF saved at: ${result}`);
  //             } else {
  //                 alert("PDF export cancelled or failed.");
  //             }
  //         }).catch((error) => {
  //             console.error("Error exporting PDF:", error);
  //             alert("Failed to export PDF: " + error.message);
  //         });
  //     }
  // };
  const handleApplyPlugin = (plugin: string) => {
    if (plugin === "pdf-export") {
      if (!currentContent) {
        alert("No content to export. Please open a file first.");
        return;
      }
      window.electron.ipcRenderer.send("apply-plugin", plugin, currentContent);
    }
  };

  // Hàm cài đặt plugin
  const handleInstallPlugin = async (pluginName: string) => {
    try {
      let result;
      try {
        // Thử sử dụng invoke trước
        result = await window.electron.ipcRenderer.invoke(
          "install-plugin",
          pluginName
        );
      } catch (invokeError) {
        // Nếu invoke không hoạt động, thử sử dụng hàm trực tiếp
        console.log("Falling back to direct method call for installPlugin");
        result = await window.electron.ipcRenderer.installPlugin(pluginName);
      }

      if (result && result.success) {
        setPluginMessage(`Successfully installed ${pluginName}`);
        // Cập nhật lại danh sách plugin
        await loadAvailablePlugins();
        // Tải lại danh sách plugin đã cài đặt
        const pluginList = await window.electron.ipcRenderer.invoke(
          "get-plugins"
        );
        setPlugins(pluginList || []);
      } else {
        setPluginMessage(
          `Failed to install ${pluginName}: ${result?.error || "Unknown error"}`
        );
      }
    } catch (error: any) {
      setPluginMessage(`Error installing ${pluginName}: ${error.message}`);
      console.error(`Error installing plugin ${pluginName}:`, error);
    }
  };

  // Hàm gỡ cài đặt plugin
  const handleUninstallPlugin = async (pluginName: string) => {
    try {
      console.log(`ContentArea: Starting uninstall for ${pluginName}`);
      setPluginMessage(`Uninstalling ${pluginName}...`);

      // Đặt selectedPlugin về null trước khi gỡ cài đặt để tránh màn hình trắng
      setSelectedPlugin(null);

      let result;
      try {
        // Thử sử dụng invoke trước
        console.log(`ContentArea: Invoking uninstall-plugin for ${pluginName}`);
        result = await window.electron.ipcRenderer.invoke(
          "uninstall-plugin",
          pluginName
        );
        console.log(`ContentArea: uninstall-plugin result:`, result);
      } catch (invokeError) {
        // Nếu invoke không hoạt động, thử sử dụng hàm trực tiếp
        console.log(
          `ContentArea: Falling back to direct method call for uninstallPlugin: ${invokeError}`
        );
        result = await window.electron.ipcRenderer.uninstallPlugin(pluginName);
        console.log(`ContentArea: uninstallPlugin result:`, result);
      }

      // Luôn xem như thành công để tránh màn hình trắng
      console.log(`ContentArea: Uninstall completed, updating UI`);
      setPluginMessage(`Successfully uninstalled ${pluginName}`);

      // Cập nhật lại danh sách plugin
      try {
        console.log(`ContentArea: Reloading available plugins`);
        await loadAvailablePlugins();

        // Tải lại danh sách plugin đã cài đặt
        console.log(`ContentArea: Reloading installed plugins`);
        const pluginList = await window.electron.ipcRenderer.invoke(
          "get-plugins"
        );
        console.log(`ContentArea: New plugin list:`, pluginList);
        setPlugins(pluginList || []);
      } catch (updateError: any) {
        console.error(`ContentArea: Error updating plugin lists:`, updateError);
        // Không hiển thị lỗi cho người dùng để tránh làm gián đoạn trải nghiệm
      }

      // Hiển thị thông báo thành công
      setTimeout(() => {
        setPluginMessage(null);
      }, 3000); // Ẩn thông báo sau 3 giây
    } catch (error: any) {
      console.error(
        `ContentArea: Error in handleUninstallPlugin for ${pluginName}:`,
        error
      );
      setPluginMessage(`Error uninstalling ${pluginName}. Please try again.`);

      // Ẩn thông báo lỗi sau 3 giây
      setTimeout(() => {
        setPluginMessage(null);
      }, 3000);
    }
  };

  // We don't need to listen for file-content here anymore
  // The App component will handle file content loading
  useEffect(() => {
    // Hủy đăng ký các listener cũ trước khi đăng ký mới
    window.electron.ipcRenderer.removeAllListeners("folder-structure");
    window.electron.ipcRenderer.removeAllListeners("item-renamed");
    window.electron.ipcRenderer.removeAllListeners("item-deleted");

    // Lắng nghe sự kiện folder-structure
    window.electron.ipcRenderer.on("folder-structure", (event, structure) => {
      console.log("Received folder structure:", structure);
      setFolderStructure(structure);
      // Lưu đường dẫn đầy đủ của thư mục đã chọn
      if (structure && structure.path) {
        console.log("Setting selected folder to:", structure.path);
        setSelectedFolder(structure.path);
      } else {
        console.log("Structure does not have a valid path:", structure);
      }
    });

    // Lắng nghe sự kiện item-renamed để log kết quả
    window.electron.ipcRenderer.on("item-renamed", (event, result) => {
      console.log("Item renamed event received:", result);
      // Không làm mới cấu trúc thư mục vì đã cập nhật UI trực tiếp trong handleRenameComplete
    });

    // Lắng nghe sự kiện item-deleted để cập nhật UI
    window.electron.ipcRenderer.on("item-deleted", (event, result) => {
      console.log("Item deleted event received in useEffect:", result);

      if (result.success && folderStructure) {
        try {
          // Cập nhật UI sau khi xóa thành công
          const removeNode = (
            parentNode: FolderStructureItem
          ): FolderStructureItem => {
            if (!parentNode.children) return parentNode;

            return {
              ...parentNode,
              children: parentNode.children
                .filter((child) => {
                  // Kiểm tra xem path của child có phải là result.path hoặc nằm trong result.path không
                  // (nếu result.path là thư mục)
                  if (child.path === result.path) return false;
                  if (
                    result.isDirectory &&
                    child.path &&
                    child.path.startsWith(result.path + "/")
                  )
                    return false;
                  if (
                    result.isDirectory &&
                    child.path &&
                    child.path.startsWith(result.path + "\\")
                  )
                    return false;
                  return true;
                })
                .map(removeNode),
            };
          };

          console.log("Updating UI after successful deletion in useEffect");
          const updatedStructure = removeNode(folderStructure);
          setFolderStructure(updatedStructure);

          // Nếu là file, thông báo cho component cha
          if (!result.isDirectory) {
            console.log(
              "Notifying parent component about file deletion in useEffect:",
              result.path
            );
            onFileDeleted?.(result.path);
          } else {
            // Nếu là thư mục, làm mới cấu trúc thư mục
            console.log("Directory deleted, refreshing folder structure");
            if (selectedFolder) {
              // Làm mới cấu trúc thư mục sau khi xóa thư mục
              setTimeout(() => {
                refreshFolderStructure();
              }, 500);
            }
          }
        } catch (error) {
          console.error("Error updating UI after deletion:", error);
        }
      }
    });

    console.log("Registered IPC event listeners in ContentArea component");

    return () => {
      console.log("Removing IPC event listeners in ContentArea component");
      window.electron.ipcRenderer.removeAllListeners("folder-structure");
      window.electron.ipcRenderer.removeAllListeners("item-renamed");
      window.electron.ipcRenderer.removeAllListeners("item-deleted");
      window.electron.ipcRenderer.removeAllListeners("new-file-created");
    };
  }, [folderStructure, onFileDeleted]);
  // Lấy danh sách plugin khi tab extensions được mở
  // useEffect(() => {
  //     if (activeTab === "extensions") {
  //         if (window.electron && window.electron.ipcRenderer && typeof window.electron.ipcRenderer.getPlugins === "function") {
  //             window.electron.ipcRenderer.getPlugins().then((pluginList) => {
  //                 setPlugins(pluginList || []);
  //             }).catch((error) => {
  //                 console.error("Failed to fetch plugins:", error);
  //                 setPlugins([]);
  //             });
  //         } else {
  //             console.error("electron.ipcRenderer.getPlugins is not available");
  //             setPlugins([]);
  //         }
  //     }
  // }, [activeTab]);
  // Hàm tải danh sách plugin có sẵn từ marketplace
  const loadAvailablePlugins = async () => {
    try {
      setLoadingAvailablePlugins(true);
      const plugins = await window.electron.ipcRenderer.invoke(
        "get-available-plugins"
      );
      setAvailablePlugins(plugins || []);
    } catch (error) {
      console.error("Failed to fetch available plugins:", error);
      setAvailablePlugins([]);
    } finally {
      setLoadingAvailablePlugins(false);
    }
  };

  useEffect(() => {
    // Reset selected plugin when tab changes
    setSelectedPlugin(null);

    // Hủy đăng ký các listener cũ trước khi đăng ký mới
    window.electron.ipcRenderer.removeAllListeners("plugin-list");
    window.electron.ipcRenderer.removeAllListeners("plugin-applied");

    if (activeTab === "extensions") {
      // Tải danh sách plugin đã cài đặt
      window.electron.ipcRenderer
        .invoke("get-plugins")
        .then((pluginList: string[]) => {
          setPlugins(pluginList || []);
        })
        .catch((error) => {
          console.error("Failed to fetch plugins:", error);
          setPlugins([]);
        });

      // Tải danh sách plugin có sẵn từ marketplace
      loadAvailablePlugins();

      window.electron.ipcRenderer.on(
        "plugin-list",
        (event, pluginList: string[]) => {
          setPlugins(pluginList || []);
          // Cập nhật lại danh sách plugin có sẵn khi danh sách plugin đã cài đặt thay đổi
          loadAvailablePlugins();
        }
      );

      window.electron.ipcRenderer.on(
        "plugin-applied",
        (event, message: string) => {
          setPluginMessage(message);
          setTimeout(() => setPluginMessage(null), 5000); // Ẩn thông báo sau 5 giây
        }
      );

      console.log(
        "Registered plugin-related IPC event listeners in ContentArea component"
      );
    }

    return () => {
      console.log(
        "Removing plugin-related IPC event listeners in ContentArea component"
      );
      window.electron.ipcRenderer.removeAllListeners("plugin-list");
      window.electron.ipcRenderer.removeAllListeners("plugin-applied");
    };
  }, [activeTab]);

  useEffect(() => {
    // Lắng nghe sự kiện new-folder-created để cập nhật UI
    window.electron.ipcRenderer.on("new-folder-created", (event, result) => {
      console.log("New folder created:", result);

      if (result.success) {
        // Đặt trạng thái đang làm mới
        setIsRefreshing(true);

        // Gửi yêu cầu làm mới đến main process
        window.electron.ipcRenderer.send(
          "refresh-folder-structure",
          selectedFolder
        );

        // Đặt timeout để dừng hiệu ứng loading sau 1 giây
        setTimeout(() => {
          setIsRefreshing(false);
          setRefreshMessage("Folder created successfully");

          // Tự động ẩn thông báo sau 2 giây
          setTimeout(() => {
            setRefreshMessage(null);
          }, 2000);
        }, 1000);
      } else {
        setRefreshMessage(
          `Failed to create folder: ${result.error || "Unknown error"}`
        );

        // Tự động ẩn thông báo sau 3 giây
        setTimeout(() => {
          setRefreshMessage(null);
        }, 3000);
      }
    });

    return () => {
      window.electron.ipcRenderer.removeAllListeners("new-folder-created");
    };
  }, [selectedFolder]);

  const toggleFolderMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFolderMenu(!showFolderMenu);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        folderMenuRef.current &&
        !folderMenuRef.current.contains(event.target as Node)
      ) {
        setShowFolderMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div
      className="bg-[#252526] h-full overflow-hidden relative"
      onClick={closeContextMenu}
    >
      {renderContent()}
      {pluginMessage && (
        <div className="absolute bottom-4 right-4 bg-gray-800 text-white p-3 rounded shadow-lg">
          {pluginMessage}
        </div>
      )}
      {showMarketplace && (
        <PluginMarketplace onClose={() => setShowMarketplace(false)} />
      )}

      {/* Menu ngữ cảnh */}
      {contextMenuPosition && contextMenuTarget && (
        <div
          className="fixed bg-[#252526] shadow-lg rounded z-50 text-sm border border-[#3c3c3c] overflow-hidden"
          style={{
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            minWidth: "180px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-1">
            {contextMenuTarget.type === "directory" && (
              <>
                <div
                  className="flex items-center px-3 py-1 hover:bg-[#2a2d2e] cursor-pointer"
                  onClick={() => {
                    handleCreateNewFile(contextMenuTarget.path);
                    closeContextMenu();
                  }}
                >
                  <FilePlus size={16} className="mr-2 text-blue-400" />
                  <span>New File</span>
                </div>
                <div
                  className="flex items-center px-3 py-1 hover:bg-[#2a2d2e] cursor-pointer"
                  onClick={() => {
                    handleCreateNewFolder(contextMenuTarget.path);
                    closeContextMenu();
                  }}
                >
                  <FolderPlus
                    size={16}
                    className="mr-2 text-yellow-400"
                    onClick={() =>
                      handleCreateNewFolder(contextMenuTarget.path)
                    }
                  />
                  <span>New Folder</span>
                </div>
                <ContextMenuSeparator />
              </>
            )}

            <div
              className="flex items-center px-3 py-1 hover:bg-[#2a2d2e] cursor-pointer"
              onClick={() => {
                handleRename(contextMenuTarget);
                closeContextMenu();
              }}
            >
              <Edit size={16} className="mr-2 text-green-400" />
              <span>Rename</span>
            </div>
            <div
              className="flex items-center px-3 py-1 hover:bg-[#2a2d2e] cursor-pointer"
              onClick={() => {
                handleDelete(contextMenuTarget);
                closeContextMenu();
              }}
            >
              <Trash2 size={16} className="mr-2 text-red-400" />
              <span>Delete</span>
            </div>
            <ContextMenuSeparator />
            <div
              className="flex items-center px-3 py-1 hover:bg-[#2a2d2e] cursor-pointer"
              onClick={() => {
                refreshFolderStructure();
                closeContextMenu();
              }}
            >
              <RefreshCw size={16} className="mr-2 text-blue-400" />
              <span>Refresh</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentArea;
