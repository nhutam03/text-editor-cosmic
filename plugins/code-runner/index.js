const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const os = require('os');

// Avoid using node-pty which requires native compilation
// const pty = require('node-pty'); // Commented out to avoid errors

// Import electron for shell.openExternal
let shell;
try {
  const electron = require('electron');
  shell = electron.shell;
} catch (error) {
  console.warn('Electron module not available, HTML preview will not work');
  shell = null;
}

// Đường dẫn đến thư mục bin của plugin
const pluginPath = __dirname;
const binPath = path.join(pluginPath, 'bin');

// Đường dẫn đến các công cụ biên dịch tích hợp dựa trên nền tảng
const platformBinPath = {
  win32: path.join(binPath, 'win32'),
  darwin: path.join(binPath, 'darwin'),
  linux: path.join(binPath, 'linux')
}[process.platform] || '';

// Kiểm tra xem có thư mục bin cho nền tảng hiện tại không
const hasIntegratedCompiler = fs.existsSync(platformBinPath);
console.log(`Integrated compiler path: ${platformBinPath}`);
console.log(`Has integrated compiler: ${hasIntegratedCompiler}`);

// Kiểm tra xem có thư mục bin con không
const binSubdir = fs.existsSync(path.join(platformBinPath, 'bin')) ? 'bin' : '';
const compilerDir = binSubdir ? path.join(platformBinPath, binSubdir) : platformBinPath;
console.log(`Compiler directory: ${compilerDir}`);

// Đường dẫn đến các công cụ biên dịch
const compilerPaths = {
  'g++': hasIntegratedCompiler ? path.join(compilerDir, process.platform === 'win32' ? 'g++.exe' : 'g++') : '',
  'gcc': hasIntegratedCompiler ? path.join(compilerDir, process.platform === 'win32' ? 'gcc.exe' : 'gcc') : '',
  'python': hasIntegratedCompiler ? path.join(compilerDir, process.platform === 'win32' ? 'python.exe' : 'python') : '',
  'node': hasIntegratedCompiler ? path.join(compilerDir, process.platform === 'win32' ? 'node.exe' : 'node') : ''
};

// Connect to the plugin server
const client = new net.Socket();
const PORT = process.argv.find(arg => arg.startsWith('--port='))?.split('=')[1] || 5000;

// Map để lưu trữ các process đang chạy
const runningProcesses = new Map();

// Tạo thư mục tạm thời để chạy code
const tempDir = path.join(os.tmpdir(), 'text-editor-code-runner');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Kiểm tra xem một chương trình có được cài đặt không
function isCommandInstalled(command) {
  // Kiểm tra trước nếu có trình biên dịch tích hợp
  if (hasIntegratedCompiler && compilerPaths[command]) {
    const compilerPath = compilerPaths[command];
    console.log(`Using integrated compiler: ${compilerPath}`);
    return fs.existsSync(compilerPath);
  }

  // Kiểm tra trực tiếp trong thư mục bin/win32/bin
  if (process.platform === 'win32' && (command === 'g++' || command === 'gcc')) {
    const directCompilerPath = path.join(pluginPath, 'bin', 'win32', 'bin', command + '.exe');
    console.log(`Checking direct compiler path: ${directCompilerPath}`);
    if (fs.existsSync(directCompilerPath)) {
      console.log(`Found compiler at: ${directCompilerPath}`);
      // Cập nhật compilerPaths
      compilerPaths[command] = directCompilerPath;
      return true;
    }
  }

  // Nếu không có trình biên dịch tích hợp, kiểm tra hệ thống
  try {
    const platform = process.platform;
    const cmd = platform === 'win32' ? 'where' : 'which';
    const result = require('child_process').spawnSync(cmd, [command], {
      shell: true,
      timeout: 5000,
      windowsHide: true
    });
    return result.status === 0;
  } catch (error) {
    console.error(`Error checking if ${command} is installed:`, error);
    return false;
  }
}

