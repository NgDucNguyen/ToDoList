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

  const rawDayTasks = tasks.filter((t) => t.task_date === dateStr);
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
  const dayTasks = tasks.filter((t) => t.task_date === dateStr);
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
  const rawDayTasks = tasks.filter((t) => t.task_date === dateStr);
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
