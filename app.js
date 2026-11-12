(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const { dateString, parseDate, addDays, id } = PlannerStore;
  const today = () => dateString(new Date());
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const priorityNames = { low: "Thấp", normal: "Bình thường", high: "Cao", urgent: "Khẩn cấp" };
  const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
  const statusNames = { todo: "Việc cần làm", doing: "Đang thực hiện", done: "Hoàn thành" };
  const viewNames = { today: "Hôm nay", upcoming: "Sắp tới", overdue: "Quá hạn", important: "Quan trọng", unscheduled: "Chưa lên lịch" };
  let store;
  let viewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let activeView = "calendar";
  let todoView = "today";
  let activeProjectId = "";
  let currentTagFilter = "ALL";
  let searchQuery = "";
  let selectedDate = "";
  let editingTask = null;
  let editingProjectId = "";
  let checklistDraft = [];
  let confirmAction = null;
  const modalFocus = new Map();
  let noticeTimeout;
  let lastToday = today();

  function notice(message, error = false) {
    const element = $("app-notice");
    clearTimeout(noticeTimeout);
    element.textContent = message;
    element.className = `app-notice${error ? " error" : ""}`;
    element.setAttribute("role", error ? "alert" : "status");
    if (!error) noticeTimeout = setTimeout(() => element.classList.add("hidden"), 4500);
  }
  function safely(action) {
    try { action(); return true; }
    catch (error) { notice(error.name === "QuotaExceededError" ? "Bộ nhớ đã đầy. Thay đổi chưa được lưu; hãy sao lưu dữ liệu trước khi tiếp tục." : error.message, true); return false; }
  }
  try { store = PlannerStore.createStore(localStorage); }
  catch (error) {
    notice(error.message || "Không thể mở bộ nhớ dữ liệu. Chưa thay đổi dữ liệu đã lưu.", true);
    document.querySelectorAll("button, input, select, textarea").forEach((element) => { element.disabled = true; });
    return;
  }

  function normalizeText(value) { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase(); }
  function filterTasks(rows) {
    const words = normalizeText(searchQuery).trim().split(/\s+/).filter(Boolean);
    return rows.filter((task) => (currentTagFilter === "ALL" || task.tag === currentTagFilter) && words.every((word) => normalizeText(`${task.title} ${task.description}`).includes(word)));
  }
  function sortTasks(rows) {
    return [...rows].sort((a, b) => Number(a.is_completed) - Number(b.is_completed) || priorityOrder[a.priority] - priorityOrder[b.priority] || Number(b.is_important) - Number(a.is_important) || (a.task_date || "9999").localeCompare(b.task_date || "9999") || (a.time || "99:99").localeCompare(b.time || "99:99") || a.title.localeCompare(b.title, "vi"));
  }
  function projectName(task) { return store.state.projects.find((project) => project.id === task.project_id)?.name || ""; }
  function friendlyDate(value) { const date = parseDate(value); return date ? date.toLocaleDateString("vi-VN") : "Chưa lên lịch"; }
  function repeatLabel(task) {
    if (!task.recurrence) return "";
    return `Lặp mỗi ${task.recurrence.interval} ${{ daily: "ngày", weekly: "tuần", monthly: "tháng" }[task.recurrence.frequency]}`;
  }
  function showModal(modalId, focusId) {
    modalFocus.set(modalId, document.activeElement);
    $(modalId).classList.remove("hidden");
    if (focusId) $(focusId).focus();
  }
  function closeModal(modalId) {
    $(modalId).classList.add("hidden");
    const previous = modalFocus.get(modalId);
    if (previous?.isConnected) previous.focus();
  }
  function confirmDelete(message, action) {
    confirmAction = action;
    $("confirm-message").textContent = message;
    showModal("confirm-modal", "confirm-cancel-btn");
  }

  function renderCalendar() {
    $("current-month-year").textContent = `Tháng ${viewDate.getMonth() + 1} - ${viewDate.getFullYear()}`;
    const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    const last = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    last.setDate(last.getDate() + (7 - last.getDay()) % 7);
    const byDate = new Map();
    filterTasks(store.occurrences(dateString(start), dateString(last))).forEach((task) => {
      if (!byDate.has(task.task_date)) byDate.set(task.task_date, []);
      byDate.get(task.task_date).push(task);
    });
    const fragment = document.createDocumentFragment();
    for (let date = dateString(start); date <= dateString(last); date = addDays(date, 1)) {
      const parsed = parseDate(date);
      const cell = document.createElement("div");
      cell.className = `day-cell${parsed.getMonth() !== viewDate.getMonth() ? " other-month" : ""}${date === today() ? " today" : ""}`;
      cell.dataset.date = date;
      cell.innerHTML = `<div class="day-header"><div class="day-number-wrapper"><span class="day-num">${parsed.getDate()}</span><span class="lunar-num">${getLunarDate(parsed.getDate(), parsed.getMonth() + 1, parsed.getFullYear())}</span></div><button class="add-task-btn" aria-label="Thêm công việc ngày ${date}">+</button></div><div class="task-list"></div>`;
      cell.querySelector(".add-task-btn").addEventListener("click", (event) => { event.stopPropagation(); openTaskModal({ date }); });
      const tasks = sortTasks(byDate.get(date) || []);
      tasks.slice(0, 2).forEach((task) => cell.querySelector(".task-list").append(createTaskCard(task, "calendar")));
      if (tasks.length > 2) {
        const more = document.createElement("button"); more.className = "more-tasks-btn";
        more.textContent = `+${tasks.length - 2} việc khác`; cell.querySelector(".task-list").append(more);
      }
      cell.addEventListener("click", () => { selectedDate = date; renderDayDetails(); showModal("day-details-modal", "close-day-details-btn"); });
      fragment.append(cell);
    }
    $("calendar-grid").replaceChildren(fragment);
  }

  function createTaskCard(task, variant) {
    const card = document.createElement("div");
    const compact = variant === "calendar";
    card.className = `${compact ? "task-item" : "planner-task-card"}${task.is_completed ? " completed" : ""}${task.task_date && task.task_date < today() && !task.is_completed ? " overdue" : ""}`;
    card.dataset.taskId = task.id;
    card.dataset.occurrenceDate = task.occurrence_date || "";
    const project = projectName(task);
    const safeTag = /^[a-zA-Z0-9_-]+$/.test(task.tag) ? task.tag : "Other";
    const checklistCount = task.checklist.filter((item) => item.is_completed).length;
    card.innerHTML = `<div class="task-meta"><span class="task-time">${compact ? escapeHTML(task.time) : escapeHTML(friendlyDate(task.task_date) + (task.time ? ` · ${task.time}` : ""))}</span><span class="task-tag tag-${safeTag}">${escapeHTML(task.tag)}</span></div>
      <div class="task-body"><input class="task-complete-checkbox" type="checkbox" aria-label="Hoàn thành ${escapeHTML(task.title)}" ${task.is_completed ? "checked" : ""}><button class="task-open-btn" title="${escapeHTML(task.title)}">${escapeHTML(task.title)}</button><button class="task-star-btn${task.is_important ? " active" : ""}" aria-label="Đánh dấu quan trọng" aria-pressed="${task.is_important}">${task.is_important ? "★" : "☆"}</button></div>
      <div class="task-badges">${task.priority !== "normal" ? `<span class="priority-badge priority-${task.priority}">${priorityNames[task.priority]}</span>` : ""}${task.recurrence ? `<span class="repeat-badge" title="${escapeHTML(repeatLabel(task))}">↻${compact ? "" : ` ${escapeHTML(repeatLabel(task))}`}</span>` : ""}${task.checklist.length ? `<span class="checklist-badge">☑ ${checklistCount}/${task.checklist.length}</span>` : ""}${!compact && project ? `<span class="project-badge">📁 ${escapeHTML(project)}</span>` : ""}${!compact ? `<span class="status-badge">${statusNames[task.status]}</span>` : ""}</div>`;
    card.querySelector(".task-open-btn").addEventListener("click", (event) => { event.stopPropagation(); openTaskModal({ task }); });
    card.querySelector(".task-complete-checkbox").addEventListener("click", (event) => event.stopPropagation());
    card.querySelector(".task-complete-checkbox").addEventListener("change", () => {
      safely(() => store.setStatus(task, task.is_completed ? "todo" : "done")); renderAll();
    });
    card.querySelector(".task-star-btn").addEventListener("click", (event) => {
      event.stopPropagation(); safely(() => { store.setImportant(task, !task.is_important); renderAll(); });
    });
    if (!compact && task.description) {
      const description = document.createElement("p"); description.className = "task-description-preview";
      description.textContent = task.description; card.append(description);
    }
    if (!compact && variant === "day" && task.checklist.length) {
      const list = document.createElement("div"); list.className = "task-checklist";
      task.checklist.forEach((item) => {
        const label = document.createElement("label"); label.className = "inline-checkbox";
        const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = item.is_completed;
        checkbox.addEventListener("change", () => { safely(() => store.setChecklistItem(task, item.id, checkbox.checked)); renderAll(); });
        const text = document.createElement("span"); text.textContent = item.text;
        label.append(checkbox, text); list.append(label);
      }); card.append(list);
    }
    if (variant === "kanban") {
      const control = document.createElement("select"); control.className = "card-status-select";
      control.setAttribute("aria-label", "Trạng thái công việc");
      Object.entries(statusNames).forEach(([value, label]) => control.add(new Option(label, value)));
      control.value = task.status;
      control.addEventListener("change", () => { safely(() => store.setStatus(task, control.value)); renderAll(); });
      card.append(control);
    }
    return card;
  }

  function renderDayDetails() {
    if (!selectedDate) return;
    const tasks = sortTasks(filterTasks(store.occurrences(selectedDate, selectedDate)));
    $("day-details-subtitle").textContent = `Ngày ${friendlyDate(selectedDate)}`;
    const count = tasks.filter((task) => task.is_completed).length;
    const percent = tasks.length ? Math.round(count / tasks.length * 100) : 0;
    $("battery-fill").style.width = `${percent}%`; $("battery-percent").textContent = `${percent}%`;
    $("progress-count").textContent = `${count}/${tasks.length}`;
    const list = $("day-details-task-list"); list.replaceChildren();
    if (!tasks.length) list.innerHTML = '<div class="empty-day-state">Không có công việc phù hợp trong ngày này.</div>';
    tasks.forEach((task) => list.append(createTaskCard(task, "day")));
  }
  function renderProjects() {
    const list = $("project-list"); list.replaceChildren();
    store.state.projects.forEach((project) => {
      const button = document.createElement("button");
      button.className = `project-item${activeView === "project" && activeProjectId === project.id ? " active" : ""}`;
      button.dataset.projectId = project.id;
      button.innerHTML = `<span class="proj-left"><svg class="project-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 10h18"/></svg><span class="proj-name-text">${escapeHTML(project.name)}</span></span>`;
      button.title = project.name; button.addEventListener("click", () => { activeProjectId = project.id; showView("project"); });
      list.append(button);
    });
    if (!store.state.projects.length) list.innerHTML = '<p class="empty-projects">Bấm + để tạo dự án.</p>';
    for (const selectId of ["task-project-input", "myday-project-picker"]) {
      const select = $(selectId); const value = select.value;
      select.replaceChildren(new Option("Không thuộc dự án", ""));
      store.state.projects.forEach((project) => select.add(new Option(project.name, project.id)));
      select.value = value;
    }
  }
  function renderKanban() {
    const project = store.state.projects.find((item) => item.id === activeProjectId); if (!project) return;
    $("kanban-project-title").textContent = project.name;
    const rows = sortTasks(filterTasks(store.projectTasks(project.id)));
    $("project-summary").textContent = `${rows.filter((task) => task.is_completed).length}/${rows.length} công việc hoàn thành`;
    for (const status of Object.keys(statusNames)) {
      const tasks = rows.filter((task) => task.status === status);
      $("count-" + status).textContent = tasks.length;
      $("cards-" + status).replaceChildren(...tasks.map((task) => createTaskCard(task, "kanban")));
    }
  }
  function renderTodo() {
    $("todo-view-title").textContent = viewNames[todoView];
    $("myday-date").textContent = todoView === "upcoming" ? `Từ ${friendlyDate(addDays(today(), 1))} đến ${friendlyDate(addDays(today(), 7))}` : todoView === "important" ? "Việc được gắn sao, bao gồm các lần lặp trong 7 ngày tới" : new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    document.querySelectorAll(".todo-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.view === todoView); tab.setAttribute("aria-selected", String(tab.dataset.view === todoView));
      tab.querySelector("span").textContent = filterTasks(store.todo(tab.dataset.view)).filter((task) => !task.is_completed).length;
    });
    let tasks = filterTasks(store.todo(todoView));
    if (!$("show-completed").checked) tasks = tasks.filter((task) => !task.is_completed);
    const list = $("myday-task-list"); list.replaceChildren();
    if (!tasks.length) list.innerHTML = '<div class="empty-day-state">Không có công việc trong mục này.</div>';
    sortTasks(tasks).forEach((task) => list.append(createTaskCard(task, "todo")));
  }
  function renderAll() {
    renderProjects(); renderCalendar(); renderKanban(); renderTodo();
    if (!$("day-details-modal").classList.contains("hidden")) renderDayDetails();
  }
  function showView(view) {
    activeView = view;
    $("calendar-view").classList.toggle("hidden", view !== "calendar");
    $("kanban-view").classList.toggle("hidden", view !== "project");
    $("todolist-view").classList.toggle("hidden", view !== "todo");
    document.querySelector(".nav-link:not(#todolist-nav-link)").classList.toggle("active", view === "calendar");
    $("todolist-nav-link").classList.toggle("active", view === "todo"); renderAll();
  }

  function renderChecklistEditor(focusLast = false) {
    const list = $("task-checklist-editor"); list.replaceChildren();
    checklistDraft.forEach((item, index) => {
      const row = document.createElement("div"); row.className = "checklist-editor-row";
      row.innerHTML = `<input type="checkbox" aria-label="Hoàn thành bước ${index + 1}" ${item.is_completed ? "checked" : ""} ${editingTask?.recurrence && $("task-edit-scope").value === "series" ? "disabled" : ""}><input type="text" aria-label="Nội dung bước ${index + 1}" placeholder="Nhập bước cần làm" value="${escapeHTML(item.text)}"><button type="button" aria-label="Xóa bước ${index + 1}">✕</button>`;
      row.querySelector('[type="checkbox"]').addEventListener("change", (event) => { item.is_completed = event.target.checked; updateChecklistProgress(); });
      row.querySelector('[type="text"]').addEventListener("input", (event) => { item.text = event.target.value; });
      row.querySelector("button").addEventListener("click", () => { checklistDraft.splice(index, 1); renderChecklistEditor(); }); list.append(row);
    });
    updateChecklistProgress();
    if (focusLast) list.lastElementChild?.querySelector('[type="text"]').focus();
  }
  function updateChecklistProgress() { $("checklist-progress").textContent = checklistDraft.length ? `(${checklistDraft.filter((item) => item.is_completed).length}/${checklistDraft.length})` : ""; }
  function updateRepeatFields() {
    const frequency = $("task-repeat-input").value;
    const existing = Boolean(editingTask?.recurrence), series = $("task-edit-scope").value === "series", locked = existing && !series;
    $("repeat-interval-group").classList.toggle("hidden", frequency === "none");
    $("repeat-until-group").classList.toggle("hidden", frequency === "none");
    $("repeat-help").classList.toggle("hidden", frequency === "none");
    $("repeat-weekdays").classList.toggle("hidden", frequency !== "weekly");
    $("repeat-interval-unit").textContent = { daily: "ngày", weekly: "tuần", monthly: "tháng" }[frequency] || "ngày";
    $("task-date-picker").required = frequency !== "none"; $("task-date-picker").disabled = existing && series;
    $("task-repeat-input").disabled = locked; $("task-repeat-interval").disabled = locked || frequency === "none";
    $("task-repeat-until").disabled = locked || frequency === "none";
    $("repeat-weekdays").querySelectorAll("input").forEach((input) => { input.disabled = locked; });
    $("task-repeat-input").querySelector('[value="none"]').disabled = existing;
    if (existing) {
      $("recurrence-scope-hint").textContent = series ? "Nội dung áp dụng cả chuỗi; trạng thái áp dụng lần đang sửa. Tiến độ checklist được giữ riêng, tích bước ở Chỉ lần này. Đặt ngày kết thúc để dừng lặp, giữ lại lịch sử." : "Các lần lặp khác giữ nguyên. Chọn Cả chuỗi nếu muốn đổi quy tắc lặp.";
      $("delete-task-btn").textContent = series ? "Xóa cả chuỗi" : "Xóa lần này";
    }
  }
  function openTaskModal({ task = null, date, projectId = "" } = {}) {
    editingTask = task; $("task-form").reset(); $("task-form-error").classList.add("hidden"); renderProjects();
    $("modal-title").textContent = task ? "Chi tiết công việc" : "Thêm công việc";
    $("task-text-input").value = task?.title || "";
    $("task-date-picker").value = task ? task.task_date : (date ?? today());
    $("task-time-input").value = task?.time || "";
    const tag = task?.tag || (projectId ? "Project" : "Daily");
    if (![...$("task-tag-input").options].some((option) => option.value === tag)) $("task-tag-input").add(new Option(tag, tag));
    $("task-tag-input").value = tag; $("task-project-input").value = task?.project_id || projectId;
    $("task-status-input").value = task?.status || "todo"; $("task-priority-input").value = task?.priority || "normal";
    $("task-important-input").checked = task?.is_important || false; $("task-description-input").value = task?.description || "";
    checklistDraft = (task?.checklist || []).map((item) => ({ ...item })); renderChecklistEditor();
    $("task-repeat-input").value = task?.recurrence?.frequency || "none";
    $("task-repeat-interval").value = task?.recurrence?.interval || 1; $("task-repeat-until").value = task?.recurrence?.until || "";
    const weekdays = task?.recurrence?.weekdays || [parseDate($("task-date-picker").value)?.getDay() ?? new Date().getDay()];
    $("repeat-weekdays").querySelectorAll("input").forEach((input) => { input.checked = weekdays.includes(Number(input.value)); });
    $("recurrence-edit-scope").classList.toggle("hidden", !task?.recurrence); $("delete-task-btn").classList.toggle("hidden", !task);
    $("delete-task-btn").textContent = "Xóa công việc"; $("task-edit-scope").value = "occurrence"; updateRepeatFields();
    showModal("task-modal", "task-text-input"); $("task-modal").querySelector(".modal-card").scrollTop = 0;
  }
  function saveTask(event) {
    event.preventDefault();
    try {
      const title = $("task-text-input").value.trim(); if (!title) throw new Error("Hãy nhập tên công việc.");
      const scope = $("task-edit-scope").value, frequency = $("task-repeat-input").value;
      const start = editingTask?.recurrence && scope === "series" ? store.state.tasks.find((task) => task.id === editingTask.id).task_date : $("task-date-picker").value;
      const weekdays = [...$("repeat-weekdays").querySelectorAll("input:checked")].map((input) => Number(input.value));
      if (frequency === "weekly" && !weekdays.length) throw new Error("Hãy chọn ít nhất một ngày trong tuần.");
      const patch = {
        title, task_date: start, time: $("task-time-input").value, tag: $("task-tag-input").value,
        project_id: $("task-project-input").value, status: $("task-status-input").value,
        priority: $("task-priority-input").value, is_important: $("task-important-input").checked,
        description: $("task-description-input").value.trim(), checklist: checklistDraft.filter((item) => item.text.trim()).map((item) => ({ ...item, text: item.text.trim() })),
      };
      if (!editingTask?.recurrence || scope === "series") patch.recurrence = frequency === "none" ? null : { frequency, interval: Number($("task-repeat-interval").value), weekdays, until: $("task-repeat-until").value };
      if (editingTask) store.updateTask(editingTask.id, patch, { date: editingTask.occurrence_date, scope }); else store.addTask(patch);
      closeModal("task-modal"); renderAll(); notice("Đã lưu công việc.");
    } catch (error) {
      $("task-form-error").textContent = error.name === "QuotaExceededError" ? "Bộ nhớ đã đầy. Công việc chưa được lưu." : error.message;
      $("task-form-error").classList.remove("hidden"); $("task-form-error").scrollIntoView({ block: "nearest" });
    }
  }
  function openProjectModal(projectId = "") {
    editingProjectId = projectId; $("project-modal-title").textContent = projectId ? "Đổi tên dự án" : "Thêm dự án";
    $("project-name-input").value = store.state.projects.find((project) => project.id === projectId)?.name || "";
    $("project-form-error").classList.add("hidden"); showModal("project-modal", "project-name-input");
  }

  $("task-form").addEventListener("submit", saveTask);
  $("task-repeat-input").addEventListener("change", updateRepeatFields);
  $("task-edit-scope").addEventListener("change", () => {
    const series = store.state.tasks.find((task) => task.id === editingTask?.id);
    if (series) {
      const values = $("task-edit-scope").value === "series" ? series : editingTask;
      $("task-date-picker").value = values.task_date; $("task-text-input").value = values.title;
      $("task-description-input").value = values.description; $("task-project-input").value = values.project_id;
      $("task-priority-input").value = values.priority; $("task-important-input").checked = values.is_important;
      $("task-time-input").value = values.time; $("task-tag-input").value = values.tag;
      checklistDraft = values.checklist.map((item) => ({ ...item })); renderChecklistEditor();
    } updateRepeatFields();
  });
  $("task-date-picker").addEventListener("change", () => {
    if (!editingTask && $("task-repeat-input").value === "none") {
      const day = parseDate($("task-date-picker").value)?.getDay();
      $("repeat-weekdays").querySelectorAll("input").forEach((input) => { input.checked = Number(input.value) === day; });
    }
  });
  $("add-checklist-btn").addEventListener("click", () => { checklistDraft.push({ id: id(), text: "", is_completed: false }); renderChecklistEditor(true); });
  $("delete-task-btn").addEventListener("click", () => {
    const task = editingTask, scope = $("task-edit-scope").value;
    confirmDelete(task.recurrence && scope === "series" ? "Xóa toàn bộ chuỗi và lịch sử các lần lặp?" : `Xóa ${task.recurrence ? "lần lặp này của " : ""}“${task.title}”?`, () => {
      store.removeTask(task.id, task.occurrence_date, scope); closeModal("task-modal"); renderAll(); notice("Đã xóa công việc.");
    });
  });
  for (const button of ["close-modal-btn", "cancel-task-btn"]) $(button).addEventListener("click", () => closeModal("task-modal"));
  for (const button of ["close-day-details-btn", "day-details-close-btn"]) $(button).addEventListener("click", () => closeModal("day-details-modal"));
  $("day-details-add-btn").addEventListener("click", () => { closeModal("day-details-modal"); openTaskModal({ date: selectedDate }); });
  $("quick-add-btn").addEventListener("click", () => openTaskModal());
  $("todo-add-btn").addEventListener("click", () => openTaskModal({ date: todoView === "unscheduled" ? "" : todoView === "upcoming" ? addDays(today(), 1) : today() }));
  $("add-kanban-task-btn").addEventListener("click", () => openTaskModal({ projectId: activeProjectId, date: "" }));
  $("add-project-btn").addEventListener("click", () => openProjectModal());
  $("rename-project-btn").addEventListener("click", () => openProjectModal(activeProjectId));
  $("cancel-project-btn").addEventListener("click", () => closeModal("project-modal"));
  $("project-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try { activeProjectId = store.saveProject($("project-name-input").value, editingProjectId); closeModal("project-modal"); showView("project"); }
    catch (error) { $("project-form-error").textContent = error.message; $("project-form-error").classList.remove("hidden"); }
  });
  $("delete-project-btn").addEventListener("click", () => confirmDelete("Xóa dự án này? Các công việc được giữ lại và chuyển thành không thuộc dự án.", () => {
    store.removeProject(activeProjectId); activeProjectId = ""; showView("calendar");
  }));
  $("confirm-cancel-btn").addEventListener("click", () => { confirmAction = null; closeModal("confirm-modal"); });
  $("confirm-ok-btn").addEventListener("click", () => { if (!confirmAction) return; const action = confirmAction; confirmAction = null; closeModal("confirm-modal"); safely(action); });
  document.querySelector(".nav-link:not(#todolist-nav-link)").addEventListener("click", (event) => { event.preventDefault(); showView("calendar"); });
  $("todolist-nav-link").addEventListener("click", (event) => { event.preventDefault(); showView("todo"); });
  document.querySelector(".brand-title").addEventListener("click", () => { viewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1); showView("calendar"); });
  $("prev-month-btn").addEventListener("click", () => { viewDate.setMonth(viewDate.getMonth() - 1); renderCalendar(); });
  $("next-month-btn").addEventListener("click", () => { viewDate.setMonth(viewDate.getMonth() + 1); renderCalendar(); });
  $("search-input").addEventListener("input", (event) => { searchQuery = event.target.value; renderAll(); });
  document.querySelectorAll(".tag-filter-btn").forEach((button) => button.addEventListener("click", () => {
    currentTagFilter = button.dataset.tag; document.querySelectorAll(".tag-filter-btn").forEach((item) => item.classList.toggle("active", item === button)); renderAll();
  }));
  document.querySelectorAll(".todo-tab").forEach((tab) => tab.addEventListener("click", () => {
    todoView = tab.dataset.view;
    if (!$("myday-quick-input").value.trim()) $("myday-date-picker").value = todoView === "upcoming" ? addDays(today(), 1) : todoView === "unscheduled" ? "" : today();
    renderTodo();
  }));
  $("show-completed").addEventListener("change", renderTodo); $("myday-date-picker").value = today();
  $("myday-quick-input").addEventListener("input", (event) => $("myday-options-bar").classList.toggle("hidden", !event.target.value.trim()));
  $("myday-quick-input").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return; event.preventDefault();
    const title = event.target.value.trim(); if (!title) return;
    safely(() => {
      store.addTask({ title, task_date: $("myday-date-picker").value, tag: $("myday-tag-picker").value, project_id: $("myday-project-picker").value });
      event.target.value = ""; $("myday-options-bar").classList.add("hidden"); renderAll(); notice("Đã thêm công việc.");
    });
  });
  document.addEventListener("keydown", (event) => {
    const visible = ["confirm-modal", "project-modal", "task-modal", "day-details-modal"].find((modalId) => !$(modalId).classList.contains("hidden")); if (!visible) return;
    if (event.key === "Escape") { event.preventDefault(); closeModal(visible); }
    if (event.key === "Tab") {
      const elements = [...$(visible).querySelectorAll("button, input, select, textarea")].filter((element) => !element.disabled && element.getClientRects().length);
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  function refreshAfterMidnight() { if (lastToday !== today()) { lastToday = today(); $("myday-date-picker").value = today(); renderAll(); } }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshAfterMidnight(); });
  setInterval(refreshAfterMidnight, 60000);
  renderAll();
})();
