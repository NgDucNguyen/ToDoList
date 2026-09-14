const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
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
