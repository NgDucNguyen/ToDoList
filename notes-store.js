/* Plain-text notes have their own storage, independent of tasks and calendars. */
(function (root, factory) {
  const api = factory();
  root.PlannerNotesStore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEY = 'planner_notes_v1', BACKUP_KEY = 'planner_notes_before_delete_v1';
  const copy = value => JSON.parse(JSON.stringify(value));
  function createStore(storage) {
    let raw = storage.getItem(KEY), state;
    try { state = raw === null ? { version: 1, notes: [] } : JSON.parse(raw); }
    catch { throw new Error('Không đọc được ghi chú đã lưu. Dữ liệu gốc được giữ nguyên.'); }
    const ids = new Set();
    if (!state || state.version !== 1 || !Array.isArray(state.notes) || state.notes.some(note => {
      if (!note || typeof note.id !== 'string' || !note.id || ids.has(note.id) || typeof note.title !== 'string' || typeof note.body !== 'string') return true;
      ids.add(note.id); return false;
    })) throw new Error('Định dạng ghi chú chưa được hỗ trợ. Dữ liệu gốc được giữ nguyên.');
    function commit(change, backup = false) {
      if (storage.getItem(KEY) !== raw) throw new Error('Ghi chú vừa thay đổi ở cửa sổ khác. Hãy xuất nội dung đang sửa ra TXT trước khi mở lại app.');
      const next = copy(state), result = change(next);
      if (backup && raw !== null) storage.setItem(BACKUP_KEY, raw);
      const nextRaw = JSON.stringify(next);
      storage.setItem(KEY, nextRaw); state = next; raw = nextRaw;
      return result;
    }
    function create() {
      const now = new Date().toISOString();
      const note = { id: globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`, title: '', body: '', created_at: now, updated_at: now };
      commit(next => next.notes.unshift(note)); return copy(note);
    }
    function update(noteId, title, body) {
      if (typeof title !== 'string' || typeof body !== 'string') throw new Error('Nội dung ghi chú không hợp lệ.');
      const current = state.notes.find(note => note.id === noteId);
      if (!current) throw new Error('Ghi chú không còn tồn tại.');
      if (current.title === title && current.body === body) return;
      commit(next => Object.assign(next.notes.find(note => note.id === noteId), { title, body, updated_at: new Date().toISOString() }));
    }
    function remove(noteId) {
      if (!state.notes.some(note => note.id === noteId)) throw new Error('Ghi chú không còn tồn tại.');
      commit(next => { next.notes = next.notes.filter(note => note.id !== noteId); }, true);
    }
    return { get notes() { return copy(state.notes); }, create, update, remove };
  }
  return { KEY, BACKUP_KEY, createStore };
});
