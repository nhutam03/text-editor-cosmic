import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const isElectron = process.env.ELECTRON === 'true' || mode === 'production';

  return {
    build: {
      outDir: 'dist',
      rollupOptions: {
       
      },
      emptyOutDir: true,
      sourcemap: true, // Tùy chọn, giúp debug dễ hơn
    },
    base: isElectron ? './' : '/', // Sử dụng đường dẫn tương đối khi build cho Electron
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});