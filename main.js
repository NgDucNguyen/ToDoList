const { app, BrowserWindow, ipcMain, Notification } = require("electron");
const path = require("path");
const { createHustConnector } = require("./hust-connector");
let mainWindow = null;
const hustConnector = createHustConnector(app, () => mainWindow);
hustConnector.register(ipcMain);

ipcMain.on("planner:reminder", (event, message) => {
  if (!BrowserWindow.fromWebContents(event.sender) || !Notification.isSupported()) return;
  const body = typeof message === "string" ? message.slice(0, 200) : "";
  if (body) new Notification({ title: "Nhắc việc · Daily Planner", body }).show();
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    title: "My Daily Planner",
    icon: path.join(__dirname, "Calendar.ico"),
    autoHideMenuBar: true, // Ẩn thanh menu File/Edit mặc định cho giao diện sạch sẽ
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow = win;
  win.on("closed", () => { mainWindow = null; hustConnector.close(); });

  // Tải trực tiếp giao diện ứng dụng
  win.loadFile("index.html");
}

// Reopening the desktop shortcut focuses the existing app instead of creating
// a second renderer whose stale task store would block subsequent saves.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = mainWindow;
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    } else if (app.isReady()) createWindow();
  });
  app.whenReady().then(createWindow);
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
