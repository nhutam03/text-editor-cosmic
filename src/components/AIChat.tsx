import React, { useState, useRef, useEffect } from 'react';
import { X, Send, User, Bot } from 'lucide-react';
import { Button } from './ui/button';

interface AIChatProps {
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AIChat: React.FC<AIChatProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Xin chào! Tôi là trợ lý AI. Tôi có thể giúp gì cho bạn về lập trình?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Cuộn xuống cuối cuộc trò chuyện khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus vào input khi component được mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    console.log('🚀 [AIChat] Sending message to AI:', input);

    // Thêm tin nhắn của người dùng vào danh sách
    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const requestData = {
        pluginName: 'ai-assistant',
        content: input,
        options: {
          systemPrompt: 'Bạn là một trợ lý AI hữu ích về lập trình. Hãy trả lời bằng tiếng Việt.',
          prompt: input
        }
      };

      console.log('📤 [AIChat] Sending execute-plugin request:', requestData);

      // Đăng ký listener để nhận kết quả TRƯỚC khi gửi request
      console.log('📝 [AIChat] Registering plugin-executed listener...');
      window.electron.ipcRenderer.once('plugin-executed', (_event: Electron.IpcRendererEvent, result: { success: boolean, data?: string | { result: string }, message?: string }) => {
        console.log('📥 [AIChat] Received plugin-executed response:', result);
        console.log('📥 [AIChat] Response data type:', typeof result.data);
        console.log('📥 [AIChat] Response data content:', result.data);

        if (result.success) {
          // Xử lý response từ AI service tích hợp hoặc plugin
          let aiResponse = '';
          if (typeof result.data === 'string') {
            // Response từ AI service tích hợp
            aiResponse = result.data;
          } else if (result.data && typeof result.data === 'object' && 'result' in result.data) {
            // Response từ plugin
            aiResponse = result.data.result;
          } else {
            aiResponse = 'Không có kết quả';
          }

          console.log('✅ [AIChat] AI processing successful, response:', aiResponse);
          // Thêm phản hồi từ AI vào danh sách tin nhắn
          setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
        } else {
          console.error('❌ [AIChat] AI processing failed:', result.message);
          // Hiển thị thông báo lỗi
          setMessages(prev => [...prev, { role: 'assistant', content: `Lỗi: ${result.message}` }]);
        }
        setIsLoading(false);
      });

      // Gửi yêu cầu đến plugin AI SAU khi đã đăng ký listener
      console.log('📤 [AIChat] Sending execute-plugin request to main process...');
      window.electron.ipcRenderer.send('execute-plugin', requestData);
    } catch (error) {
      console.error('💥 [AIChat] Error sending message to AI:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn.' }]);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Gửi tin nhắn khi nhấn Enter (không phải Shift+Enter)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-[#252526] border border-gray-700 rounded-lg shadow-lg flex flex-col z-50">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-gray-700">
        <h3 className="text-white font-medium">AI Assistant</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-gray-400 hover:text-white"
          onClick={onClose}
        >
          <X size={16} />
        </Button>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-[#0078D4] text-white'
                  : 'bg-[#3c3c3c] text-gray-200'
              }`}
            >
              <div className="flex items-center mb-1">
                {message.role === 'user' ? (
                  <>
                    <span className="font-medium">Bạn</span>
                    <User size={14} className="ml-1" />
                  </>
                ) : (
                  <>
                    <span className="font-medium">AI Assistant</span>
                    <Bot size={14} className="ml-1" />
                  </>
                )}
              </div>
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-3 rounded-lg bg-[#3c3c3c] text-gray-200">
              <div className="flex items-center mb-1">
                <span className="font-medium">AI Assistant</span>
                <Bot size={14} className="ml-1" />
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex items-end">
          <textarea
            ref={inputRef}
            className="flex-1 bg-[#3c3c3c] text-white rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Nhập tin nhắn..."
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <Button
            className="ml-2 bg-[#0078D4] hover:bg-[#106EBE] text-white rounded-full h-10 w-10 p-0 flex items-center justify-center"
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
