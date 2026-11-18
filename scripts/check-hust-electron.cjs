/* Exercise the real connector/IPC with an intercepted HTTPS fixture and a
   disposable profile. Never connects to HUST or opens the personal profile. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
if (!process.versions.electron) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const run = require('node:child_process').spawnSync(require('electron'), [__filename], { env, encoding: 'utf8', timeout: 45000, windowsHide: true });
  process.stdout.write(run.stdout || '');
  if (run.status !== 0) { process.stderr.write(run.error?.message || run.stderr || 'HUST connector check failed.'); process.exitCode = 1; }
} else {
  const { app, BrowserWindow, ipcMain, session } = require('electron');
  const { createHustConnector, allowedNavigation, PARTITION } = require('../hust-connector');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-hust-'));
  app.setPath('userData', profile); app.setPath('sessionData', profile);
  app.whenReady().then(async () => {
    assert(allowedNavigation('https://sso.hust.edu.vn/login'));
    assert(allowedNavigation('https://login.microsoftonline.com/common/oauth2/authorize'));
    for (const url of ['file:///C:/Windows', 'http://qldt.hust.edu.vn', 'https://hust.edu.vn.evil.invalid', 'https://evil.invalid']) assert(!allowedNavigation(url));
    const fixture = `<!doctype html><div id="__next"></div><script>
      const klass={id:99,classId:'123456',courseName:'Môn kiểm thử',courseId:'IT0000',semester:'20261',_calendars:[]};
      const state={authState:{isLoggedIn:true,user:{id:'fixture-account',token:'NEVER EXPORT'}},semesterState:{semesters:[{semester:'20261',startDate:1788109200000,startWeek:1}]},timetableState:{items:[klass],mapSemesterLoaded:{20261:true}}};
      document.getElementById('__next')['__reactContainer$fixture']={memoizedProps:{store:{getState:()=>state}}};
      window.webpackChunk_N_E=[];window.webpackChunk_N_E.push=args=>args[2](id=>id===35870?{mI:()=>[{id:777,date:Date.parse('2026-11-18T00:00:00+07:00'),dayTime:1,from:1,to:4,place:'D9-101',_class:klass}],zV:()=>true}:{Jq:(_c,side)=>side==='from'?'06:45':'10:05'});
    </script>`;
    const portalSession = session.fromPartition(PARTITION);
    await portalSession.protocol.handle('https', () => new Response(fixture, { headers: { 'content-type': 'text/html; charset=utf-8' } }));
    const main = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
    const connector = createHustConnector(app, () => main); connector.register(ipcMain);
    await main.loadFile(path.join(__dirname, '..', 'index.html'));
    const result = await main.webContents.executeJavaScript(`window.plannerDesktop.hust.read()`);
    assert.equal(result.events.length, 1); assert.equal(result.events[0].date, '2026-11-18');
    assert.match(result.account, /^[a-f0-9]{24}$/); assert.equal(result.identity, undefined);
    assert(!JSON.stringify(result).includes('NEVER EXPORT'));
    const portal = BrowserWindow.getAllWindows().find(window => window !== main);
    const preferences = portal.webContents.getLastWebPreferences();
    assert.equal(preferences.nodeIntegration, false); assert.equal(preferences.contextIsolation, true); assert.equal(preferences.sandbox, true);
    assert.equal(await portal.webContents.executeJavaScript(`typeof require`), 'undefined');
    const raw = await main.webContents.executeJavaScript(`localStorage.getItem(PlannerStore.DATA_KEY)`);
    const backup = await main.webContents.executeJavaScript(`window.plannerDesktop.hust.backup(${JSON.stringify(raw)})`);
    assert.equal(fs.readFileSync(path.join(profile, 'backups', backup), 'utf8'), raw);
    const rogue = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } });
    await rogue.loadFile(path.join(__dirname, '..', 'index.html'));
    const denied = await rogue.webContents.executeJavaScript(`require('electron').ipcRenderer.invoke('hust:backup', ${JSON.stringify(raw)}).then(()=>false,()=>true)`);
    assert(denied, 'A different window must not be able to call the connector.');
    // Blank popup is needed by OAuth. Its final navigation remains restricted.
    const popupCreated = new Promise(resolve => portal.webContents.once('did-create-window', resolve));
    await portal.webContents.executeJavaScript(`void window.open('about:blank','fixture-oauth')`);
    const popup = await popupCreated;
    assert.equal(popup.webContents.getLastWebPreferences().nodeIntegration, false);
    const navigated = new Promise(resolve => popup.webContents.once('did-finish-load', resolve));
    await portal.webContents.executeJavaScript(`void window.open('https://sso.hust.edu.vn/fixture','fixture-oauth')`);
    await navigated;
    assert.equal(popup.webContents.getURL(), 'https://sso.hust.edu.vn/fixture');
    const blocked = new Promise(resolve => popup.webContents.once('will-navigate', event => resolve(event.defaultPrevented)));
    await popup.webContents.executeJavaScript(`location.href='https://evil.invalid/fixture'`);
    assert(await blocked); assert.equal(popup.webContents.getURL(), 'https://sso.hust.edu.vn/fixture');
    await main.webContents.executeJavaScript(`window.plannerDesktop.hust.disconnect()`);
    assert(popup.isDestroyed()); assert(portal.isDestroyed());
    console.log('PASS: actual HUST connector, sandboxed portal, blank SSO popup, blocked external navigation, account hashing, IPC sender checks and disk backup.');
    console.log('Isolated profile: ' + profile); app.quit();
  }).catch(error => { console.error(error.stack || error); app.exit(1); });
}
