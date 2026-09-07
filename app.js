//Hardcode data

const sampleTasks = [
  {
    id: "1",
    title: "Team Sync",
    time: "8:00",
    tag: "Work",
    task_date: "2026-09-07",
    is_completed: false,
  },
  {
    id: "2",
    title: "Status Update",
    time: "9:30",
    tag: "Dev",
    task_date: "2026-09-08",
    is_completed: false,
  },
  {
    id: "3",
    title: "UX Review",
    time: "1:30",
    tag: "Design",
    task_date: "2026-09-08",
    is_completed: false,
  },
  {
    id: "4",
    title: "Ship groceries",
    time: "5:00",
    tag: "Personal",
    task_date: "2026-09-11",
    is_completed: false,
  },
  {
    id: "5",
    title: "Prepare deck",
    time: "",
    tag: "Work",
    task_date: "2026-09-07",
    is_completed: true,
  },
];

let tasks = JSON.parse(localStorage.getItem("planner_tasks")) || sampleTasks;

function saveTasks() {
  localStorage.setItem("planner_tasks", JSON.stringify(tasks));
}

let viewDate = new Date();
let currentSelectedDate = ""; // Ngày đang xem chi tiết trên pop-up

// Lấy các element

const monthYearLabel = document.getElementById("current-month-year");
const calendarGrid = document.getElementById("calendar-grid");
const prevMonthBtn = document.getElementById("prev-month-btn");
const nextMonthBtn = document.getElementById("next-month-btn");
const todayBtn = document.getElementById("today-btn");

const quickAddBtn = document.getElementById("quick-add-btn");
const taskModal = document.getElementById("task-modal");
const taskForm = document.getElementById("task-form");
const closeModalBtn = document.getElementById("close-modal-btn");
const cancelTaskBtn = document.getElementById("cancel-task-btn");

const taskTextInput = document.getElementById("task-text-input");
const taskDatePicker = document.getElementById("task-date-picker");
const taskTimeInput = document.getElementById("task-time-input");
const taskTagInput = document.getElementById("task-tag-input");

// DOM Pop-up xem chi tiết ngày
const dayDetailsModal = document.getElementById("day-details-modal");
const dayDetailsTitle = document.getElementById("day-details-title");
const dayDetailsSubtitle = document.getElementById("day-details-subtitle");
const dayDetailsTaskList = document.getElementById("day-details-task-list");
const closeDayDetailsBtn = document.getElementById("close-day-details-btn");
const dayDetailsCloseBtn = document.getElementById("day-details-close-btn");
const dayDetailsAddBtn = document.getElementById("day-details-add-btn");

// Định dạng ngày chuẩn

function formatDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

//Dựng bảng lịch

function renderCalendar() {
  calendarGrid.innerHTML = "";

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const monthNames = [
    "Tháng 1",
    "Tháng 2",
    "Tháng 3",
    "Tháng 4",
    "Tháng 5",
    "Tháng 6",
    "Tháng 7",
    "Tháng 8",
    "Tháng 9",
    "Tháng 10",
    "Tháng 11",
    "Tháng 12",
  ];
  monthYearLabel.textContent = `${monthNames[currentMonth]} - ${currentYear}`;

  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const startOffset = (firstDayIndex + 6) % 7;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  const todayStr = formatDateString(new Date());

  // 1. Ngày tháng trước
  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const dateObj = new Date(currentYear, currentMonth - 1, dayNum);
    calendarGrid.appendChild(createDayCell(dateObj, true));
  }

  // 2. Ngày tháng hiện tại
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(currentYear, currentMonth, day);
    const isToday = formatDateString(dateObj) === todayStr;
    calendarGrid.appendChild(createDayCell(dateObj, false, isToday));
  }

  // 3. Ngày tháng sau
  const totalSlots = startOffset + daysInMonth;
  const nextMonthPadding = totalSlots % 7 === 0 ? 0 : 7 - (totalSlots % 7);
  for (let day = 1; day <= nextMonthPadding; day++) {
    const dateObj = new Date(currentYear, currentMonth + 1, day);
    calendarGrid.appendChild(createDayCell(dateObj, true));
  }
}

