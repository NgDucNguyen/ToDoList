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

let editingTaskId = null;
const modalTitle = document.getElementById("modal-title");
const saveTaskBtn = document.getElementById("save-task-btn");
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

let currentTagFilter = "ALL";
let searchQuery = "";
const searchInput = document.getElementById("search-input");
const tagFilterButtons = document.querySelectorAll(".tag-filter-btn");
// DOM Pop-up xem chi tiết ngày
const dayDetailsModal = document.getElementById("day-details-modal");
const dayDetailsTitle = document.getElementById("day-details-title");
const dayDetailsSubtitle = document.getElementById("day-details-subtitle");
const dayDetailsTaskList = document.getElementById("day-details-task-list");

const batteryFill = document.getElementById("battery-fill");
const batteryPercent = document.getElementById("battery-percent");
const progressCount = document.getElementById("progress-count");

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

// Thuật toán sắp xếp task theo giờ
function sortTaskByTime(taskList) {
  return taskList.sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    return 0;
  });
}

// Hàm chuẩn hóa tiếng Việt (bỏ dấu, chuyển chữ thường)
function removeVietnameseTones(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
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

//Hàm lọc task theo tag và từ khóa
function getFilteredTasks(taskList) {
  return taskList.filter((task) => {
    // Khớp Tag
    const matchTag =
      currentTagFilter === "ALL" || task.tag === currentTagFilter;

    // Khớp từ khóa -> Tahcs từ
    if (!searchQuery) return matchTag;
    // git;
    const normalizedTitle = removeVietnameseTones(task.title);
    // Tách chuỗi tìm kiếm thành từng từ
    const searchWords = removeVietnameseTones(searchQuery)
      .split(/\s+/)
      .filter(Boolean);
    const matchQuery = searchWords.every((word) =>
      normalizedTitle.includes(word),
    );
    return matchTag && matchQuery;
  });
}
function createDayCell(dateObj, isOtherMonth, isToday = false) {
  const dateStr = formatDateString(dateObj);
  const cell = document.createElement("div");
  cell.className = `day-cell ${isOtherMonth ? "other-month" : ""} ${isToday ? "today" : ""}`;

  const lunarStr = getLunarDate(
    dateObj.getDate(),
    dateObj.getMonth() + 1,
    dateObj.getFullYear(),
  );

  const header = document.createElement("div");
  header.className = "day-header";
  header.innerHTML = `
  <div class="day-number-wrapper">
    <span class="day-num">${dateObj.getDate()}</span>
    <span class="lunar-num">${lunarStr}</span>
  </div>
  <button class="add-task-btn" title="Thêm việc">+</button>
`;

  // Bấm nút + để tạo việc mới
  header.querySelector(".add-task-btn").addEventListener("click", (e) => {
    e.stopPropagation(); // Không kích hoạt click vào ô ngày
    openTaskModal(dateStr);
  });

  const taskList = document.createElement("div");
  taskList.className = "task-list";

  const dayTasksBeforeFilter = tasks.filter((t) => t.task_date === dateStr);
  const rawDayTasks = getFilteredTasks(dayTasksBeforeFilter);
  const dayTasks = sortTaskByTime(rawDayTasks);

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
  item.style.cursor = "pointer"; // Đổi con trỏ chuột thành hình bàn tay

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

  // [SỬA TẠI ĐÂY]: Bấm thẳng vào thẻ công việc là mở form sửa ngay
  item.addEventListener("click", (e) => {
    e.stopPropagation(); // Không kích hoạt click vào ô ngày
    if (isInsideModal) {
      closeDayDetailsModal();
    }
    openTaskModal("", task); // Đổ dữ liệu công việc này lên form để sửa
  });

  // Chặn checkbox không cho mở popup sửa khi chỉ muốn tích hoàn thành
  const checkbox = item.querySelector("input");
  checkbox.addEventListener("click", (e) => e.stopPropagation());
  checkbox.addEventListener("change", (e) => {
    task.is_completed = e.target.checked;
    saveTasks();
    renderCalendar();
    if (isInsideModal) {
      renderDayDetailsList(task.task_date);
    }
  });

  // Chặn nút xóa không cho mở popup sửa khi ấn xóa
  const delBtn = item.querySelector(".task-del-btn");
  delBtn.addEventListener("click", (e) => {
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

// Ham cap nhật thanh pin
function updateDayProgress(dateStr) {
  const dayTasksBeforeFilter = tasks.filter((t) => t.task_date === dateStr);
  const dayTasks = getFilteredTasks(dayTasksBeforeFilter); // [SỬA TẠI ĐÂY]
  const total = dayTasks.length;
  const completed = dayTasks.filter((t) => t.is_completed).length;

  if (total === 0) {
    if (batteryFill) batteryFill.style.width = "0%";
    if (batteryPercent) batteryPercent.textContent = "0%";
    if (progressCount) progressCount.textContent = "0/0";
    return;
  }

  const percent = Math.round((completed / total) * 100);

  if (batteryFill) batteryFill.style.width = `${percent}%`;
  if (batteryPercent) batteryPercent.textContent = `${percent}%`;
  if (progressCount) progressCount.textContent = `${completed}/${total}`;
}

function renderDayDetailsList(dateStr) {
  // Cập nhật tiến độ hàng ngày
  updateDayProgress(dateStr);

  dayDetailsTaskList.innerHTML = "";
  const dayTasksBeforeFilter = tasks.filter((t) => t.task_date === dateStr);
  const rawDayTasks = getFilteredTasks(dayTasksBeforeFilter);
  const dayTasks = sortTaskByTime(rawDayTasks);

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

function openTaskModal(defaultDate = "", taskToEdit = null) {
  if (taskToEdit) {
    editingTaskId = taskToEdit.id;
    if (modalTitle) modalTitle.textContent = "Sửa việc";
    if (saveTaskBtn) saveTaskBtn.textContent = "Lưu";
    taskTextInput.value = taskToEdit.title;
    taskDatePicker.value = taskToEdit.task_date;
    taskTimeInput.value = taskToEdit.time || "";
    taskTagInput.value = taskToEdit.tag || "Daily";
  } else {
    editingTaskId = null;
    if (modalTitle) modalTitle.textContent = "Thêm công việc mới";
    if (saveTaskBtn) saveTaskBtn.textContent = "Lưu";
    taskDatePicker.value = defaultDate || formatDateString(new Date());
    taskTimeInput.value = "";
    taskTextInput.value = "";
    taskTagInput.value = "Daily";
  }

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

  if (editingTaskId) {
    const targetTask = tasks.find((t) => t.id === editingTaskId);
    if (targetTask) {
      targetTask.title = title;
      targetTask.task_date = dateStr;
      targetTask.time = taskTimeInput.value;
      targetTask.tag = taskTagInput.value;
    }
  } else {
    const newTask = {
      id: Date.now().toString(),
      title: title,
      task_date: dateStr,
      time: taskTimeInput.value,
      tag: taskTagInput.value,
      is_completed: false,
      created_at: new Date().toISOString(),
    };
    tasks.push(newTask);
  }
  saveTasks();
  closeTaskModal();
  renderCalendar();
});

// Ngày âm
const INT = Math.floor;
const PI = Math.PI;

function jdFromDate(dd, mm, yy) {
  let a = INT((14 - mm) / 12);
  let y = yy + 4800 - a;
  let m = mm + 12 * a - 3;
  let jd =
    dd +
    INT((153 * m + 2) / 5) +
    365 * y +
    INT(y / 4) -
    INT(y / 100) +
    INT(y / 400) -
    32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

function getNewMoonDay(k, timeZone = 7) {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;

  // Thời điểm Sóc trung bình
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;

  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);

  // Độ lệch Mặt Trời
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;

  // Độ lệch Mặt Trăng
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;

  // Độ lệch vĩ độ Mặt Trăng
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;

  // Hiệu chỉnh
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * M * dr);

  C1 -= 0.4068 * Math.sin(Mpr * dr);
  C1 += 0.0161 * Math.sin(2 * Mpr * dr);

  C1 -= 0.0004 * Math.sin(3 * Mpr * dr);

  C1 += 0.0104 * Math.sin(2 * F * dr);
  C1 -= 0.0051 * Math.sin((M + Mpr) * dr);

  C1 -= 0.0074 * Math.sin((M - Mpr) * dr);
  C1 += 0.0004 * Math.sin((2 * F + M) * dr);

  C1 -= 0.0004 * Math.sin((2 * F - M) * dr);
  C1 -= 0.0006 * Math.sin((2 * F + Mpr) * dr);

  C1 += 0.001 * Math.sin((2 * F - Mpr) * dr);
  C1 += 0.0005 * Math.sin((2 * Mpr + M) * dr);

  // Delta T
  let deltaT;

  if (T < -11) {
    deltaT =
      0.001 +
      0.000839 * T +
      0.0002261 * T2 -
      0.00000845 * T3 -
      0.000000081 * T * T3;
  } else {
    deltaT = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }

  const JdNew = Jd1 + C1 - deltaT;

  return INT(JdNew + 0.5 + timeZone / 24);
}

function getSunLongitude(dayNumber, timeZone = 7) {
  let T = (dayNumber - 2451545.5 - timeZone / 24) / 36525;
  let T2 = T * T;
  let dr = PI / 180;
  let M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  let L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL +=
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - PI * 2 * INT(L / (PI * 2));
  if (L < 0) L += PI * 2;
  return INT((L / PI) * 6);
}

function getLunarMonth11(yy, timeZone = 7) {
  let off = jdFromDate(31, 12, yy) - 2415021;
  let k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  let sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

function getLeapMonthOffset(a11, timeZone = 7) {
  let k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

function convertSolar2Lunar(dd, mm, yy, timeZone = 7) {
  let dayNumber = jdFromDate(dd, mm, yy);
  let k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  let lunarDay = dayNumber - monthStart + 1;
  let diff = INT((monthStart - a11) / 29);
  let lunarLeap = 0;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    let leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) {
        lunarLeap = 1;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth = lunarMonth - 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return [lunarDay, lunarMonth, lunarYear, lunarLeap];
}

function getLunarDate(dd, mm, yy) {
  const [lunarDay, lunarMonth, , lunarLeap] = convertSolar2Lunar(dd, mm, yy, 7);
  // Nếu là mùng 1 hoặc ngày nhuận có thể hiện rõ hơn: ví dụ "1/8" hoặc "1/8N"
  return `${lunarDay}/${lunarMonth}${lunarLeap ? "N" : ""}`;
}

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

//  Lắng nghe sự kiện Search & Filter Tag
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    renderCalendar();
    if (!dayDetailsModal.classList.contains("hidden")) {
      renderDayDetailsList(currentSelectedDate);
    }
  });
}

tagFilterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tagFilterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentTagFilter = btn.getAttribute("data-tag");
    renderCalendar();
    if (!dayDetailsModal.classList.contains("hidden")) {
      renderDayDetailsList(currentSelectedDate);
    }
  });
});

