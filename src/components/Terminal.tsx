import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface TerminalProps {
  activeTab: string;
  isRunning: boolean;
  terminalOutput: string;
  onTabClick: (tab: string) => void;
  onClose: () => void;
  onExecuteCommand?: (command: string) => void;
}

const Terminal: React.FC<TerminalProps> = ({
  activeTab,
  isRunning,
  terminalOutput,
  onTabClick,
  onClose,
  onExecuteCommand
}) => {
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalContentRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn xuống dưới khi có output mới
  useEffect(() => {
    if (terminalContentRef.current) {
      terminalContentRef.current.scrollTop = terminalContentRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Chỉ focus terminal khi tab được chọn lần đầu, sau đó để người dùng tự do điều khiển
  useEffect(() => {
    if (activeTab !== 'TERMINAL') return;

    // Chỉ focus vào terminal khi tab được chọn lần đầu
    if (terminalRef.current) {
      // Sử dụng setTimeout để đảm bảo focus được thực hiện sau khi render
      setTimeout(() => {
        if (terminalRef.current) {
          terminalRef.current.focus();
          console.log('Terminal focused on mount/tab change');
        }
      }, 50);
    }

    // Không thêm bất kỳ event listener nào để can thiệp vào việc focus
    // Để người dùng tự do điều khiển focus theo ý muốn
  }, [activeTab]);



  // Xử lý khi người dùng nhấn phím trong terminal
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ngăn chặn các phím mặc định như Tab
    if (e.key === 'Tab') {
      e.preventDefault();
    }

    if (e.key === 'Enter' && command.trim() !== '') {
      e.preventDefault();

      // Thêm lệnh vào lịch sử
      setCommandHistory(prev => [...prev, command]);
      setHistoryIndex(-1);

      // Gọi hàm xử lý lệnh nếu được cung cấp
      if (onExecuteCommand) {
        onExecuteCommand(command);
      }

      // Xóa lệnh hiện tại
      setCommand('');
      setCursorPosition(0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Lấy lệnh trước đó từ lịch sử
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        const historyCommand = commandHistory[commandHistory.length - 1 - newIndex];
        setCommand(historyCommand);
        setCursorPosition(historyCommand.length);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Lấy lệnh tiếp theo từ lịch sử
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        const historyCommand = commandHistory[commandHistory.length - 1 - newIndex];
        setCommand(historyCommand);
        setCursorPosition(historyCommand.length);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
        setCursorPosition(0);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (cursorPosition > 0) {
        setCursorPosition(cursorPosition - 1);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (cursorPosition < command.length) {
        setCursorPosition(cursorPosition + 1);
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      if (cursorPosition > 0) {
        setCommand(prev => prev.substring(0, cursorPosition - 1) + prev.substring(cursorPosition));
        setCursorPosition(cursorPosition - 1);
      }
    } else if (e.key === 'Delete') {
      e.preventDefault();
      if (cursorPosition < command.length) {
        setCommand(prev => prev.substring(0, cursorPosition) + prev.substring(cursorPosition + 1));
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      setCursorPosition(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setCursorPosition(command.length);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      setCommand(prev => prev.substring(0, cursorPosition) + e.key + prev.substring(cursorPosition));
      setCursorPosition(cursorPosition + 1);
    }
  };

  // Xử lý click vào terminal để focus
  const handleTerminalClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Ngăn event bubbling
    if (terminalRef.current) {
      terminalRef.current.focus();
      setCursorPosition(command.length);
    }
  };

  // Xử lý focus vào terminal
  const handleTerminalFocus = () => {
    console.log("Terminal focused");
    setCursorPosition(command.length);
  };

  // Xử lý blur khỏi terminal
  const handleTerminalBlur = (e: React.FocusEvent) => {
    // Chỉ blur nếu focus không chuyển sang element con của terminal
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!terminalRef.current?.contains(relatedTarget)) {
      console.log("Terminal blurred");
    }
  };

  return (
    <div className="bg-[#1e1e1e] border-t border-[#3c3c3c] flex flex-col h-full overflow-hidden">
      <div className="flex bg-[#252526] text-sm">
        <div
          className={`px-3 py-1 border-r border-[#3c3c3c] cursor-pointer ${activeTab === 'PROBLEMS' ? 'bg-[#1e1e1e]' : ''}`}
          onClick={() => onTabClick('PROBLEMS')}
        >
          PROBLEMS
        </div>
        <div
          className={`px-3 py-1 border-r border-[#3c3c3c] cursor-pointer ${activeTab === 'OUTPUT' ? 'bg-[#1e1e1e]' : ''}`}
          onClick={() => onTabClick('OUTPUT')}
        >
          OUTPUT
        </div>
        <div
          className={`px-3 py-1 border-r border-[#3c3c3c] cursor-pointer ${activeTab === 'DEBUG CONSOLE' ? 'bg-[#1e1e1e]' : ''}`}
          onClick={() => onTabClick('DEBUG CONSOLE')}
        >
          DEBUG CONSOLE
        </div>
        <div
          className={`px-3 py-1 border-r border-[#3c3c3c] cursor-pointer ${activeTab === 'TERMINAL' ? 'bg-[#1e1e1e]' : ''}`}
          onClick={() => onTabClick('TERMINAL')}
        >
          TERMINAL
        </div>
        <div
          className={`px-3 py-1 border-r border-[#3c3c3c] cursor-pointer ${activeTab === 'PORTS' ? 'bg-[#1e1e1e]' : ''}`}
          onClick={() => onTabClick('PORTS')}
        >
          PORTS
        </div>
        <div
          className={`px-3 py-1 cursor-pointer ${activeTab === 'AUGMENT NEXT EDIT' ? 'bg-[#1e1e1e]' : ''}`}
          onClick={() => onTabClick('AUGMENT NEXT EDIT')}
        >
          AUGMENT NEXT EDIT
        </div>
        <div className="ml-auto px-3 py-1 cursor-pointer" onClick={onClose}>
          <X size={14} />
        </div>
      </div>

      {activeTab === 'TERMINAL' && (
        <div
          className="flex flex-col h-full terminal-container"
          ref={terminalRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onClick={handleTerminalClick}
          onFocus={handleTerminalFocus}
          onBlur={handleTerminalBlur}
          style={{ outline: 'none', userSelect: 'text' }}
        >
          <div className="p-2 text-sm font-mono flex-1 overflow-auto" ref={terminalContentRef} style={{ userSelect: 'text' }}>
            {isRunning ? (
              <div className="flex items-center text-yellow-400 mb-2">
                <span className="animate-pulse mr-2">●</span>
                <span>Running code... (Press Shift+F5 to stop)</span>
              </div>
            ) : null}

            {terminalOutput ? (
              <pre className="whitespace-pre-wrap" style={{ userSelect: 'text' }}>
                {terminalOutput.split('\n').map((line, index) => {
                  // Determine line color based on content
                  let className = "text-white";
                  if (line.includes('ERROR') || line.includes('Error:')) {
                    className = "text-red-400";
                  } else if (line.includes('SUCCESS')) {
                    className = "text-green-400";
                  } else if (line.includes('STOPPED')) {
                    className = "text-yellow-400";
                  }

                  return <div key={index} className={className} style={{ userSelect: 'text' }}>{line}</div>;
                })}
              </pre>
            ) : (
              <div>
                <div className="text-green-400">$ Terminal ready</div>
                <div className="text-white">Type commands to run code</div>
                <div className="text-white">Examples: node file.js, python file.py, g++ file.cpp -o file.exe && file.exe</div>
              </div>
            )}

            {/* Terminal prompt - tích hợp trong terminal content */}
            <div className="flex items-start mt-2" ref={promptRef} style={{ userSelect: 'text' }}>
              <span className="text-green-400 mr-2">$</span>
              <div className="relative inline-block text-white" style={{ userSelect: 'text' }}>
                <span style={{ userSelect: 'text' }}>{command}</span>
                {/* Cursor */}
                <span
                  className="absolute bg-white opacity-70 w-[2px] h-[14px] animate-pulse"
                  style={{
                    left: `${cursorPosition * 8}px`, // Ước tính khoảng cách dựa trên độ rộng của font mono
                    top: '1px'
                  }}
                ></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'PROBLEMS' && (
        <div className="p-2 text-sm text-white flex-1 overflow-auto">
          <div className="flex items-center justify-center h-full text-gray-400">
            No problems have been detected in the workspace.
          </div>
        </div>
      )}

      {activeTab === 'OUTPUT' && (
        <div className="p-2 text-sm text-white flex-1 overflow-auto">
          <div className="flex items-center justify-center h-full text-gray-400">
            No output to show.
          </div>
        </div>
      )}

      {activeTab === 'DEBUG CONSOLE' && (
        <div className="p-2 text-sm text-white flex-1 overflow-auto">
          <div className="flex items-center justify-center h-full text-gray-400">
            Debug console is inactive.
          </div>
        </div>
      )}

      {activeTab === 'PORTS' && (
        <div className="p-2 text-sm text-white flex-1 overflow-auto">
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

      {activeTab === 'AUGMENT NEXT EDIT' && (
        <div className="p-2 text-sm text-white flex-1 overflow-auto">
          <div className="flex items-center justify-center h-full text-gray-400">
            Augment Next Edit is ready.
          </div>
        </div>
      )}
    </div>
  );
};

export default Terminal;
