# Resources Directory

This directory contains resources used by the application during the build process.

## Contents

- `icon.ico`: Main application icon
- `installer.ico`: Icon used for the installer
- `uninstaller.ico`: Icon used for the uninstaller
- `splash.png`: Splash screen image

## Usage

These resources are referenced in the `electron-builder` configuration in `package.json`.

```json
"build": {
  "win": {
    "icon": "resources/icon.ico"
  },
  "nsis": {
    "installerIcon": "resources/installer.ico",
    "uninstallerIcon": "resources/uninstaller.ico"
  }
}
```

## Notes

- Icons should be in `.ico` format for Windows
- For macOS, icons should be in `.icns` format
- For Linux, icons should be in `.png` format
