/* Chromium checks use an in-memory task store and a disposable Electron profile. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-features-'));
const chromium = require('electron');
const renderer = path.join(__dirname, 'render-checks.cjs');
const runtimeEnv = { ...process.env };
delete runtimeEnv.ELECTRON_RUN_AS_NODE;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace('<link rel="stylesheet" href="style.css" />', () => '<style>' + fs.readFileSync(path.join(root, 'style.css'), 'utf8') + '</style>');
for (const name of ['planner-store.js', 'lunar.js', 'app.js', 'appearance.js']) html = html.replace(`<script src="${name}"></script>`, () => '<script>' + fs.readFileSync(path.join(root,name),'utf8') + '</script>');
const initialize = `
window.addEventListener('error',event=>parent.__errors.push(event.message));
const RealDate=Date; window.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[RealDate.UTC(2026,10,11,5)]));}static now(){return RealDate.UTC(2026,10,11,5);}};
Object.defineProperty(window,'localStorage',{value:{getItem:key=>parent.__storage[key]??null,setItem:(key,value)=>{parent.__storage[key]=String(value);}}});
// Synthetic reminders must never reach Windows from the test fixture.
Object.defineProperty(window,'Notification',{configurable:true,value:class {static permission='denied';}});
// Electron exposes CommonJS globals in a renderer with nodeIntegration enabled.
if(parent.__electronMode) window.module={exports:{}};
`;
html = html.replace('<head>', () => '<head><script>' + initialize + '</script>');
const old = {
  planner_tasks: JSON.stringify([{id:'legacy-calendar',title:'Việc cũ trên lịch',task_date:'2026-11-11',tag:'Work',is_completed:false}]),
  planner_projects: JSON.stringify([{id:'legacy-project',name:'Dự án cũ'}]),
  planner_kanban_tasks: JSON.stringify([{id:'legacy-board',title:'Việc cũ chưa có ngày',project_id:'legacy-project',status:'doing'}]),
};

async function browserChecks(source, legacy) {
  const results = [], failures = [];
  window.__storage = {...legacy}; window.__errors=[]; window.__electronMode=false;
  const frame=document.createElement('iframe'); frame.style.border='0'; document.body.append(frame);
  const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
  const assert=(condition,message)=>{if(!condition) throw new Error(message);};
  const waitFor=async(condition,message)=>{for(let count=0;count<200;count++){if(condition())return;await tick();}throw new Error(message);};
  const load=async(width=1280,height=800)=>{
    frame.style.width=width+'px';frame.style.height=height+'px';
    await new Promise(resolve=>{frame.onload=resolve;frame.srcdoc=source;});await tick();
    assert(!window.__errors.length,'Browser error: '+window.__errors.join('; '));
    return frame.contentDocument;
  };
  const data=()=>JSON.parse(window.__storage.planner_data_v2);
  let doc;
  const click=selector=>{const el=doc.querySelector(selector);assert(el,'Missing '+selector);el.click();};
  const value=(selector,text)=>{const el=doc.querySelector(selector);assert(el,'Missing '+selector);el.value=text;el.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));el.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));};
  const checked=(selector,bool)=>{const el=doc.querySelector(selector);el.checked=bool;el.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));};
  const submit=()=>{doc.querySelector('#task-form').requestSubmit();assert(doc.querySelector('#task-modal').classList.contains('hidden'),'Save failed: '+doc.querySelector('#task-form-error').textContent);};
  const taskSelector=(taskId,container='')=>`${container} [data-task-id="${taskId}"]`;
  const calendar=()=>click('.nav-link:not(#todolist-nav-link)');
  const todo=mode=>{click('#todolist-nav-link');click(`.todo-tab[data-view="${mode}"]`);};
  const add=(title,date)=>{calendar();click('#quick-add-btn');value('#task-text-input',title);value('#task-date-picker',date);submit();return data().tasks.find(t=>t.title===title);};
  let photoFixture='';
  try {
    doc=await load();
    assert(frame.contentWindow.Notification.permission==='denied','Test notifications were not disabled');
    assert(data().tasks.length===2,'Migration lost legacy tasks');
    assert(data().tasks.find(t=>t.id==='legacy-board').status==='doing','Legacy status lost');
    assert(window.__storage.planner_backup_before_v2,'Missing migration backup');
    for(const key of Object.keys(legacy)) assert(window.__storage[key]===legacy[key],'Legacy data overwritten');
    results.push('Legacy migration and backup');

    click('#add-project-btn');value('#project-name-input','Dự án mới <an toàn>');doc.querySelector('#project-form').requestSubmit();
    const project=data().projects.find(p=>p.name==='Dự án mới <an toàn>');assert(project,'Create project failed');
    click('#add-kanban-task-btn');assert(doc.querySelector('#task-project-input').value===project.id,'Project not selected');
    value('#task-text-input','Báo cáo liên kết');value('#task-date-picker','2026-11-11');value('#task-status-input','doing');value('#task-priority-input','urgent');checked('#task-important-input',true);
    value('#task-description-input','Ghi chú <img src=x onerror=alert(1)> và https://example.com');
    click('#add-checklist-btn');value('.checklist-editor-row input[type="text"]','Thu thập số liệu');
    click('#add-checklist-btn');value('.checklist-editor-row:last-child input[type="text"]','Viết báo cáo');checked('.checklist-editor-row input[type="checkbox"]',true);submit();
    const linked=data().tasks.find(t=>t.title==='Báo cáo liên kết');
    assert(linked.project_id===project.id&&linked.priority==='urgent'&&linked.is_important,'Details not saved');
    assert(doc.querySelector(taskSelector(linked.id,'#cards-doing')),'Not in project board');
    calendar();assert(doc.querySelector(taskSelector(linked.id,'#calendar-grid')),'Project task not on calendar');
    click(taskSelector(linked.id,'#calendar-grid')+' .task-complete-checkbox');
    click(`[data-project-id="${project.id}"]`);assert(doc.querySelector(taskSelector(linked.id,'#cards-done')),'Completion did not sync to project');
    todo('today');assert(doc.querySelector(taskSelector(linked.id,'#myday-task-list')+' .task-complete-checkbox').checked,'Completion did not sync to To-Do');
    assert(doc.querySelector('#todo-progress-count').textContent.includes('hoàn thành')&&Number(doc.querySelector('#todo-progress-bar').getAttribute('aria-valuenow'))>0,'Task progress did not update');
    assert(!doc.querySelector('#myday-task-list img, #calendar-grid img, #kanban-view img'),'Task content interpreted as HTML');
    click(taskSelector(linked.id,'#myday-task-list')+' .task-star-btn');assert(!data().tasks.find(t=>t.id===linked.id).is_important,'Star toggle failed');
    click(taskSelector(linked.id,'#myday-task-list')+' .task-star-btn');
    doc=await load();todo('important');assert(doc.querySelector(taskSelector(linked.id,'#myday-task-list')),'Star did not persist');
    click(taskSelector(linked.id,'#myday-task-list')+' .task-open-btn');assert(doc.querySelector('.checklist-editor-row input[type="checkbox"]').checked,'Checklist did not persist');click('#cancel-task-btn');
    results.push('Linked calendar / project / To-Do, priority, persistent star, notes and checklist');

    const future=add('Việc sắp tới','2026-11-13'),overdue=add('Việc quá hạn','2026-11-10'),unscheduled=add('Việc chưa lên lịch','');
    todo('upcoming');assert(doc.querySelector(taskSelector(future.id,'#myday-task-list')),'Upcoming task missing');assert(!doc.querySelector(taskSelector(overdue.id,'#myday-task-list')),'Overdue leaked into upcoming');
    todo('overdue');assert(doc.querySelector(taskSelector(overdue.id,'#myday-task-list')),'Overdue task missing');click(taskSelector(overdue.id,'#myday-task-list')+' .task-complete-checkbox');assert(!doc.querySelector(taskSelector(overdue.id,'#myday-task-list')),'Completed task still overdue');
    todo('unscheduled');assert(doc.querySelector(taskSelector(unscheduled.id,'#myday-task-list')),'Unscheduled task missing');assert(doc.querySelector(taskSelector('legacy-board','#myday-task-list')),'Legacy undated task disappeared');
    results.push('Today / upcoming / overdue / unscheduled boundaries');

    calendar();click('#quick-add-btn');value('#task-text-input','Học lặp hằng ngày');value('#task-date-picker','2026-11-11');value('#task-project-input',project.id);value('#task-repeat-input','daily');value('#task-repeat-until','2026-11-14');
    click('#add-checklist-btn');value('.checklist-editor-row input[type="text"]','Ôn bài');submit();
    const repeat=data().tasks.find(t=>t.title==='Học lặp hằng ngày');
    click('.day-cell[data-date="2026-11-11"]');click(taskSelector(repeat.id,'#day-details-task-list')+' .task-checklist input');click(taskSelector(repeat.id,'#day-details-task-list')+' .task-complete-checkbox');click('#day-details-close-btn');
    click('.day-cell[data-date="2026-11-12"]');assert(!doc.querySelector(taskSelector(repeat.id,'#day-details-task-list')+' .task-complete-checkbox').checked,'Completion leaked to next repeat');assert(!doc.querySelector(taskSelector(repeat.id,'#day-details-task-list')+' .task-checklist input').checked,'Checklist leaked to next repeat');
    click(taskSelector(repeat.id,'#day-details-task-list')+' .task-open-btn');value('#task-date-picker','2026-11-16');value('#task-description-input','Chỉ đổi lần này');submit();click('#day-details-close-btn');
    assert(!doc.querySelector('.day-cell[data-date="2026-11-12"] '+taskSelector(repeat.id)),'Old occurrence date still visible');
    click('.day-cell[data-date="2026-11-16"]');click(taskSelector(repeat.id,'#day-details-task-list')+' .task-open-btn');assert(doc.querySelector('#task-description-input').value==='Chỉ đổi lần này','Rescheduled occurrence lost');
    value('#task-edit-scope','series');value('#task-text-input','Học cả chuỗi đã sửa');submit();click('#day-details-close-btn');
    click('.day-cell[data-date="2026-11-13"]');click(taskSelector(repeat.id,'#day-details-task-list')+' .task-open-btn');assert(doc.querySelector('#task-text-input').value==='Học cả chuỗi đã sửa','Series edit missing');click('#delete-task-btn');click('#confirm-ok-btn');
    assert(!doc.querySelector(taskSelector(repeat.id,'#day-details-task-list')),'Deleted occurrence still visible');click('#day-details-close-btn');
    doc=await load();click('.day-cell[data-date="2026-11-11"]');assert(doc.querySelector(taskSelector(repeat.id,'#day-details-task-list')+' .task-complete-checkbox').checked,'Repeat completion lost after reload');click('#day-details-close-btn');
    results.push('Recurring instances, independent completion/checklists, reschedule, series edit and instance deletion');

    calendar();click('#quick-add-btn');value('#task-text-input','Học thứ 2-4-6');value('#task-date-picker','2026-11-11');value('#task-repeat-input','weekly');
    checked('#repeat-weekdays input[value="1"]',true);checked('#repeat-weekdays input[value="5"]',true);value('#task-repeat-until','2026-11-18');submit();
    const weekly=data().tasks.find(t=>t.title==='Học thứ 2-4-6');
    assert(weekly.recurrence.frequency==='weekly'&&JSON.stringify(weekly.recurrence.weekdays)==='[1,3,5]','Weekly weekdays not saved');
    const projected=frame.contentWindow.PlannerStore.createStore(frame.contentWindow.localStorage).occurrences('2026-11-11','2026-11-18').filter(t=>t.id===weekly.id);
    assert(JSON.stringify(projected.map(t=>t.task_date))==='["2026-11-11","2026-11-13","2026-11-16","2026-11-18"]','Weekly UI schedule incorrect');
    results.push('Weekly recurrence form with Monday / Wednesday / Friday');

    value('#filter-priority','urgent');calendar();
    assert(doc.querySelector(taskSelector(linked.id,'#calendar-grid')),'Priority filter hid matching task');
    value('#filter-status','todo');assert(!doc.querySelector(taskSelector(linked.id,'#calendar-grid')),'Status filter ignored');
    value('#filter-status','done');assert(doc.querySelector(taskSelector(linked.id,'#calendar-grid')),'Status filter lost matching task');
    value('#filter-from','2026-11-12');assert(!doc.querySelector(taskSelector(linked.id,'#calendar-grid')),'Date range filter ignored');
    click('#clear-advanced-filters');
    assert(doc.querySelector('#filter-priority').value==='ALL'&&doc.querySelector('#filter-status').value==='ALL'&&!doc.querySelector('#filter-from').value,'Clear advanced filters failed');
    click(`[data-project-id="${project.id}"]`);
    assert(doc.querySelector(taskSelector(linked.id,'#cards-done')),'Cleared filters still hide project task');
    const handle=doc.querySelector(taskSelector(linked.id,'#cards-done')+' .kanban-drag-handle');
    assert(handle,'Kanban drag handle missing');
    const transfer=new frame.contentWindow.DataTransfer();
    handle.dispatchEvent(new frame.contentWindow.DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));
    const dropColumn=doc.querySelector('#cards-doing');
    dropColumn.dispatchEvent(new frame.contentWindow.DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    dropColumn.dispatchEvent(new frame.contentWindow.DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    assert(data().tasks.find(t=>t.id===linked.id).status==='doing'&&doc.querySelector(taskSelector(linked.id,'#cards-doing')),'Kanban drop did not persist status');
    results.push('Priority/status/date filters and Kanban drag/drop');

    calendar();click('#quick-add-btn');value('#task-text-input','Báo cáo từ mẫu');value('#task-time-input','14:00');value('#task-reminder-input','15');value('#task-template-name','Mẫu báo cáo');click('#save-task-template');
    const template=JSON.parse(window.__storage.planner_templates_v1)?.[0];
    assert(template?.name==='Mẫu báo cáo'&&template.values.remind_before==='15','Template was not saved');
    click('#cancel-task-btn');doc=await load();click('#quick-add-btn');value('#task-template-select',template.id);click('#apply-task-template');
    assert(doc.querySelector('#task-text-input').value==='Báo cáo từ mẫu'&&doc.querySelector('#task-reminder-input').value==='15','Template was not applied after reload');
    submit();assert(data().tasks.some(t=>t.title==='Báo cáo từ mẫu'&&t.remind_before===15),'Task created from template lost reminder');
    click('#quick-add-btn');value('#task-text-input','Nhắc đúng giờ thử nghiệm');
    const due=new frame.contentWindow.Date(frame.contentWindow.Date.now()+15*60000);
    value('#task-date-picker',frame.contentWindow.PlannerStore.dateString(due));
    value('#task-time-input',String(due.getHours()).padStart(2,'0')+':'+String(due.getMinutes()).padStart(2,'0'));
    value('#task-reminder-input','15');submit();doc=await load();
    assert(doc.querySelector('#reminder-banner-message').textContent.includes('Nhắc đúng giờ thử nghiệm')&&!doc.querySelector('#reminder-banner').classList.contains('hidden'),'Due reminder did not appear on startup');
    click('#dismiss-reminder');assert(doc.querySelector('#reminder-banner').classList.contains('hidden'),'Reminder could not be dismissed');
    results.push('Reusable templates and due reminder after reload');

    const tasksBeforePhoto=window.__storage.planner_data_v2;
    await waitFor(()=>doc.body.dataset.appearanceReady==='true','Appearance did not initialize');
    const canvas=doc.createElement('canvas');canvas.width=3200;canvas.height=1800;
    const context=canvas.getContext('2d'),gradient=context.createLinearGradient(0,0,3200,1800);
    gradient.addColorStop(0,'#2e6f81');gradient.addColorStop(0.5,'#87b8ac');gradient.addColorStop(1,'#ecd1b3');context.fillStyle=gradient;context.fillRect(0,0,3200,1800);
    context.fillStyle='#375d66';context.beginPath();context.moveTo(0,1800);context.lineTo(1100,700);context.lineTo(2300,1800);context.fill();
    context.fillStyle='#66908b';context.beginPath();context.moveTo(1400,1800);context.lineTo(2500,850);context.lineTo(3200,1800);context.fill();
    photoFixture=canvas.toDataURL('image/png');
    const photo=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const choosePhoto=(file)=>{const win=frame.contentWindow,transfer=new win.DataTransfer();transfer.items.add(file);const input=doc.querySelector('#background-file-input');input.files=transfer.files;input.dispatchEvent(new win.Event('change',{bubbles:true}));};
    const openAppearance=async()=>{click('#open-appearance-btn');await waitFor(()=>doc.querySelector('#appearance-dialog').open,'Appearance dialog did not open');};
    await openAppearance();choosePhoto(new frame.contentWindow.File([photo],'Nền thử nghiệm.png',{type:'image/png'}));
    await waitFor(()=>!doc.querySelector('#choose-background-btn').disabled&&doc.body.classList.contains('has-background'),'Photo did not load');
    await waitFor(()=>doc.querySelector('#background-preview-image').naturalWidth>0,'Preview did not decode');
    assert(doc.querySelector('#background-preview-image').naturalWidth===2560,'Large photo was not resized');
    value('#background-overlay','22');value('#background-blur','3');value('#background-position','top');click('#save-background-btn');
    await waitFor(()=>!doc.querySelector('#appearance-dialog').open,'Photo save did not finish');
    doc=await load();await waitFor(()=>doc.body.dataset.appearanceReady==='true','Photo reload did not finish');
    assert(doc.body.classList.contains('has-background'),'Photo did not persist');
    assert(doc.querySelector('#app-background').style.getPropertyValue('--background-veil')==='0.22','Overlay did not persist');
    assert(doc.querySelector('#app-background').style.getPropertyValue('--background-blur')==='3px','Blur did not persist');
    assert(doc.querySelector('#app-background').style.getPropertyValue('--background-position')==='top','Position did not persist');
    await openAppearance();value('#background-overlay','75');click('#cancel-appearance-btn');
    assert(doc.querySelector('#app-background').style.getPropertyValue('--background-veil')==='0.22','Cancel did not restore saved settings');
    await openAppearance();choosePhoto(new frame.contentWindow.File(['invalid'],'bad.txt',{type:'text/plain'}));
    await waitFor(()=>!doc.querySelector('#choose-background-btn').disabled&&!doc.querySelector('#background-error').classList.contains('hidden'),'Invalid type was accepted');
    choosePhoto(new frame.contentWindow.File(['broken'],'broken.png',{type:'image/png'}));
    await waitFor(()=>!doc.querySelector('#choose-background-btn').disabled&&!doc.querySelector('#background-error').classList.contains('hidden'),'Corrupt image was accepted');
    choosePhoto(new frame.contentWindow.File([new Uint8Array(20*1024*1024+1)],'large.png',{type:'image/png'}));
    await waitFor(()=>!doc.querySelector('#choose-background-btn').disabled&&doc.querySelector('#background-error').textContent.includes('20 MB'),'File size limit was not enforced');
    assert(doc.body.classList.contains('has-background'),'Bad upload removed existing photo');click('#cancel-appearance-btn');
    await openAppearance();value('#background-overlay','65');
    const originalOpen=frame.contentWindow.indexedDB.open.bind(frame.contentWindow.indexedDB);
    frame.contentWindow.indexedDB.open=()=>{throw new frame.contentWindow.DOMException('Không đủ bộ nhớ thử nghiệm','QuotaExceededError');};
    click('#save-background-btn');await waitFor(()=>!doc.querySelector('#background-error').classList.contains('hidden'),'Storage error was not shown');
    frame.contentWindow.indexedDB.open=originalOpen;click('#cancel-appearance-btn');
    doc=await load();await waitFor(()=>doc.body.dataset.appearanceReady==='true','Appearance failed to reload after failed save');
    assert(doc.querySelector('#app-background').style.getPropertyValue('--background-veil')==='0.22','Failed save overwrote previous settings');
    await openAppearance();click('#reset-background-btn');click('#cancel-appearance-btn');assert(doc.body.classList.contains('has-background'),'Cancel reset removed saved photo');
    await openAppearance();click('#reset-background-btn');click('#save-background-btn');await waitFor(()=>!doc.querySelector('#appearance-dialog').open,'Reset did not save');
    doc=await load();await waitFor(()=>doc.body.dataset.appearanceReady==='true','Reset reload did not initialize');assert(!doc.body.classList.contains('has-background'),'Default background did not persist');
    assert(window.__storage.planner_data_v2===tasksBeforePhoto,'Background changed task data');
    await openAppearance();choosePhoto(new frame.contentWindow.File([photo],'Nền thử nghiệm.png',{type:'image/png'}));
    await waitFor(()=>!doc.querySelector('#choose-background-btn').disabled&&doc.body.classList.contains('has-background'),'Could not restore test background');click('#save-background-btn');await waitFor(()=>!doc.querySelector('#appearance-dialog').open,'Test background save failed');
    results.push('Local photo upload, resizing, persistent settings, cancel/reset, invalid images, storage failure and task isolation');

    window.__electronMode=true;doc=await load();assert(frame.contentWindow.PlannerStore&&frame.contentWindow.module.exports.createStore,'Electron CommonJS renderer failed');
    window.__electronMode=false;results.push('Electron-compatible script loading');
    for(const [width,height] of [[1920,1080],[1280,800],[1100,720],[900,600],[640,480],[390,844],[360,640],[1280,520]]) {
      doc=await load(width,height);
      await waitFor(()=>doc.body.dataset.appearanceReady==='true','Background not ready during layout check');
      assert(doc.body.classList.contains('has-background'),'Saved photo missing during layout check');
      if(width<=600){
        const toggle=doc.querySelector('#sidebar-tools-toggle');
        assert(toggle.getAttribute('aria-expanded')==='false'&&frame.contentWindow.getComputedStyle(doc.querySelector('#sidebar-tools')).display==='none','Mobile tools did not start collapsed');
        click('#sidebar-tools-toggle');
        assert(toggle.getAttribute('aria-expanded')==='true'&&doc.querySelector('.project-item').getBoundingClientRect().height>0,'Mobile tools did not open');
        click('#sidebar-tools-toggle');
      }
      const noOverflow=selector=>{const el=doc.querySelector(selector);assert(el.scrollWidth<=el.clientWidth+1,`${width}x${height}: overflow ${selector} ${el.scrollWidth}/${el.clientWidth}`);};
      ['body','.main-content','.topbar','.calendar-card','.calendar-grid','.weekdays-bar'].forEach(noOverflow);
      const header=[...doc.querySelector('.weekdays-bar').children].map(el=>el.getBoundingClientRect());
      [...doc.querySelectorAll('.day-cell')].slice(0,7).forEach((el,i)=>{const r=el.getBoundingClientRect();assert(r.left>=-1&&r.right<=width+1,'Calendar column clipped');assert(Math.abs(r.left-header[i].left)<2,'Calendar header misaligned');});
      click('#quick-add-btn');noOverflow('#task-modal .modal-card');const rect=doc.querySelector('#task-modal .modal-card').getBoundingClientRect();assert(rect.left>=-1&&rect.right<=width+1&&rect.top>=-1&&rect.bottom<=height+1,'Task dialog clipped');value('#task-repeat-input','weekly');click('#add-checklist-btn');noOverflow('#task-modal .modal-card');const saveRect=doc.querySelector('#save-task-btn').getBoundingClientRect();assert(saveRect.top>=0&&saveRect.bottom<=height,'Save button not visible');click('#cancel-task-btn');
      click(`[data-project-id="${project.id}"]`);['#kanban-view','.kanban-grid-layout','#kanban-view .planner-task-card'].forEach(noOverflow);
      todo('today');['#todolist-view','.myday-container','#myday-task-list .planner-task-card','.todo-toolbar'].forEach(noOverflow);
      await openAppearance();noOverflow('#appearance-dialog');const appearanceRect=doc.querySelector('#appearance-dialog').getBoundingClientRect();assert(appearanceRect.left>=-1&&appearanceRect.right<=width+1&&appearanceRect.top>=-1&&appearanceRect.bottom<=height+1,'Background dialog clipped');click('#cancel-appearance-btn');
      results.push(`Layout ${width}x${height}`);
    }
    assert(!window.__errors.length,'Browser errors: '+window.__errors.join('; '));
  } catch(error) { failures.push((error.stack||String(error))+'\nAppearance: '+JSON.stringify({error:doc?.querySelector('#background-error')?.textContent,button:doc?.querySelector('#choose-background-btn')?.textContent,open:doc?.querySelector('#appearance-dialog')?.open,background:doc?.body.className,browserErrors:window.__errors})); }
  const saved=JSON.parse(JSON.stringify(window.__storage));
  document.body.innerHTML='<pre id="results"></pre>';
  document.querySelector('#results').textContent=JSON.stringify({results,failures,storage:saved,photoFixture},null,2);
}

const fixture=path.join(folder,'checks.html');
const script=`(${browserChecks.toString()})(${JSON.stringify(html)},${JSON.stringify(old)});`;
fs.writeFileSync(fixture,'<!doctype html><meta charset="utf-8"><body><script>'+script.replaceAll('</script>','<\\/script>')+'</script></body>');
const resultFile=path.join(folder,'results.json');
const run=spawnSync(chromium,[renderer,fixture,resultFile],{encoding:'utf8',timeout:60000,windowsHide:true,maxBuffer:8*1024*1024,env:runtimeEnv});
console.log('Artifacts: '+folder);
if(!fs.existsSync(resultFile)){console.error(run.error?.message||(run.stderr||'').slice(-2000));console.error((run.stdout||'').slice(-1500));process.exitCode=1;}
else{
  const report=JSON.parse(fs.readFileSync(resultFile,'utf8'));
  console.log(JSON.stringify({results:report.results,failures:report.failures},null,2));
  if(report.failures.length) process.exitCode=1;
  if(!report.failures.length&&process.argv.includes('--screenshots')){
    const jobs=[];
    for(const [width,height,view] of [[1280,800,'calendar'],[900,600,'today'],[640,480,'calendar'],[390,844,'today'],[1280,800,'form'],[1280,800,'project'],[1280,800,'appearance']]){
      const file=path.join(folder,`${view}-${width}x${height}.html`),screenshot=file.replace('.html','.png');
      const activate=view==='today'?`document.getElementById('todolist-nav-link').click();`:view==='form'?`document.getElementById('quick-add-btn').click();document.getElementById('task-text-input').value='Lập kế hoạch tuần';document.getElementById('task-repeat-input').value='weekly';document.getElementById('task-repeat-input').dispatchEvent(new Event('change'));`:view==='project'?`document.querySelectorAll('.project-item')[1].click();`:view==='appearance'?`document.getElementById('open-appearance-btn').click();`:'';
      const seedPhoto=`const wait=async(condition)=>{for(let i=0;i<200;i++){if(condition())return;await new Promise(r=>setTimeout(r,20));}throw new Error('Preview timed out');};await wait(()=>document.body.dataset.appearanceReady==='true');document.getElementById('open-appearance-btn').click();await wait(()=>document.getElementById('appearance-dialog').open);const bytes=Uint8Array.from(atob(${JSON.stringify(report.photoFixture.split(',')[1])}),c=>c.charCodeAt(0));const transfer=new frame.contentWindow.DataTransfer();transfer.items.add(new frame.contentWindow.File([bytes],'Nền thử nghiệm.png',{type:'image/png'}));document.getElementById('background-file-input').files=transfer.files;document.getElementById('background-file-input').dispatchEvent(new Event('change'));await wait(()=>!document.getElementById('choose-background-btn').disabled&&document.body.classList.contains('has-background'));document.getElementById('save-background-btn').click();await wait(()=>!document.getElementById('appearance-dialog').open);`;
      const previewScript=`window.__storage=${JSON.stringify(report.storage)};window.__errors=[];const frame=document.createElement('iframe');frame.style.cssText='border:0;display:block;width:${width}px;height:${height}px';let started=false;frame.onload=async()=>{if(started||!frame.contentDocument.getElementById('open-appearance-btn'))return;started=true;const document=frame.contentDocument;const Event=frame.contentWindow.Event;${seedPhoto}${activate}window.__previewReady=true;};frame.srcdoc=${JSON.stringify(html)};document.body.append(frame);`;
      const standalone='<!doctype html><meta charset="utf-8"><body style="margin:0;overflow:hidden"><script>'+previewScript.replaceAll('</script>','<\\/script>')+'</script></body>';
      fs.writeFileSync(file,standalone);
      jobs.push({file,screenshot,width,height});
    }
    const jobsFile=path.join(folder,'screenshots.json');fs.writeFileSync(jobsFile,JSON.stringify(jobs));
    const shots=spawnSync(chromium,[renderer,fixture,resultFile,jobsFile],{encoding:'utf8',timeout:60000,windowsHide:true,env:runtimeEnv});
    process.stdout.write(shots.stdout||'');if(shots.status!==0){console.error(shots.error?.message||shots.stderr);process.exitCode=1;}
  }
}
