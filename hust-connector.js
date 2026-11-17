const { BrowserWindow, session } = require('electron');
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { readHustTimetable } = require('./hust-extractor');

const TIMETABLE_URL = 'https://qldt.hust.edu.vn/students/learn/timetable';
const PARTITION = 'persist:planner-hust-qldt';
function allowedNavigation(value) {
  try {
    const url = new URL(value), host = url.hostname;
    return url.protocol === 'https:' && (host === 'hust.edu.vn' || host.endsWith('.hust.edu.vn') || ['login.microsoftonline.com', 'login.microsoft.com', 'login.live.com', 'account.live.com'].includes(host));
  } catch { return false; }
}

function createHustConnector(app, getMainWindow) {
  let window = null, reading = false, configured = false;
  const popups = new Set();
  function secureContents(contents) {
    const guard = (event, url) => {
      if (allowedNavigation(url)) return;
      event.preventDefault();
      let host = ''; try { host = new URL(url).hostname; } catch { /* No URL details leave the login window. */ }
      const main = getMainWindow();
      if (main && !main.isDestroyed()) main.webContents.send('hust:connection-status', `Chưa cho phép địa chỉ đăng nhập ${host || 'này'}. Vui lòng báo lại để cập nhật kết nối.`);
    };
    contents.on('will-navigate', guard);
    contents.on('will-redirect', guard);
    // OAuth libraries first create an empty window, then navigate it to SSO.
    // Allow that initial blank page while guarding every subsequent navigation.
    contents.setWindowOpenHandler(({ url }) => (url === '' || url === 'about:blank' || allowedNavigation(url)) ? { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: { partition: PARTITION, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } } } : { action: 'deny' });
    contents.on('did-create-window', popup => {
      popups.add(popup);
      secureContents(popup.webContents);
      popup.on('closed', () => popups.delete(popup));
    });
  }
  function ensureWindow(show) {
    if (window && !window.isDestroyed()) {
      if (show) { window.show(); window.focus(); }
      return window;
    }
    const portalSession = session.fromPartition(PARTITION);
    if (!configured) {
      portalSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      portalSession.setPermissionCheckHandler(() => false);
      configured = true;
    }
    window = new BrowserWindow({
      width: 1120, height: 800, minWidth: 700, minHeight: 500,
      show, title: 'Kết nối HUST · Đăng nhập và chọn học kỳ', autoHideMenuBar: true,
      webPreferences: { partition: PARTITION, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: false },
    });
    secureContents(window.webContents);
    window.on('closed', () => { window = null; });
    return window;
  }
  async function connect() {
    const target = ensureWindow(true);
    if (!target.webContents.getURL().startsWith(TIMETABLE_URL)) await target.loadURL(TIMETABLE_URL);
    return { status: 'opened' };
  }
  async function read({ refresh = false } = {}) {
    if (reading) throw new Error('Đang đọc lịch HUST. Vui lòng đợi.');
    reading = true;
    try {
      const target = ensureWindow(false);
      if (refresh || !target.webContents.getURL().startsWith(TIMETABLE_URL)) await target.loadURL(TIMETABLE_URL);
      const deadline = Date.now() + 25000;
      let result;
      do {
        if (target.isDestroyed()) throw new Error('Cửa sổ HUST đã đóng. Bấm Kết nối HUST để mở lại.');
        // Source runs pick up adapter fixes without closing a signed-in portal.
        let reader = readHustTimetable;
        if (!app.isPackaged) {
          delete require.cache[require.resolve('./hust-extractor')];
          reader = require('./hust-extractor').readHustTimetable;
        }
        result = await target.webContents.executeJavaScript(`(() => { try { return (${reader.toString()})(); } catch (error) { return { status: 'unsupported', message: 'Không đọc được lịch HUST: ' + String(error.message || error).slice(0, 250) }; } })()`);
        if (result.status !== 'loading') break;
        await new Promise(resolve => setTimeout(resolve, 600));
      } while (Date.now() < deadline);
      if (result?.status === 'loading') throw new Error('HUST tải lịch quá lâu hoặc cấu trúc trang đã thay đổi. Mở Kết nối HUST để kiểm tra.');
      if (result?.status !== 'ready') throw new Error(result?.message || 'Chưa đọc được lịch HUST.');
      if (!Array.isArray(result.events) || !result.events.length) throw new Error('Không có buổi học để đồng bộ. Lịch trong app được giữ nguyên.');
      if (result.events.length > 3000) throw new Error('Lịch HUST vượt giới hạn xử lý. Chưa đồng bộ.');
      result.account = createHash('sha256').update(result.identity).digest('hex').slice(0, 24);
      delete result.identity;
      return result;
    } finally { reading = false; }
  }
  async function backup(raw) {
    if (typeof raw !== 'string' || raw.length > 15 * 1024 * 1024) throw new Error('Bản sao dữ liệu không hợp lệ.');
    const parsed = JSON.parse(raw);
    if (parsed.version !== 2 || !Array.isArray(parsed.tasks)) throw new Error('Không thể sao lưu định dạng dữ liệu này.');
    const folder = path.join(app.getPath('userData'), 'backups');
    await fs.mkdir(folder, { recursive: true });
    const filename = `before-hust-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.json`;
    await fs.writeFile(path.join(folder, filename), raw, { encoding: 'utf8', flag: 'wx' });
    return filename;
  }
  async function disconnect() {
    if (reading) throw new Error('Đợi đọc lịch xong trước khi ngắt kết nối.');
    if (window && !window.isDestroyed()) window.close();
    for (const popup of popups) if (!popup.isDestroyed()) popup.destroy();
    const portalSession = session.fromPartition(PARTITION);
    await portalSession.clearStorageData();
    await portalSession.clearAuthCache();
    return true;
  }
  function register(ipcMain) {
    const handlers = { 'hust:connect': connect, 'hust:read': read, 'hust:backup': backup, 'hust:disconnect': disconnect };
    for (const [channel, handler] of Object.entries(handlers)) ipcMain.handle(channel, (event, argument) => {
      const main = getMainWindow();
      if (!main || event.sender !== main.webContents || event.senderFrame !== main.webContents.mainFrame || !event.senderFrame.url.startsWith('file:')) throw new Error('Nguồn yêu cầu không hợp lệ.');
      return handler(argument);
    });
  }
  function close() {
    for (const popup of popups) if (!popup.isDestroyed()) popup.destroy();
    if (window && !window.isDestroyed()) window.destroy();
  }
  return { register, close, connect, read, backup, disconnect };
}
module.exports = { createHustConnector, allowedNavigation, TIMETABLE_URL, PARTITION };
