const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const os = require('os');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');
const { createGunzip } = require('zlib');
const { extract } = require('tar');

// Đường dẫn đến thư mục bin
const pluginPath = __dirname;
const binPath = path.join(pluginPath, 'bin');

// Tạo thư mục bin nếu chưa tồn tại
if (!fs.existsSync(binPath)) {
  fs.mkdirSync(binPath, { recursive: true });
}

// Tạo thư mục cho từng nền tảng
const platformBinPath = {
  win32: path.join(binPath, 'win32'),
  darwin: path.join(binPath, 'darwin'),
  linux: path.join(binPath, 'linux')
};

// Tạo thư mục cho nền tảng hiện tại
const currentPlatform = process.platform;
if (!fs.existsSync(platformBinPath[currentPlatform])) {
  fs.mkdirSync(platformBinPath[currentPlatform], { recursive: true });
}

// URL tải trình biên dịch
const compilerUrls = {
  win32: {
    mingw: 'https://github.com/niXman/mingw-builds-binaries/releases/download/12.2.0-rt_v10-rev2/i686-12.2.0-release-posix-dwarf-msvcrt-rt_v10-rev2.7z'
  },
  darwin: {
    gcc: 'https://github.com/Homebrew/homebrew-core/archive/refs/tags/gcc-12.2.0.tar.gz'
  },
  linux: {
    gcc: 'https://ftp.gnu.org/gnu/gcc/gcc-12.2.0/gcc-12.2.0.tar.gz'
  }
};

// Hàm tải file
async function downloadFile(url, destPath) {
  console.log(`Downloading from ${url} to ${destPath}...`);
  
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      pipeline(response, file, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// Hàm giải nén file
async function extractArchive(archivePath, destPath) {
  console.log(`Extracting ${archivePath} to ${destPath}...`);
  
  if (archivePath.endsWith('.tar.gz')) {
    return new Promise((resolve, reject) => {
      fs.createReadStream(archivePath)
        .pipe(createGunzip())
        .pipe(extract({ cwd: destPath }))
        .on('error', reject)
        .on('end', resolve);
    });
  } else if (archivePath.endsWith('.7z')) {
    // Sử dụng 7zip để giải nén (cần cài đặt 7zip)
    return new Promise((resolve, reject) => {
      const sevenZip = spawn('7z', ['x', archivePath, `-o${destPath}`, '-y']);
      
      sevenZip.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`7zip exited with code ${code}`));
        }
      });
      
      sevenZip.on('error', reject);
    });
  } else {
    throw new Error(`Unsupported archive format: ${archivePath}`);
  }
}

// Hàm cài đặt trình biên dịch cho Windows
async function installWindowsCompilers() {
  console.log('Installing compilers for Windows...');
  
  const tempDir = path.join(os.tmpdir(), 'text-editor-compilers');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const mingwUrl = compilerUrls.win32.mingw;
  const archivePath = path.join(tempDir, 'mingw.7z');
  
  try {
    // Tải MinGW
    await downloadFile(mingwUrl, archivePath);
    
    // Giải nén
    await extractArchive(archivePath, tempDir);
    
    // Sao chép các file cần thiết
    const mingwBinPath = path.join(tempDir, 'mingw32', 'bin');
    const files = ['g++.exe', 'gcc.exe', 'libstdc++-6.dll', 'libgcc_s_dw2-1.dll'];
    
    for (const file of files) {
      const srcPath = path.join(mingwBinPath, file);
      const destPath = path.join(platformBinPath.win32, file);
      
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${file} to ${destPath}`);
      } else {
        console.warn(`File not found: ${srcPath}`);
      }
    }
    
    console.log('Windows compilers installed successfully!');
  } catch (error) {
    console.error('Failed to install Windows compilers:', error);
  } finally {
    // Dọn dẹp
    try {
      fs.unlinkSync(archivePath);
    } catch (error) {
      console.warn('Failed to clean up temporary files:', error);
    }
  }
}

// Hàm chính để cài đặt trình biên dịch
async function installCompilers() {
  console.log('Starting compiler installation...');
  
  switch (currentPlatform) {
    case 'win32':
      await installWindowsCompilers();
      break;
    case 'darwin':
      console.log('macOS compiler installation not implemented yet.');
      break;
    case 'linux':
      console.log('Linux compiler installation not implemented yet.');
      break;
    default:
      console.log(`Unsupported platform: ${currentPlatform}`);
  }
  
  console.log('Compiler installation completed.');
}

// Chạy hàm cài đặt
installCompilers().catch(console.error);
