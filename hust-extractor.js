/* Runs only inside the official HUST timetable page. Reads timetable state only;
   credentials, cookies, tokens, grades and other account records are not exported. */
function readHustTimetable() {
  if (location.origin !== 'https://qldt.hust.edu.vn' || !location.pathname.startsWith('/students/learn/timetable')) return { status: 'login', message: 'Đăng nhập và mở Thời khóa biểu trên HUST.' };
  const root = document.getElementById('__next');
  if (!root) return { status: 'loading' };
  const fiberKey = Object.keys(root).find(key => key.startsWith('__reactContainer$') || key.startsWith('__reactFiber$'));
  const pending = fiberKey ? [root[fiberKey]] : [], visited = new Set();
  let state;
  while (pending.length && visited.size < 40000) {
    const fiber = pending.pop();
    if (!fiber || visited.has(fiber)) continue;
    visited.add(fiber);
    const props = fiber.memoizedProps;
    const store = props?.store || props?.value?.store;
    if (store && typeof store.getState === 'function') {
      const candidate = store.getState();
      if (candidate?.timetableState && candidate?.semesterState) { state = candidate; break; }
    }
    pending.push(fiber.child, fiber.sibling, fiber.return, fiber.alternate, fiber.stateNode?.current);
  }
  if (!state) return { status: 'loading' };
  if (!state.authState?.isLoggedIn) return { status: 'login', message: 'Phiên HUST chưa đăng nhập hoặc đã hết hạn.' };
  const timetable = state.timetableState;
  if (timetable.isLoading || state.semesterState.isLoading) return { status: 'loading' };
  const items = timetable.items;
  if (!Array.isArray(items) || !items.length) return { status: 'empty', message: 'Chưa có lịch. Chọn học kỳ có lịch trên trang HUST rồi bấm Đọc lại.' };
  const terms = [...new Set(items.map(item => String(item.semester)))];
  if (terms.length !== 1 || !/^\d{5}$/.test(terms[0]) || !timetable.mapSemesterLoaded?.[terms[0]]) return { status: 'loading' };
  const term = terms[0];
  const semester = state.semesterState.semesters?.find(item => String(item.semester) === term);
  if (!semester || !(Number(semester.startDate) > 0)) return { status: 'unsupported', message: 'Không đọc được mốc tuần học HUST. Chưa thay đổi lịch trong app.' };
  const account = state.authState.user;
  const identity = [account?.id, account?.userId, account?.studentId, account?.username, account?.email].find(value => value != null && !['', '-1', '0'].includes(String(value).trim()));
  if (identity == null || String(identity).trim() === '') return { status: 'unsupported', message: 'Không xác định được tài khoản HUST để tránh trộn lịch.' };
  let runtime;
  if (Array.isArray(window.webpackChunk_N_E)) window.webpackChunk_N_E.push([['planner_hust_read_' + Date.now()], {}, require => { runtime = require; }]);
  let calendar, clock;
  try { calendar = runtime(35870); clock = runtime(9822); } catch { /* Fail closed when the portal changes its bundle. */ }
  if (typeof calendar?.mI !== 'function' || typeof clock?.Jq !== 'function') return { status: 'unsupported', message: 'Cấu trúc lịch HUST đã thay đổi. Cần cập nhật bộ đọc trước khi đồng bộ.' };
  const dateString = value => {
    if (typeof value === 'string') {
      value = value.trim();
      const localDate = /^(\d{2})[-/](\d{2})[-/](\d{4})(?:[ T].*)?$/.exec(value);
      if (localDate) return `${localDate[3]}-${localDate[2]}-${localDate[1]}`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) value = Date.parse(value);
    }
    if (!(Number(value) > 0)) return '';
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(Number(value)));
    const part = type => parts.find(item => item.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  };
  // Sync the regular timetable only. Makeup/cancellation/change notices are
  // deliberately excluded; the user manages exceptional lessons manually.
  const rows = calendar.mI({ items, absentReports: [], startSemesterTime: semester.startDate, startSemesterWeek: semester.startWeek });
  const timeOf = (side, value, dayTime = 1) => clock.Jq('hust', side, typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value, dayTime);
  const keyFor = (row, originalDate) => `${row._class.classId}:${Number(row.id) > 0 ? row.id : `${row.dayTime}-${row.from}-${row.to}`}:${originalDate || dateString(row.date)}`;
  const result = [], keys = new Set();
  for (const row of rows) {
    if (!row._class) throw new Error('Lịch HUST thiếu thông tin lớp.');
    const date = dateString(row.date);
    if (row._isReplaced) continue;
    const originalDate = date, uid = keyFor(row, originalDate);
    if (keys.has(uid)) throw new Error('Lịch HUST có buổi trùng mã. Chưa đồng bộ để tránh ghi sai.');
    keys.add(uid);
    const course = row._class;
    result.push({ uid, date, originalDate, time: timeOf('from', row.from, row.dayTime), endTime: timeOf('to', row.to, row.dayTime), title: course._course?.name || course.courseName, classId: String(course.classId), courseId: String(course.courseId || ''), classType: String(course.classType || ''), room: String(row.place || ''), changed: false });
  }
  const unscheduled = items.filter(item => !item._calendars?.length).map(item => ({ classId: String(item.classId), title: String(item._course?.name || item.courseName || '') }));
  return { status: 'ready', term, identity: String(identity), classes: items.length, semesterStart: dateString(semester.startDate), semesterEnd: dateString(semester.endDate), events: result, unscheduled, complete: true };
}

if (typeof module === 'object' && module.exports) module.exports = { readHustTimetable };
