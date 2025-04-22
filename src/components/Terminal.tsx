import React from 'react';
import { X } from 'lucide-react';

interface TerminalProps {
  activeTab: string;
  isRunning: boolean;
  terminalOutput: string; // Đã thay đổi từ string[] sang string
  onTabClick: (tab: string) => void;
  onClose: () => void;
}

const Terminal: React.FC<TerminalProps> = ({
  activeTab,
  isRunning,
  terminalOutput,
  onTabClick,
  onClose
}) => {
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
        <div className="p-2 text-sm font-mono flex-1 overflow-auto">
          {isRunning ? (
            <div className="flex items-center text-yellow-400 mb-2">
              <span className="animate-pulse mr-2">●</span>
              <span>Running code... (Press Shift+F5 to stop)</span>
            </div>
          ) : null}

          {terminalOutput ? (
            <pre className="whitespace-pre-wrap">
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

                return <div key={index} className={className}>{line}</div>;
              })}
            </pre>
          ) : (
            <div>
              <div className="text-green-400">$ Ready to run code</div>
              <div className="text-white">Press F5 to run the current file or use Run menu</div>
              <div className="text-white">Supported languages: JavaScript (.js), TypeScript (.ts), Python (.py), HTML (.html)</div>
            </div>
          )}
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
