const { app, BrowserWindow, ipcMain, Notification } = require("electron");
const path = require("path");

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

  // Tải trực tiếp giao diện ứng dụng
  win.loadFile("index.html");
}

// Khởi chạy khi Electron sẵn sàng
app.whenReady().then(createWindow);

// Tắt hoàn toàn app khi đóng tất cả cửa sổ
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
