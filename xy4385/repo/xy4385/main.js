const { app, BrowserWindow } = require('electron');
const path = require('path');

// 启动后端服务器
require('./server');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: '印染打样室复盘工具',
  });

  // 开发环境使用 React 开发服务器
  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
  mainWindow.loadURL(startUrl);

  // 生产环境使用构建后的文件
  // mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));

  // 打开开发者工具（开发环境）
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
