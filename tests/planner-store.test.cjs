const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../planner-store.js');

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.failKey = ''; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { if (this.failKey === key) throw new DOMException('Full', 'QuotaExceededError'); this.values.set(key, String(value)); }
}
const setup = () => { const storage = new MemoryStorage(); return { storage, store: P.createStore(storage) }; };
const row = (store, date) => store.occurrences(date, date)[0];
const recurring = (store, extra = {}) => store.addTask({ title: 'Học bài', task_date: '2026-11-11', recurrence: { frequency: 'daily' }, ...extra });

test('migrates both legacy task lists without losing projects, status, unknown fields or colliding IDs', () => {
  const old = {
    planner_tasks: JSON.stringify([{ id: '1', title: 'Lịch', task_date: '2026-11-11', is_completed: true, custom: 'keep' }]),
    planner_projects: JSON.stringify([{ id: 'p', name: 'CV' }]),
    planner_kanban_tasks: JSON.stringify([{ id: '1', title: 'Dự án', project_id: 'p', status: 'doing' }]),
  };
  const storage = new MemoryStorage(old), store = P.createStore(storage);
  assert.equal(store.state.tasks.length, 2);
  assert.equal(new Set(store.state.tasks.map(t => t.id)).size, 2);
  assert.equal(store.state.tasks[0].custom, 'keep');
  assert.equal(store.state.tasks[0].status, 'done');
  assert.equal(store.projectTasks('p')[0].status, 'doing');
  assert.equal(store.todo('unscheduled').length, 1);
  for (const [key, value] of Object.entries(old)) assert.equal(storage.getItem(key), value);
  assert.deepEqual(JSON.parse(storage.getItem(P.BACKUP_KEY)).data, old);
  assert.deepEqual(P.createStore(storage).state, store.state);
});

test('stops on malformed legacy or unsupported modern data without overwriting it', () => {
  for (const values of [{ planner_tasks: '{bad' }, { planner_projects: '{}' }, { [P.DATA_KEY]: '{"version":99,"tasks":[],"projects":[]}' }]) {
    const storage = new MemoryStorage(values);
    assert.throws(() => P.createStore(storage));
    assert.deepEqual(Object.fromEntries(storage.values), values);
  }
});

test('does not migrate when backup cannot be written', () => {
  const original = '[{"id":"1","title":"Keep"}]';
  const storage = new MemoryStorage({ planner_tasks: original }); storage.failKey = P.BACKUP_KEY;
  assert.throws(() => P.createStore(storage), { name: 'QuotaExceededError' });
  assert.equal(storage.getItem(P.DATA_KEY), null);
  assert.equal(storage.getItem('planner_tasks'), original);
});

test('failed save leaves both current state and persisted data unchanged', () => {
  const { storage, store } = setup();
  const task = store.addTask({ title: 'Keep', task_date: '2026-11-11' });
  const before = store.state, raw = storage.getItem(P.DATA_KEY); storage.failKey = P.DATA_KEY;
  assert.throws(() => store.updateTask(task.id, { title: 'Lost' }), { name: 'QuotaExceededError' });
  assert.deepEqual(store.state, before); assert.equal(storage.getItem(P.DATA_KEY), raw);
});

test('rejects stale writes from another window', () => {
  const { storage, store } = setup(); const other = P.createStore(storage);
  store.addTask({ title: 'First window' });
  assert.throws(() => other.addTask({ title: 'Stale' }), /cửa sổ khác/);
  assert.equal(P.createStore(storage).state.tasks.length, 1);
});

test('one task shares its date and completion across calendar, project and To-Do', () => {
  const { store } = setup(); const project = store.saveProject('Báo cáo');
  const task = store.addTask({ title: 'Nộp', task_date: '2026-11-11', project_id: project });
  store.setStatus(store.projectTasks(project)[0], 'done');
  assert.equal(row(store, '2026-11-11').is_completed, true);
  assert.equal(store.todo('today', '2026-11-11')[0].is_completed, true);
  store.updateTask(task.id, { task_date: '2026-11-12', status: 'doing' });
  assert.equal(store.occurrences('2026-11-11', '2026-11-11').length, 0);
  assert.equal(store.projectTasks(project)[0].task_date, '2026-11-12');
  assert.equal(row(store, '2026-11-12').status, 'doing');
});

