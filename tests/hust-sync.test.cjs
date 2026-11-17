const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const P = require('../planner-store');
const { readHustTimetable } = require('../hust-extractor');
class MemoryStorage {
  constructor() { this.data = new Map(); this.failKey = ''; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { if (key === this.failKey) throw new Error('Simulated storage failure'); this.data.set(key, String(value)); }
}
const event = (uid = 'class:slot:2026-11-18', patch = {}) => ({ uid, title: 'Môn kiểm thử', classId: '123456', courseId: 'IT0000', classType: 'LT', date: '2026-11-18', originalDate: '2026-11-18', time: '06:45', endTime: '10:05', room: 'D9-101', ...patch });
const snapshot = (events = [event()], patch = {}) => ({ account: 'a'.repeat(24), term: '20261', complete: true, classes: 1, events, unscheduled: [], ...patch });
const setup = () => { const storage = new MemoryStorage(); return { storage, store: P.createStore(storage) }; };

test('preview is read-only, initial sync backs up and repeated sync is idempotent', () => {
  const { storage, store } = setup(); const raw = storage.getItem(P.DATA_KEY);
  assert.equal(store.previewHustSync(snapshot()).added, 1);
  assert.equal(storage.getItem(P.DATA_KEY), raw);
  assert.equal(store.applyHustSync(snapshot()).added, 1);
  assert.equal(storage.getItem('planner_backup_before_hust'), raw);
  const id = store.state.tasks[0].id;
  assert.equal(store.applyHustSync(snapshot()).added, 0);
  assert.equal(store.state.tasks.length, 1); assert.equal(store.state.tasks[0].id, id);
  assert.equal(store.state.tasks[0].calendar_id, 'hust'); assert.equal(store.state.tasks[0].project_id, '');
  assert.equal(store.state.projects.length, 0, 'Sync must not create a HUST project.');
});

test('migrates old HUST projects into the separate calendar with an exact backup', () => {
  const { storage, store } = setup();
  const regularProject = store.saveProject('Lịch học HUST · tên tự đặt');
  const old = store.state;
  old.projects.push({ id: 'old-hust', name: 'Lịch học HUST · 20261', source: { provider: 'hust', account: 'a'.repeat(24), term: '20261' } });
  old.tasks.push(P.normalizeTask({ id: 'imported', title: 'Môn học', project_id: 'old-hust', task_date: '2026-11-18', source: { provider: 'hust', uid: 'u' }, status: 'done', description: 'Giữ ghi chú', checklist: [{ id: 'c', text: 'Ôn tập', is_completed: true }] }));
  old.tasks.push(P.normalizeTask({ id: 'manual-makeup', title: 'Buổi học bù tự thêm', project_id: 'old-hust', task_date: '2026-11-21' }));
  old.tasks.push(P.normalizeTask({ id: 'personal', title: 'Việc cá nhân', project_id: regularProject }));
  const raw = JSON.stringify(old); storage.setItem(P.DATA_KEY, raw);
  const migrated = P.createStore(storage);
  assert.equal(storage.getItem('planner_backup_before_hust_calendar'), raw);
  assert.equal(migrated.state.projects.length, 1); assert.equal(migrated.state.projects[0].id, regularProject);
  for (const task of migrated.state.tasks.filter(task => task.id !== 'personal')) { assert.equal(P.taskCalendar(task), 'hust'); assert.equal(task.project_id, ''); }
  const imported = migrated.state.tasks.find(task => task.id === 'imported');
  assert.equal(imported.status, 'done'); assert.equal(imported.description, 'Giữ ghi chú'); assert(imported.checklist[0].is_completed);
  assert.equal(P.taskCalendar(migrated.state.tasks.find(task => task.id === 'personal')), 'personal');
  const migratedRaw = storage.getItem(P.DATA_KEY); P.createStore(storage);
  assert.equal(storage.getItem(P.DATA_KEY), migratedRaw, 'Migration must run only once.');
});

test('failed calendar migration backup or commit leaves original tasks and projects untouched', () => {
  for (const failKey of ['planner_backup_before_hust_calendar', P.DATA_KEY]) {
    const { storage, store } = setup();
    const old = store.state; old.projects.push({ id: 'old', name: 'HUST', source: { provider: 'hust' } });
    old.tasks.push(P.normalizeTask({ title: 'Buổi học', project_id: 'old' }));
    const raw = JSON.stringify(old); storage.setItem(P.DATA_KEY, raw); storage.failKey = failKey;
    assert.throws(() => P.createStore(storage)); assert.equal(storage.getItem(P.DATA_KEY), raw);
  }
});
test('rescheduled lessons keep identity, completion, checklist, notes and manual fields', () => {
  const { store } = setup(); store.applyHustSync(snapshot());
  const task = store.state.tasks[0];
  store.updateTask(task.id, { status: 'done', description: 'Ghi chú cá nhân', title: 'Tên riêng', checklist: [{ id: 'step', text: 'Ôn tập', is_completed: true }] });
  const result = store.applyHustSync(snapshot([event(undefined, { title: 'Tên HUST mới', date: '2026-11-21', time: '08:25', endTime: '11:45', room: 'D5-404', changed: true })]));
  const after = store.state.tasks[0];
  assert.equal(after.id, task.id); assert.equal(after.title, 'Tên riêng');
  assert.equal(after.task_date, '2026-11-21'); assert.equal(after.location, 'D5-404');
  assert.equal(after.status, 'done'); assert.equal(after.description, 'Ghi chú cá nhân');
  assert.equal(after.checklist[0].is_completed, true); assert.equal(result.conflicts.length, 1);
});
test('missing lessons are archived without deleting tasks, and can be restored', () => {
  const { store } = setup(); store.applyHustSync(snapshot([event('a'), event('b')]));
  const manual = store.addTask({ title: 'Việc tự tạo', task_date: '2026-11-18', is_important: true });
  const imported = store.state.tasks.find(task => task.source?.uid === 'b');
  store.setImportant(imported, true);
  assert.equal(store.applyHustSync(snapshot([event('a')])).archived, 1);
  assert.equal(store.state.tasks.length, 3);
  assert.equal(store.todo('today', '2026-11-18').length, 2);
  assert(!store.todo('important', '2026-11-18').some(task => task.id === imported.id));
  assert(store.state.tasks.find(task => task.id === manual.id));
  assert.equal(store.applyHustSync(snapshot([event('a'), event('b')])).restored, 1);
  assert.equal(store.state.tasks.find(task => task.source?.uid === 'b').id, imported.id);
});
test('other accounts and semesters never archive each other', () => {
  const { store } = setup(); store.applyHustSync(snapshot());
  store.applyHustSync(snapshot([event('other')], { account: 'b'.repeat(24) }));
  store.applyHustSync(snapshot([event('next')], { term: '20262' }));
  assert.equal(store.state.tasks.length, 3); assert(store.state.tasks.every(task => !task.source.cancelled));
});
test('invalid, empty, partial, duplicate or malformed time data leaves persisted data untouched', () => {
  const { storage, store } = setup(); store.applyHustSync(snapshot()); const raw = storage.getItem(P.DATA_KEY);
  for (const invalid of [snapshot([]), snapshot(undefined, { complete: false }), snapshot([event('a'), event('a')]), snapshot([event('a', { date: '2026-02-30' })]), snapshot([event('a', { endTime: '05:00' })]), snapshot([event('a', { time: '25:00' })])]) {
    assert.throws(() => store.applyHustSync(invalid)); assert.equal(storage.getItem(P.DATA_KEY), raw);
  }
});
test('backup or commit failure never applies a partial import', () => {
  for (const key of ['planner_backup_before_hust', P.DATA_KEY]) {
    const { storage, store } = setup(); const before = store.state;
    storage.failKey = key; assert.throws(() => store.applyHustSync(snapshot())); assert.deepEqual(store.state, before);
  }
});
test('concurrent writes are rejected before the sync can overwrite another window', () => {
  const { storage, store } = setup(); const other = P.createStore(storage);
  other.addTask({ title: 'Cửa sổ khác' });
  assert.throws(() => store.applyHustSync(snapshot()), /cửa sổ khác/);
  assert.equal(P.createStore(storage).state.tasks[0].title, 'Cửa sổ khác');
});

function extractFixture({ notice = '', loggedIn = true, unsupported = false, timestampTime = false, strayMakeup = false } = {}) {
  const date = value => Date.parse(value + 'T00:00:00+07:00');
  const klass = { id: 99, classId: '123456', courseId: 'IT0000', courseName: 'Lớp thử', classType: 'LT' };
  const calendar = { id: 777, classId: 99, date: date('2026-11-18'), dayTime: 1, from: 1, to: 4 };
  const report = { id: 8, classId: '123456', classInfoId: 777, absentDateStr: '18-11-2026', absentFrom: 1, absentTo: 4, replacedDateStr: notice === 'cancelled' ? '' : notice === 'same-day' ? '18-11-2026' : '21-11-2026', replacedFrom: 3, replacedTo: 6 };
  const rows = [{ ...calendar, _class: klass }];
  if (strayMakeup) rows.push({ ...calendar, id: -1, date: date('2026-11-21'), _class: klass, _isReplaced: true });
  if (timestampTime) Object.assign(rows[0], { from: Date.parse('2026-11-18T06:45:00+07:00'), to: Date.parse('2026-11-18T10:05:00+07:00') });
  const notices = notice === 'malformed' ? [{ replacedDateStr: 'not a date', absentDate: Infinity }, null] : notice === 'duplicate' ? [report, { ...report }] : notice ? [report] : [];
  const state = { authState: { isLoggedIn: loggedIn, user: { id: 'private-id', token: 'DO NOT EXPORT' } }, semesterState: { isLoading: false, semesters: [{ semester: '20261', startDate: date('2026-08-31'), endDate: date('2027-01-17'), startWeek: 1 }] }, timetableState: { items: [{ ...klass, semester: '20261', _calendars: [calendar], _absentReport: notices }], mapSemesterLoaded: { 20261: true } } };
  const root = { '__reactContainer$test': { child: { memoizedProps: { value: { store: { getState: () => state } } } } } };
  const queue = []; queue.push = args => args[2](moduleId => {
    if (unsupported) throw new Error('Bundle changed');
    if (moduleId === 35870) return { mI: ({ absentReports }) => { assert.equal(absentReports.length, 0, 'Only the regular timetable may be converted.'); return rows; } };
    if (moduleId === 9822) return { Jq: (_client, side, period) => Number(period) > 1e11 ? new Date(Number(period)).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }) : side === 'from' ? (period === 1 ? '06:45' : '08:25') : (period === 4 ? '10:05' : '11:45') };
    throw new Error('Unexpected module');
  });
  return vm.runInNewContext(`(${readHustTimetable.toString()})()`, { location: { origin: 'https://qldt.hust.edu.vn', pathname: '/students/learn/timetable' }, document: { getElementById: () => root }, window: { webpackChunk_N_E: queue }, Intl, Date, Set });
}
test('reader uses real dates/official time conversion and exports no auth tokens', () => {
  const result = extractFixture(); assert.equal(result.status, 'ready');
  assert.equal(result.events[0].date, '2026-11-18'); assert.equal(result.events[0].time, '06:45');
  assert(!JSON.stringify(result).includes('DO NOT EXPORT'));
});
test('reader ignores makeup, cancellation, same-day, duplicate and malformed notices', () => {
  const original = JSON.stringify(extractFixture().events);
  for (const notice of ['makeup', 'cancelled', 'same-day', 'duplicate', 'malformed']) {
    assert.equal(JSON.stringify(extractFixture({ notice }).events), original);
  }
});
test('reader fails closed when the session expires or portal bundle changes', () => {
  assert.equal(extractFixture({ loggedIn: false }).status, 'login');
  assert.equal(extractFixture({ unsupported: true }).status, 'unsupported');
});
test('reader excludes replacement rows even if the portal returns one without a notice', () => {
  const result = extractFixture({ strayMakeup: true });
  assert.equal(result.events.length, 1); assert.equal(result.events[0].changed, false);
});
test('reader supports period and timestamp times in the regular timetable', () => {
  const original = extractFixture().events[0];
  const regular = extractFixture({ timestampTime: true }).events[0];
  assert.equal(regular.uid, original.uid); assert.equal(regular.time, '06:45'); assert.equal(regular.endTime, '10:05');
});
test('regular sync preserves a manually added makeup lesson and its progress', () => {
  const { store } = setup();
  const manual = store.addTask({ title: 'Học bù tự thêm', task_date: '2026-11-21', time: '08:25', status: 'done', description: 'Ghi chú', tag: 'Study' });
  store.applyHustSync(snapshot()); store.applyHustSync(snapshot());
  assert.deepEqual(store.state.tasks.find(task => task.id === manual.id), manual);
  assert.equal(store.state.tasks.length, 2);
});
