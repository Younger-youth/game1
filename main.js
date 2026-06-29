const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // 创建一个 1280x790 的固定尺寸窗口，使用内容真实尺寸，保证 Canvas 显示完整且不产生拉伸
  const win = new BrowserWindow({
    width: 1280,
    height: 790,
    resizable: false, // 锁定大小，保证最佳 UI 排版与比例体验
    useContentSize: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    title: "赛博格点防线 (Cyber Grid Defense)"
  });

  // 隐藏顶部默认的 Chromium 菜单栏
  win.setMenuBarVisibility(false);

  // 载入游戏入口 HTML
  win.loadFile('index.html');

  win.on('closed', () => {
    app.quit();
  });
}

// 初始化完成，启动窗口
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