//============== QUẢN LÝ DỰ ÁN & KANBAN ==================
const calendarView = document.getElementById("calendar-view");
const kanbanView = document.getElementById("kanban-view");
const kanbanProjectTitle = document.getElementById("kanban-project-title");
const projectListEl = document.getElementById("project-list");
const addProjectBtn = document.getElementById("add-project-btn");
const addKanbanTaskBtn = document.getElementById("add-kanban-task-btn");
const calendarNavLink = document.querySelector(
  ".nav-manu .nav-link:first-child",
);

// Dữ liệu Projects
const defaultProjects = [
  { id: "proj_1", name: "UX Revamp" },
  { id: "proj_2", name: "Launch" },
  { id: "proj_3", name: "CV" },
];

let myProjects = JSON.parse(localStorage.getItem("planner_projects"));
if (!myProjects || !Array.isArray(myProjects) || myProjects.length === 0) {
  myProjects = defaultProjects;
  localStorage.setItem("planner_projects", JSON.stringify(myProjects));
}

// Dữ liệu thẻ việc của các cột
let kanbanTasks =
  JSON.parse(localStorage.getItem("planner_kanban_tasks")) || [];

function saveKanbanTasks() {
  localStorage.setItem("planner_kanban_tasks", JSON.stringify(kanbanTasks));
}