test('today, upcoming and overdue have correct boundaries and completed exclusions', () => {
  const { store } = setup();
  for (const date of ['2026-11-10','2026-11-11','2026-11-12','2026-11-18','2026-11-19']) store.addTask({ title: date, task_date: date });
  store.addTask({ title: 'Finished yesterday', task_date: '2026-11-10', status: 'done' });
  assert.equal(store.todo('today', '2026-11-11').length, 1);
  assert.deepEqual(store.todo('upcoming', '2026-11-11').map(t => t.task_date), ['2026-11-12','2026-11-18']);
  assert.equal(store.todo('overdue', '2026-11-11').length, 1);
});

test('importance, priority, notes and checklist persist across reloads', () => {
  const { storage, store } = setup();
  const task = store.addTask({ title: 'Important', task_date: '2027-12-31', priority: 'urgent', description: 'https://example.com\nGhi chú', checklist: [{ id: 'c', text: 'Bước 1', is_completed: false }] });
  store.setImportant(task, true); store.setChecklistItem(store.state.tasks[0], 'c', true);
  const loaded = P.createStore(storage), saved = loaded.state.tasks[0];
  assert.equal(saved.is_important, true); assert.equal(saved.priority, 'urgent');
  assert.equal(saved.checklist[0].is_completed, true); assert.equal(saved.description, task.description);
  assert.equal(loaded.todo('important', '2026-11-11').length, 1);
});

test('daily repeat intervals and end date include each independent occurrence', () => {
  const { store } = setup(); recurring(store, { recurrence: { frequency: 'daily', interval: 2, until: '2026-11-15' } });
  assert.deepEqual(store.occurrences('2026-11-10','2026-11-20').map(t => t.task_date), ['2026-11-11','2026-11-13','2026-11-15']);
});

test('weekly weekdays and multiweek intervals work across year boundaries', () => {
  const { store } = setup();
  recurring(store, { task_date: '2026-12-30', recurrence: { frequency: 'weekly', interval: 2, weekdays: [1,3,5] } });
  assert.deepEqual(store.occurrences('2026-12-28','2027-01-15').map(t => t.task_date), ['2026-12-30','2027-01-01','2027-01-11','2027-01-13','2027-01-15']);
});

test('weekly repeat does not invent an occurrence on an unselected start weekday', () => {
  const { store } = setup(); recurring(store, { recurrence: { frequency: 'weekly', weekdays: [1,5] } });
  assert.deepEqual(store.occurrences('2026-11-11','2026-11-16').map(t => t.task_date), ['2026-11-13','2026-11-16']);
});

test('monthly end-of-month repeat preserves original anchor and handles leap years', () => {
  const { store } = setup(); recurring(store, { task_date: '2028-01-31', recurrence: { frequency: 'monthly', until: '2028-04-30' } });
  assert.deepEqual(store.occurrences('2028-01-01','2028-05-01').map(t => t.task_date), ['2028-01-31','2028-02-29','2028-03-31','2028-04-30']);
});

test('repeat completion, checklist and notes affect one occurrence and survive reload', () => {
  const { store, storage } = setup(); recurring(store, { checklist: [{ id: 'c', text: 'Study' }] });
  store.setStatus(row(store,'2026-11-11'), 'done');
  store.setChecklistItem(row(store,'2026-11-11'), 'c', true);
  store.updateTask(row(store,'2026-11-11').id, { description: 'Only today' }, { date: '2026-11-11' });
  const loaded = P.createStore(storage);
  assert.equal(row(loaded,'2026-11-11').is_completed, true);
  assert.equal(row(loaded,'2026-11-11').checklist[0].is_completed, true);
  assert.equal(row(loaded,'2026-11-12').is_completed, false);
  assert.equal(row(loaded,'2026-11-12').checklist[0].is_completed, false);
  assert.equal(row(loaded,'2026-11-12').description, '');
});

