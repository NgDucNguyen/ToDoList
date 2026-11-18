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
html = html.replace('<link rel="stylesheet" href="chatbot.css" />', () => '<style>' + fs.readFileSync(path.join(root, 'chatbot.css'), 'utf8') + '</style>');
html = html.replaceAll('assets/chatbot-avatar.svg', 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(root, 'assets', 'chatbot-avatar.svg')).toString('base64'));
for (const name of ['planner-store.js', 'lunar.js', 'hust-ui.js', 'notes-store.js', 'notes.js', 'chatbot-core.js', 'chatbot-nlu.js', 'chatbot-model.js', 'chatbot-knowledge.js', 'chatbot-local.js', 'chatbot.js', 'app.js', 'appearance.js']) html = html.replace(`<script src="${name}"></script>`, () => '<script>' + fs.readFileSync(path.join(root,name),'utf8') + '</script>');
const initialize = `
window.addEventListener('error',event=>parent.__errors.push(event.message));
const RealDate=Date; window.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[RealDate.UTC(2026,10,11,5)]));}static now(){return RealDate.UTC(2026,10,11,5);}};
Object.defineProperty(window,'localStorage',{value:{getItem:key=>parent.__storage[key]??null,setItem:(key,value)=>{parent.__storage[key]=String(value);}}});
// Synthetic reminders must never reach Windows from the test fixture.
Object.defineProperty(window,'Notification',{configurable:true,value:class {static permission='denied';}});
// Electron exposes CommonJS globals in a renderer with nodeIntegration enabled.
if(parent.__electronMode) window.module={exports:{}};
if(parent.__hustMock) window.plannerDesktop={
reminder:()=>{},
hust:parent.__hustMock?{connect:()=>parent.__hustMock('hust:connect'),read:arg=>parent.__hustMock('hust:read',arg),backup:arg=>parent.__hustMock('hust:backup',arg),disconnect:()=>parent.__hustMock('hust:disconnect')}:undefined,
};
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
  const calendar=()=>click('#calendar-nav-link');
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
    assert(!dropColumn.children.length&&dropColumn.getBoundingClientRect().height>=100,'Empty Kanban column has no usable drop area');
    dropColumn.dispatchEvent(new frame.contentWindow.DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    dropColumn.dispatchEvent(new frame.contentWindow.DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    assert(data().tasks.find(t=>t.id===linked.id).status==='doing'&&doc.querySelector(taskSelector(linked.id,'#cards-doing')),'Kanban drop did not persist status');
    const movingCard=doc.querySelector(taskSelector(linked.id,'#cards-doing'));
    movingCard.dispatchEvent(new frame.contentWindow.DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));
    const doneHeader=doc.querySelector('.kanban-col[data-status="done"] .col-head');
    doneHeader.dispatchEvent(new frame.contentWindow.DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    doneHeader.dispatchEvent(new frame.contentWindow.DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    assert(data().tasks.find(t=>t.id===linked.id).is_completed&&doc.querySelector(taskSelector(linked.id,'#cards-done')),'Dragging card onto column header failed');
    click(taskSelector(linked.id,'#cards-done')+' .task-complete-checkbox');
    assert(data().tasks.find(t=>t.id===linked.id).status==='todo'&&!data().tasks.find(t=>t.id===linked.id).is_completed,'Unchecking completed Kanban task did not move it back');
    click(taskSelector(linked.id,'#cards-todo')+' .task-complete-checkbox');
    doc=await load();click(`[data-project-id="${project.id}"]`);
    assert(doc.querySelector(taskSelector(linked.id,'#cards-done')+' .task-complete-checkbox').checked,'Checkbox completion did not persist after reload');
    results.push('Priority/status/date filters and Kanban drag/drop');

    const fixture=data();
    for(let i=0;i<12;i++)fixture.tasks.push({id:'scroll-fixture-'+i,title:'Kiểm thử cuộn '+i,project_id:project.id,status:'todo'});
    window.__storage.planner_data_v2=JSON.stringify(fixture);doc=await load();click(`[data-project-id="${project.id}"]`);
    const scrolling=doc.querySelector('#cards-todo');scrolling.scrollTop=180;
    const scrollBefore=scrolling.scrollTop;assert(scrollBefore>0,'Scroll regression fixture did not overflow');
    click(taskSelector('scroll-fixture-4','#cards-todo')+' .task-complete-checkbox');
    assert(Math.abs(scrolling.scrollTop-scrollBefore)<=1,'Checking task reset Kanban column scroll');
    const cleanup=data();cleanup.tasks=cleanup.tasks.filter(task=>!task.id.startsWith('scroll-fixture-'));
    window.__storage.planner_data_v2=JSON.stringify(cleanup);doc=await load();
    results.push('Empty-column/header drops, checkbox reversal/reload and preserved column scroll');

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

    const beforeHust=window.__storage.planner_data_v2;
    let backupFails=false,readFails=false;const ipcCalls=[];
    let hustFixture={status:'ready',account:'a'.repeat(24),term:'20261',complete:true,classes:2,unscheduled:[{title:'Lớp chưa có lịch',classId:'000002'}],events:[{uid:'fixture-class:1:2026-11-11',title:'HUST <img src=x>',date:'2026-11-11',time:'06:45',endTime:'10:05',classId:'000001',courseId:'IT0000',classType:'LT',room:'D9-101'}]};
    window.__hustMock=async(channel,arg)=>{ipcCalls.push(channel);if(channel==='hust:read'){if(readFails)throw new Error('Phiên HUST đã hết hạn');return JSON.parse(JSON.stringify(hustFixture));}if(channel==='hust:backup'){if(backupFails)throw new Error('Sao lưu thất bại');assert(JSON.parse(arg).version===2,'Invalid sync backup');return 'backup.json';}return true;};
    doc=await load();click('#open-hust-btn');assert(doc.querySelector('#hust-dialog').open,'HUST dialog did not open');
    assert(!doc.querySelector('#hust-auto-sync').checked&&doc.querySelector('#hust-auto-sync').disabled,'Auto sync enabled before first import');
    click('#hust-connect-btn');await waitFor(()=>!doc.querySelector('#hust-connect-btn').disabled,'Connect button stayed busy');
    click('#hust-read-btn');await waitFor(()=>!doc.querySelector('#hust-apply-btn').disabled,'HUST preview not ready');
    assert(window.__storage.planner_data_v2===beforeHust,'Preview changed planner data');assert(!doc.querySelector('#hust-preview-rows img'),'HUST title interpreted as HTML');
    backupFails=true;click('#hust-apply-btn');await waitFor(()=>doc.querySelector('#hust-status').classList.contains('error'),'Backup failure not shown');
    assert(window.__storage.planner_data_v2===beforeHust,'Failed backup still applied sync');
    backupFails=false;click('#hust-apply-btn');await waitFor(()=>data().tasks.some(task=>task.source?.provider==='hust'),'HUST import did not persist');
    const imported=data().tasks.find(task=>task.source?.provider==='hust');assert(imported.location==='D9-101'&&imported.end_time==='10:05','Imported location/time lost');
    assert(ipcCalls.includes('hust:connect')&&ipcCalls.includes('hust:backup'),'Desktop connector not invoked');
    assert(!doc.querySelector('#hust-auto-sync').disabled,'Auto sync unavailable after import');checked('#hust-auto-sync',true);click('#close-hust-btn');
    calendar();assert(!doc.querySelector(taskSelector(imported.id,'#calendar-grid')),'HUST lesson leaked into personal calendar');
    todo('today');assert(!doc.querySelector(taskSelector(imported.id,'#myday-task-list')),'HUST lesson leaked into personal tasks');
    click('#hust-calendar-nav-link');assert(!doc.querySelector('#hust-calendar-view').classList.contains('hidden'),'HUST calendar did not open');
    assert(doc.querySelector(taskSelector(imported.id,'#hust-calendar-grid')),'Imported lesson missing from separate HUST calendar');
    assert(!data().projects.some(project=>project.source?.provider==='hust'),'Sync recreated a HUST project');
    click(taskSelector(imported.id,'#hust-calendar-grid')+' .task-complete-checkbox');
    const personalMonth=doc.querySelector('#current-month-year').textContent;
    click('#hust-next-month-btn');calendar();assert(doc.querySelector('#current-month-year').textContent===personalMonth,'HUST navigation changed personal calendar month');
    click('#hust-calendar-nav-link');click('#hust-prev-month-btn');
    click('#hust-add-lesson-btn');assert(doc.querySelector('#task-calendar-input').value==='hust','Manual lesson defaults to the wrong calendar');
    value('#task-text-input','Học bù tự thêm');value('#task-date-picker','2026-11-11');submit();
    const manualLesson=data().tasks.find(task=>task.title==='Học bù tự thêm');
    assert(manualLesson.calendar_id==='hust'&&!manualLesson.source,'Manual lesson was marked as a synced lesson');
    assert(doc.querySelector(taskSelector(manualLesson.id,'#hust-calendar-grid')),'Manual lesson missing from HUST calendar');
    value('#hust-search-input','000001');assert(!doc.querySelector(taskSelector(manualLesson.id,'#hust-calendar-grid'))&&doc.querySelector(taskSelector(imported.id,'#hust-calendar-grid')),'HUST class search did not stay within the school calendar');value('#hust-search-input','');
    hustFixture.events[0]={...hustFixture.events[0],date:'2026-11-12',room:'D5-404',changed:true};
    click('#open-hust-btn');click('#hust-read-btn');await waitFor(()=>!doc.querySelector('#hust-apply-btn').disabled,'Second preview not ready');click('#hust-apply-btn');
    await waitFor(()=>data().tasks.find(task=>task.id===imported.id).task_date==='2026-11-12','Reschedule did not update');
    assert(data().tasks.filter(task=>task.source?.provider==='hust').length===1&&data().tasks.find(task=>task.id===imported.id).is_completed,'Sync duplicated task or cleared completion');
    assert(data().tasks.find(task=>task.id===manualLesson.id)?.title==='Học bù tự thêm','Sync removed the manual makeup lesson');
    const beforeFullPreview=window.__storage.planner_data_v2;
    hustFixture.events.push(...Array.from({length:135},(_,index)=>({...hustFixture.events[0],uid:'full-semester:'+index,title:'Buổi học '+index,date:frame.contentWindow.PlannerStore.addDays('2026-12-05',index),changed:false})));
    // Return unsorted data so the displayed range and last row must use the
    // full sorted timetable, rather than the original first/last positions.
    hustFixture.events.reverse();
    click('#hust-read-btn');await waitFor(()=>!doc.querySelector('#hust-apply-btn').disabled,'Full-semester preview not ready');
    assert(doc.querySelectorAll('#hust-preview-rows tr').length===136,'Preview truncated lessons after the first 100');
    assert(doc.querySelector('#hust-preview-rows tr:last-child td').textContent==='18/04/2027','Late-semester lesson missing from preview');
    assert(doc.querySelector('#hust-preview-summary').textContent.includes('từ 12/11/2026 đến 18/04/2027'),'Full timetable date range not shown');
    assert(window.__storage.planner_data_v2===beforeFullPreview,'Full-semester preview changed saved tasks');
    click('#hust-apply-btn');await waitFor(()=>data().tasks.filter(task=>task.source?.provider==='hust').length===136,'Import truncated lessons after the first 100');
    assert(data().tasks.some(task=>task.source?.uid==='full-semester:134'&&task.task_date==='2027-04-18'),'Last lesson was not saved');
    const afterHust=window.__storage.planner_data_v2;readFails=true;click('#hust-read-btn');await waitFor(()=>doc.querySelector('#hust-status').textContent.includes('hết hạn'),'Expired session not shown');
    assert(window.__storage.planner_data_v2===afterHust,'Expired session changed saved tasks');
    click('#hust-disconnect-btn');await waitFor(()=>ipcCalls.includes('hust:disconnect')&&!doc.querySelector('#hust-disconnect-btn').disabled,'Disconnect failed');
    assert(!JSON.parse(window.__storage.planner_hust_settings_v1).auto,'Disconnect left auto sync enabled');
    const oldSchoolState=data();
    oldSchoolState.projects.push({id:'old-school-project',name:'Lịch học HUST · 20261',source:{provider:'hust'}},{id:'user-school-name',name:'Lịch học HUST tự đặt'});
    oldSchoolState.tasks.find(task=>task.id===imported.id).project_id='old-school-project';
    const oldManual=oldSchoolState.tasks.find(task=>task.id===manualLesson.id);oldManual.project_id='old-school-project';delete oldManual.calendar_id;
    const beforeCalendarMigration=JSON.stringify(oldSchoolState);window.__storage.planner_data_v2=beforeCalendarMigration;
    doc=await load();
    assert(window.__storage.planner_backup_before_hust_calendar===beforeCalendarMigration,'Calendar migration did not save an exact backup');
    assert(!doc.querySelector('[data-project-id="old-school-project"]')&&doc.querySelector('[data-project-id="user-school-name"]'),'Migration removed the wrong project');
    assert(data().tasks.find(task=>task.id===imported.id).is_completed,'Calendar migration cleared completion');
    click('#hust-calendar-nav-link');assert(doc.querySelector(taskSelector(manualLesson.id,'#hust-calendar-grid')),'Migration lost the manually added school lesson');
    click(taskSelector(manualLesson.id,'#hust-calendar-grid')+' .task-open-btn');value('#task-calendar-input','personal');submit();
    assert(!doc.querySelector(taskSelector(manualLesson.id,'#hust-calendar-grid')),'Moved manual lesson remained in school calendar');
    calendar();click('#calendar-grid .day-cell[data-date="2026-11-11"]');
    assert(doc.querySelector(taskSelector(manualLesson.id,'#day-details-task-list')),'Moved lesson missing from personal day details');
    assert(!doc.querySelector(taskSelector(imported.id,'#day-details-task-list')),'School lesson leaked into personal day details');
    click(taskSelector(manualLesson.id,'#day-details-task-list')+' .task-open-btn');value('#task-calendar-input','hust');submit();click('#day-details-close-btn');
    click('#hust-calendar-nav-link');assert(doc.querySelector(taskSelector(manualLesson.id,'#hust-calendar-grid')),'Moving a manual lesson back to HUST failed');
    window.__hustMock=null;window.__storage.planner_data_v2=beforeHust;delete window.__storage.planner_hust_settings_v1;doc=await load();
    results.push('Full HUST preview/import beyond 100 lessons, date range, local backup failure, safe import, reschedule preserving completion, expired session and disconnect');
    results.push('Separate personal/HUST calendars, independent months and search, manual school lessons, migration backup and calendar reassignment');

    const tasksBeforeNotes=window.__storage.planner_data_v2;
    click('#notes-nav-link');assert(!doc.querySelector('#notes-view').classList.contains('hidden'),'Notes page did not open');
    click('#new-note-btn');value('#note-title-input','Ý tưởng <img src=x>');
    const noteBody='  Ghi chú tiếng Việt\n\n\tGiữ nguyên khoảng trắng\nDòng cuối  ';
    value('#note-body-input',noteBody);
    await waitFor(()=>JSON.parse(window.__storage.planner_notes_v1||'{"notes":[]}').notes[0]?.body===noteBody,'Note did not autosave');
    const firstNote=JSON.parse(window.__storage.planner_notes_v1).notes[0];
    assert(!doc.querySelector('#notes-list img'),'Note title interpreted as HTML');
    click('#new-note-btn');value('#note-title-input','Ghi nhanh');value('#note-body-input','Lưu ngay khi chuyển trang');calendar();
    assert(JSON.parse(window.__storage.planner_notes_v1).notes.some(note=>note.body==='Lưu ngay khi chuyển trang'),'Leaving notes lost pending text');
    doc=await load();click('#notes-nav-link');value('#notes-search-input','khoảng trắng');
    assert(doc.querySelectorAll('.note-list-item').length===1&&doc.querySelector('.note-list-item').dataset.noteId===firstNote.id,'Notes search did not find body text');
    click('.note-list-item');assert(doc.querySelector('#note-body-input').value===noteBody,'Note whitespace changed after reload');
    value('#notes-search-input','');
    const notesStorage=frame.contentWindow.localStorage,originalNotesSet=notesStorage.setItem.bind(notesStorage);
    notesStorage.setItem=(key,text)=>{if(key==='planner_notes_v1')throw new frame.contentWindow.DOMException('Full','QuotaExceededError');originalNotesSet(key,text);};
    value('#note-body-input',noteBody+'\nChưa lưu');click('#save-note-btn');
    assert(doc.querySelector('#note-save-status').classList.contains('error'),'Failed note save was reported as saved');
    click('#new-note-btn');assert(doc.querySelector('#note-body-input').value.endsWith('Chưa lưu'),'Failed save discarded draft when creating another note');
    notesStorage.setItem=originalNotesSet;click('#save-note-btn');assert(!doc.querySelector('#note-save-status').classList.contains('error'),'Note save could not be retried');
    const originalAnchorClick=frame.contentWindow.HTMLAnchorElement.prototype.click;
    let exportedNote;
    frame.contentWindow.HTMLAnchorElement.prototype.click=function(){if(this.download?.endsWith('.txt'))exportedNote=frame.contentWindow.fetch(this.href).then(response=>response.text());else originalAnchorClick.call(this);};
    click('#export-note-btn');assert(exportedNote&&await exportedNote===noteBody+'\nChưa lưu','TXT export changed Unicode or whitespace');frame.contentWindow.HTMLAnchorElement.prototype.click=originalAnchorClick;
    const notesBeforeDelete=window.__storage.planner_notes_v1;
    click('#delete-note-btn');click('#confirm-cancel-btn');assert(window.__storage.planner_notes_v1===notesBeforeDelete,'Cancel deleted a note');
    click('#delete-note-btn');click('#confirm-ok-btn');assert(JSON.parse(window.__storage.planner_notes_v1).notes.length===1,'Confirmed note deletion failed');
    assert(window.__storage.planner_notes_before_delete_v1===notesBeforeDelete,'Note deletion did not back up original content');
    assert(window.__storage.planner_data_v2===tasksBeforeNotes,'Notes changed calendar/task data');
    results.push('Notes autosave/reload, Unicode and whitespace, search, TXT export, failed save retry, deletion backup and calendar isolation');

    doc=await load();click('#cb-launcher');
    const originalChatFetch=frame.contentWindow.fetch;
    frame.contentWindow.fetch=()=>{throw new Error('Network forbidden for local bot');};
    assert(!doc.querySelector('#cb-panel').hidden,'Chatbot did not open');
    const sendChat=async text=>{value('#cb-input',text);doc.querySelector('#cb-form').requestSubmit();await waitFor(()=>!doc.querySelector('#cb-send').disabled,'Chat did not complete');};
    const beforeChat=data().tasks.length;
    await sendChat('Tạo lịch đọc sách ngày mai 19:00');
    assert(data().tasks.length===beforeChat,'Local bot wrote a task before confirmation');
    click('.cb-accept');click('.cb-accept');
    assert(data().tasks.length===beforeChat+1,'Repeated confirmation created duplicates');
    assert(data().tasks.at(-1).calendar_id==='personal','Chat wrote HUST calendar');
    assert(data().tasks.at(-1).task_date==='2026-11-12'&&data().tasks.at(-1).time==='19:00','Local date/time parse failed');
    assert(!doc.querySelector('#cb-messages img'),'Chat rendered AI text as HTML');
    const chatNoteBody='Tiếng Việt\n  Giữ khoảng trắng  ';
    await sendChat('Tạo ghi chú Ghi từ chatbot với nội dung: '+chatNoteBody);
    const noteCount=JSON.parse(window.__storage.planner_notes_v1).notes.length;
    const accepts=doc.querySelectorAll('.cb-accept');accepts[accepts.length-1].click();
    assert(JSON.parse(window.__storage.planner_notes_v1).notes.length===noteCount+1,'Confirmed note not created');
    assert(doc.querySelector('#note-body-input').value===chatNoteBody,'Chat note lost text');
    await sendChat('Tìm ghi chú Ghi từ chatbot');assert(doc.querySelector('#cb-messages').textContent.includes(chatNoteBody),'Local note retrieval failed');
    await sendChat('Tạo lịch họp nhóm');assert(doc.querySelector('#cb-messages').lastElementChild.textContent.includes('ngày nào'),'Missing date was guessed');
    await sendChat('ngày mai');await sendChat('7 giờ tối');
    const followupAccepts=doc.querySelectorAll('.cb-accept');followupAccepts[followupAccepts.length-1].click();assert(data().tasks.at(-1).title==='họp nhóm'&&data().tasks.at(-1).time==='19:00','Follow-up slots failed');
    await sendChat('Ghi chú: <img src=x onerror=alert(1)>');assert(!doc.querySelector('#cb-messages img'),'Reply interpreted as HTML');
    assert(!doc.querySelector('#cb-from,#cb-to'),'Chatbot still requires date pickers');
    await sendChat('Xem toàn bộ lịch');assert(doc.querySelector('#cb-messages').lastElementChild.textContent.includes('Toàn bộ'),'No-date request did not read all data');
    await sendChat('xóa các ghi chú');assert(doc.querySelector('#cb-messages').lastElementChild.textContent.includes('Chưa hỗ trợ'),'Destructive command accepted');
    const taskCountBeforeRead=data().tasks.length;await sendChat('Tóm tắt lịch tuần này');assert(data().tasks.length===taskCountBeforeRead,'Summary changed tasks');
    click('#cb-new-chat');assert(!doc.querySelector('.cb-proposal'),'New conversation retained stale action');
    click('#cb-close');assert(doc.querySelector('#cb-panel').hidden&&doc.activeElement.id==='cb-launcher','Close did not restore focus');
    frame.contentWindow.fetch=originalChatFetch;
    results.push('Real offline intent model/date parser, confirmed tasks/notes, exact text, follow-up questions, local retrieval, safety and no network');

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

    window.__electronMode=true;doc=await load();assert(frame.contentWindow.PlannerStore.createStore&&frame.contentWindow.PlannerChatbotCore.validateResult&&frame.contentWindow.PlannerLocalChatbot.createSession,'CommonJS-compatible shared modules failed');
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
      click('#open-hust-btn');noOverflow('#hust-dialog');const hustRect=doc.querySelector('#hust-dialog').getBoundingClientRect();assert(hustRect.left>=-1&&hustRect.right<=width+1&&hustRect.top>=-1&&hustRect.bottom<=height+1,'HUST dialog clipped');click('#close-hust-btn');
      click('#hust-calendar-nav-link');['body','.main-content','#hust-calendar-view','#hust-calendar-view .topbar','#hust-calendar-grid','#hust-calendar-view .calendar-card'].forEach(noOverflow);
      const schoolHeader=[...doc.querySelector('#hust-calendar-view .weekdays-bar').children].map(el=>el.getBoundingClientRect());
      [...doc.querySelectorAll('#hust-calendar-grid .day-cell')].slice(0,7).forEach((el,i)=>{const r=el.getBoundingClientRect();assert(r.left>=-1&&r.right<=width+1,'HUST calendar column clipped');assert(Math.abs(r.left-schoolHeader[i].left)<2,'HUST calendar header misaligned');});
      click('#hust-add-lesson-btn');noOverflow('#task-modal .modal-card');assert(doc.querySelector('#task-calendar-input').value==='hust','School add button lost calendar context');click('#cancel-task-btn');calendar();
      click('#notes-nav-link');['body','.main-content','#notes-view','.notes-workspace','.note-editor','.note-editor-toolbar'].forEach(noOverflow);
      const editorRect=doc.querySelector('#note-body-input').getBoundingClientRect();assert(editorRect.width>100&&editorRect.height>=70,'Notes editor became unusable at '+width+'x'+height);calendar();
      click('#cb-launcher');const chatRect=doc.querySelector('#cb-panel').getBoundingClientRect();
      assert(chatRect.left>=0&&chatRect.top>=0&&chatRect.right<=width+1&&chatRect.bottom<=height+1,'Chatbot clipped at '+width+'x'+height);
      ['#cb-panel','#cb-form'].forEach(noOverflow);
      const chatSend=doc.querySelector('#cb-send').getBoundingClientRect();assert(chatSend.bottom<=height&&chatSend.top>=0,'Chat send button clipped');click('#cb-close');
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
    for(const [width,height,view] of [[1280,800,'calendar'],[900,600,'today'],[640,480,'calendar'],[390,844,'today'],[1280,800,'form'],[1280,800,'project'],[1280,800,'appearance'],[1280,800,'hust'],[390,844,'hust'],[1280,800,'hust-calendar'],[640,480,'hust-calendar'],[390,844,'hust-calendar'],[1280,800,'notes'],[640,480,'notes'],[390,844,'notes'],[1280,800,'chatbot'],[640,480,'chatbot'],[390,844,'chatbot']]){
      const file=path.join(folder,`${view}-${width}x${height}.html`),screenshot=file.replace('.html','.png');
      const activate=view==='today'?`document.getElementById('todolist-nav-link').click();`:view==='form'?`document.getElementById('quick-add-btn').click();document.getElementById('task-text-input').value='Lập kế hoạch tuần';document.getElementById('task-repeat-input').value='weekly';document.getElementById('task-repeat-input').dispatchEvent(new Event('change'));`:view==='project'?`document.querySelectorAll('.project-item')[1].click();`:view==='appearance'?`document.getElementById('open-appearance-btn').click();`:view==='hust'?`document.getElementById('open-hust-btn').click();`:view==='hust-calendar'?`document.getElementById('hust-calendar-nav-link').click();`:view==='notes'?`document.getElementById('notes-nav-link').click();`:'';
      const previewStorage={...report.storage};
      if(view==='notes') previewStorage.planner_notes_v1=JSON.stringify({version:1,notes:[
        {id:'note-preview-1',title:'Ý tưởng cho tuần mới',body:'Mỗi ngày một chút tiến bộ.\n\nCẦN GHI NHỚ\n• Hoàn thiện báo cáo dự án\n• Chuẩn bị nội dung buổi họp nhóm\n• Dành 30 phút đọc sách\n\nÝ tưởng mới\nGhi lại ngay khi nghĩ ra, sắp xếp lại sau.',created_at:'2026-11-18T00:00:00Z',updated_at:'2026-11-18T00:15:00Z'},
        {id:'note-preview-2',title:'Ghi nhanh sau buổi họp',body:'Các ý chính và bước tiếp theo của nhóm.',created_at:'2026-11-17T00:00:00Z',updated_at:'2026-11-17T02:30:00Z'}
      ]});
      if(view==='hust-calendar'){
        const schoolData=JSON.parse(previewStorage.planner_data_v2);
        [['Đại số','2026-11-09','15:05','17:30','D3-301'],['Công nghệ phần mềm','2026-11-10','06:45','10:05','D9-201'],['Khoa học dữ liệu','2026-11-11','15:05','17:30','TC-301'],['Học máy','2026-11-12','06:45','10:05','D9-101'],['Học bù tự thêm','2026-11-11','18:00','20:30','Online'],['Thuật toán ứng dụng','2026-11-13','12:30','14:00','D5-101']].forEach(([title,task_date,time,end_time,location],index)=>schoolData.tasks.push({id:'school-preview-'+index,title,task_date,time,end_time,location,tag:'Study',calendar_id:'hust',...(index===4?{}:{source:{provider:'hust',term:'20261',class_id:'12345'+index}})}));
        previewStorage.planner_data_v2=JSON.stringify(schoolData);
      }
      const seedPhoto=`const wait=async(condition)=>{for(let i=0;i<200;i++){if(condition())return;await new Promise(r=>setTimeout(r,20));}throw new Error('Preview timed out');};await wait(()=>document.body.dataset.appearanceReady==='true');document.getElementById('open-appearance-btn').click();await wait(()=>document.getElementById('appearance-dialog').open);const bytes=Uint8Array.from(atob(${JSON.stringify(report.photoFixture.split(',')[1])}),c=>c.charCodeAt(0));const transfer=new frame.contentWindow.DataTransfer();transfer.items.add(new frame.contentWindow.File([bytes],'Nền thử nghiệm.png',{type:'image/png'}));document.getElementById('background-file-input').files=transfer.files;document.getElementById('background-file-input').dispatchEvent(new Event('change'));await wait(()=>!document.getElementById('choose-background-btn').disabled&&document.body.classList.contains('has-background'));document.getElementById('save-background-btn').click();await wait(()=>!document.getElementById('appearance-dialog').open);`;
      const chatActivate=view==='chatbot'?`document.getElementById('cb-launcher').click();document.getElementById('cb-input').value='Tóm tắt lịch tuần này';document.getElementById('cb-form').requestSubmit();await wait(()=>!document.getElementById('cb-send').disabled);`:'';
      const previewScript=`window.__storage=${JSON.stringify(previewStorage)};window.__errors=[];const frame=document.createElement('iframe');frame.style.cssText='border:0;display:block;width:${width}px;height:${height}px';let started=false;frame.onload=async()=>{if(started||!frame.contentDocument.getElementById('open-appearance-btn'))return;started=true;const document=frame.contentDocument;const Event=frame.contentWindow.Event;${seedPhoto}document.getElementById('dismiss-reminder').click();${activate}${chatActivate}window.__previewReady=true;};frame.srcdoc=${JSON.stringify(html)};document.body.append(frame);`;
      const standalone='<!doctype html><meta charset="utf-8"><body style="margin:0;overflow:hidden"><script>'+previewScript.replaceAll('</script>','<\\/script>')+'</script></body>';
      fs.writeFileSync(file,standalone);
      jobs.push({file,screenshot,width,height});
    }
    const jobsFile=path.join(folder,'screenshots.json');fs.writeFileSync(jobsFile,JSON.stringify(jobs));
    const shots=spawnSync(chromium,[renderer,fixture,resultFile,jobsFile],{encoding:'utf8',timeout:60000,windowsHide:true,env:runtimeEnv});
    process.stdout.write(shots.stdout||'');if(shots.status!==0){console.error(shots.error?.message||shots.stderr);process.exitCode=1;}
  }
}
