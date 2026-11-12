/* Shared data model for the browser and Electron. No dependencies. */
(function (root, factory) {
  const api = factory();
  root.PlannerStore = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DATA_KEY = "planner_data_v2";
  const BACKUP_KEY = "planner_backup_before_v2";
  const LEGACY_KEYS = ["planner_tasks", "planner_projects", "planner_kanban_tasks"];
  const STATUSES = ["todo", "doing", "done"];
  const PRIORITIES = ["low", "normal", "high", "urgent"];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  function dateString(date) {
    return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function parseDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(2000, month - 1, day, 12);
    date.setFullYear(year);
    return dateString(date) === value ? date : null;
  }

  function addDays(value, days) {
    const date = parseDate(value);
    if (!date) throw new Error("Ngày không hợp lệ.");
    date.setDate(date.getDate() + days);
    return dateString(date);
  }

  function dayNumber(value) {
    const date = parseDate(value);
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  }

  function normalizeChecklist(items) {
    if (!Array.isArray(items)) return [];
    const used = new Set();
    return items.map((item) => {
      const result = typeof item === "string" ? { text: item } : { ...item };
      result.id = String(result.id || id());
      if (used.has(result.id)) result.id = id();
      used.add(result.id);
      return { ...result, text: String(result.text || ""), is_completed: Boolean(result.is_completed) };
    });
  }

  function normalizeRecurrence(rule, start) {
    if (!rule || rule.frequency === "none") return null;
    if (!["daily", "weekly", "monthly"].includes(rule.frequency) || !parseDate(start)) {
      throw new Error("Công việc lặp lại cần ngày bắt đầu hợp lệ.");
    }
    const interval = Number(rule.interval ?? 1);
    if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
      throw new Error("Khoảng lặp phải là số nguyên từ 1 đến 365.");
    }
    const until = rule.until || "";
    if (until && (!parseDate(until) || until < start)) {
      throw new Error("Ngày kết thúc lặp phải từ ngày bắt đầu trở đi.");
    }
    const weekdays = [...new Set((rule.weekdays || []).map(Number))].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    return { frequency: rule.frequency, interval, until, weekdays: weekdays.length ? weekdays : [parseDate(start).getDay()] };
  }

  function normalizeTask(source) {
    if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("Dữ liệu công việc không hợp lệ.");
    const status = STATUSES.includes(source.status) ? source.status : (source.is_completed ? "done" : "todo");
    const task = {
      ...source,
      id: String(source.id || id()),
      title: String(source.title || "Công việc chưa có tên"),
      task_date: parseDate(source.task_date) ? source.task_date : "",
      time: typeof source.time === "string" ? source.time : "",
      tag: String(source.tag || "Daily"),
      project_id: source.project_id ? String(source.project_id) : "",
      status,
      is_completed: status === "done",
      priority: PRIORITIES.includes(source.priority) ? source.priority : "normal",
      is_important: Boolean(source.is_important),
      description: String(source.description || ""),
      checklist: normalizeChecklist(source.checklist),
      occurrences: source.occurrences && typeof source.occurrences === "object" && !Array.isArray(source.occurrences) ? clone(source.occurrences) : {},
      created_at: source.created_at || new Date().toISOString(),
    };
    task.recurrence = normalizeRecurrence(source.recurrence, task.task_date);
    return task;
  }

  function occursOn(task, date) {
    if (!task.recurrence) return task.task_date === date;
    if (!parseDate(date) || date < task.task_date || (task.recurrence.until && date > task.recurrence.until)) return false;
    const start = parseDate(task.task_date);
    const current = parseDate(date);
    const rule = task.recurrence;
    if (rule.frequency === "daily") return (dayNumber(date) - dayNumber(task.task_date)) % rule.interval === 0;
    if (rule.frequency === "weekly") {
      const startMonday = dayNumber(task.task_date) - (start.getDay() + 6) % 7;
      const currentMonday = dayNumber(date) - (current.getDay() + 6) % 7;
      return ((currentMonday - startMonday) / 7) % rule.interval === 0 && rule.weekdays.includes(current.getDay());
    }
    const months = (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth();
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0, 12).getDate();
    return months % rule.interval === 0 && current.getDate() === Math.min(start.getDate(), lastDay);
  }

  function initializeSeries(task) {
    const status = task.status;
    const checklist = clone(task.checklist);
    task.occurrences = {};
    if (status !== "todo" || checklist.some((item) => item.is_completed)) {
      let first = task.task_date;
      for (let count = 0; !occursOn(task, first) && count <= task.recurrence.interval * 7 + 7; count++) first = addDays(first, 1);
      if (occursOn(task, first)) task.occurrences[first] = { status, checklist };
    }
    task.status = "todo";
    task.is_completed = false;
    task.checklist = task.checklist.map((item) => ({ ...item, is_completed: false }));
  }

  function projectOccurrence(task, date) {
    if (!task.recurrence) return { ...clone(task), occurrence_date: "" };
    const override = task.occurrences[date] || {};
    if (override.deleted) return null;
    const checklist = clone(override.checklist || task.checklist.map((item) => ({ ...item, is_completed: false })));
    const status = override.status || "todo";
    const { occurrences, ...fields } = task;
    return { ...clone(fields), ...clone(override), checklist, id: task.id, task_date: override.task_date ?? date, occurrence_date: date, status, is_completed: status === "done" };
  }

  function occurrencesInRange(task, from, until) {
    if (!parseDate(from) || !parseDate(until) || from > until) return [];
    if (!task.recurrence) return task.task_date >= from && task.task_date <= until ? [projectOccurrence(task)] : [];
    const rows = [];
    const seen = new Set();
    const end = task.recurrence.until && task.recurrence.until < until ? task.recurrence.until : until;
    for (let date = task.task_date > from ? task.task_date : from; date <= end; date = addDays(date, 1)) {
      if (!occursOn(task, date)) continue;
      const row = projectOccurrence(task, date);
      if (row && row.task_date >= from && row.task_date <= until) rows.push(row);
      seen.add(date);
    }
    // An individually rescheduled occurrence can move into the requested range.
    for (const [date] of Object.entries(task.occurrences)) {
      if (seen.has(date) || !parseDate(date)) continue;
      const row = projectOccurrence(task, date);
      if (row && row.task_date >= from && row.task_date <= until) rows.push(row);
    }
    return rows;
  }

  function createStore(storage) {
    let state;
    let savedRaw;
    let migrated = false;
    function readJSON(key, fallback) {
      const raw = storage.getItem(key);
      if (raw === null) return fallback;
      try { return JSON.parse(raw); }
      catch { throw new Error(`Không đọc được dữ liệu đã lưu (${key}). Dữ liệu gốc được giữ nguyên; hãy khôi phục từ bản sao lưu.`); }
    }
    function load() {
      const saved = readJSON(DATA_KEY, null);
      if (saved !== null) {
        if (saved.version !== 2 || !Array.isArray(saved.tasks) || !Array.isArray(saved.projects)) throw new Error("Phiên bản dữ liệu chưa được hỗ trợ. Dữ liệu gốc được giữ nguyên.");
        state = { ...saved, tasks: saved.tasks.map(normalizeTask) };
        savedRaw = storage.getItem(DATA_KEY);
        return;
      }
      const legacy = LEGACY_KEYS.map((key) => readJSON(key, []));
      if (legacy.some((value) => !Array.isArray(value))) throw new Error("Dữ liệu cũ không hợp lệ. Chưa thay đổi dữ liệu trên máy.");
      const used = new Set();
      const tasks = [...legacy[0], ...legacy[2]].map((raw) => {
        const task = normalizeTask(raw);
        if (used.has(task.id)) task.id = `migrated_${id()}`;
        used.add(task.id);
        return task;
      });
      const projects = legacy[1].map((project) => ({ ...project, id: String(project.id || id()), name: String(project.name || "Dự án") }));
      for (const task of tasks) {
        if (task.project_id && !projects.some((project) => project.id === task.project_id)) projects.push({ id: task.project_id, name: "Dự án đã lưu" });
      }
      const candidate = { version: 2, tasks, projects };
      const hasLegacy = LEGACY_KEYS.some((key) => storage.getItem(key) !== null);
      if (hasLegacy && storage.getItem(BACKUP_KEY) === null) {
        storage.setItem(BACKUP_KEY, JSON.stringify({ saved_at: new Date().toISOString(), data: Object.fromEntries(LEGACY_KEYS.map((key) => [key, storage.getItem(key)])) }));
      }
      // Commit only after a backup has been written successfully. Legacy keys stay untouched.
      storage.setItem(DATA_KEY, JSON.stringify(candidate));
      state = candidate;
      savedRaw = storage.getItem(DATA_KEY);
      migrated = hasLegacy;
    }
    load();

    function commit(change) {
      if (storage.getItem(DATA_KEY) !== savedRaw) throw new Error("Dữ liệu vừa thay đổi ở cửa sổ khác. Hãy tải lại ứng dụng trước khi tiếp tục.");
      const draft = clone(state);
      const result = change(draft);
      const raw = JSON.stringify(draft);
      storage.setItem(DATA_KEY, raw);
      state = draft;
      savedRaw = raw;
      return result;
    }
    function find(draft, taskId) {
      const task = draft.tasks.find((item) => item.id === taskId);
      if (!task) throw new Error("Công việc không còn tồn tại.");
      return task;
    }
    function addTask(values) {
      if (!String(values.title || "").trim()) throw new Error("Hãy nhập tên công việc.");
      const task = normalizeTask({ ...values, id: id() });
      if (!task.title.trim()) throw new Error("Hãy nhập tên công việc.");
      if (task.recurrence) initializeSeries(task);
      commit((draft) => draft.tasks.push(task));
      return clone(task);
    }
    function updateTask(taskId, patch, options = {}) {
      commit((draft) => {
        const task = find(draft, taskId);
        if (task.recurrence && options.date && options.scope !== "series") {
          if (!occursOn(task, options.date) && !task.occurrences[options.date]) throw new Error("Lần lặp này không hợp lệ.");
          const safePatch = clone(patch);
          delete safePatch.id; delete safePatch.recurrence; delete safePatch.occurrences; delete safePatch.occurrence_date;
          if ("task_date" in safePatch && !parseDate(safePatch.task_date)) throw new Error("Lần lặp cần có ngày hợp lệ.");
          if (safePatch.status) safePatch.is_completed = safePatch.status === "done";
          task.occurrences[options.date] = { ...task.occurrences[options.date], ...safePatch };
          return;
        }
        const next = normalizeTask({ ...task, ...patch, id: task.id, occurrences: task.occurrences });
        if (task.recurrence && next.recurrence) {
          if (next.task_date !== task.task_date) throw new Error("Ngày bắt đầu chuỗi được giữ cố định. Bạn có thể đổi ngày của từng lần.");
          next.status = "todo"; next.is_completed = false;
          // Fields deliberately edited for the whole series replace per-occurrence values.
          for (const override of Object.values(next.occurrences)) {
            for (const key of ["title", "description", "priority", "is_important", "project_id", "tag", "time"]) if (key in patch) delete override[key];
            if ("checklist" in patch) {
              const old = new Map((override.checklist || []).map((item) => [item.id, item.is_completed]));
              override.checklist = next.checklist.map((item) => ({ ...item, is_completed: old.get(item.id) || false }));
            }
          }
          if (options.date && patch.status) next.occurrences[options.date] = { ...next.occurrences[options.date], status: patch.status };
          next.checklist = next.checklist.map((item) => ({ ...item, is_completed: false }));
        } else if (!task.recurrence && next.recurrence) {
          initializeSeries(next);
        } else if (task.recurrence && !next.recurrence) {
          throw new Error("Để dừng chuỗi, hãy đặt ngày kết thúc lặp. Các lần đã ghi nhận sẽ được giữ lại.");
        }
        draft.tasks[draft.tasks.findIndex((item) => item.id === taskId)] = next;
      });
    }
    function removeTask(taskId, date, scope = "occurrence") {
      commit((draft) => {
        const task = find(draft, taskId);
        if (task.recurrence && date && scope !== "series") task.occurrences[date] = { ...task.occurrences[date], deleted: true };
        else draft.tasks = draft.tasks.filter((item) => item.id !== taskId);
      });
    }
    function setStatus(task, status) {
      if (!STATUSES.includes(status)) throw new Error("Trạng thái không hợp lệ.");
      updateTask(task.id, { status }, { date: task.occurrence_date });
    }
    function setImportant(task, important) {
      updateTask(task.id, { is_important: Boolean(important) }, { date: task.occurrence_date });
    }
    function setChecklistItem(task, itemId, completed) {
      const checklist = task.checklist.map((item) => item.id === itemId ? { ...item, is_completed: Boolean(completed) } : item);
      updateTask(task.id, { checklist }, { date: task.occurrence_date });
    }
    function occurrences(from, until, projectId) {
      return state.tasks.filter((task) => !projectId || task.project_id === projectId || Object.values(task.occurrences).some((item) => item.project_id === projectId))
        .flatMap((task) => occurrencesInRange(task, from, until)).filter((task) => !projectId || task.project_id === projectId);
    }
    function todo(mode, today = dateString(new Date())) {
      if (mode === "unscheduled") return state.tasks.filter((task) => !task.task_date).map((task) => projectOccurrence(task));
      const earliest = state.tasks.reduce((date, task) => {
        const dates = [task.task_date, ...Object.values(task.occurrences).map((item) => item.task_date)].filter((value) => parseDate(value));
        return dates.reduce((min, value) => value < min ? value : min, date);
      }, today);
      const from = mode === "today" ? today : mode === "upcoming" ? addDays(today, 1) : earliest;
      const until = mode === "overdue" ? addDays(today, -1) : mode === "today" ? today : addDays(today, 7);
      let result = occurrences(from, until);
      if (mode === "overdue") result = result.filter((task) => !task.is_completed);
      if (mode === "important") result = result.filter((task) => task.recurrence && task.is_important).concat(state.tasks.filter((task) => !task.recurrence && task.is_important).map((task) => projectOccurrence(task)));
      return result;
    }
    function projectTasks(projectId, today = dateString(new Date())) {
      return state.tasks.flatMap((task) => {
        if (!task.recurrence) return task.project_id === projectId ? [projectOccurrence(task)] : [];
        if (task.project_id !== projectId && !Object.values(task.occurrences).some((entry) => entry.project_id === projectId)) return [];
        const end = task.recurrence.until || addDays(today > task.task_date ? today : task.task_date, 370 * task.recurrence.interval);
        const candidates = Object.keys(task.occurrences).filter((date) => parseDate(date)).map((date) => projectOccurrence(task, date)).filter((row) => row && row.project_id === projectId);
        // Check explicit reschedules as well as the next natural date. Moving an old
        // occurrence into the future must not hide a nearer, still-pending one.
        for (let date = task.task_date; date <= end; date = addDays(date, 1)) {
          if (!occursOn(task, date)) continue;
          const row = projectOccurrence(task, date);
          if (!row || row.project_id !== projectId) continue;
          if (!row.is_completed && row.task_date === date) { candidates.push(row); break; }
        }
        const pending = candidates.filter((row) => !row.is_completed).sort((a, b) => a.task_date.localeCompare(b.task_date));
        const completed = candidates.filter((row) => row.is_completed).sort((a, b) => b.task_date.localeCompare(a.task_date));
        return pending.length ? [pending[0]] : completed.length ? [completed[0]] : [];
      });
    }
    function saveProject(name, projectId) {
      const text = String(name).trim();
      if (!text) throw new Error("Hãy nhập tên dự án.");
      const result = projectId || id();
      commit((draft) => {
        if (projectId) {
          const project = draft.projects.find((item) => item.id === projectId);
          if (!project) throw new Error("Không tìm thấy dự án.");
          project.name = text;
        } else draft.projects.push({ id: result, name: text });
      });
      return result;
    }
    function removeProject(projectId) {
      commit((draft) => {
        draft.projects = draft.projects.filter((project) => project.id !== projectId);
        for (const task of draft.tasks) {
          if (task.project_id === projectId) task.project_id = "";
          for (const occurrence of Object.values(task.occurrences)) if (occurrence.project_id === projectId) occurrence.project_id = "";
        }
      });
    }
    return { get state() { return clone(state); }, migrated, addTask, updateTask, removeTask, setStatus, setImportant, setChecklistItem, occurrences, todo, projectTasks, saveProject, removeProject };
  }

  return { DATA_KEY, BACKUP_KEY, LEGACY_KEYS, createStore, dateString, parseDate, addDays, occursOn, occurrencesInRange, normalizeTask, id };
});
