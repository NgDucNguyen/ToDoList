/* Shared validation: model suggestions never write directly to planner storage. */
(function (root, factory) {
  const api = factory();
  root.PlannerChatbotCore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function validateResult(result, dates) {
    if (!result || !['none', 'create_task', 'create_note'].includes(result.kind)) throw new Error('Thao tác Chatbot chưa được hỗ trợ.');
    for (const field of ['reply', 'title', 'date', 'time', 'body']) {
      if (typeof result[field] !== 'string') throw new Error('Câu trả lời của Chatbot không hợp lệ.');
    }
    if (!result.reply.trim() || result.reply.length > 12000 || result.body.length > 100000 || result.title.length > 200) throw new Error('Câu trả lời Chatbot quá dài hoặc thiếu nội dung.');
    if (result.kind !== 'none' && !result.title.trim()) throw new Error('Đề xuất thiếu tiêu đề.');
    if (result.kind === 'create_task' && dates) {
      if (!dates.parseDate(result.date)) throw new Error('Ngày đề xuất không hợp lệ. Hãy yêu cầu Chatbot sửa lại.');
      if (result.time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(result.time)) throw new Error('Giờ đề xuất không hợp lệ.');
    }
    return Object.fromEntries(['reply', 'kind', 'title', 'date', 'time', 'body'].map(key => [key, result[key]]));
  }
  function getContext(store, dates, from, to, now = new Date()) {
    const state = store.state;
    const fields = task => ({
      title: task.title, date: task.task_date, time: task.time || '', endTime: task.end_time || '',
      location: task.location || '', calendar: dates.taskCalendar(task), status: task.status,
    });
    if (!from && !to) {
      return {
        currentDate: dates.dateString(now), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        all: true, scope: 'Toàn bộ công việc và lịch đã lưu. Lịch lặp hiển thị theo chuỗi, không tự đếm vô hạn các lần lặp.',
        hustLastSync: state.hust_sync?.last_sync || null,
        tasks: state.tasks.filter(task => !(task.source?.provider === 'hust' && task.source.cancelled)).map(task => ({
          ...fields(task), recurrence: task.recurrence || null,
          knownOccurrences: task.recurrence ? Object.entries(task.occurrences).filter(([date, item]) => dates.parseDate(date) && !item.deleted).map(([date, item]) => ({
            ...fields(task), title: item.title ?? task.title, date: item.task_date || date, time: item.time ?? task.time ?? '',
            status: item.status || 'todo', calendar: dates.taskCalendar({ ...task, ...item }),
          })) : [],
        })),
      };
    }
    const start = dates.parseDate(from), end = dates.parseDate(to);
    if (!start || !end || from > to) throw new Error('Ngày bạn hỏi chưa hợp lệ. Hãy nhập lại ngày bắt đầu và kết thúc.');
    if ((end - start) / 86400000 > 3660 && state.tasks.some(task => task.recurrence)) throw new Error('Khoảng hơn 10 năm có lịch lặp rất lớn. Hãy hỏi một năm cụ thể hoặc tìm theo tên công việc.');
    const tasks = store.occurrences(from, to);
    return {
      currentDate: dates.dateString(now), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      from, to, scheduleIncluded: true,
      scope: 'Lịch được đọc nội bộ theo khoảng ngày; không gửi ra mạng. Lịch HUST có thể chưa đồng bộ mới nhất.',
      hustLastSync: store.state.hust_sync?.last_sync || null,
      tasks: tasks.sort((a, b) => `${a.task_date} ${a.time || ''}`.localeCompare(`${b.task_date} ${b.time || ''}`)).map(fields),
    };
  }
  function applyProposal(result, { store, dates, createNote }) {
    const proposal = validateResult(result, dates);
    if (proposal.kind === 'create_task') {
      const task = store.addTask({ title: proposal.title.trim(), task_date: proposal.date, time: proposal.time,
        description: proposal.body, calendar_id: 'personal', tag: 'Daily', status: 'todo', priority: 'normal' });
      return { kind: proposal.kind, item: task, message: `Đã tạo “${task.title}” vào ngày ${proposal.date.split('-').reverse().join('/')}.` };
    }
    if (proposal.kind === 'create_note') {
      if (typeof createNote !== 'function') throw new Error('Bộ ghi chú chưa sẵn sàng.');
      const note = createNote(proposal.title.trim(), proposal.body);
      return { kind: proposal.kind, item: note, message: `Đã tạo ghi chú “${note.title}”.` };
    }
    throw new Error('Không có đề xuất để tạo.');
  }
  return { validateResult, getContext, applyProposal };
});