// Hàm chạy code
async function runCode(content, fileName, language) {
  console.log(`Running code in ${language} language, content length: ${content?.length || 0}`);

  // Xác định tên file và lệnh chạy dựa trên ngôn ngữ
  let tempFile = '';
  let command = '';
  let args = [];
  let needsCompilation = false;
  let compileCommand = '';
  let compileArgs = [];
  let executableFile = '';

  switch (language) {
    case 'js':
      tempFile = path.join(tempDir, 'temp.js');

      if (isCommandInstalled('node')) {
        command = 'node';
        args = [tempFile];
      } else {
        return {
          success: false,
          message: 'Node.js is not installed. Please install Node.js to run JavaScript code.',
          output: '',
          error: 'Node.js not found'
        };
      }
      break;

    case 'py':
      tempFile = path.join(tempDir, 'temp.py');

      if (isCommandInstalled('python')) {
        command = 'python';
        args = [tempFile];
      } else if (isCommandInstalled('python3')) {
        command = 'python3';
        args = [tempFile];
      } else {
        return {
          success: false,
          message: 'Python is not installed. Please install Python to run Python code.',
          output: '',
          error: 'Python not found'
        };
      }
      break;

    case 'ts':
      tempFile = path.join(tempDir, 'temp.ts');

      if (isCommandInstalled('npx')) {
        command = 'npx';
        args = ['ts-node', tempFile];
      } else {
        return {
          success: false,
          message: 'ts-node is not installed. Please install TypeScript and ts-node to run TypeScript code.',
          output: '',
          error: 'ts-node not found'
        };
      }
      break;

    case 'cpp':
      tempFile = path.join(tempDir, 'temp.cpp');
      executableFile = path.join(tempDir, 'temp.exe');

      // Kiểm tra g++ có được cài đặt không
      const gppInstalled = isCommandInstalled('g++');
      console.log(`g++ installed: ${gppInstalled}`);

      if (gppInstalled) {
        needsCompilation = true;
        // Sử dụng trình biên dịch tích hợp nếu có
        if (compilerPaths['g++']) {
          compileCommand = compilerPaths['g++'];
          console.log(`Using integrated compiler: ${compileCommand}`);
        } else {
          compileCommand = 'g++';
          console.log(`Using system compiler: ${compileCommand}`);
        }
        compileArgs = [tempFile, '-o', executableFile];
        command = executableFile;
        args = [];
      } else {
        // Thử kiểm tra MinGW g++
        const mingwInstalled = isCommandInstalled('mingw32-g++');
        console.log(`MinGW g++ installed: ${mingwInstalled}`);

        if (mingwInstalled) {
          needsCompilation = true;
          compileCommand = 'mingw32-g++';
          compileArgs = [tempFile, '-o', executableFile];
          command = executableFile;
          args = [];
        } else {
          // Kiểm tra trực tiếp trong thư mục bin/win32/bin
          const directCompilerPath = path.join(pluginPath, 'bin', 'win32', 'bin', 'g++.exe');
          if (fs.existsSync(directCompilerPath)) {
            console.log(`Found direct compiler at: ${directCompilerPath}`);
            needsCompilation = true;
            compileCommand = directCompilerPath;
            compileArgs = [tempFile, '-o', executableFile];
            command = executableFile;
            args = [];
          } else {
            // Nếu không có trình biên dịch nào được cài đặt
            return {
              success: false,
              message: 'C++ compiler not found. The plugin will install a compiler in a future update.',
              output: '',
              error: 'C++ compiler not found. Please wait for the next plugin update which will include an integrated compiler.'
            };
          }
        }
      }
      break;

    case 'c':
      tempFile = path.join(tempDir, 'temp.c');
      executableFile = path.join(tempDir, 'temp.exe');

      const gccInstalled = isCommandInstalled('gcc');
      console.log(`gcc installed: ${gccInstalled}`);

      if (gccInstalled) {
        needsCompilation = true;
        // Sử dụng trình biên dịch tích hợp nếu có
        if (hasIntegratedCompiler && compilerPaths['gcc']) {
          compileCommand = compilerPaths['gcc'];
        } else {
          compileCommand = 'gcc';
        }
        compileArgs = [tempFile, '-o', executableFile];
        command = executableFile;
        args = [];
      } else {
        // Nếu không có trình biên dịch nào được cài đặt
        return {
          success: false,
          message: 'C compiler not found. The plugin will install a compiler in a future update.',
          output: '',
          error: 'C compiler not found. Please wait for the next plugin update which will include an integrated compiler.'
        };
      }
      break;

    case 'java':
      tempFile = path.join(tempDir, 'Main.java');

      if (isCommandInstalled('javac') && isCommandInstalled('java')) {
        needsCompilation = true;
        compileCommand = 'javac';
        compileArgs = [tempFile];
        command = 'java';
        args = ['-cp', tempDir, 'Main'];
      } else {
        return {
          success: false,
          message: 'Java is not installed. Please install Java to compile and run Java code.',
          output: '',
          error: 'Java not found'
        };
      }
      break;

    case 'html':
      tempFile = path.join(tempDir, 'temp.html');
      fs.writeFileSync(tempFile, content);

      // Mở file HTML trong trình duyệt mặc định
      const url = `file://${tempFile}`;

      if (shell) {
        shell.openExternal(url);
        return {
          success: true,
          message: `Opened HTML file in default browser: ${url}`,
          output: '',
          error: ''
        };
      } else {
        return {
          success: false,
          message: 'Cannot open HTML file: Electron shell not available',
          output: '',
          error: 'Electron shell not available'
        };
      }

    default:
      return {
        success: false,
        message: `Unsupported language: ${language}`,
        output: '',
        error: `Language ${language} is not supported by Code Runner plugin.`
      };
  }

  // Ghi code vào file tạm thời
  fs.writeFileSync(tempFile, content);

  // Nếu cần biên dịch trước
  if (needsCompilation) {
    try {
      console.log(`Compiling with command: ${compileCommand} ${compileArgs.join(' ')}`);

      // Biên dịch code
      const compileResult = await new Promise((resolve, reject) => {
        const compileProcess = spawn(compileCommand, compileArgs, {
          shell: true,
          windowsHide: true
        });
        let compileError = '';
        let compileOutput = '';

        compileProcess.stdout.on('data', (data) => {
          const text = data.toString();
          compileOutput += text;
          console.log(`Compiler stdout: ${text}`);
        });

        compileProcess.stderr.on('data', (data) => {
          const text = data.toString();
          compileError += text;
          console.log(`Compiler stderr: ${text}`);
        });

        compileProcess.on('error', (error) => {
          console.error(`Compiler process error: ${error.message}`);
          reject({
            success: false,
            message: `Compilation process error: ${error.message}`,
            output: compileOutput,
            error: error.message,
            exitCode: 1
          });
        });

        compileProcess.on('close', (code) => {
          console.log(`Compiler process exited with code ${code}`);
          if (code !== 0) {
            reject({
              success: false,
              message: `Compilation failed with exit code ${code}`,
              output: compileOutput,
              error: compileError,
              exitCode: code
            });
          } else {
            resolve({
              success: true,
              message: 'Compilation successful',
              output: compileOutput
            });
          }
        });
      });

      // Nếu biên dịch thất bại, trả về lỗi
      if (!compileResult.success) {
        return compileResult;
      }

      // Kiểm tra file thực thi có tồn tại không
      if (!fs.existsSync(executableFile)) {
        console.error(`Executable file not found: ${executableFile}`);
        return {
          success: false,
          message: 'Compilation completed but executable file not found',
          output: compileResult.output || '',
          error: 'Executable file not found',
          exitCode: 1
        };
      }
    } catch (error) {
      console.error('Compilation error:', error);
      return {
        success: false,
        message: `Compilation error: ${error.message || String(error)}`,
        output: '',
        error: error.message || String(error),
        exitCode: 1
      };
    }
  }

  // Chạy code
  return new Promise((resolve, reject) => {
    try {
      console.log(`Running command: ${command} ${args.join(' ')}`);

      // Sử dụng shell: true cho cả Windows và Unix
      const runOptions = {
        shell: true,
        windowsHide: true
      };

      // Đặc biệt xử lý cho file thực thi trên Windows
      if (process.platform === 'win32' && command.endsWith('.exe') && args.length === 0) {
        // Trên Windows, chạy file .exe trực tiếp
        console.log(`Running Windows executable: ${command}`);
      }

      const runProcess = spawn(command, args, runOptions);
      let output = '';
      let errorOutput = '';

      // Lưu trữ process để có thể dừng nó sau này
      runningProcesses.set(fileName, runProcess);

      // Gửi thông báo đang chạy code
      client.write(JSON.stringify({
        type: 'CODE_RUNNING',
        payload: {
          fileName,
          message: `Running ${language} code...`
        }
      }));

      runProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;

        // Gửi kết quả trực tiếp
        client.write(JSON.stringify({
          type: 'CODE_OUTPUT',
          payload: {
            type: 'stdout',
            text: text
          }
        }));
      });

      runProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;

        // Gửi lỗi trực tiếp
        client.write(JSON.stringify({
          type: 'CODE_OUTPUT',
          payload: {
            type: 'stderr',
            text: text
          }
        }));
      });

      runProcess.on('close', (code) => {
        console.log(`Process exited with code ${code}`);
        runningProcesses.delete(fileName);

        resolve({
          success: code === 0,
          message: code === 0 ? 'Code executed successfully' : `Code execution failed with exit code ${code}`,
          output: output,
          error: errorOutput,
          exitCode: code
        });
      });

      runProcess.on('error', (error) => {
        console.error(`Error running process: ${error.message}`);
        console.error(`Command: ${command}, Args: ${JSON.stringify(args)}`);
        console.error(`Platform: ${process.platform}, Node version: ${process.version}`);
        runningProcesses.delete(fileName);

        // Gửi thông báo lỗi trực tiếp
        client.write(JSON.stringify({
          type: 'CODE_OUTPUT',
          payload: {
            type: 'stderr',
            text: `Error running process: ${error.message}\nMake sure you have a C++ compiler installed (g++ or MinGW).`
          }
        }));

        reject({
          success: false,
          message: `Error running process: ${error.message}`,
          output: output,
          error: errorOutput + '\n' + error.message + '\nMake sure you have a C++ compiler installed (g++ or MinGW).',
          exitCode: 1
        });
      });
    } catch (error) {
      console.error(`Exception running process: ${error.message}`);
      reject({
        success: false,
        message: `Exception running process: ${error.message}`,
        output: '',
        error: error.message,
        exitCode: 1
      });
    }
  });
}

