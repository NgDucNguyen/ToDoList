(function () {
  'use strict';
  window.PlannerHustUI = {
    init({ getStore, renderAll, notice }) {
      const $ = id => document.getElementById(id), dialog = $('hust-dialog');
      const KEY = 'planner_hust_settings_v1', PERIOD = 6 * 60 * 60 * 1000;
      const ipc = window.plannerDesktop?.hust;
      let snapshot = null, busy = false, settings = { auto: false, lastCheck: 0 };
      try {
        const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (saved && typeof saved === 'object') settings = { auto: saved.auto === true, lastCheck: Number(saved.lastCheck) || 0 };
      } catch { /* Invalid preferences never alter task data. */ }
      const status = (message, error = false) => { $('hust-status').textContent = message; $('hust-status').classList.toggle('error', error); };
      ipc?.onStatus?.(message => status(String(message), true));
      const saveSettings = () => localStorage.setItem(KEY, JSON.stringify(settings));
      const summaryText = summary => `${summary.added} thêm · ${summary.updated} cập nhật · ${summary.archived} buổi được ẩn · ${summary.unchanged} giữ nguyên`;
      function refreshControls() {
        ['hust-connect-btn', 'hust-read-btn', 'hust-disconnect-btn'].forEach(id => { $(id).disabled = busy || !ipc; });
        $('hust-apply-btn').disabled = busy || !snapshot || !ipc;
        $('hust-auto-sync').disabled = busy || !ipc || !getStore().state.hust_sync;
        $('hust-auto-sync').checked = settings.auto;
      }
      function preview(result) {
        const summary = getStore().previewHustSync(result);
        const events = [...result.events].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        const formatDate = date => date.split('-').reverse().join('/');
        snapshot = result;
        $('hust-preview').classList.remove('hidden');
        $('hust-preview-summary').textContent = `Học kỳ ${result.term} · ${result.classes} lớp · ${summary.total} buổi, từ ${formatDate(events[0].date)} đến ${formatDate(events[events.length - 1].date)}. ${summaryText(summary)}.`;
        const warnings = [];
        if (result.unscheduled?.length) warnings.push(`Chưa xếp ngày: ${result.unscheduled.map(item => `${item.title} (${item.classId})`).join('; ')}.`);
        if (summary.conflicts.length) warnings.push(`${summary.conflicts.length} trường bạn đã chỉnh riêng sẽ được giữ lại.`);
        if (summary.archived) warnings.push('Các buổi không còn trong lịch HUST sẽ được ẩn, dữ liệu gốc vẫn được lưu.');
        $('hust-preview-warnings').textContent = warnings.join(' ');
        const rows = events.map(event => {
          const row = document.createElement('tr');
          [formatDate(event.date), `${event.time}–${event.endTime}`, `${event.title} · ${event.classId}${event.changed ? ' · Đổi lịch' : ''}`, event.room || 'Chưa rõ phòng'].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
          return row;
        });
        $('hust-preview-rows').replaceChildren(...rows);
        return summary;
      }
      async function apply(result, automatic = false) {
        const raw = localStorage.getItem(PlannerStore.DATA_KEY);
        await ipc.backup(raw);
        if (localStorage.getItem(PlannerStore.DATA_KEY) !== raw) throw new Error('Công việc vừa thay đổi trong lúc sao lưu. Hãy đọc lại lịch trước khi áp dụng.');
        const summary = getStore().applyHustSync(result);
        snapshot = null; settings.lastCheck = Date.now();
        renderAll();
        let preferenceError = '';
        try { saveSettings(); } catch { preferenceError = ' Lịch đã lưu, nhưng chưa lưu được tùy chọn tự động.'; }
        status(`Đã đồng bộ kỳ ${result.term}: ${summaryText(summary)}.${preferenceError}`);
        if (!automatic) notice('Đã đồng bộ lịch HUST và tạo bản sao lưu.');
        return summary;
      }
      async function run(action) {
        if (busy) return;
        busy = true; refreshControls();
        try { await action(); }
        catch (error) { status(String(error.message || error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''), true); }
        finally { busy = false; refreshControls(); }
      }
      $('open-hust-btn').addEventListener('click', () => {
        if (!dialog.open) dialog.showModal();
        refreshControls();
        if (!ipc) status('Kết nối HUST được hỗ trợ trong bản EXE. Mở Daily Planner trên Desktop để sử dụng.');
        else if (!snapshot && !$('hust-status').classList.contains('error')) {
          const saved = getStore().state.hust_sync;
          status(saved ? `Đã đồng bộ kỳ ${saved.term} lúc ${new Date(saved.last_sync).toLocaleString('vi-VN')}.` : 'Bấm Kết nối HUST và tự đăng nhập trong cửa sổ mở ra.');
        }
      });
      $('close-hust-btn').addEventListener('click', () => dialog.close());
      $('hust-connect-btn').addEventListener('click', () => run(async () => {
        status('Đang mở cửa sổ HUST…');
        await ipc.connect();
        status('Đăng nhập, chọn học kỳ trên HUST rồi quay lại bấm Đọc lịch / cập nhật.');
      }));
      $('hust-read-btn').addEventListener('click', () => run(async () => {
        snapshot = null; $('hust-preview').classList.add('hidden');
        status('Đang đọc thời khóa biểu HUST…');
        const result = await ipc.read({ refresh: false });
        preview(result); status('Đã đọc lịch. Kiểm tra bảng xem trước rồi bấm Áp dụng vào lịch.');
      }));
      $('hust-apply-btn').addEventListener('click', () => run(async () => { if (snapshot) await apply(snapshot); }));
      $('hust-disconnect-btn').addEventListener('click', () => run(async () => {
        await ipc.disconnect();
        settings.auto = false; snapshot = null;
        $('hust-preview').classList.add('hidden');
        try { saveSettings(); } catch { /* Session was still cleared successfully. */ }
        status('Đã ngắt kết nối. Các buổi học đã nhập vẫn được giữ trong app.');
      }));
      $('hust-auto-sync').addEventListener('change', () => {
        const previous = settings.auto; settings.auto = $('hust-auto-sync').checked;
        try { saveSettings(); status(settings.auto ? 'Đã bật tự cập nhật mỗi 6 giờ khi app đang mở.' : 'Đã tắt tự cập nhật.'); }
        catch { settings.auto = previous; status('Chưa lưu được tùy chọn tự cập nhật.', true); }
        refreshControls();
      });
      async function automaticSync() {
        if (!ipc || !settings.auto || busy || Date.now() - settings.lastCheck < PERIOD || document.querySelector('dialog[open], .modal-backdrop:not(.hidden)')) return;
        const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()));
        if (hour < 2) return;
        const saved = getStore().state.hust_sync;
        if (!saved) return;
        await run(async () => {
          settings.lastCheck = Date.now();
          try { saveSettings(); } catch { /* This run remains rate-limited in memory. */ }
          const result = await ipc.read({ refresh: true });
          if (result.account !== saved.account || result.term !== saved.term) throw new Error('Tài khoản hoặc học kỳ HUST đã đổi. Mở Lịch học HUST để xem trước và áp dụng lại.');
          await apply(result, true);
        });
      }
      refreshControls();
      setTimeout(automaticSync, 15000);
      setInterval(automaticSync, 15 * 60 * 1000);
    },
  };
})();