let currentActiveProjectId = null;

// Chuyển sang xem Lịch
function showCalendarView() {
  if (calendarView) calendarView.classList.remove("hidden");
  if (kanbanView) kanbanView.classList.add("hidden");
  if (calendarNavLink) calendarNavLink.classList.add("active");
  document
    .querySelectorAll(".project-item")
    .forEach((el) => el.classList.remove("active"));
  currentActiveProjectId = null;
}

// Chuyển sang xem Kanban của Project
function showKanbanView(proj) {
  currentActiveProjectId = proj.id;
  if (calendarView) calendarView.classList.add("hidden");
  if (kanbanView) kanbanView.classList.remove("hidden");
  if (calendarNavLink) calendarNavLink.classList.remove("active");
  if (kanbanProjectTitle) kanbanProjectTitle.textContent = proj.name;
  renderKanbanBoard();
}

if (calendarNavLink) {
  calendarNavLink.addEventListener("click", (e) => {
    e.preventDefault();
    showCalendarView();
  });
}

// Render danh sách dự án ra sidebar với tính năng sửa tên trực tiếp
function renderProjectsList() {
  if (!projectListEl) return;
  projectListEl.innerHTML = "";

  myProjects.forEach((proj) => {
    const item = document.createElement("div");
    item.className = "project-item";
    if (proj.id === currentActiveProjectId) item.classList.add("active");

    item.innerHTML = `
      <div class="proj-left">
        <span class="icon">📁</span>
        <span class="proj-name-text">${proj.name}</span>
      </div>
      <button class="proj-more-btn" title="Tùy chọn">•••</button>
    `;

    const projNameSpan = item.querySelector(".proj-name-text");
    const moreBtn = item.querySelector(".proj-more-btn");

    // Hàm kích hoạt sửa tên dự án trực tiếp
    const startRenameProject = () => {
      // Đóng tất cả menu ... đang mở
      document.querySelectorAll(".proj-action-menu").forEach((m) => m.remove());

      const input = document.createElement("input");
      input.type = "text";
      input.className = "proj-inline-input";
      input.value = proj.name;

      projNameSpan.replaceWith(input);
      input.focus();
      input.select(); // Tự động bôi đen toàn bộ tên dự án

      let isSaved = false;
      const saveProjectName = () => {
        if (isSaved) return;
        isSaved = true;
        const newName = input.value.trim();
        if (newName && newName !== proj.name) {
          proj.name = newName;
          localStorage.setItem("planner_projects", JSON.stringify(myProjects));

          // Nếu đang mở đúng dự án này thì cập nhật luôn tiêu đề Kanban
          if (currentActiveProjectId === proj.id && kanbanProjectTitle) {
            kanbanProjectTitle.textContent = proj.name;
          }
        }
        renderProjectsList();
      };

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          input.blur();
        } else if (e.key === "Escape") {
          isSaved = true;
          renderProjectsList();
        }
      });

      input.addEventListener("blur", saveProjectName);
    };

    // Click vào item để mở Kanban
    item.addEventListener("click", (e) => {
      if (e.target.classList.contains("proj-inline-input")) return;
      document
        .querySelectorAll(".project-item")
        .forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      showKanbanView(proj);
    });

    // Double click vào tên dự án để sửa nhanh
    projNameSpan.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      startRenameProject();
    });

    // Bấm nút ... để mở menu
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".proj-action-menu").forEach((m) => m.remove());

      const menu = document.createElement("div");
      menu.className = "proj-action-menu";
      menu.innerHTML = `
        <button type="button" class="rename-proj-action">✏️ Đổi tên</button>
        <button type="button" class="delete-proj-action">🗑 Xóa dự án</button>
      `;

      // Chọn Đổi tên: kích hoạt inline edit
      menu
        .querySelector(".rename-proj-action")
        .addEventListener("click", (evt) => {
          evt.stopPropagation();
          menu.remove();
          startRenameProject();
        });

      // Chọn Xóa dự án
      menu
        .querySelector(".delete-proj-action")
        .addEventListener("click", (evt) => {
          evt.stopPropagation();
          menu.remove();
          myProjects = myProjects.filter((p) => p.id !== proj.id);
          localStorage.setItem("planner_projects", JSON.stringify(myProjects));

          // Xóa luôn các task thuộc dự án này
          kanbanTasks = kanbanTasks.filter((t) => t.project_id !== proj.id);
          saveKanbanTasks();

          if (currentActiveProjectId === proj.id) {
            showCalendarView();
          }
          renderProjectsList();
        });

      item.appendChild(menu);
    });

    projectListEl.appendChild(item);
  });
}

