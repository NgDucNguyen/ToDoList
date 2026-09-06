const sampleTasks = [
  {
    id: "1",
    title: "Team Sync",
    time: "8:00 AM",
    tag: "Work",
    task_date: "2026-09-07",
    is_completed: false,
  },
  {
    id: "2",
    title: "Status Update",
    time: "9:30 AM",
    tag: "Dev",
    task_date: "2026-09-08",
    is_completed: false,
  },
  {
    id: "3",
    title: "UX Review",
    time: "1:30 PM",
    tag: "Design",
    task_date: "2026-09-08",
    is_completed: false,
  },
  {
    id: "4",
    title: "Ship groceries",
    time: "5:00 PM",
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

// Liên kết
const monthYearLabel = document.getElementById("current-month-year");
const calendarGrid = document.getElementById("calendar-grid");
const prevMonthBtn = document.getElementById("prev-month-btn");
const nextMonthBtn = document.getElementById("next-month-btn");
const todayBtn = document.getElementById("today-btn");

// Bắt thêm các phần tử của thanh Topbar và Modal nâng cấp
const quickAddBtn = document.getElementById("quick-add-btn");
const taskModal = document.getElementById("task-modal");
const taskForm = document.getElementById("task-form");
const closeModalBtn = document.getElementById("close-modal-btn");
const cancelTaskBtn = document.getElementById("cancel-task-btn");

const taskTextInput = document.getElementById("task-text-input");
// Ô chọn ngày, giờ và menu nhãn Tag
const taskDatePicker = document.getElementById("task-date-picker");
const taskTimeInput = document.getElementById("task-time-input");
const taskTagInput = document.getElementById("task-tag-input");

//Định dạng
function formatDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
  // Tuần bắt đầu từ Thứ 2
  const startOffset = (firstDayIndex + 6) % 7;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  const todayStr = formatDateString(new Date());

  // 1. Dựng ngày đệm của tháng trước
  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const dateObj = new Date(currentYear, currentMonth - 1, dayNum);
    calendarGrid.appendChild(createDayCell(dateObj, true));
  }

  // 2. Dựng ngày của tháng hiện tại
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(currentYear, currentMonth, day);
    const isToday = formatDateString(dateObj) === todayStr;
    calendarGrid.appendChild(createDayCell(dateObj, false, isToday));
  }

  // 3. Dựng ngày đệm của tháng sau để lưới luôn đều hàng
  const totalSlots = startOffset + daysInMonth;
  const nextMonthPadding = totalSlots % 7 === 0 ? 0 : 7 - (totalSlots % 7);
  for (let day = 1; day <= nextMonthPadding; day++) {
    const dateObj = new Date(currentYear, currentMonth + 1, day);
    calendarGrid.appendChild(createDayCell(dateObj, true));
  }
}

/**
 * Tạo một khối ô ngày
 */
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

  // Bấm dấu + thì mở modal và gán sẵn ngày của ô đó
  header.querySelector(".add-task-btn").addEventListener("click", () => {
    openModal(dateStr);
  });

  const taskList = document.createElement("div");
  taskList.className = "task-list";

  // Lọc và gắn các task thuộc về ngày này
  const dayTasks = tasks.filter((t) => t.task_date === dateStr);
  dayTasks.forEach((task) => {
    taskList.appendChild(createTaskItem(task));
  });

  cell.appendChild(header);
  cell.appendChild(taskList);
  return cell;
}

function createTaskItem(task) {
  const item = document.createElement("div");
  item.className = `task-item ${task.is_completed ? "completed" : ""}`;

  item.innerHTML = `
    <!-- [MỚI] Hàng hiển thị giờ hẹn và nhãn màu -->
    <div class="task-meta">
      <span class="task-time">${task.time || ""}</span>
      ${task.tag ? `<span class="task-tag tag-${task.tag}">${task.tag}</span>` : ""}
    </div>
    <!-- Hàng nội dung chính: checkbox, tên việc và nút xóa -->
    <div class="task-body">
      <input type="checkbox" ${task.is_completed ? "checked" : ""}>
      <span class="task-title" title="${task.title}">${task.title}</span>
      <button class="task-del-btn" title="Xóa">✕</button>
    </div>
  `;

  // Checkbox toggle hoàn thành
  item.querySelector("input").addEventListener("change", (e) => {
    task.is_completed = e.target.checked;
    saveTasks();
    renderCalendar();
  });

  // Nút xóa
  item.querySelector(".task-del-btn").addEventListener("click", () => {
    tasks = tasks.filter((t) => t.id !== task.id);
    saveTasks();
    renderCalendar();
  });

  return item;
}

function openModal(defaultDate = "") {
  taskDatePicker.value = defaultDate || formatDateString(new Date());
  taskTextInput.value = "";
  taskTimeInput.value = "";
  taskModal.classList.remove("hidden");
  taskTextInput.focus();
}

function closeModal() {
  taskModal.classList.add("hidden");
}

quickAddBtn.addEventListener("click", () => openModal());
closeModalBtn.addEventListener("click", closeModal);
cancelTaskBtn.addEventListener("click", closeModal);

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
  closeModal();
  renderCalendar();
});

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

// Khởi chạy vẽ lịch lần đầu
renderCalendar();
