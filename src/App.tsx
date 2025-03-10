import React, { useEffect, useState} from 'react';
import Editor from './components/Editor';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import ContentArea from './components/ContentArea';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './components/ui/resizable';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('explorer');
  const [stats, setStats] = useState({
    line: 1,
    column: 1,
    wordCount: 0,
    page: 1,
    language: 'markdown',
  });
  const [contentSize, setContentSize] = useState(20);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
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
  const handleContentChange = (newStats: Partial<typeof stats>) => {
    setStats((prev) => ({ ...prev, ...newStats }));
  };

  const handleFileSelect = (filePath: string) => {
    loadFileContent(filePath);
    console.log('File selected:', filePath);
  };
  const loadFileContent = (fileName: string) => {
    window.electron.ipcRenderer.send('open-file-request', fileName);
  };

  useEffect(() => {
    setContentSize(isRightSidebarCollapsed ? 0 : defaultContentSize);
  }, [isRightSidebarCollapsed]);

  return (
    <div className="flex h-screen bg-gray-900 text-white">
        {/* Sidebar */}
      <Sidebar setActiveTab={setActiveTab} activeTab={activeTab} onTabClick={handleTabClick} />

      {/* Resizable layout */}
      <ResizablePanelGroup direction="horizontal" className="flex flex-1"
        key={contentSize} 
      >
        {/* Content Area */}
        <ResizablePanel 
          defaultSize={isRightSidebarCollapsed ? 0 : contentSize}
          >
          <ContentArea activeTab={activeTab} onFileSelect={handleFileSelect} />
        </ResizablePanel>

        <ResizableHandle />

        {/* Editor Area (Editor + Status Bar) */}
        <ResizablePanel
         defaultSize={100 - contentSize} minSize={30}
         >
          <div className="flex flex-col h-full">
            <Editor onContentChange={handleContentChange} loadFileContent={loadFileContent} />
            <StatusBar stats={stats} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default App;