// Nút + thêm dự án mới
if (addProjectBtn) {
  addProjectBtn.addEventListener("click", () => {
    const name = prompt("Nhập tên dự án mới:");
    if (name && name.trim()) {
      const newProj = { id: "proj_" + Date.now(), name: name.trim() };
      myProjects.push(newProj);
      localStorage.setItem("planner_projects", JSON.stringify(myProjects));
      renderProjectsList();
      showKanbanView(newProj);
    }
  });
}

// Render các thẻ việc vào cột
function renderKanbanBoard() {
  if (!currentActiveProjectId) return;

  const statuses = ["todo", "doing", "done"];
  statuses.forEach((st) => {
    const container = document.getElementById(`cards-${st}`);
    const countEl = document.getElementById(`count-${st}`);
    if (!container) return;

    const cards = kanbanTasks.filter(
      (t) => t.project_id === currentActiveProjectId && t.status === st,
    );

    if (countEl) countEl.textContent = cards.length;
    container.innerHTML = "";

    cards.forEach((task) => {
      const card = document.createElement("div");
      card.className = "sample-card";
      card.innerHTML = `
        <span class="card-title">${task.title}</span>
        <div class="card-actions">
          <button class="card-edit-btn" title="Đổi tên">✏️</button>
          <button class="card-del-btn" title="Xóa việc">✕</button>
        </div>
      `;

      const titleSpan = card.querySelector(".card-title");
      const editBtn = card.querySelector(".card-edit-btn");
      const delBtn = card.querySelector(".card-del-btn");
      const actionsDiv = card.querySelector(".card-actions");

      // Hàm kích hoạt sửa tên
      const startEditing = () => {
        // Tạo ô input thay thế vị trí span tên việc
        const input = document.createElement("input");
        input.type = "text";
        input.className = "card-inline-input";
        input.value = task.title;

        // Ẩn tạm nút sửa/xóa khi đang gõ
        actionsDiv.style.display = "none";
        titleSpan.replaceWith(input);

        input.focus();
        input.select(); // chọn tên hiện tại

        let isSaved = false;
        const saveEdit = () => {
          if (isSaved) return;
          isSaved = true;
          const newTitle = input.value.trim();
          if (newTitle && newTitle !== task.title) {
            task.title = newTitle;
            saveKanbanTasks();
          }
          renderKanbanBoard();
        };

        // Bấm Enter để lưu
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            input.blur();
          } else if (e.key === "Escape") {
            isSaved = true;
            renderKanbanBoard();
          }
        });

        // Bấm ra khoảng trống ngoài
        input.addEventListener("blur", saveEdit);
      };

      // Bấm nút bút để kích hoạt sửa
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        startEditing();
      });

      // Bấm trực tiếp 2 lần vào tên để sửa nhanh
      titleSpan.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        startEditing();
      });

      // Bấm nút ✕ để xóa vĩnh viễn việc
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        kanbanTasks = kanbanTasks.filter((t) => t.id !== task.id);
        saveKanbanTasks();
        renderKanbanBoard();
      });

      container.appendChild(card);
    });
  });
}

// Bắt sự kiện bấm nút + trên cột Việc cần làm
if (addKanbanTaskBtn) {
  addKanbanTaskBtn.addEventListener("click", () => {
    if (!currentActiveProjectId) return;

    const title = prompt("Nhập công việc cần làm:");
    if (title && title.trim()) {
      kanbanTasks.push({
        id: "kb_" + Date.now(),
        project_id: currentActiveProjectId,
        title: title.trim(),
        status: "todo",
      });

      saveKanbanTasks();
      renderKanbanBoard();
    }
  });
}

// Đóng menu ... khi click ra ngoài
document.addEventListener("click", () => {
  document.querySelectorAll(".proj-action-menu").forEach((m) => m.remove());
});

// Chạy khởi tạo danh sách dự án
renderProjectsList();
