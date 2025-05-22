# Cosmic Text Editor

A modern, feature-rich text editor built with Electron, React, and TypeScript.

## 🚀 Features

- ✅ **Advanced Text Editing** with Monaco Editor
- ✅ **Plugin System** with Firebase Storage integration
- ✅ **AI Assistant** for coding help
- ✅ **File Management** with explorer
- ✅ **Code Execution** (JavaScript, Python, TypeScript, C++)
- ✅ **Export to PDF** functionality
- ✅ **Spell Checking** with dictionary support
- ✅ **Syntax Highlighting** for multiple languages
- ✅ **Dark/Light Theme** support
- ✅ **Terminal Integration**

## 📦 Download & Installation

### For End Users

1. **Download the installer**: `Cosmic Text Editor Setup 0.0.0.exe` (~147MB)
2. **Run as administrator** and follow the installation wizard
3. **Launch** from Desktop shortcut or Start Menu

### Portable Version

1. **Extract** the `win-unpacked` folder
2. **Run** `Cosmic Text Editor.exe` directly
3. **No installation required**

## 🛠️ For Developers

### Quick Start
```bash
# Clone the repository
git clone <repository-url>
cd text-editor-app

# Install dependencies
npm install

# Run in development mode
npm run electron-dev
```

### Build for Distribution
```bash
# Full build with testing
.\build-release.ps1

# Quick build
.\quick-build.ps1

# Test existing build
.\simple-test.ps1
```

### Development Scripts
```bash
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run build-electron # Build Electron main process
npm run electron     # Run Electron app
npm run dist         # Create installer
npm run clean        # Clean build files
```

## 💻 System Requirements

### For End Users
- **OS**: Windows 10/11 (64-bit)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB free space
- **Internet**: Required for plugin downloads and AI features

### For Developers
- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **OS**: Windows 10/11 (for building Windows installer)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 2GB free space (including node_modules)

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket

# Plugin Configuration
VITE_PLUGIN_PORT=5001

# Application Settings
VITE_APP_NAME=Cosmic
VITE_APP_VERSION=1.0.0
```

## 🐛 Troubleshooting

### Common Issues

1. **Application won't start**
   - Check if all dependencies are installed: `npm install`
   - Verify Node.js version: `node --version`
   - Try rebuilding: `npm run clean && npm run build`

2. **Build fails**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check disk space (need ~2GB free)
   - Run as administrator if permission errors

3. **Plugins not working**
   - Check internet connection
   - Verify Firebase configuration in `.env`
   - Check browser console for errors

4. **AI Assistant not responding**
   - Verify API keys in `.env`
   - Check network connectivity
   - Restart the application

### Getting Help

- 📖 Check [BUILD_DISTRIBUTION.md](BUILD_DISTRIBUTION.md) for detailed build instructions
- 🔍 Search existing issues on GitHub
- 💬 Create a new issue with detailed error information

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📞 Support

For support and questions:
- 📧 Email: nhutam050@gmail.com
- 🐛 Issues: GitHub Issues
- 📖 Documentation: Check the docs folder
