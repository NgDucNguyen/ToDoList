const { test } = require('node:test');
const assert = require('node:assert/strict');
const N = require('../notes-store');
const R = require('../notes-richtext');
class MemoryStorage {
  constructor() { this.data = new Map(); this.failKey = ''; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { if (key === this.failKey) throw new Error('Storage unavailable'); this.data.set(key, String(value)); }
}

test('checklist persists independent checked state and bold, exports status, and backs up rich notes once', () => {
  const storage = new MemoryStorage(), store = N.createStore(storage), note = store.create({ body: 'Bản gốc' });
  store.update(note.id, 'Kế hoạch', 'Bản gốc', R.fromPlain('Bản gốc'));
  const before = storage.getItem(N.KEY);
  const content = { version: 1, blocks: [
    { type: 'h1', runs: [{ text: 'Hôm nay', bold: false }] },
    { type: 'check', checked: false, runs: [{ text: 'Đọc sách', bold: true }] },
    { type: 'check', checked: true, runs: [{ text: 'Nộp bài', bold: false }] },
  ] };
  storage.failKey = N.CHECKLIST_BACKUP_KEY;
  assert.throws(() => store.update(note.id, 'Kế hoạch', R.toPlain(content), content));
  assert.equal(storage.getItem(N.KEY), before); assert.equal(store.notes[0].body, 'Bản gốc');
  storage.failKey = ''; store.update(note.id, 'Kế hoạch', R.toPlain(content), content);
  assert.equal(storage.getItem(N.CHECKLIST_BACKUP_KEY), before);
  assert.equal(N.createStore(storage).notes[0].body, 'Hôm nay\n[ ] Đọc sách\n[x] Nộp bài');
  assert.deepEqual(N.createStore(storage).notes[0].content, content);
  content.blocks[1].checked = true;
  store.update(note.id, 'Kế hoạch', R.toPlain(content), content);
  assert.equal(storage.getItem(N.CHECKLIST_BACKUP_KEY), before);
  assert.throws(() => R.normalize({version: 1, blocks: [{type: 'check', checked: 'true', runs: []}]}));
});
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

test('rich notes round-trip headings and bold while keeping exact searchable plain text', () => {
  const storage = new MemoryStorage(), store = N.createStore(storage), note = store.create();
  const content = { version: 1, blocks: [
    { type: 'h1', runs: [{ text: 'Kế hoạch', bold: false }] },
    { type: 'h2', runs: [{ text: 'Mục tiêu', bold: false, normal: true }] },
    { type: 'h3', runs: [{ text: 'Công việc', bold: false }] },
    { type: 'p', runs: [{ text: '  Đọc ', bold: false }, { text: 'tài liệu', bold: true }, { text: '\t  ', bold: false }] },
    { type: 'p', runs: [] },
  ] };
  const body = R.toPlain(content), before = storage.getItem(N.KEY);
  store.update(note.id, 'Ý tưởng', body, content);
  assert.equal(storage.getItem(N.RICH_BACKUP_KEY), before);
  const restored = N.createStore(storage).notes[0];
  assert.equal(restored.body, 'Kế hoạch\nMục tiêu\nCông việc\n  Đọc tài liệu\t  \n');
  assert.deepEqual(restored.content, R.normalize(content));
  store.update(note.id, 'Đổi tên', body); assert.deepEqual(store.notes[0].content, restored.content);
  assert.equal(storage.getItem(N.RICH_BACKUP_KEY), before);
});

test('first rich save requires an exact legacy backup and failed writes preserve legacy data', () => {
  const storage = new MemoryStorage(), store = N.createStore(storage), note = store.create({ title: 'Cũ', body: 'Giữ nguyên' });
  const raw = storage.getItem(N.KEY), document = R.fromPlain('Nội dung mới'); document.blocks[0].runs[0].bold = true;
  storage.failKey = N.RICH_BACKUP_KEY;
  assert.throws(() => store.update(note.id, 'Mới', 'Nội dung mới', document)); assert.equal(storage.getItem(N.KEY), raw);
  storage.failKey = N.KEY;
  assert.throws(() => store.update(note.id, 'Mới', 'Nội dung mới', document)); assert.equal(storage.getItem(N.KEY), raw);
  assert.equal(store.notes[0].body, 'Giữ nguyên');
  storage.failKey = ''; store.update(note.id, 'Mới', 'Nội dung mới', document);
  assert.equal(storage.getItem(N.RICH_BACKUP_KEY), raw);
});

test('invalid structured data is never rendered or silently reset', () => {
  const storage = new MemoryStorage(), store = N.createStore(storage), note = store.create();
  assert.throws(() => store.update(note.id, 'X', 'Mismatch', R.fromPlain('Other')));
  assert.throws(() => store.update(note.id, 'X', 'Script', { version: 1, blocks: [{ type: 'script', runs: [{ text: 'Script', bold: false }] }] }));
  const raw = JSON.stringify({ version: 1, notes: [{ id: 'a', title: 'Giữ', body: 'A', content: { version: 99, blocks: [] } }] });
  storage.setItem(N.KEY, raw); assert.throws(() => N.createStore(storage)); assert.equal(storage.getItem(N.KEY), raw);
  const plain = '  <script>text</script>\n\tTiếng Việt\n'; assert.equal(R.toPlain(R.fromPlain(plain)), plain);
});
