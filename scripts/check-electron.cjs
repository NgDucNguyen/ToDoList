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
    const window = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
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
    await window.webContents.executeJavaScript(`(() => {
      document.getElementById('notes-nav-link').click();document.getElementById('new-note-btn').click();
      document.getElementById('note-title-input').value='Ghi chú Electron';
      const input=document.getElementById('note-body-input');input.value='Tiếng Việt\\n\\tGiữ khoảng trắng  ';input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    // Reload immediately while the debounce is pending: beforeunload must save.
    const notesReload = new Promise(resolve => window.webContents.once('did-finish-load', resolve));
    window.webContents.reload(); await notesReload;
    const notesSaved = await window.webContents.executeJavaScript(`(() => {document.getElementById('notes-nav-link').click();return document.getElementById('note-body-input').value==='Tiếng Việt\\n\\tGiữ khoảng trắng  ';})()`);
    if (!notesSaved) throw new Error('Pending notes did not persist through Electron reload.');
    const bridge = await window.webContents.executeJavaScript(`({node:typeof require,process:typeof process,chat:typeof window.plannerDesktop.chat,hust:typeof window.plannerDesktop.hust.connect})`);
    if(bridge.node!=='undefined'||bridge.process!=='undefined'||bridge.chat!=='undefined'||bridge.hust!=='function')throw new Error('Secure desktop bridge failed: '+JSON.stringify(bridge));
    let networkRequests=0;
    window.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,callback)=>{networkRequests++;callback({cancel:true});});
    await window.webContents.executeJavaScript(`(async () => {
      document.getElementById('cb-launcher').click();
      const send=async text=>{document.getElementById('cb-input').value=text;document.getElementById('cb-form').requestSubmit();for(let i=0;i<100&&document.getElementById('cb-send').disabled;i++)await new Promise(r=>setTimeout(r,20));};
      await send('Thêm lịch thử offline ngày mai 19h');
      const accept=document.querySelector('.cb-accept');if(!accept)throw new Error('Offline chat did not propose task');accept.click();
      if(!JSON.parse(localStorage.getItem(PlannerStore.DATA_KEY)).tasks.some(t=>t.title==='thử offline'))throw new Error('Offline task not saved');
      await send('Ghi chú: Không cần mạng');
      const buttons=document.querySelectorAll('.cb-accept');buttons[buttons.length-1].click();
      if(!JSON.parse(localStorage.getItem(PlannerNotesStore.KEY)).notes.some(n=>n.body==='Không cần mạng'))throw new Error('Offline note not saved');
      await send('Tóm tắt tuần này');
      if(document.getElementById('cb-status').classList.contains('error'))throw new Error('Offline summary failed');
    })()`);
    if(networkRequests)throw new Error('Local chatbot attempted '+networkRequests+' network requests');
    console.log('PASS: Electron isolation/preload, migration, photo, notes, actual offline chatbot tasks/notes/summary and zero network requests.');
    console.log('Isolated profile: ' + profile);
    app.quit();
  }).catch(error => { console.error(error.stack || error); app.exit(1); });
}
