import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import "./index.css";

// Bao bọc App bằng ErrorBoundary để bắt tất cả lỗi JavaScript
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={
        <div className="flex flex-col items-center justify-center h-screen bg-[#1e1e1e] text-white">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-4 text-red-400">Application Error</h1>
            <p className="text-gray-300 mb-4">
              The application encountered an unexpected error. This might be due to a plugin operation.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      }
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);