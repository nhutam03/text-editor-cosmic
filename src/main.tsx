import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import "./index.css";

// Tạm thời tắt StrictMode để kiểm tra vấn đề với focus
ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);