test('rescheduling and deleting one repeat never changes other occurrences', () => {
  const { store } = setup(); const task = recurring(store);
  store.updateTask(task.id, { task_date: '2026-12-01' }, { date: '2026-11-11' });
  assert.equal(store.occurrences('2026-11-11','2026-11-11').length, 0);
  assert.equal(store.occurrences('2026-12-01','2026-12-01').length, 2);
  assert.equal(row(store,'2026-11-12').task_date, '2026-11-12');
  store.removeTask(task.id,'2026-11-12');
  assert.equal(store.occurrences('2026-11-12','2026-11-12').length, 0);
  assert.equal(store.occurrences('2026-11-13','2026-11-13').length, 1);
  assert.throws(() => store.updateTask(task.id,{task_date:''},{date:'2026-11-13'}));
});

test('series edit changes shared details but preserves historical completion and checklist', () => {
  const { store } = setup(); const task = recurring(store, { checklist: [{ id: 'c', text: 'Old' }] });
  store.setStatus(row(store,'2026-11-11'),'done'); store.setChecklistItem(row(store,'2026-11-11'),'c',true);
  store.updateTask(task.id, { title:'New', checklist:[{id:'c',text:'Updated'},{id:'d',text:'Extra'}], recurrence:{frequency:'weekly',weekdays:[5]}, status:'done' }, {scope:'series',date:'2026-11-11'});
  assert.equal(row(store,'2026-11-11').is_completed,true);
  assert.equal(row(store,'2026-11-11').checklist[0].is_completed,true);
  assert.equal(row(store,'2026-11-11').checklist[1].is_completed,false);
  assert.equal(row(store,'2026-11-13').title,'New');
  assert.equal(row(store,'2026-11-13').is_completed,false);
});

test('removing a project keeps all tasks and does not recreate default projects', () => {
  const { store, storage } = setup(); const p = store.saveProject('Test');
  store.addTask({title:'Keep',project_id:p}); recurring(store,{project_id:p});
  store.removeProject(p);
  const loaded=P.createStore(storage);
  assert.equal(loaded.state.projects.length,0); assert.equal(loaded.state.tasks.length,2);
  assert.ok(loaded.state.tasks.every(t=>!t.project_id));
});

test('invalid repeat schedules fail before persistence', () => {
  const { store }=setup();
  for(const values of [{task_date:''},{recurrence:{frequency:'daily',interval:0}},{recurrence:{frequency:'daily',interval:1.5}},{recurrence:{frequency:'daily',until:'2026-01-01'}}]) assert.throws(()=>recurring(store,values));
  assert.equal(store.state.tasks.length,0);
});

test('board chooses the earliest pending date after rescheduling an older occurrence', () => {
  const {store}=setup();const project=store.saveProject('Test');
  const task=recurring(store,{project_id:project,recurrence:{frequency:'daily',until:'2026-11-14'}});
  store.setStatus(row(store,'2026-11-11'),'done');
  store.updateTask(task.id,{task_date:'2026-11-16'},{date:'2026-11-12'});
  assert.equal(store.projectTasks(project,'2026-11-11')[0].task_date,'2026-11-13');
  store.removeTask(task.id,'2026-11-13');
  assert.equal(store.projectTasks(project,'2026-11-11')[0].task_date,'2026-11-14');
});

test('reminder time persists and can differ for one recurring occurrence', () => {
  const { store, storage } = setup();
  const task = recurring(store, { time: '14:00', remind_before: 15 });
  assert.equal(row(store, '2026-11-11').remind_before, 15);
  store.updateTask(task.id, { remind_before: 5 }, { date: '2026-11-12' });
  const loaded = P.createStore(storage);
  assert.equal(row(loaded, '2026-11-11').remind_before, 15);
  assert.equal(row(loaded, '2026-11-12').remind_before, 5);
  assert.equal(row(loaded, '2026-11-13').remind_before, 15);
  assert.equal(P.normalizeTask({ title: 'Old task' }).remind_before, null);
});
