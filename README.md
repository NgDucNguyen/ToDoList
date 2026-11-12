# My Daily Planner

Ứng dụng Electron lập kế hoạch cá nhân, dùng được trực tiếp bằng `index.html` trên trình duyệt.

## Chạy và kiểm tra

- `npm start`: chạy bản desktop từ mã nguồn.
- `npm test`: kiểm tra dữ liệu, chuyển đổi dữ liệu cũ và lịch lặp.
- `npm run test:ui`: kiểm tra luồng sử dụng, ảnh nền và 8 kích thước cửa sổ bằng Chromium của Electron (tắt Node trong trang) với dữ liệu mẫu trong bộ nhớ và hồ sơ tạm riêng.
- `node scripts/check-ui.cjs --screenshots`: kiểm tra và lưu ảnh mẫu trong thư mục tạm.
- `npm run test:electron`: mở cửa sổ Electron ẩn với hồ sơ tạm để kiểm tra bản desktop. Không dùng hồ sơ dữ liệu cá nhân.
- `npm run build-exe`: mỗi lần đóng gói vào thư mục mới `dist/build-<thời gian>-<mã>/MyDailyPlanner-win32-x64`, đường dẫn EXE được in trong Terminal. Không xóa hay ghi đè bản cũ, tránh lỗi `EBUSY` khi thư mục cũ đang mở. Đóng app cũ trước khi chạy bản mới. Dùng cả thư mục build, không tách riêng file `.exe`.

Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd` thay cho `npm`.

## Năm tính năng mới

1. **Dự án ↔ Lịch ↔ To-Do:** cùng một công việc được cập nhật ở mọi màn hình. Chọn dự án và ngày trong hộp chi tiết để đưa việc lên lịch. Việc dự án cũ chưa có ngày vẫn nằm ở dự án và mục **Chưa lên lịch**.
2. **Hôm nay / Sắp tới / Quá hạn:** Sắp tới gồm ngày mai đến hết 7 ngày tiếp theo. Quá hạn gồm việc chưa hoàn thành có ngày trước hôm nay. Có công tắc hiện/ẩn việc đã hoàn thành.
3. **Ưu tiên / Quan trọng:** bốn mức Thấp, Bình thường, Cao, Khẩn cấp; dấu sao được lưu. Việc chưa hoàn thành được sắp theo ưu tiên, dấu sao rồi ngày và giờ. Mục Quan trọng hiển thị việc đơn được gắn sao ở mọi ngày, và các lần lặp đã qua hoặc trong 7 ngày tới.
4. **Mô tả / Checklist:** bấm tên công việc để chỉnh ghi chú và các bước nhỏ. Tích checklist và lưu trong chi tiết; cũng có thể tích trực tiếp ở cửa sổ xem ngày. Các bước không tự hoàn thành cả công việc.
5. **Lặp lại:** theo ngày, tuần (chọn thứ) hoặc tháng, có khoảng lặp và ngày kết thúc tùy chọn. Lặp ngày 31 sẽ dùng ngày cuối tháng ngắn hơn và quay về ngày 31 ở tháng sau. Mỗi lần có trạng thái và checklist riêng. Khi sửa/xóa, chọn **Chỉ lần này** hoặc **Cả chuỗi lặp lại**. Ngày bắt đầu chuỗi được giữ cố định; có thể dời từng lần. Để dừng lặp mà giữ lịch sử, đặt ngày kết thúc. Kanban hiển thị lần chưa hoàn thành có ngày gần nhất của mỗi chuỗi; các lần khác xem trên lịch.

Xóa một dự án sẽ giữ lại công việc và bỏ liên kết dự án đó.

## Ảnh nền cá nhân

Bấm **Ảnh nền** ở cuối thanh bên (biểu tượng ảnh ở góc trên trên màn hình nhỏ) → **Chọn ảnh từ máy** → chỉnh độ phủ sáng, độ mờ và vị trí → **Áp dụng**. Có thể xem trước trực tiếp; **Hủy** sẽ trả về nền đã lưu. Chọn **Nền mặc định** rồi **Áp dụng** để bỏ ảnh.

Hỗ trợ JPG, PNG, WebP tối đa 20 MB. Ảnh được tối ưu đến cạnh dài tối đa 2560 px, lưu cục bộ trong IndexedDB `planner_appearance` của cùng hồ sơ ứng dụng. Không tải lên máy chủ và không chiếm dung lượng localStorage của công việc. Copy toàn bộ thư mục hồ sơ khi sao lưu để giữ cả ảnh nền. Bản web và desktop lưu ảnh riêng nhau.

## Dữ liệu và cập nhật

- Bản desktop giữ tên ứng dụng `todolist` và hồ sơ dữ liệu mặc định `%APPDATA%/todolist`.
- Bản web và bản Electron có bộ nhớ riêng. Mở `index.html` trên web không tự lấy dữ liệu từ `.exe`.
- Lần đầu mở bản mới, ứng dụng chuyển `planner_tasks`, `planner_projects`, `planner_kanban_tasks` vào mô hình dùng chung `planner_data_v2`.
- Trước khi chuyển, lưu bản gốc tại `planner_backup_before_v2`. Các khóa dữ liệu cũ không bị xóa hay ghi đè. Nếu không đọc được dữ liệu hoặc không ghi được bản sao, ứng dụng dừng chuyển đổi và báo lỗi.
- Bản `.exe` cũ không đọc định dạng mới. Đóng bản cũ trước khi chuyển sang bản mới; sau khi đã chuyển, tiếp tục dùng bản mới để tránh nhập thêm dữ liệu vào hai phiên bản riêng nhau.
- Trước khi thay `.exe`, đóng ứng dụng và copy toàn bộ `%APPDATA%/todolist` ra nơi khác. Không commit thư mục dữ liệu cá nhân lên GitHub.

Mã chính: `planner-store.js` (dữ liệu và lặp lại), `app.js` (giao diện), `lunar.js` (âm lịch), `main.js` (cửa sổ Electron).
