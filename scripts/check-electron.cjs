/* Launch an invisible Electron window with a disposable profile, never the personal profile. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process');
  const runtimeEnv = { ...process.env };
  delete runtimeEnv.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require('electron'), [__filename], { encoding: 'utf8', timeout: 45000, windowsHide: true, env: runtimeEnv });
  process.stdout.write(result.stdout || '');
  if (result.status !== 0) process.stderr.write(result.error?.message || result.stderr || 'Electron smoke check failed.');
  process.exitCode = result.status === 0 ? 0 : 1;
} else {
  const { app, BrowserWindow } = require('electron');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-electron-'));
  app.setPath('userData', profile);
  app.setPath('sessionData', profile);
  app.whenReady().then(async () => {
    const window = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false } });
    await window.loadFile(path.join(__dirname, '..', 'index.html'));
    let result = await window.webContents.executeJavaScript(`({ api: typeof PlannerStore.createStore === 'function', days: document.querySelectorAll('.day-cell').length, error: document.getElementById('app-notice').classList.contains('error') })`);
    if (!result.api || result.days < 28 || result.error) throw new Error('Electron renderer did not initialize: ' + JSON.stringify(result));
    await window.webContents.executeJavaScript(`(() => { const data = PlannerStore.createStore(localStorage); const project = data.saveProject('Kiểm thử Electron'); data.addTask({title:'Công việc lặp thử nghiệm',task_date:PlannerStore.dateString(new Date()),project_id:project,priority:'high',is_important:true,recurrence:{frequency:'daily'},checklist:[{text:'Kiểm tra hiển thị'}]}); })()`);
    const loaded = new Promise(resolve => window.webContents.once('did-finish-load', resolve));
    window.webContents.reload(); await loaded;
    result = await window.webContents.executeJavaScript(`({days:document.querySelectorAll('.day-cell').length,tasks:document.querySelectorAll('#calendar-grid .task-item').length,projects:document.querySelectorAll('.project-item').length,error:document.getElementById('app-notice').classList.contains('error')})`);
    if (!result.tasks || result.projects !== 1 || result.error) throw new Error('Electron reload failed: ' + JSON.stringify(result));
    await window.webContents.executeJavaScript(`(async () => {
      const wait = async (condition) => { for (let i=0;i<200;i++) { if(condition())return; await new Promise(resolve=>setTimeout(resolve,20)); } throw new Error('Background operation timed out'); };
      await wait(()=>document.body.dataset.appearanceReady==='true');
      document.getElementById('open-appearance-btn').click();await wait(()=>document.getElementById('appearance-dialog').open);
      const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;canvas.getContext('2d').fillRect(0,0,64,64);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      const transfer=new DataTransfer();transfer.items.add(new File([blob],'Electron test.png',{type:'image/png'}));
      document.getElementById('background-file-input').files=transfer.files;document.getElementById('background-file-input').dispatchEvent(new Event('change'));
      await wait(()=>!document.getElementById('choose-background-btn').disabled&&document.body.classList.contains('has-background'));
      document.getElementById('save-background-btn').click();await wait(()=>!document.getElementById('appearance-dialog').open);
    })()`);
    const backgroundReload = new Promise(resolve => window.webContents.once('did-finish-load', resolve));
    window.webContents.reload(); await backgroundReload;
    const backgroundSaved = await window.webContents.executeJavaScript(`new Promise(resolve=>{ const check=()=>{if(document.body.dataset.appearanceReady==='true')resolve(document.body.classList.contains('has-background'));else setTimeout(check,20);};check();})`);
    if (!backgroundSaved) throw new Error('Background photo did not persist in Electron.');
    console.log('PASS: actual Electron renderer, migration, persistent reload, recurring tasks and saved photo background.');
    console.log('Isolated profile: ' + profile);
    app.quit();
  }).catch(error => { console.error(error.stack || error); app.exit(1); });
}
