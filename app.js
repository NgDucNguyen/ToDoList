let tasks = JSON.parse(localStorage.getItem("calendar_tasks") || "[]");
function saveTasks() {
  localStorage.setItem("calendar_tasks", JSON.stringify(tasks));
}

let viewDate = new Date();

// SỬA LỖI 1: Đổi "calendar-month-year" thành "current-month-year" để khớp với ID trong index.html
const mothYearLabel = document.getElementById("current-month-year");
const calendarGrid = document.getElementById("calendar-grid");
const prevMonthBtn = document.getElementById("prev-month-btn");
const nextMonthBtn = document.getElementById("next-month-btn");
const todayBtn = document.getElementById("today-btn");

const taskModal = document.getElementById("task-modal");
const taskForm = document.getElementById("task-form");
const taskDateInput = document.getElementById("task-date-input");
const taskTextInput = document.getElementById("task-text-input");
const modalDateLabel = document.getElementById("modal-date-label");
const cancelTaskBtn = document.getElementById("cancel-task-btn");

// Chuẩn hóa định dạng ngày tháng về YYYY-MM-DD
function formatDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Dựng lưới lịch
function renderCalendar() {
  calendarGrid.innerHTML = "";
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  mothYearLabel.textContent = `Tháng ${currentMonth + 1} - ${currentYear}`;

  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const startOffset = (firstDayIndex + 6) % 7;
  const dayInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const dayInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  const todayStr = formatDateString(new Date());

  // 1. Dựng các ngày đệm của tháng trước
  // SỬA LỖI 2: Đổi (dayInPrevMonth - 1) thành (dayInPrevMonth - i) để lùi ngày chính xác
  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNum = dayInPrevMonth - i;
    const dateObj = new Date(currentYear, currentMonth - 1, dayNum);
    calendarGrid.appendChild(createDayCell(dateObj, true));
  }

  // 2. Dựng các ngày thực tế của tháng hiện tại
  for (let day = 1; day <= dayInMonth; day++) {
    const dateObj = new Date(currentYear, currentMonth, day);
    const isToday = formatDateString(dateObj) === todayStr;
    calendarGrid.appendChild(createDayCell(dateObj, false, isToday));
  }

  // 3. Dựng các ngày đệm của tháng sau để lưới luôn tròn hàng (bội số 7)
  const totalSlots = startOffset + dayInMonth;
  const nextMonthPadding = totalSlots % 7 === 0 ? 0 : 7 - (totalSlots % 7);
  for (let day = 1; day <= nextMonthPadding; day++) {
    const dateObj = new Date(currentYear, currentMonth + 1, day);
    calendarGrid.appendChild(createDayCell(dateObj, true));
  }
}

// Tạo 1 khối ô ngày gồm: số ngày, nút thêm task, danh sách task
function createDayCell(dateObj, isOtherMonth, isToday = false) {
  const dateStr = formatDateString(dateObj);
  const cell = document.createElement("div");
  cell.className = `day-cell ${isOtherMonth ? "other-month" : ""} ${isToday ? "today" : ""}`;

  const header = document.createElement("div");
  header.className = "day-header";
  header.innerHTML = `<span class="day-number">${dateObj.getDate()}</span><button class="add-task-btn" title="Thêm việc">+</button>`;
  header
    .querySelector(".add-task-btn")
    .addEventListener("click", () => openModal(dateStr));

  const taskList = document.createElement("div");
  taskList.className = "task-list";

  const dayTasks = tasks.filter((t) => t.task_date === dateStr);
  dayTasks.forEach((task) => {
    taskList.appendChild(createTaskItem(task));
  });

  cell.appendChild(header);
  cell.appendChild(taskList);
  return cell;
}

// Tạo 1 thẻ việc đơn lẻ
function createTaskItem(task) {
  const item = document.createElement("div");
  item.className = `task-item ${task.is_completed ? "completed" : ""}`;

  item.innerHTML = `
    <div class="task-item-content">
      <input type="checkbox" ${task.is_completed ? "checked" : ""}>
      <span title="${task.title}">${task.title}</span>
    </div>
    <button class="task-delete-btn" title="Xóa">✕</button>
  `;

  // Cập nhật hoàn thành (UPDATE)
  item.querySelector("input").addEventListener("change", (e) => {
    task.is_completed = e.target.checked;
    saveTasks();
    renderCalendar();
  });

  // Xóa việc (DELETE)
  item.querySelector(".task-delete-btn").addEventListener("click", () => {
    tasks = tasks.filter((t) => t.id !== task.id);
    saveTasks();
    renderCalendar();
  });

  return item;
}

// Mở modal nhập việc
function openModal(dateStr) {
  taskDateInput.value = dateStr;
  modalDateLabel.textContent = `Ngày: ${dateStr}`;
  taskTextInput.value = "";
  taskModal.classList.remove("hidden");
  taskTextInput.focus();
}

// Đóng modal
function closeModal() {
  taskModal.classList.add("hidden");
}

cancelTaskBtn.addEventListener("click", closeModal);

// Tạo mới công việc (CREATE)
taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = taskTextInput.value.trim();
  const dateStr = taskDateInput.value;

  if (!title) return;

  const newTask = {
    id: Date.now().toString(),
    title: title,
    task_date: dateStr,
    is_completed: false,
    created_at: new Date().toISOString(),
  };

  tasks.push(newTask);
  saveTasks();
  closeModal();
  renderCalendar();
});

// Điều hướng chuyển tháng
prevMonthBtn.addEventListener("click", () => {
  viewDate.setMonth(viewDate.getMonth() - 1);
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  viewDate.setMonth(viewDate.getMonth() + 1);
  renderCalendar();
});

todayBtn.addEventListener("click", () => {
  viewDate = new Date();
  renderCalendar();
});

// Chạy lần đầu tiên
renderCalendar();
