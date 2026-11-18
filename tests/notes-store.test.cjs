const { test } = require('node:test');
const assert = require('node:assert/strict');
const N = require('../notes-store');
class MemoryStorage {
  constructor() { this.data = new Map(); this.failKey = ''; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { if (key === this.failKey) throw new Error('Storage unavailable'); this.data.set(key, String(value)); }
}
test('notes preserve Unicode, whitespace and multiple documents across reload without touching tasks', () => {
  const storage = new MemoryStorage(); storage.setItem('planner_data_v2', 'calendar data');
  const store = N.createStore(storage), first = store.create(), second = store.create();
  const body = '  Ghi chú tiếng Việt\n\n\t<img src=x>\nDòng cuối  ';
  store.update(first.id, 'Ý tưởng', body); store.update(second.id, 'Việc cần nhớ', 'Nội dung khác');
  const loaded = N.createStore(storage);
  assert.equal(loaded.notes.length, 2); assert.equal(loaded.notes.find(note => note.id === first.id).body, body);
  assert.equal(storage.getItem('planner_data_v2'), 'calendar data');
});
test('malformed, unsupported or duplicate note data is preserved and never reset', () => {
  for (const raw of ['{broken', JSON.stringify({ version: 99, notes: [] }), JSON.stringify({ version: 1, notes: [{id:'a',title:'A',body:'1'},{id:'a',title:'B',body:'2'}] })]) {
    const storage = new MemoryStorage(); storage.setItem(N.KEY, raw);
    assert.throws(() => N.createStore(storage)); assert.equal(storage.getItem(N.KEY), raw);
  }
});
test('failed note write keeps persisted and in-memory contents intact for retry', () => {
  const storage = new MemoryStorage(), store = N.createStore(storage), note = store.create();
  store.update(note.id, 'Tên', 'Bản đã lưu'); const raw = storage.getItem(N.KEY), before = store.notes;
  storage.failKey = N.KEY;
  assert.throws(() => store.update(note.id, 'Tên', 'Bản chưa lưu'));
  assert.equal(storage.getItem(N.KEY), raw); assert.deepEqual(store.notes, before);
  storage.failKey = ''; store.update(note.id, 'Tên', 'Bản chưa lưu');
  assert.equal(N.createStore(storage).notes[0].body, 'Bản chưa lưu');
});
test('stale note writes cannot overwrite changes saved by another window', () => {
  const storage = new MemoryStorage(), first = N.createStore(storage), note = first.create();
  const second = N.createStore(storage); second.update(note.id, 'Mới', 'Cửa sổ khác');
  assert.throws(() => first.update(note.id, 'Cũ', 'Nội dung cũ'), /cửa sổ khác/);
  assert.equal(N.createStore(storage).notes[0].body, 'Cửa sổ khác');
});
test('deletion backs up exact notes and is blocked if that backup cannot be written', () => {
  const storage = new MemoryStorage(), store = N.createStore(storage), first = store.create(), second = store.create();
  store.update(first.id, 'Cần giữ', 'Bản trước khi xóa'); const raw = storage.getItem(N.KEY);
  storage.failKey = N.BACKUP_KEY; assert.throws(() => store.remove(first.id)); assert.equal(storage.getItem(N.KEY), raw);
  storage.failKey = ''; store.remove(first.id);
  assert.equal(storage.getItem(N.BACKUP_KEY), raw); assert.deepEqual(store.notes.map(note => note.id), [second.id]);
});