// Hàm dừng chạy code
function stopExecution(fileName) {
  if (fileName && runningProcesses.has(fileName)) {
    // Dừng process cụ thể
    const process = runningProcesses.get(fileName);
    if (process) {
      process.kill();
      runningProcesses.delete(fileName);
      return {
        success: true,
        message: `Execution of ${fileName} stopped by user`
      };
    }
  } else {
    // Dừng tất cả các process đang chạy
    for (const [file, process] of runningProcesses.entries()) {
      process.kill();
    }
    runningProcesses.clear();
    return {
      success: true,
      message: 'All executions stopped'
    };
  }

  return {
    success: false,
    message: 'No running processes found'
  };
}

client.connect(PORT, 'localhost', () => {
  console.log('Connected to plugin server');

  // Register the plugin
  client.write(JSON.stringify({
    type: 'REGISTER',
    payload: {
      name: 'code-runner',
      version: '1.0.0',
      description: 'Run code in various programming languages',
      author: 'nhtam'
    }
  }));

  // Register menu items
  client.write(JSON.stringify({
    type: 'REGISTER_MENU',
    payload: {
      pluginName: 'code-runner',
      menuItems: [
        {
          id: 'code-runner.runCode',
          label: 'Run Code',
          parentMenu: 'run',
          accelerator: 'F5'
        },
        {
          id: 'code-runner.stopExecution',
          label: 'Stop Execution',
          parentMenu: 'run',
          accelerator: 'Shift+F5'
        }
      ]
    }
  }));
});

