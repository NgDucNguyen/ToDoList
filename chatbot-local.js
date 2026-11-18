/* Local intent inference + deterministic dates, retrieval and safe action drafts. */
(function (root, factory) {
  const api = typeof module === 'object' && module.exports && typeof require === 'function'
    ? factory(require('./chatbot-nlu'), require('./chatbot-model'), require('./chatbot-knowledge'), require('./planner-store'))
    : factory(root.PlannerChatbotNLU, root.PlannerChatbotModel, root.PlannerChatbotKnowledge, root.PlannerStore);
  root.PlannerLocalChatbot = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (nlu, model, knowledge, dates) {
  'use strict';
  const norm = nlu.normalize;
  const answer = (reply, fields = {}) => ({ reply, kind: 'none', title: '', date: '', time: '', body: '', ...fields });
  const displayDate = value => value.split('-').reverse().join('/');
  function fold(text) { return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase(); }
  function mapped(text) {
    let normalized = '', map = [];
    for (let i = 0; i < text.length;) {
      const character = String.fromCodePoint(text.codePointAt(i)), value = fold(character);
      for (const char of value) { normalized += char; map.push(i); }
      i += character.length;
    }
    map.push(text.length); return { text: normalized, map };
  }
  function strip(text, ranges) {
    const { map } = mapped(text), remove = new Set();
    for (const [from, until] of ranges) for (let i = map[from]; i < (map[until] ?? text.length); i++) remove.add(i);
    return text.split('').filter((_, i) => !remove.has(i)).join('').replace(/\s+/g, ' ').replace(/^[\s,:;–-]+|[\s,:;–-]+$/g, '').trim();
  }
  function dateInfo(text, today) {
    const value = fold(text), matches = [], year = Number(today.slice(0, 4));
    const add = (date, match, invalid = false) => { matches.push({ date, span: [match.index, match.index + match[0].length], invalid: invalid || !dates.parseDate(date) }); };
    for (const match of value.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) add(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`, match);
    for (const match of value.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g)) add(`${match[3] || year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`, match);
    for (const match of value.matchAll(/\b(\d{1,2})-(\d{1,2})(?:-(\d{4}))?\b/g)) {
      if (!matches.some(item => match.index < item.span[1] && match.index + match[0].length > item.span[0])) add(`${match[3] || year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`, match);
    }
    for (const match of value.matchAll(/\bngay\s+(\d{1,2})\s+thang\s+(\d{1,2})(?:\s+nam\s+(\d{4}))?\b/g)) add(`${match[3] || year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`, match);
    if (matches.length) return { entries: matches, invalid: matches.some(item => item.invalid) };
    const dayOnly = value.match(/\bngay\s+(\d{1,2})\b/);
    if (dayOnly) { add(`${year}-${today.slice(5, 7)}-${dayOnly[1].padStart(2, '0')}`, dayOnly); return { entries: matches, invalid: matches.some(item => item.invalid) }; }
    let match = value.match(/\b(?:sau\s+(\d+)\s+ngay|(\d+)\s+ngay\s+nua)\b/);
    if (match) { const count = Number(match[1] || match[2]); add(count <= 365 ? dates.addDays(today, count) : '', match); }
    const relative = [[/\b(?:ngay\s*mai|hom\s*sau|mai)\b/, 1], [/\b(?:ngay\s*kia|ngay\s*mot)\b/, 2], [/\b(?:hom\s*qua)\b/, -1], [/\b(?:hom\s*nay|hnay|hn)\b/, 0], [/\b(?:toi nay|chieu nay|sang nay|trua nay)\b/, 0]];
    if (!matches.length) for (const [pattern, offset] of relative) { match = value.match(pattern); if (match) { add(dates.addDays(today, offset), match); break; } }
    if (!matches.length) {
      match = value.match(/\b(?:thu\s*(hai|ba|tu|nam|sau|bay|[2-7])|t([2-7])|chu\s*nhat|cn)\b/);
      if (match) {
        const names = { hai: 1, ba: 2, tu: 3, nam: 4, sau: 5, bay: 6 };
        const weekday = match[1] ? (names[match[1]] ?? Number(match[1]) - 1) : match[2] ? Number(match[2]) - 1 : 0;
        const nowDay = dates.parseDate(today).getDay();
        let delta;
        if (/tuan\s*(?:sau|toi)/.test(value)) delta = -(nowDay + 6) % 7 + 7 + (weekday + 6) % 7;
        else if (/tuan\s*nay/.test(value)) delta = -(nowDay + 6) % 7 + (weekday + 6) % 7;
        else delta = (weekday - nowDay + 7) % 7;
        add(dates.addDays(today, delta), match);
      }
    }
    return { entries: matches, invalid: matches.some(item => item.invalid) };
  }
  function resolveRange(text, today) {
    const value = norm(text), info = dateInfo(text, today);
    if (info.invalid) throw new Error('Ngày không tồn tại. Hãy nhập ngày hợp lệ, ví dụ 20/11/2026.');
    if (info.entries.length) return { from: info.entries[0].date, to: info.entries.at(-1).date, explicit: true };
    if (/\b(?:tuan|thang)\b/.test(value)) {
      if (/\btuan\b/.test(value)) {
        let from = dates.addDays(today, -(dates.parseDate(today).getDay() + 6) % 7);
        if (/tuan\s*(sau|toi)/.test(value)) from = dates.addDays(from, 7);
        if (/tuan\s*(truoc|vua roi)/.test(value)) from = dates.addDays(from, -7);
        return { from, to: dates.addDays(from, 6), explicit: true };
      }
      const date = dates.parseDate(today), next = /thang\s*(sau|toi)/.test(value) ? 1 : /thang\s*truoc/.test(value) ? -1 : 0;
      const monthMatch = value.match(/thang\s+(\d{1,2})(?:\s+(?:nam\s+)?(\d{4}))?/);
      const month = monthMatch ? Number(monthMatch[1]) - 1 : date.getMonth() + next;
      if (monthMatch && (month < 0 || month > 11)) throw new Error('Tháng cần nằm trong khoảng 1–12.');
      const y = monthMatch?.[2] ? Number(monthMatch[2]) : date.getFullYear();
      return { from: dates.dateString(new Date(y, month, 1, 12)), to: dates.dateString(new Date(y, month + 1, 0, 12)), explicit: true };
    }
    const countMatch = value.match(/\b(\d+)\s+ngay\s+(?:toi|tiep theo)\b/);
    if (countMatch) { const count = Number(countMatch[1]); if (count < 1 || count > 3660) throw new Error('Số ngày chưa hợp lệ. Hãy hỏi tối đa 10 năm mỗi lần.'); return { from: today, to: dates.addDays(today, count - 1), explicit: true }; }
    return { from: null, to: null, explicit: false, all: true };
  }
  function timeInfo(text) {
    const value = fold(text);
    let match = value.match(/\b(?:ca ngay|khong\s+(?:dat\s+)?gio|khong can gio)\b/);
    if (match) return { time: '', span: [match.index, match.index + match[0].length] };
    match = value.match(/\b(?:(?:luc|vao luc)\s+)?(\d{1,2})(?:(?::|h)(\d{1,2})?|\s*gio(?:\s+(\d{1,2}))?)\s*(sang|chieu|toi|trua|dem)?\b/);
    if (!match) match = value.match(/\bluc\s+(\d{1,2})\s*(sang|chieu|toi|trua|dem)?\b/);
    if (!match) return null;
    const longForm = match.length > 4;
    let hour = Number(match[1]), minute = Number(longForm ? match[2] || match[3] || 0 : 0);
    let period = longForm ? match[4] : match[2];
    if (!period) {
      const prefix = value.slice(Math.max(0, match.index - 16), match.index).match(/\b(sang|chieu|buoi toi|trua|dem)\s*$/);
      if (prefix) period = prefix[1] === 'buoi toi' ? 'toi' : prefix[1];
      if (/tối\s*$/i.test(text.slice(0, mapped(text).map[match.index]))) period = 'toi';
      const relativePeriod = value.match(/\b(sang|chieu|toi|trua)(?:\s+ngay)?\s+(?:mai|nay)\b/);
      if (relativePeriod) period = relativePeriod[1];
    }
    if (hour > 23 || minute > 59) return { invalid: true };
    if (period && hour > 12 && !(period === 'chieu' && hour < 18) && !(['toi', 'dem'].includes(period) && hour >= 18)) return { invalid: true };
    if (['chieu', 'toi'].includes(period) && hour > 0 && hour < 12) hour += 12;
    if (period === 'trua' && hour < 11) hour += 12;
    if (period === 'sang' && hour === 12) hour = 0;
    if (['toi', 'dem'].includes(period) && hour === 12) hour = 0;
    const ambiguous = !period && /^luc\s+\d+\s*$/.test(match[0]) && hour >= 1 && hour <= 12;
    return { time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, span: [match.index, match.index + match[0].length], ambiguous };
  }
  function parseTask(text, today, previous = {}) {
    const info = dateInfo(text, today), clock = timeInfo(text), value = fold(text), spans = info.entries.map(item => item.span);
    if (info.invalid) throw new Error('Ngày không tồn tại. Hãy nhập lại ngày, ví dụ 20/11/2026.');
    if (info.entries.length > 1) throw new Error('Mỗi lần chỉ tạo một công việc vào một ngày. Hãy tách các yêu cầu.');
    if (clock?.invalid) throw new Error('Giờ không hợp lệ. Dùng 00:00–23:59.');
    if (clock?.span) spans.push(clock.span);
    const command = value.match(/^\s*(?:(?:hay|vui long|giup toi|toi muon|cho toi)\s+)*(?:tao|them|dat|len|luu|nhac)\s*(?:(?:cho toi|toi|mot|1|cai|moi|cong viec|viec|task|lich|ke hoach|ca nhan)\b[\s:]*)*/);
    if (command) spans.push([command.index, command.index + command[0].length]);
    for (const match of value.matchAll(/\b(?:vao ngay|vao|ngay|luc|tuan sau|tuan toi|tuan nay|giup toi|cho toi|nhe|nha|nhe ban)\b/g)) spans.push([match.index, match.index + match[0].length]);
    if (clock) for (const match of value.matchAll(/\b(?:sang|chieu|toi|trua)(?:\s+ngay)?\s+(?:mai|nay)\b/g)) spans.push([match.index, match.index + match[0].length]);
    let title = strip(text, spans);
    // A slot-only follow-up must not become a new title.
    if (!command && previous.title) title = previous.title;
    return { title: title || previous.title || '', date: info.entries[0]?.date || previous.date || '', time: clock && !clock.ambiguous ? clock.time : previous.time,
      ambiguousTime: clock?.ambiguous || false, body: previous.body || '' };
  }
  function parseNote(text) {
    const value = fold(text), prefix = value.match(/^\s*(?:(?:hay|vui long|toi muon|giup toi|cho toi)\s+)*(?:(?:tao|them|viet|luu)\s+)?(?:(?:mot|1)\s+)?(?:ghi\s*chu|note|ghi nhanh|ghi lai)(?:\s+(?:moi|lai|giup toi))?[ \t]*:?[ \t]?/);
    const map = mapped(text).map, content = prefix ? text.slice(map[prefix[0].length] ?? text.length) : text;
    const separator = fold(content).match(/\s+(?:voi\s+)?noi dung[ \t]*:?[ \t]?/);
    if (separator) {
      const contentMap = mapped(content).map;
      return { title: content.slice(0, contentMap[separator.index]).replace(/^(?:tên|ten|tiêu đề|tieu de)\s*:?\s*/i, '').trim(), body: content.slice(contentMap[separator.index + separator[0].length] ?? content.length) };
    }
    if (!content.trim()) return { title: '', body: '' };
    return { title: (content.split('\n').find(line => line.trim()) || '').trim().slice(0, 80), body: content };
  }
  function faq(text) {
    const query = new Map(nlu.features(text));
    const ranked = knowledge.map(item => ({ ...item, score: Math.max(...item.questions.map(question => nlu.features(question).reduce((sum, [i, value]) => sum + (query.get(i) || 0) * value, 0))) })).sort((a, b) => b.score - a.score);
    return ranked[0].score >= .13 ? ranked[0].answer : knowledge[0].answer;
  }
  function chooseIntent(text) {
    const value = norm(text), predicted = nlu.classify(text, model);
    const command = value.replace(/^(?:(?:hay|vui long|giup toi|toi muon|cho toi)\s+)*/, '');
    // Text after a note command is content, even if it mentions help or actions.
    if (/^(?:(?:tao|them|viet|luu)\s+(?:(?:mot|1)\s+)?)?(?:ghi\s*chu|note|ghi nhanh|ghi lai)\b/.test(command)) return { ...predicted, intent: 'create_note', guarded: true };
    const taskCommand = /^(?:tao|them|dat|len lich|nhac toi|luu lich)\b/.test(command);
    // Deterministic guards cover destructive requests and explicit help questions.
    if (!taskCommand && (/^(?:(?:cho toi|cho minh|ban|toi muon biet)\s+)*(?:cach|lam sao|lam the nao|huong dan|tai sao|vi sao)\b/.test(value) || /\b(?:mat du lieu|mat lich|can api|can mang|train|huan luyen|luu du lieu o dau)\b/.test(value))) return { ...predicted, intent: 'help', guarded: true };
    if (/^(?:(?:hay|giup toi|toi muon|cho toi)\s+)*(?:xoa|sua|chinh sua|chuyen|doi trang thai|hoan thanh tat ca)\b/.test(value) || /\b(?:(?:hang|moi)\s+(?:ngay|tuan|thang)|lap lai|lich lap|cookie|mat khau)\b/.test(value) || /\b(?:tao|them)\s+\d+\s+(?:lich|viec|cong viec|ghi chu|note)\b/.test(value)) return { ...predicted, intent: 'unsupported', guarded: true };
    if (taskCommand) return { ...predicted, intent: 'create_task', guarded: true };
    if (/\b(?:qua han|tre han|tre deadline|qua deadline)\b/.test(value)) return { ...predicted, intent: 'overdue', guarded: true };
    if (/\b(?:chua|khong)\s+(?:lam\s+)?(?:xong|hoan thanh)\b/.test(value)) return { ...predicted, intent: 'unfinished', guarded: true };
    if (/\b(?:da\s+)?(?:lam xong|hoan tat|da xong|da hoan thanh)\b/.test(value)) return { ...predicted, intent: 'completed', guarded: true };
    if (/^tim\s+(?:lich|cong viec|viec)\s+/.test(value)) return { ...predicted, intent: 'schedule', guarded: true };
    return predicted;
  }
  function createSession({ getContext, getTaskList = () => [], getNotes = () => [], clock = () => new Date() }) {
    let pending = null, lastReadIntent = '', lastCalendar = '', listing = null;
    function renderListing(tasks, label, tail, intent, series, page = 0) {
      const start = page * 20, end = Math.min(start + 20, tasks.length);
      listing = { tasks, label, tail, intent, series, page };
      const lines = tasks.slice(start, end).map(task => {
        const date = task.date || task.task_date;
        let suffix = task.status === 'done' ? ' ✓' : '';
        if (task.recurrence) {
          const rule = task.recurrence;
          suffix = ` · Lặp mỗi ${rule.interval} ${{ daily: 'ngày', weekly: 'tuần', monthly: 'tháng' }[rule.frequency]}`;
          if (rule.frequency === 'weekly') suffix += ` (${rule.weekdays.map(day => day === 0 ? 'CN' : 'T' + (day + 1)).join(', ')})`;
          suffix += rule.until ? ' đến ' + displayDate(rule.until) : ', chưa đặt ngày kết thúc';
        }
        return `• ${date ? (task.recurrence ? 'Từ ' : '') + displayDate(date) : 'Chưa có ngày'} ${task.time || 'Cả ngày/chưa đặt giờ'} — ${task.title}${task.location ? ' · ' + task.location : ''}${suffix}`;
      });
      const prefix = page ? `Kết quả ${start + 1}–${end}/${tasks.length}:\n\n` : intent === 'summary'
        ? `Tổng cộng ${tasks.length} mục: ${tasks.filter(task => !task.recurrence && task.status === 'done').length} hoàn thành, ${tasks.filter(task => !task.recurrence && task.status !== 'done').length} chưa hoàn thành${series.length ? `, ${series.length} chuỗi lặp` : ''}.\n\n`
        : `Có ${tasks.length} mục phù hợp:\n\n`;
      return answer(`${label}\n${prefix}${lines.join('\n')}${end < tasks.length ? `\n… còn ${tasks.length - end} mục. Gõ “xem tiếp” để xem thêm.` : ''}${tail}`);
    }
    function draftTask(text, today, old) {
      let draft;
      try { draft = parseTask(text, today, old); }
      catch (error) { return answer(error.message + ' Chưa tạo dữ liệu. Hãy gửi lại đầy đủ tên, ngày và giờ.'); }
      pending = { kind: 'create_task', ...draft };
      if (!draft.title) return answer('Bạn muốn đặt tên công việc là gì?');
      if (!draft.date) return answer(`Bạn muốn tạo “${draft.title}” vào ngày nào? Ví dụ: ngày mai hoặc 20/11/2026.`);
      if (draft.ambiguousTime) return answer('Bạn muốn giờ sáng hay tối? Hãy nhập rõ, ví dụ 07:00 hoặc 19:00.');
      if (draft.time === undefined) return answer(`“${draft.title}” ngày ${displayDate(draft.date)} lúc mấy giờ? Nhập 19:00 hoặc “cả ngày”.`);
      pending = null;
      return answer('Mình đã chuẩn bị công việc trên Lịch cá nhân, chờ bạn xác nhận. Đây chưa phải lời nhắc Windows; muốn thông báo, mở chi tiết việc và chọn Nhắc việc.', { kind: 'create_task', title: draft.title, date: draft.date, time: draft.time, body: draft.body });
    }
    function draftNote(text, old) {
      const draft = parseNote(text);
      const note = { title: old?.title || draft.title || '', body: draft.body };
      if (!note.body) { pending = { kind: 'create_note', ...note }; return answer('Bạn muốn ghi lại nội dung gì? Có thể nhập “Tạo ghi chú Ý tưởng với nội dung: ...”.'); }
      if (!note.title) note.title = (note.body.split('\n').find(line => line.trim()) || '').trim().slice(0, 80);
      pending = null;
      return answer('Mình đã chuẩn bị ghi chú, chờ bạn xác nhận.', { kind: 'create_note', title: note.title, body: note.body });
    }
    function respond(text) {
      if (typeof text !== 'string' || !text.trim() || text.length > 3000) return answer('Nhập câu hỏi từ 1 đến 3000 ký tự nhé.');
      const today = dates.dateString(clock()), value = norm(text), prediction = chooseIntent(text);
      if (/^(?:xem tiep|tiep tuc|trang sau)[.!\s]*$/.test(value)) {
        if (!listing) return answer('Bạn muốn xem lịch nào? Thử “Xem toàn bộ lịch” hoặc “Tìm lịch họp”.');
        if ((listing.page + 1) * 20 >= listing.tasks.length) return answer('Đã xem hết kết quả lần tra cứu này. Bạn có thể hỏi lịch hoặc từ khóa khác.');
        return renderListing(listing.tasks, listing.label, listing.tail, listing.intent, listing.series, listing.page + 1);
      }
      let intent = prediction.intent, followupCalendar = '';
      if (lastReadIntent && /^(?:con|the|vay|con ngay|the con)\b/.test(value) && !/\b(?:tao|them|xoa|sua)\b/.test(value)) {
        const followup = resolveRange(text, today);
        if (followup.explicit) { intent = lastReadIntent; prediction.guarded = true; followupCalendar = lastCalendar; }
      }
      if (/^(?:huy|huy bo|thoi|bo qua|khong tao|cancel)[.!\s]*$/.test(value)) { pending = null; return answer('Đã hủy yêu cầu đang điền. Chưa thay đổi dữ liệu.'); }
      if (pending) {
        const newCommand = /^(?:(?:hay|giup toi|toi muon|cho toi)\s+)*(?:tao|them|dat|nhac|xem|tim|tom tat|tong hop|xoa|sua|huong dan|cach|chao)\b/.test(value);
        if (!newCommand) return pending.kind === 'create_task' ? draftTask(text, today, pending) : draftNote(text, pending);
        pending = null;
      }
      if (intent === 'greeting') return answer('Chào bạn! Mình là trợ lý nội bộ của Planner. Thử “Mai học môn gì?”, “Tóm tắt tuần này”, “Thêm lịch đọc sách ngày mai 19h” hoặc “Ghi chú: nhớ mang laptop”. Mọi xử lý chatbot đều trên máy.');
      if (intent === 'help') return answer(faq(text));
      if (intent === 'unsupported') return answer('Mình chuyên hỗ trợ Planner: xem/tóm tắt lịch, tìm việc và ghi chú, đề xuất tạo một việc cá nhân hoặc ghi chú. Chưa hỗ trợ sửa/xóa, tạo nhiều việc hoặc lịch lặp bằng chat. Các thao tác đó bạn dùng màn hình chi tiết trong app nhé.');
      if (!prediction.guarded && (prediction.confidence < .40 || prediction.margin < .12)) return answer('Mình chưa hiểu chắc yêu cầu này. Bạn thử nói rõ: “Xem lịch ngày mai”, “Việc nào quá hạn?”, “Tạo lịch họp ngày mai 19h” hoặc “Ghi chú: ...”. Chưa thay đổi dữ liệu.');
      if (intent === 'create_task') {
        if (!/\b(?:tao|them|dat|len lich|nhac toi|luu lich)\b/.test(value)) return answer('Bạn muốn tạo công việc mới phải không? Hãy nhập “Thêm lịch [tên việc] [ngày] [giờ]”.');
        if (/\bhust\b/.test(value)) return answer('Bot chỉ tạo việc cá nhân. Muốn thêm buổi học thủ công, vào Lịch HUST → Thêm buổi học.');
        return draftTask(text, today);
      }
      if (intent === 'create_note') return draftNote(text);
      if (intent === 'search_notes') {
        const all = getNotes(), query = value.replace(/^(?:(?:cho toi|cho minh|toi co|hay|tim kiem|tim|xem|doc|mo|liet ke|danh sach|cac|nhung|ghi chu|note|da luu|ve|chua)\s*)+/, '').replace(/\b(?:cua toi|nao|nhung gi|co gi|da luu|o dau)\b/g, '').trim();
        const words = query.split(/\s+/).filter(Boolean), found = all.filter(note => words.every(word => norm(note.title + '\n' + note.body).includes(word)));
        if (!found.length) return answer(all.length ? 'Không tìm thấy ghi chú phù hợp. Thử “Tìm ghi chú [từ khóa]”.' : 'Bạn chưa có ghi chú đã lưu. Thử “Ghi chú: nội dung cần nhớ”.');
        return answer(`Tìm thấy ${found.length} ghi chú${query ? ` cho “${query}”` : ''}:\n\n` + found.slice(0, 5).map(note => `• ${note.title || 'Chưa có tên'}\n${note.body.slice(0, 500)}${note.body.length > 500 ? '…' : ''}`).join('\n\n') + (found.length > 5 ? '\n\nChỉ hiện 5 ghi chú đầu; xem thêm ở trang Ghi chú.' : ''));
      }
      let range, context, tasks;
      try {
        range = resolveRange(text, today);
        // Availability is a forward-looking question; use the coming week and say so.
        if (range.all && ['free_time', 'conflicts'].includes(intent)) range = { from: today, to: dates.addDays(today, 6), automatic: true };
        if (intent === 'overdue') { tasks = getTaskList('overdue', today); range = { from: '', to: dates.addDays(today, -1) }; }
        else if (intent === 'unscheduled') { tasks = getTaskList('unscheduled', today); }
        else { context = getContext(range.from, range.to); tasks = context.tasks; }
      } catch (error) { return answer(error.message); }
      const calendar = /\b(?:hust|lich hoc|mon hoc|hoc mon|hoc gi|hoc o|buoi hoc|thoi khoa bieu)\b/.test(value) ? 'hust' : /\bca nhan\b/.test(value) ? 'personal' : followupCalendar;
      if (calendar) tasks = tasks.filter(task => (task.calendar || dates.taskCalendar(task)) === calendar);
      lastCalendar = calendar;
      const series = range.all ? tasks.filter(task => task.recurrence) : [];
      if (range.all && ['completed', 'unfinished'].includes(intent)) {
        tasks = tasks.flatMap(task => task.recurrence ? task.knownOccurrences || [] : [task]);
      }
      if (intent === 'unfinished' || intent === 'overdue') tasks = tasks.filter(task => task.status !== 'done');
      if (intent === 'completed') tasks = tasks.filter(task => task.status === 'done');
      if (intent === 'unfinished' && /\bdang\s+(?:lam|thuc hien)\b/.test(value)) tasks = tasks.filter(task => task.status === 'doing');
      lastReadIntent = intent;
      if (intent === 'schedule') {
        const search = value.match(/\btim\s+(?:lich|cong viec|viec)\s+(.+)/);
        if (search) {
          const dateSpans = dateInfo(search[1], today).entries.map(item => item.span);
          const words = norm(strip(search[1], dateSpans)).replace(/\b(?:ngay|tuan nay|tuan sau|tuan toi|hust|ca nhan)\b/g, '').trim().split(/\s+/).filter(Boolean);
          tasks = tasks.filter(task => words.every(word => norm(task.title).includes(word)));
        }
      }
      let phase = /\b(?:buoi\s+)?(sang|chieu|trua)\b/.exec(value)?.[1];
      if (/\b(?:buoi toi|toi (?:nay|mai)|lich toi)\b/.test(value) || /(?:^|\s)tối(?:\s|$)/i.test(text)) phase = 'toi';
      if (phase) tasks = tasks.filter(task => { const time = task.time || '', hour = Number(time.slice(0, 2)); return time && (phase === 'sang' ? hour < 12 : phase === 'chieu' ? hour >= 12 && hour < 18 : phase === 'toi' ? hour >= 18 : hour >= 11 && hour < 14); });
      const label = intent === 'overdue' ? `Quá hạn trước ${displayDate(today)}` : intent === 'unscheduled' ? 'Chưa lên lịch' : range.all ? 'Toàn bộ lịch và công việc đã lưu' : `${range.automatic ? 'Tự xem 7 ngày tới: ' : ''}${displayDate(range.from)} – ${displayDate(range.to)}`;
      let tail = tasks.some(task => (task.calendar || dates.taskCalendar(task)) === 'hust') ? '\n\nLịch HUST là bản hiện có trong app, có thể chưa đồng bộ mới nhất.' : '';
      if (series.length) tail += `\n\nCó ${series.length} chuỗi lặp. Xem toàn bộ thì hiển thị theo chuỗi; hỏi một ngày/tuần để xem từng lần. ${['completed', 'unfinished'].includes(intent) ? 'Trạng thái ở trên chỉ tính việc đơn và các lần lặp đã ghi nhận trạng thái riêng.' : ''}`;
      if (intent === 'free_time') {
        const counts = [];
        for (let date = range.from; date <= range.to; date = dates.addDays(date, 1)) counts.push({ date, count: tasks.filter(task => (task.date || task.task_date) === date).length });
        const most = /\b(?:ban nhat|nhieu (?:viec|lich) nhat)\b/.test(value); counts.sort((a, b) => most ? b.count - a.count : a.count - b.count);
        const chosen = counts.filter(item => item.count === counts[0]?.count).slice(0, 7);
        return answer(`${label}\nNgày ${most ? 'nhiều' : 'ít'} lịch đã lưu nhất:\n` + chosen.map(item => `• ${displayDate(item.date)}: ${item.count} lịch`).join('\n') + '\n\nĐây là so sánh số lịch, không khẳng định bạn rảnh hoàn toàn. Việc chưa có giờ kết thúc hoặc chưa nhập vào app không đủ để tính khoảng rảnh chính xác.' + tail);
      }
      if (intent === 'conflicts') {
        const overlaps = [];
        for (let i = 0; i < tasks.length; i++) for (let j = i + 1; j < tasks.length; j++) {
          const a = tasks[i], b = tasks[j], endA = a.endTime || a.end_time, endB = b.endTime || b.end_time;
          if ((a.date || a.task_date) === (b.date || b.task_date) && a.time && b.time && endA > a.time && endB > b.time && a.time < endB && b.time < endA) overlaps.push(`${displayDate(a.date || a.task_date)}: ${a.title} (${a.time}–${endA}) ↔ ${b.title} (${b.time}–${endB})`);
        }
        return answer(`${label}\n` + (overlaps.length ? `Có ${overlaps.length} cặp trùng giờ:\n${overlaps.slice(0, 15).map(text => '• ' + text).join('\n')}` : 'Không thấy cặp trùng giờ trong những lịch có đủ giờ bắt đầu/kết thúc.') + '\nLịch thiếu giờ kết thúc chưa thể kiểm tra chính xác.' + tail);
      }
      if (!tasks.length) return answer(`${label}\nKhông có ${intent === 'completed' ? 'việc đã hoàn thành' : intent === 'unfinished' ? 'việc chưa hoàn thành' : 'lịch phù hợp'} được lưu${range.all ? '' : ' trong thời gian bạn hỏi'}.` + tail);
      tasks.sort((a, b) => `${a.date || a.task_date || '9999'} ${a.time || ''}`.localeCompare(`${b.date || b.task_date || '9999'} ${b.time || ''}`));
      return renderListing(tasks, label, tail, intent, series);
    }
    return { respond, reset() { pending = null; lastReadIntent = ''; lastCalendar = ''; listing = null; }, get pending() { return pending ? { ...pending } : null; } };
  }
  return { createSession, resolveRange, dateInfo, timeInfo, parseTask, parseNote, chooseIntent, faq };
});
