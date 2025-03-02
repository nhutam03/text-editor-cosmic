import React, { useEffect, useState, useRef } from 'react';
import { Flex, Box, ChakraProvider, createSystem, defaultConfig } from '@chakra-ui/react';
import Editor from './components/Editor';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import ContentArea from './components/ContentArea';
// import { recentFiles } from './plugins/recentFiles';

// Định nghĩa theme tùy chỉnh với createSystem
const customConfig = {
  theme: {
    tokens: {
      colors: {
        gray: {
          900: { value: '#1a202c' }, // Định nghĩa màu theo cấu trúc mới
        },
        // Thêm các màu tùy chỉnh khác nếu cần
      },
      fonts: {
        body: { value: 'Arial, sans-serif' }, // Định nghĩa font
      },
    },
    globalCss: {
      'html, body': {
        margin: 0,
        padding: 0,
      },
      body: {
        background: 'gray.900',
        color: 'white',
        overflow: 'hidden',
      },
    },
  },
};

const customSystem = createSystem(defaultConfig, customConfig);
const App: React.FC = () => {
  const [contentWidth, setContentWidth] = useState(300); // Độ rộng của ContentArea
  const [activeTab, setActiveTab] = useState('explorer');
  // const [stats, setStats] = useState({ words: 0, chars: 0, lines: 0 });
  const [stats, setStats] = useState({
    line: 1,
    column: 1,
    wordCount: 0,
    page: 1,
    language: 'plaintext',
  });

  const resizerRef = useRef<HTMLDivElement>(null);

  const handleContentChange = (newStats: Partial<typeof stats>) => {
    setStats((prev) => ({ ...prev, ...newStats }));
  };

  // const handleSave = () => {
  //   console.log('Saving file...');
  // };

  const handleSpellCheck = () => {
    console.log('Toggling spell-check...');
  };

  const handleThemeChange = () => {
    console.log('Changing theme...');
  };

  useEffect(() => {
    const resizer = resizerRef.current;
    if (resizer) {
      const handleMouseDown = (e: MouseEvent) => {
        const startX = e.pageX;
        const handleMouseMove = (moveEvent: MouseEvent) => {
          const newWidth = contentWidth + (moveEvent.pageX - startX);
          if (newWidth >= 150 && newWidth <= 500) {
            setContentWidth(newWidth);
          }
        };
        const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      };

      resizer.addEventListener('mousedown', handleMouseDown);
      return () => resizer.removeEventListener('mousedown', handleMouseDown);
    }
  }, [contentWidth]);

  return (
    <ChakraProvider value={customSystem}>

      <Flex h="100vh" bg="gray.900" color="white">
        {/* Sidebar */}
        <Sidebar setActiveTab={setActiveTab} />

        <Flex flex={1} flexDir="row">
          <ContentArea width={contentWidth} activeTab={activeTab} />

          {/* Resizer (thay thế Divider) */}
          <Box
            ref={resizerRef}
            w="4px"
            bg="gray.500"
            cursor="col-resize"
            _hover={{ bg: 'gray.400' }} // Tùy chọn: thay đổi màu khi hover
          />

          {/* Editor Area (Toolbar + Open Files + Editor + Status Bar) */}
          <Flex flex={1} flexDir="column">
            <Toolbar
              onSpellCheck={handleSpellCheck}
              onThemeChange={handleThemeChange}
            />
            <Editor onContentChange={handleContentChange}/>
            <StatusBar stats={stats} />
          </Flex>
        </Flex>
      </Flex>
    </ChakraProvider>

  );
}

export default App;