// Handle data from the server
client.on('data', async (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('Received message:', message);

    if (message.type === 'EXECUTE') {
      const { id, action, content, fileName } = message.payload;

      // Xử lý các hành động khác nhau
      if (action === 'code-runner.runCode') {
        if (!content) {
          sendResponse(id, false, 'No content provided');
          return;
        }

        // Xác định ngôn ngữ từ phần mở rộng của file
        const extension = fileName.split('.').pop()?.toLowerCase();
        let language = extension;

        // Xử lý đặc biệt cho các phần mở rộng C++
        if (['cpp', 'cc', 'cxx', 'c++', 'hpp', 'hxx', 'h++'].includes(extension)) {
          language = 'cpp';
        }

        try {
          const result = await runCode(content, fileName, language);
          sendResponse(id, result.success, result.message, result);
        } catch (error) {
          console.error('Error running code:', error);
          sendResponse(id, false, error.message || 'Error running code', error);
        }
      }
      else if (action === 'code-runner.stopExecution') {
        const result = stopExecution(fileName);
        sendResponse(id, result.success, result.message, result);
      }
      else {
        sendResponse(id, false, `Unknown action: ${action}`);
      }
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

// Helper function to send response back to the server
function sendResponse(id, success, message, data = {}) {
  client.write(JSON.stringify({
    type: 'EXECUTE_RESULT',
    payload: {
      id,
      success,
      message,
      data
    }
  }));
}

// Handle errors
client.on('error', (error) => {
  console.error('Socket error:', error);
});

// Handle connection close
client.on('close', () => {
  console.log('Connection closed');
  // Dừng tất cả các process đang chạy khi kết nối đóng
  for (const [file, process] of runningProcesses.entries()) {
    process.kill();
  }
  runningProcesses.clear();
});

// Xử lý khi process kết thúc
process.on('exit', () => {
  // Dừng tất cả các process đang chạy khi plugin kết thúc
  for (const [file, process] of runningProcesses.entries()) {
    process.kill();
  }
  runningProcesses.clear();
});
