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

## Tính năng bổ sung

- Trong dự án, kéo nền thẻ hoặc dòng **Kéo sang cột khác** để đổi trạng thái. Có thể thả vào vùng trống, thẻ khác hoặc tiêu đề của cột; cột rỗng luôn có vùng nhận thả. Menu trạng thái trên thẻ vẫn dùng được khi không kéo thả.
- Tích ô để chuyển việc sang **Hoàn thành**, bỏ tích để đưa về **Việc cần làm**. Vị trí cuộn được giữ khi cập nhật công việc. Mở lại biểu tượng Desktop sẽ đưa cửa sổ đang chạy lên trước, tránh hai cửa sổ cùng chỉnh hồ sơ dữ liệu.
- Mở **Lọc nâng cao** ở thanh bên để kết hợp ưu tiên, trạng thái và khoảng ngày với bộ lọc nhãn và ô tìm kiếm. Nút **Xóa lọc nâng cao** chỉ đặt lại ba điều kiện này.
- Trong hộp thêm/sửa công việc, chọn **Nhắc việc** sau khi nhập ngày và giờ. App kiểm tra mỗi 30 giây và nhắc khi thời điểm đến; khi mở app trong vòng 10 phút sau thời điểm nhắc, thông báo cũng xuất hiện. App cần đang chạy để nhắc đúng giờ. Lời nhắc trong app giữ nguyên cho tới khi bạn đóng. Thông báo Windows chỉ hoạt động khi hệ thống và shortcut của app hỗ trợ ([điều kiện của Electron](https://www.electronjs.org/docs/latest/tutorial/notifications)).
- Trong hộp công việc, nhập tên mẫu và bấm **Lưu mẫu** để lưu nội dung đang điền. Khi tạo công việc mới, chọn mẫu và bấm **Dùng mẫu**. Ngày, ngày kết thúc lặp lại và tiến độ checklist không được chép sang công việc mới. Mẫu lưu trong `planner_templates_v1` cùng hồ sơ ứng dụng; sao lưu toàn bộ `%APPDATA%/todolist` sẽ giữ cả mẫu.

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

## Ghi chú

Mở **Ghi chú** trên thanh bên → **Ghi chú mới** để viết văn bản thuần như Notepad. Mỗi ghi chú có tiêu đề và nội dung riêng; ô tìm kiếm tìm cả hai. App tự lưu sau khi ngừng gõ 250 ms, khi chuyển trang và trước khi đóng. Có thể bấm **Lưu** hoặc **Ctrl+S** để lưu ngay. Trạng thái **Đã lưu trên máy** chỉ hiện khi ghi thành công; nếu lỗi bộ nhớ, nội dung đang sửa được giữ trong ô soạn thảo để thử lại hoặc xuất TXT.

**Xuất TXT** lưu nội dung đang mở thành file UTF-8, giữ tiếng Việt, xuống dòng và khoảng trắng. **Xóa** cần xác nhận và lưu bản dữ liệu trước lần xóa gần nhất tại `planner_notes_before_delete_v1`. Các ghi chú dùng khóa `planner_notes_v1` riêng, không thay đổi công việc hay lịch học. Khi sao lưu đầy đủ, copy toàn bộ `%APPDATA%\todolist` để giữ cả ghi chú và ảnh nền; các bản sao JSON công việc trước khi đồng bộ HUST chỉ chứa dữ liệu công việc.

Mã liên quan: `notes-store.js` (lưu dữ liệu), `notes.js` (soạn thảo và tự lưu).

## Chatbot

Bấm avatar tròn ở góc dưới bên phải để mở **Chatbot nội bộ**. Chatbot không cần Internet, API key, dịch vụ AI hoặc tải model bên ngoài. Câu hỏi, lịch và ghi chú được xử lý ngay trong app, dùng được cả khi mở `index.html` trên trình duyệt và trong EXE. Riêng chức năng đồng bộ QLĐT HUST vẫn cần kết nối tới HUST như trước.

Mô hình nhận diện 14 nhóm yêu cầu được huấn luyện từ 275 câu mẫu tiếng Việt do project cung cấp, bằng đặc trưng từ/cụm từ/ký tự và hồi quy softmax. Model đóng gói trong `chatbot-model.js`. Đây là mô hình phân loại ý định chuyên cho Planner kết hợp bộ đọc ngày giờ và câu trả lời có kiểm soát, **không phải mô hình ngôn ngữ lớn được huấn luyện từ đầu**. Không tự lấy dữ liệu cá nhân làm mẫu huấn luyện và không cam kết hiểu mọi cách diễn đạt. Khi độ tin cậy thấp, bot yêu cầu nói rõ thay vì tự ghi dữ liệu.

Ví dụ: “Mai tôi học môn nào?”, “Tóm tắt lịch tuần này”, “Việc nào quá hạn?”, “Xem việc chưa lên lịch”, “Hôm nay làm xong những việc nào?”, “Tuần sau hôm nào ít việc nhất?”, “Kiểm tra trùng lịch ngày mai”, “Tìm ghi chú Ý tưởng”, “Cách sao lưu dữ liệu”. Các câu không dấu cũng được nhận diện. Lịch lặp được đọc theo từng lần; buổi HUST đã ẩn không được liệt kê. Bot chỉ thấy lịch đã có trong app, không tự đọc QLĐT và không suy ra toàn bộ lịch HUST đã đầy đủ.

Không cần chọn phạm vi ngày. Nếu câu hỏi nêu ngày, bot tự hiểu hôm nay/mai/ngày kia, thứ 2–CN, tuần này/sau, tháng này/sau, ngày/tháng[/năm] hoặc YYYY-MM-DD. Nếu không nêu ngày, tìm toàn bộ lịch/công việc đã lưu, gồm quá khứ, tương lai và việc chưa có ngày; không giới hạn mặc định 62 ngày/500 lịch. Kết quả dài chia 20 mục mỗi lượt, gõ “xem tiếp” để đọc tiếp. Chuỗi lặp hiển thị theo quy luật; hỏi ngày/tuần để xem từng lần, tránh đếm vô hạn chuỗi chưa có ngày kết thúc. Xem hoàn thành/chưa hoàn thành toàn bộ chỉ đếm việc đơn và trạng thái từng lần lặp đã ghi nhận riêng. Hỏi ngày ít lịch hoặc trùng giờ mà không nêu thời gian thì bot tự xem 7 ngày tới và ghi rõ mốc đó. So sánh ngày ít/bận dựa trên số lịch đã lưu, không khẳng định rảnh hoàn toàn; trùng giờ chỉ kết luận cho lịch đủ giờ bắt đầu/kết thúc.

Tạo công việc: “Thêm lịch đọc sách ngày mai 19h”, hoặc “Tạo lịch họp nhóm” rồi trả lời ngày/giờ khi bot hỏi. Giờ hỗ trợ HH:mm, 19h, 8h30, 7 giờ tối; nhập “cả ngày” để không đặt giờ. Tạo ghi chú: “Ghi chú: nội dung” hoặc “Tạo ghi chú Ý tưởng với nội dung: ...”. Bot giữ nội dung ghi chú và xuống dòng. Mỗi lần chỉ đề xuất một việc cá nhân hoặc một ghi chú, **Xác nhận tạo** mới ghi, **Bỏ qua** không ghi. Thiếu thông tin thì hỏi lại; gõ “hủy” bỏ yêu cầu đang điền. Không tự sửa/xóa, tạo HUST, nhiều công việc hay lịch lặp. “Nhắc tôi ...” tạo công việc; muốn thông báo Windows, mở chi tiết và chọn Nhắc việc.

Huấn luyện lại: thêm ví dụ vào đúng nhóm trong `chatbot-training.json`, giữ tập `evaluation` tách biệt, chạy `npm.cmd run train:chatbot` rồi `npm.cmd test`. Script huấn luyện có seed cố định, không dùng mạng hoặc dữ liệu lịch cá nhân; xuất trọng số và `chatbot-training-report.json`. Bản đầu nhận đúng 43/46 câu của tập kiểm tra cố định (93,48%); đây chỉ là điểm phân loại trên bộ ví dụ nhỏ, không phải độ chính xác chung của chatbot. Bộ kiểm tra ngày giờ, dữ liệu và thao tác chạy riêng. `npm.cmd run build-exe` tự huấn luyện lại trước khi đóng gói.

Cuộc trò chuyện và yêu cầu chưa xác nhận chỉ giữ trong phiên hiện tại. Lịch/ghi chú đã xác nhận lưu bình thường. Nếu có file cấu hình key từ bản cũ, bản nội bộ không đọc hay sử dụng file đó. HUST/reminder tiếp tục dùng preload cách ly; chatbot không dùng IPC mạng. Các kiểm tra giao diện/desktop sử dụng mô hình và câu trả lời nội bộ thật trong hồ sơ tạm, có chặn mạng để phát hiện yêu cầu ra ngoài.

Mã liên quan: `chatbot.js`/`chatbot.css` (giao diện), `chatbot-core.js` (đọc/lưu được kiểm tra), `chatbot-nlu.js` (đặc trưng/phân loại), `chatbot-local.js` (ngày giờ/hội thoại), `chatbot-knowledge.js` (kiến thức app), `scripts/train-chatbot.cjs` (huấn luyện). Avatar mặc định là SVG ViT, thay ảnh và cập nhật đường dẫn trong `index.html` nếu muốn.

## Đồng bộ lịch học HUST

Thanh bên có hai trang lịch riêng: **Lịch** dành cho công việc cá nhân, **Lịch HUST** dành cho buổi học. Hai lịch có khung tháng và nút chuyển tháng độc lập. **Công việc** và Kanban hiển thị việc cá nhân. Trong hộp thêm/sửa, mục **Lưu vào lịch** cho phép chuyển việc tự thêm giữa hai lịch.

Trong bản desktop, mở **Lịch HUST → Đồng bộ HUST**:

1. Bấm **Kết nối HUST**, tự đăng nhập ở cửa sổ QLĐT và chọn học kỳ có thời khóa biểu. Cửa sổ này dùng phiên riêng của app; đăng nhập sẵn trên Chrome không thay thế bước này.
2. Quay lại Planner, bấm **Đọc lịch / cập nhật** để xem toàn bộ các buổi đã đọc, khoảng ngày đầu–cuối, giờ bắt đầu/kết thúc, phòng, số buổi thêm/cập nhật và cảnh báo môn chưa có lịch. Bảng xem trước không giới hạn ở 100 buổi đầu.
3. Bấm **Áp dụng vào Lịch HUST**. App nhập từng buổi vào trang lịch học riêng, không tạo dự án HUST. Đọc lại cùng lịch không tạo bản trùng. Dùng **Thêm buổi học** hoặc dấu **+** trong ô ngày ở Lịch HUST để nhập lịch học bù thủ công; các buổi này không bị đồng bộ ghi đè.
4. Sau lần áp dụng đầu tiên, có thể bật **Tự cập nhật mỗi 6 giờ khi app đang mở**. Tự động chỉ áp dụng cho tài khoản và học kỳ đã xác nhận; đổi tài khoản/học kỳ cần xem trước lại. Phiên hết hạn cần đăng nhập lại. App không cập nhật khi đang đóng.

Đây là đồng bộ một chiều **HUST → Planner**, chỉ lấy **thời khóa biểu gốc**. App bỏ qua các thông báo nghỉ, đổi lịch và học bù; bạn tự thêm hoặc chỉnh những buổi này. Các buổi tự thêm không bị đồng bộ ghi đè. App giữ tiến độ hoàn thành, ghi chú, checklist và các trường tên/ngày/giờ bạn đã sửa riêng. Buổi không còn trong thời khóa biểu gốc sẽ được ẩn, không xóa dữ liệu gốc; nếu buổi đó xuất hiện lại thì phục hồi cùng công việc. Môn chưa được nhà trường xếp lịch chỉ được báo, không tự đoán ngày học.

Trước mỗi lần áp dụng, app ghi bản JSON dữ liệu công việc vào `%APPDATA%\todolist\backups\before-hust-*.json`. Nếu sao lưu thất bại thì không nhập lịch. Bản sao này không chứa ảnh nền; muốn giữ ảnh nền, sao lưu toàn bộ hồ sơ như hướng dẫn ở trên. App cũng giữ bản dữ liệu trước lần nhập đầu tiên tại khóa `planner_backup_before_hust`.

Khi mở bản có trang Lịch HUST lần đầu, app bỏ các dự án HUST tự tạo cũ và chuyển các buổi trong đó sang lịch học riêng. ID, ghi chú, checklist và tiến độ được giữ lại. Dữ liệu trước khi chuyển được lưu nguyên bản tại khóa `planner_backup_before_hust_calendar`; nếu không ghi được bản sao thì không chuyển. Dự án do bạn tự đặt tên không bị xóa theo tên.

Cửa sổ HUST tắt Node và chạy sandbox, lưu phiên đăng nhập riêng tại partition `persist:planner-hust-qldt`. Bộ đọc chỉ trả thông tin thời khóa biểu và mã tài khoản đã băm; không lấy mật khẩu/cookie/token để đưa vào dữ liệu công việc. **Ngắt kết nối** xóa phiên HUST riêng và tắt tự cập nhật, giữ lịch đã nhập.

Bộ đọc hiện dựa trên cấu trúc trang thời khóa biểu HUST. Khi trang thay đổi hoặc tải thiếu dữ liệu, app dừng và báo lỗi thay vì ghi đè lịch. Thông báo học bù không tham gia quá trình đọc lịch. Bản mở `index.html` trên trình duyệt không có kết nối HUST.

Mã liên quan: `hust-connector.js` (cửa sổ, phiên và IPC), `hust-extractor.js` (bộ đọc trang chính thức), `hust-ui.js` (xem trước/tự cập nhật), `planner-store.js` (nhập và bảo toàn dữ liệu). Chạy `npm run test:hust` để kiểm tra connector Electron với trang HTTPS giả lập và hồ sơ tạm; bài kiểm tra này không kết nối tài khoản thật.
