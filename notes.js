(function () {
  'use strict';
  window.PlannerNotes = {
    init({ notice, confirmDelete }) {
      const $ = id => document.getElementById(id);
      const editor = $('note-body-input'), rich = PlannerRichText;
      let store, selected = '', dirty = false, timer, savedRange = null;
      const readContent = () => rich.serialize(editor);
      const readBody = () => rich.toPlain(readContent());
      const status = (message, error = false) => { $('note-save-status').textContent = message; $('note-save-status').classList.toggle('error', error); };
      try { store = PlannerNotesStore.createStore(localStorage); }
      catch (error) {
        status(error.message, true);
        ['new-note-btn', 'save-note-btn', 'note-title-input', 'note-block-format', 'note-bold-btn', 'note-checklist-btn', 'delete-note-btn', 'export-note-btn'].forEach(id => { $(id).disabled = true; });
        $('notes-list').textContent = 'Chưa thể mở ghi chú đã lưu.';
        return;
      }
      function label(note) { return note.title.trim() || 'Ghi chú chưa có tên'; }
      function updateCount() {
        const body = readBody();
        editor.dataset.empty = String(!body);
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
        selected = note?.id || ''; dirty = false; savedRange = null;
        $('note-title-input').value = note?.title || '';
        rich.render(editor, note?.content || rich.fromPlain(note?.body || ''));
        ['save-note-btn', 'note-title-input', 'note-block-format', 'note-bold-btn', 'note-checklist-btn', 'delete-note-btn', 'export-note-btn'].forEach(id => { $(id).disabled = !note; });
        editor.contentEditable = String(Boolean(note)); editor.setAttribute('aria-disabled', String(!note)); editor.tabIndex = note ? 0 : -1;
        editor.scrollTop = 0; $('note-block-format').value = 'p'; $('note-bold-btn').setAttribute('aria-pressed', 'false');
        $('note-checklist-btn').setAttribute('aria-pressed', 'false');
        status(note ? 'Đã lưu trên máy' : 'Chọn hoặc tạo một ghi chú.');
        updateCount(); renderList();
      }
      function flush() {
        clearTimeout(timer);
        if (!dirty || !selected) return true;
        try {
          const content = readContent();
          store.update(selected, $('note-title-input').value, rich.toPlain(content), content);
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
      function insideEditor(range) { return editor.contains(range.startContainer) && editor.contains(range.endContainer); }
      function updateFormatting() {
        if (!selected) return;
        const selection = window.getSelection();
        if (!selection.rangeCount || !insideEditor(selection.getRangeAt(0))) return;
        savedRange = selection.getRangeAt(0).cloneRange();
        let node = selection.anchorNode;
        if (node?.nodeType === 3) node = node.parentElement;
        const heading = node?.closest?.('h1,h2,h3');
        $('note-block-format').value = heading && editor.contains(heading) ? heading.tagName.toLowerCase() : 'p';
        $('note-bold-btn').setAttribute('aria-pressed', String(document.queryCommandState('bold')));
        $('note-checklist-btn').setAttribute('aria-pressed', String(Boolean(node?.closest?.('[data-note-check]'))));
      }
      function restoreSelection() {
        editor.focus();
        const selection = window.getSelection();
        const range = savedRange && insideEditor(savedRange) ? savedRange : document.createRange();
        if (range !== savedRange) { range.selectNodeContents(editor.lastElementChild || editor); range.collapse(false); }
        selection.removeAllRanges(); selection.addRange(range);
      }
      function format(command, value) {
        if (!selected) return;
        restoreSelection();
        if (command === 'formatBlock' && selectedBlocks().some(block => block.hasAttribute('data-note-check'))) toggleChecklist(false);
        document.execCommand('styleWithCSS', false, false);
        document.execCommand(command, false, value);
        updateFormatting(); edit();
      }
      document.execCommand('defaultParagraphSeparator', false, 'p');
      document.addEventListener('selectionchange', updateFormatting);
      $('note-bold-btn').addEventListener('mousedown', event => event.preventDefault());
      $('note-bold-btn').addEventListener('click', () => format('bold'));
      function selectedBlocks() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return [];
        const range = selection.getRangeAt(0);
        if (!insideEditor(range)) return [];
        return Array.from(editor.children).filter(block => {
          if (range.collapsed) return block.contains(range.startContainer);
          const span = document.createRange(); span.selectNodeContents(block);
          return range.compareBoundaryPoints(Range.END_TO_START, span) < 0 && range.compareBoundaryPoints(Range.START_TO_END, span) > 0;
        });
      }
      function caretIn(target, atStart = false) {
        const range = document.createRange(); range.selectNodeContents(target); range.collapse(atStart);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); updateFormatting();
      }
      function checkRow(fragment, checked = false) {
        const holder = document.createElement('div');
        rich.render(holder, { version: 1, blocks: [{ type: 'check', checked, runs: [] }] });
        const row = holder.firstChild, text = row.querySelector('[data-check-text]');
        if (fragment?.childNodes.length) text.replaceChildren(fragment);
        return row;
      }
      function toggleChecklist(force) {
        if (!selected) return;
        restoreSelection();
        let blocks = selectedBlocks();
        if (!blocks.length) { const p = document.createElement('p'); p.append(document.createElement('br')); editor.append(p); blocks = [p]; }
        const enable = force ?? !blocks.every(block => block.hasAttribute('data-note-check'));
        let target;
        for (const block of blocks) {
          if (enable === block.hasAttribute('data-note-check')) { target = block.querySelector('[data-check-text]') || block; continue; }
          const source = block.querySelector('[data-check-text]') || block;
          const fragment = document.createDocumentFragment(); fragment.append(...source.childNodes);
          const replacement = enable ? checkRow(fragment) : document.createElement('p');
          if (!enable) replacement.append(fragment);
          block.replaceWith(replacement); target = replacement.querySelector('[data-check-text]') || replacement;
        }
        caretIn(target); edit();
      }
      $('note-checklist-btn').addEventListener('mousedown', event => event.preventDefault());
      $('note-checklist-btn').addEventListener('click', () => toggleChecklist());
      editor.addEventListener('change', event => {
        if (!event.target.matches('[data-note-check] > input[type="checkbox"]')) return;
        event.target.parentElement.dataset.checked = String(event.target.checked); edit();
      });
      $('note-block-format').addEventListener('change', event => format('formatBlock', event.target.value));
      editor.addEventListener('keydown', event => {
        if (['Backspace', 'Delete'].includes(event.key) && !event.isComposing) {
          const selection = window.getSelection(), range = selection.rangeCount && selection.getRangeAt(0);
          const block = range && selectedBlocks()[0];
          if (range?.collapsed && block && (block.querySelector('[data-check-text]') || block).contains(range.startContainer)) {
            const text = block.querySelector('[data-check-text]') || block;
            const before = document.createRange(); before.selectNodeContents(text); before.setEnd(range.startContainer, range.startOffset);
            const after = document.createRange(); after.selectNodeContents(text); after.setStart(range.startContainer, range.startOffset);
            if (event.key === 'Backspace' && !before.toString() && block.hasAttribute('data-note-check')) {
              event.preventDefault(); const index = Array.from(editor.children).indexOf(block); toggleChecklist(false); caretIn(editor.children[index], true); return;
            }
            const previous = block.previousElementSibling, next = block.nextElementSibling;
            const mergePrevious = event.key === 'Backspace' && !before.toString() && previous?.hasAttribute('data-note-check');
            const mergeNext = event.key === 'Delete' && !after.toString() && (block.hasAttribute('data-note-check') || next?.hasAttribute('data-note-check')) && next;
            if (mergePrevious || mergeNext) {
              event.preventDefault();
              const left = mergePrevious ? previous : block, right = mergePrevious ? block : next;
              const target = left.querySelector('[data-check-text]') || left, source = right.querySelector('[data-check-text]') || right;
              if (!target.textContent) target.replaceChildren();
              const caret = document.createRange(); caret.selectNodeContents(target); caret.collapse(false);
              if (source.textContent) target.append(...source.childNodes);
              right.remove(); if (!target.childNodes.length) target.append(document.createElement('br'));
              selection.removeAllRanges(); selection.addRange(caret); updateFormatting(); edit(); return;
            }
          }
        }
        if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'b') { event.preventDefault(); updateFormatting(); format('bold'); }
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          const selection = window.getSelection();
          const anchor = selection.anchorNode?.nodeType === 3 ? selection.anchorNode.parentElement : selection.anchorNode;
          const row = anchor?.closest?.('[data-note-check]');
          if (row && editor.contains(row)) {
            event.preventDefault();
            const text = row.querySelector('[data-check-text]'), range = selection.getRangeAt(0);
            if (!text.textContent.trim()) {
              const p = document.createElement('p'); p.append(document.createElement('br')); row.replaceWith(p); caretIn(p, true);
            } else if (text.contains(range.startContainer) && text.contains(range.endContainer)) {
              range.deleteContents();
              const tail = document.createRange(); tail.selectNodeContents(text); tail.setStart(range.startContainer, range.startOffset);
              const next = checkRow(tail.extractContents()); row.after(next);
              if (!text.childNodes.length) text.append(document.createElement('br'));
              caretIn(next.querySelector('[data-check-text]'), true);
            }
            edit(); return;
          }
          if (anchor?.closest?.('h1,h2,h3') && editor.contains(anchor)) {
            event.preventDefault(); document.execCommand('insertParagraph'); document.execCommand('formatBlock', false, 'p'); updateFormatting(); edit();
          }
        }
        // Only the formats offered by this editor are persisted.
        if ((event.ctrlKey || event.metaKey) && ['i', 'u'].includes(event.key.toLowerCase())) event.preventDefault();
      });
      editor.addEventListener('paste', event => {
        event.preventDefault();
        const text = event.clipboardData?.getData('text/plain');
        if (text && selected) { document.execCommand('insertText', false, text); updateFormatting(); edit(); }
      });
      editor.addEventListener('drop', event => event.preventDefault());
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
        const url = URL.createObjectURL(new Blob([readBody()], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = filename + '.txt'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      $('notes-view').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); flush(); } });
      window.addEventListener('beforeunload', event => { if (!flush()) { event.preventDefault(); event.returnValue = ''; } });
      document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
      window.PlannerNotes.flush = flush;
      window.PlannerNotes.listForChat = () => {
        if (!flush()) throw new Error('Ghi chú đang sửa chưa lưu được. Hãy lưu hoặc xuất TXT trước.');
        return store.notes;
      };
      window.PlannerNotes.createFromChat = (title, body) => {
        if (!flush()) throw new Error('Ghi chú đang sửa chưa lưu được. Hãy lưu hoặc xuất TXT trước.');
        const note = store.create({ title, body });
        $('notes-search-input').value = ''; select(note.id);
        return note;
      };
      select(store.notes[0]?.id);
    },
  };
})();