function createDayCell(dateObj, isOtherMonth, isToday = false) {
  const dateStr = formatDateString(dateObj);
  const cell = document.createElement("div");
  cell.className = `day-cell ${isOtherMonth ? "other-month" : ""} ${isToday ? "today" : ""}`;

  const header = document.createElement("div");
  header.className = "day-header";
  header.innerHTML = `
    <span class="day-num">${dateObj.getDate()}</span>
    <button class="add-task-btn" title="Thêm việc">+</button>
  `;

  // Bấm nút + để tạo việc mới
  header.querySelector(".add-task-btn").addEventListener("click", (e) => {
    e.stopPropagation(); // Không kích hoạt click vào ô ngày
    openTaskModal(dateStr);
  });

  const taskList = document.createElement("div");
  taskList.className = "task-list";

  const dayTasks = tasks.filter((t) => t.task_date === dateStr);

  // Chỉ hiện tối đa 2 việc đầu tiên trên ô để không sinh thanh cuộn
  const MAX_VISIBLE_TASKS = 2;
  const visibleTasks = dayTasks.slice(0, MAX_VISIBLE_TASKS);
  visibleTasks.forEach((task) => {
    taskList.appendChild(createTaskItem(task));
  });

  // Nếu có nhiều hơn 2 việc, hiện nút "+X việc khác"
  if (dayTasks.length > MAX_VISIBLE_TASKS) {
    const remainingCount = dayTasks.length - MAX_VISIBLE_TASKS;
    const moreBtn = document.createElement("button");
    moreBtn.className = "more-tasks-btn";
    moreBtn.textContent = `+${remainingCount} việc khác`;
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDayDetailsModal(dateStr);
    });
    taskList.appendChild(moreBtn);
  }

  // Click vào bất kỳ đâu trong ô ngày -> Bật pop-up xem chi tiết tất cả công việc
  cell.addEventListener("click", () => {
    openDayDetailsModal(dateStr);
  });

  cell.appendChild(header);
  cell.appendChild(taskList);
  return cell;
}

function createTaskItem(task, isInsideModal = false) {
  const item = document.createElement("div");
  item.className = `task-item ${task.is_completed ? "completed" : ""}`;

  item.innerHTML = `
    <div class="task-meta">
      <span class="task-time">${task.time || ""}</span>
      ${task.tag ? `<span class="task-tag tag-${task.tag}">${task.tag}</span>` : ""}
    </div>
    <div class="task-body">
      <input type="checkbox" ${task.is_completed ? "checked" : ""}>
      <span class="task-title" title="${task.title}">${task.title}</span>
      <button class="task-del-btn" title="Xóa">✕</button>
    </div>
  `;

  // Ngăn click vào checkbox/nút xóa kích hoạt sự kiện click của ô ngày
  item.addEventListener("click", (e) => e.stopPropagation());

  // Đổi trạng thái hoàn thành
  item.querySelector("input").addEventListener("change", (e) => {
    task.is_completed = e.target.checked;
    saveTasks();
    renderCalendar();
    if (isInsideModal) {
      renderDayDetailsList(task.task_date);
    }
  });

  // Xóa việc
  item.querySelector(".task-del-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    tasks = tasks.filter((t) => t.id !== task.id);
    saveTasks();
    renderCalendar();
    if (isInsideModal) {
      renderDayDetailsList(task.task_date);
    }
  });

  return item;
}

//Pop-up xem chi tiet

function openDayDetailsModal(dateStr) {
  currentSelectedDate = dateStr;
  dayDetailsSubtitle.textContent = `Ngày: ${dateStr}`;
  renderDayDetailsList(dateStr);
  dayDetailsModal.classList.remove("hidden");
}

function renderDayDetailsList(dateStr) {
  dayDetailsTaskList.innerHTML = "";
  const dayTasks = tasks.filter((t) => t.task_date === dateStr);

  if (dayTasks.length === 0) {
    dayDetailsTaskList.innerHTML = `<div class="empty-day-state">Chưa có công việc nào trong ngày này.</div>`;
    return;
  }

  dayTasks.forEach((task) => {
    dayDetailsTaskList.appendChild(createTaskItem(task, true));
  });
}

function closeDayDetailsModal() {
  dayDetailsModal.classList.add("hidden");
}

closeDayDetailsBtn.addEventListener("click", closeDayDetailsModal);
dayDetailsCloseBtn.addEventListener("click", closeDayDetailsModal);

// Từ pop-up chi tiết bấm thêm việc nhanh
dayDetailsAddBtn.addEventListener("click", () => {
  closeDayDetailsModal();
  openTaskModal(currentSelectedDate);
});

//Nhập liệu

function openTaskModal(defaultDate = "") {
  taskDatePicker.value = defaultDate || formatDateString(new Date());
  taskTextInput.value = "";
  taskTimeInput.value = "";
  taskModal.classList.remove("hidden");
  taskTextInput.focus();
}

function closeTaskModal() {
  taskModal.classList.add("hidden");
}

quickAddBtn.addEventListener("click", () => openTaskModal());
closeModalBtn.addEventListener("click", closeTaskModal);
cancelTaskBtn.addEventListener("click", closeTaskModal);

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = taskTextInput.value.trim();
  const dateStr = taskDatePicker.value;

  if (!title || !dateStr) return;

  const newTask = {
    id: Date.now().toString(),
    title: title,
    task_date: dateStr,
    time: taskTimeInput.value.trim(),
    tag: taskTagInput.value,
    is_completed: false,
    created_at: new Date().toISOString(),
  };

  tasks.push(newTask);
  saveTasks();
  closeTaskModal();
  renderCalendar();
});

// Khởi chạy

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

renderCalendar();
