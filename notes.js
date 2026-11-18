(function () {
  'use strict';
  window.PlannerNotes = {
    init({ notice, confirmDelete }) {
      const $ = id => document.getElementById(id);
      let store, selected = '', dirty = false, timer;
      const status = (message, error = false) => { $('note-save-status').textContent = message; $('note-save-status').classList.toggle('error', error); };
      try { store = PlannerNotesStore.createStore(localStorage); }
      catch (error) {
        status(error.message, true);
        ['new-note-btn', 'save-note-btn', 'note-title-input', 'note-body-input', 'delete-note-btn', 'export-note-btn'].forEach(id => { $(id).disabled = true; });
        $('notes-list').textContent = 'Chưa thể mở ghi chú đã lưu.';
        return;
      }
      function label(note) { return note.title.trim() || 'Ghi chú chưa có tên'; }
      function updateCount() {
        const body = $('note-body-input').value;
        $('note-character-count').textContent = `${body.length.toLocaleString('vi-VN')} ký tự · ${body.split('\n').length} dòng`;
      }
      function renderList() {
        const query = $('notes-search-input').value.trim().toLocaleLowerCase('vi-VN');
        const notes = store.notes.filter(note => `${note.title}\n${note.body}`.toLocaleLowerCase('vi-VN').includes(query));
        $('notes-count').textContent = String(store.notes.length);
        const rows = notes.map(note => {
          const button = document.createElement('button'); button.type = 'button';
          button.className = `note-list-item${note.id === selected ? ' active' : ''}`;
          button.dataset.noteId = note.id; button.setAttribute('aria-pressed', String(note.id === selected));
          const title = document.createElement('strong'), preview = document.createElement('span'), time = document.createElement('small');
          title.textContent = label(note); preview.textContent = note.body.replace(/\s+/g, ' ').trim().slice(0, 100) || 'Chưa có nội dung';
          const updated = new Date(note.updated_at); time.textContent = Number.isNaN(updated.getTime()) ? '' : updated.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
          button.append(title, preview, time); button.addEventListener('click', () => { if (flush()) select(note.id); }); return button;
        });
        $('notes-list').replaceChildren(...rows);
        if (!rows.length) { const empty = document.createElement('p'); empty.className = 'notes-list-empty'; empty.textContent = query ? 'Không có ghi chú phù hợp.' : 'Bấm “Ghi chú mới” để bắt đầu.'; $('notes-list').append(empty); }
      }
      function select(noteId) {
        const note = store.notes.find(note => note.id === noteId);
        selected = note?.id || ''; dirty = false;
        $('note-title-input').value = note?.title || ''; $('note-body-input').value = note?.body || '';
        ['save-note-btn', 'note-title-input', 'note-body-input', 'delete-note-btn', 'export-note-btn'].forEach(id => { $(id).disabled = !note; });
        $('note-body-input').scrollTop = 0;
        status(note ? 'Đã lưu trên máy' : 'Chọn hoặc tạo một ghi chú.');
        updateCount(); renderList();
      }
      function flush() {
        clearTimeout(timer);
        if (!dirty || !selected) return true;
        try {
          store.update(selected, $('note-title-input').value, $('note-body-input').value);
          dirty = false; status('Đã lưu trên máy'); renderList(); return true;
        } catch (error) {
          status(error.name === 'QuotaExceededError' ? 'Bộ nhớ đã đầy. Nội dung chưa lưu; hãy xuất TXT để giữ bản đang sửa.' : error.message, true);
          return false;
        }
      }
      function edit() {
        if (!selected) return;
        dirty = true; status('Đang lưu…'); updateCount(); clearTimeout(timer); timer = setTimeout(flush, 250);
      }
      $('note-title-input').addEventListener('input', edit); $('note-body-input').addEventListener('input', edit);
      $('new-note-btn').addEventListener('click', () => {
        if (!flush()) return;
        try { const note = store.create(); $('notes-search-input').value = ''; select(note.id); $('note-title-input').focus(); }
        catch (error) { status(error.name === 'QuotaExceededError' ? 'Bộ nhớ đã đầy. Chưa tạo được ghi chú.' : error.message, true); }
      });
      $('notes-search-input').addEventListener('input', () => { if (flush()) renderList(); });
      $('save-note-btn').addEventListener('click', flush);
      $('delete-note-btn').addEventListener('click', () => {
        if (!selected || !flush()) return;
        const note = store.notes.find(note => note.id === selected);
        confirmDelete(`Xóa ghi chú “${label(note)}”? Bản trước khi xóa sẽ được lưu dự phòng.`, () => {
          store.remove(note.id); select(store.notes[0]?.id); notice('Đã xóa ghi chú và giữ bản dự phòng.');
        });
      });
      $('export-note-btn').addEventListener('click', () => {
        if (!selected) return;
        const filename = ($('note-title-input').value.trim() || 'Ghi chú').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100).replace(/[. ]+$/g, '') || 'Ghi chú';
        const url = URL.createObjectURL(new Blob([$('note-body-input').value], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = filename + '.txt'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      $('notes-view').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); flush(); } });
      window.addEventListener('beforeunload', event => { if (!flush()) { event.preventDefault(); event.returnValue = ''; } });
      document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
      window.PlannerNotes.flush = flush;
      select(store.notes[0]?.id);
    },
  };
})();
