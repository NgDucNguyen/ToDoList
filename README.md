# Daily Planner

Ứng dụng lập kế hoạch cá nhân bằng **Electron + JavaScript**, gồm lịch, Kanban, ghi chú có định dạng và chatbot tiếng Việt chạy nội bộ. Dữ liệu lưu trên thiết bị; các chức năng lập kế hoạch không cần tài khoản hoặc API key.

[Bản phát hành](https://github.com/NgDucNguyen/ToDoList/releases) · [Báo lỗi / đề xuất](https://github.com/NgDucNguyen/ToDoList/issues)

## Tính năng

| Phần | Chức năng |
| --- | --- |
| Lịch cá nhân | Lịch tháng, âm lịch Việt Nam, thêm/sửa việc theo ngày/giờ, tìm kiếm và lọc nhãn. |
| Công việc | Hôm nay, sắp tới, quá hạn, quan trọng, chưa lên lịch; ưu tiên, mô tả và checklist. |
| Dự án / Kanban | Việc cần làm, Đang thực hiện, Hoàn thành; kéo thả hoặc đổi trạng thái bằng menu. |
| Lịch lặp | Theo ngày, tuần, tháng; sửa một lần hoặc cả chuỗi; tiến độ từng lần độc lập. |
| Mẫu và nhắc việc | Lưu mẫu công việc, nhắc trước giờ khi ứng dụng đang chạy. |
| Ghi chú | Tự lưu, tìm kiếm, Ctrl+B, tiêu đề 1/2/3, checklist có ô tích và xuất TXT. |
| Giao diện | Điều chỉnh theo cửa sổ; ảnh nền từ máy, chỉnh độ phủ sáng, làm mờ và vị trí. |
| Chatbot nội bộ | Tra cứu/tóm tắt lịch và ghi chú; đề xuất tạo một việc hoặc ghi chú, có xác nhận. |
| Lịch HUST | Trang lịch học riêng; desktop hỗ trợ nhập thời khóa biểu QLĐT sau khi đăng nhập. |

Công việc cá nhân dùng chung dữ liệu giữa Lịch, Công việc và dự án. Xóa dự án giữ công việc và bỏ liên kết dự án.

## Chọn cách sử dụng

| | Desktop Windows | Trình duyệt / GitHub Pages |
| --- | --- | --- |
| Lịch, Kanban, ghi chú, ảnh nền, chatbot | Có | Có |
| Thêm buổi học thủ công ở Lịch HUST | Có | Có |
| Đăng nhập và đồng bộ QLĐT HUST | Có | Không |
| Nhắc việc | Trong app; thông báo Windows tùy hệ thống | Trong trang; thông báo tùy quyền trình duyệt |
| Nơi lưu | Hồ sơ ứng dụng trên máy | Bộ nhớ trình duyệt tại địa chỉ đang mở |
| Đồng bộ giữa máy/web/desktop | Không | Không |

Nhắc việc và tự cập nhật HUST cần app đang mở. Chưa có đồng bộ đám mây, tự cập nhật EXE hoặc bản đóng gói macOS/Linux được kiểm chứng.

## Dùng Windows, không cần Node.js

1. Vào [Releases](https://github.com/NgDucNguyen/ToDoList/releases), chọn bản có ZIP Windows x64. Nếu chưa có ZIP, chạy từ mã nguồn theo hướng dẫn bên dưới.
2. Giải nén **toàn bộ** ZIP vào thư mục riêng.
3. Chạy `MyDailyPlanner.exe`. Có thể tạo shortcut ra Desktop.

Giữ các tệp/thư mục đi kèm; không kéo riêng EXE ra ngoài. Bản build là ứng dụng portable, chưa có bộ cài hoặc chữ ký phát hành. Nếu Windows cảnh báo, kiểm tra nguồn tải và nội dung cảnh báo trước khi chạy.

## Chạy từ mã nguồn

Cần **Node.js 22.12 trở lên**, npm và Git. Desktop/build được kiểm tra trên Windows x64. Lần cài đầu cần Internet để tải các gói và Electron; các chức năng nội bộ sau đó không cần mạng.

```sh
git clone https://github.com/NgDucNguyen/ToDoList.git
cd ToDoList
npm ci
npm start
```

`package-lock.json` được đưa vào Git để người dùng và CI cài cùng phiên bản thư viện. Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd`, ví dụ `npm.cmd ci` và `npm.cmd start`.

### Dùng thử trên web

Mở `index.html` bằng trình duyệt hiện đại để thử nhanh, không cần npm. Khi triển khai, xuất thư mục web riêng:

```sh
npm run build:web
```

Lệnh in đường dẫn `dist/web-<mã>/`. Phục vụ thư mục này bằng máy chủ tĩnh hoặc GitHub Pages. Trình duyệt cần cho phép localStorage và IndexedDB. `file://`, localhost và website triển khai có vùng lưu riêng; đổi trình duyệt, địa chỉ hoặc cổng không tự chuyển dữ liệu theo.

## Hướng dẫn nhanh

### Công việc và lịch

- Bấm **Thêm công việc** hoặc dấu **+** trong ô ngày. Chi tiết có ngày/giờ, dự án, ưu tiên, mô tả, checklist, lịch lặp và nhắc việc.
- Tích để hoàn thành; bỏ tích đưa về Việc cần làm. Tích hết checklist không tự hoàn thành cả công việc.
- **Sắp tới** gồm ngày mai đến hết 7 ngày tiếp theo; **Quá hạn** gồm việc chưa hoàn thành trước hôm nay.
- Kết hợp tìm kiếm, nhãn và **Lọc nâng cao** theo ưu tiên/trạng thái/ngày. Kiểm tra bộ lọc nếu không thấy việc.
- Khi sửa/xóa lịch lặp, chọn **Chỉ lần này** hoặc **Cả chuỗi lặp lại**. Lặp ngày 31 dùng ngày cuối ở tháng ngắn hơn. Đặt ngày kết thúc để dừng chuỗi và giữ lịch sử.
- Kanban hiển thị lần chưa hoàn thành có ngày gần nhất của mỗi chuỗi; xem các lần khác trên lịch.

### Ghi chú

Mở **Ghi chú → Ghi chú mới**. Nội dung và định dạng tự lưu sau khi ngừng gõ; có **Lưu / Ctrl+S**. Chỉ coi đã lưu khi trạng thái hiện **Đã lưu trên máy**.

| Thao tác | Cách dùng |
| --- | --- |
| Chữ đậm | Chọn chữ rồi Ctrl+B hoặc nút B; có thể bật trước khi gõ. |
| Tiêu đề | Kiểu chữ → Tiêu đề 1/2/3; Enter sau tiêu đề về đoạn thường. |
| Checklist | Chọn dòng/nhiều dòng → ☑ Checklist; bấm lại để về văn bản thường. |
| Thêm mục | Enter; Enter tại mục trống để kết thúc checklist. |
| Xuất TXT | Giữ tiếng Việt, xuống dòng, `[ ]` / `[x]`; không giữ chữ đậm/tiêu đề. |

Dán chỉ lấy văn bản. Xóa cần xác nhận và giữ bản dự phòng trước lần xóa gần nhất. Nếu lưu lỗi, giữ cửa sổ đang sửa và xuất TXT trước khi đóng.

### Chatbot nội bộ

Bấm avatar tròn ở góc dưới bên phải. Ví dụ:

```text
Hôm nay có lịch gì?
Mai tôi học môn nào?
Tóm tắt lịch tuần này
Việc nào quá hạn?
Tìm ghi chú Ý tưởng
Thêm lịch đọc sách ngày mai 19h
Ghi chú: nhớ mang laptop
```

Không cần chọn phạm vi ngày. Câu có ngày/tuần/tháng dùng mốc đó; tra cứu không nêu ngày tìm toàn bộ dữ liệu. Kết quả dài chia 20 mục/lượt, gõ **xem tiếp**. Riêng tìm ngày ít lịch/kiểm tra trùng giờ không có mốc dùng 7 ngày tới và ghi rõ khoảng này.

Bot chỉ ghi khi bấm **Xác nhận tạo**; hỗ trợ một việc cá nhân hoặc một ghi chú mỗi lần. Chưa sửa/xóa qua hội thoại, tạo hàng loạt hoặc tạo chuỗi lặp. Bot chỉ biết lịch đã lưu trong app.

Đây là bộ phân loại 14 ý định kết hợp xử lý ngày giờ và câu trả lời có kiểm soát, **không phải mô hình ngôn ngữ lớn**. Không gọi AI ngoài, không cần key, không tự dùng dữ liệu cá nhân để huấn luyện. Lịch sử chat chỉ giữ trong phiên.

### Lịch HUST — tùy chọn, chỉ desktop

1. Mở **Lịch HUST → Đồng bộ HUST → Kết nối HUST**.
2. Tự đăng nhập trong cửa sổ QLĐT của app, mở thời khóa biểu và chọn học kỳ. Phiên Chrome bên ngoài không thay thế phiên này.
3. Quay lại Planner → **Đọc lịch / cập nhật**, kiểm tra bảng xem trước và khoảng ngày.
4. Bấm **Áp dụng vào Lịch HUST**. Sau lần xác nhận đầu có thể bật cập nhật mỗi 6 giờ khi app mở.

Đồng bộ một chiều **HUST → Planner**, chỉ lấy thời khóa biểu gốc. Thông báo nghỉ, đổi lịch, học bù không được áp dụng; tự thêm/chỉnh các buổi ngoại lệ. Buổi thêm thủ công và các trường sửa riêng được bảo toàn. Buổi không còn trong lịch gốc được ẩn thay vì xóa.

App sao lưu công việc trước khi áp dụng; nếu sao lưu thất bại thì không nhập. Phiên đăng nhập lưu riêng trên máy; **Ngắt kết nối** xóa phiên và giữ lịch. Bộ đọc phụ thuộc cấu trúc QLĐT, có thể cần cập nhật khi cổng thay đổi. Dự án không phải sản phẩm chính thức của HUST.

## Dữ liệu, sao lưu và cập nhật

### Desktop

Dữ liệu mặc định ở **`%APPDATA%\todolist`** trên Windows, tách khỏi EXE: lịch, dự án, ghi chú, mẫu, ảnh nền và phiên HUST. Giữ `name: "todolist"` trong `package.json` khi cập nhật để không đổi hồ sơ mặc định.

**Sao lưu đầy đủ:** đóng Planner và cửa sổ HUST → Win+R → nhập `%APPDATA%` → copy toàn bộ `todolist` ra nơi riêng. Bản sao có thể chứa phiên đăng nhập HUST, không đưa lên GitHub.

**Cập nhật:** sao lưu → đóng bản cũ → giải nén bản mới vào thư mục khác → mở và kiểm tra lịch/ghi chú → cập nhật shortcut. Build lại thường giữ dữ liệu vì hồ sơ tách riêng, nhưng không thay thế sao lưu.

**Khôi phục:** đóng app → giữ thêm bản sao hồ sơ hiện tại → chép bản đã sao lưu về `%APPDATA%\todolist`. Dùng app tương thích với bản sao; không mở đồng thời bản cũ và mới.

`backups/before-hust-*.json` chỉ chứa công việc, không sao lưu đầy đủ ảnh nền, ghi chú hoặc phiên đăng nhập.

### Web

Mỗi trình duyệt/địa chỉ lưu riêng bằng localStorage và IndexedDB. Không đồng bộ giữa thiết bị. Xóa dữ liệu trang, dùng chế độ riêng tư hoặc đổi địa chỉ có thể mất khả năng truy cập dữ liệu cũ. TXT giữ từng ghi chú; hiện chưa có nút sao lưu/khôi phục toàn bộ dữ liệu web.

### Tương thích dữ liệu cũ

App chuyển dữ liệu cũ vào `planner_data_v2`, giữ khóa cũ và `planner_backup_before_v2`. Ghi chú dùng `planner_notes_v1`; có bản dự phòng trước khi thêm định dạng/checklist và trước lần xóa gần nhất. Dữ liệu không hợp lệ hoặc không sao lưu được sẽ báo lỗi thay vì tự xóa/tạo lại. Bản dự phòng nội bộ vẫn nằm trên cùng thiết bị, không thay thế bản sao riêng.

## Kiểm tra và đóng gói

```sh
npm test
npm run test:ui
npm run test:electron
npm run test:hust
npm run build-exe
```

| Lệnh | Mục đích |
| --- | --- |
| `npm test` | Dữ liệu, lịch lặp, HUST, ghi chú, chatbot và file phát hành. |
| `npm run test:ui` | Luồng sử dụng và 8 kích thước cửa sổ bằng Chromium/Electron. |
| `node scripts/check-ui.cjs --screenshots` | Kiểm tra và lưu ảnh mẫu trong thư mục tạm. |
| `npm run test:electron` | Preload cách ly, lưu dữ liệu, bàn phím và chatbot không dùng mạng. |
| `npm run test:hust` | Connector với trang HTTPS giả lập, không đăng nhập thật. |
| `npm run build:web` | Xuất các file web cần thiết vào thư mục mới dưới `dist/`. |
| `npm run build-exe` | Huấn luyện chatbot rồi đóng gói Windows x64 vào thư mục mới. |

Kiểm tra giao diện dùng dữ liệu mẫu và hồ sơ tạm riêng. Build không xóa/ghi đè bản cũ; Terminal in đường dẫn `dist/build-<thời gian>-<mã>/MyDailyPlanner-win32-x64/MyDailyPlanner.exe`.

Huấn luyện chatbot: sửa `chatbot-training.json`, giữ tập `evaluation` độc lập → `npm run train:chatbot` → `npm test`. Model ở `chatbot-model.js`, báo cáo ở `chatbot-training-report.json`. Điểm trên bộ câu mẫu nhỏ không bảo đảm hiểu mọi câu tiếng Việt.

## Triển khai và chia sẻ trên GitHub

Ba workflow được chuẩn bị sẵn; sửa file ở máy chưa tự xuất bản website hoặc Release:

| Workflow | Khi chạy | Kết quả |
| --- | --- | --- |
| Checks | Push main, pull request hoặc chạy tay | Cài bằng lockfile, kiểm tra và thử xuất web. |
| Build Windows | Actions → Build Windows → Run workflow | Artifact ZIP `MyDailyPlanner-windows-x64`, giữ 14 ngày. |
| Deploy Web | Actions → Deploy Web → Run workflow | Xuất bản web sau khi chủ repo bật GitHub Pages. |

### Chia sẻ EXE qua Releases

1. Đẩy mã đã kiểm tra và `package-lock.json` lên GitHub.
2. Chạy **Build Windows**, tải ZIP trong **Artifacts** sau khi thành công (cần đăng nhập GitHub).
3. **Releases → Draft a new release** → chọn tag phiên bản, viết thay đổi → tải ZIP lên **Assets** → Publish.
4. Người dùng tải ZIP từ Releases và giải nén toàn bộ. Không đưa `node_modules/`, `dist/`, bản sao lưu hoặc hồ sơ cá nhân vào Git.

### Bật GitHub Pages

1. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Actions → Deploy Web → Run workflow**, chọn nhánh muốn phát hành.
3. Lấy URL ở kết quả deployment / Settings → Pages. Chạy lại workflow khi muốn cập nhật.

Workflow chỉ tải file giao diện trong danh sách cho phép. Xem [hướng dẫn GitHub Pages chính thức](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Website chạy trong trình duyệt từng người; xuất bản website không đưa dữ liệu Planner cá nhân của bạn lên đó.

## Cấu trúc mã nguồn

| File / thư mục | Vai trò |
| --- | --- |
| `index.html`, `style.css`, `app.js` | Giao diện, lịch, công việc và Kanban. |
| `planner-store.js`, `lunar.js` | Dữ liệu/lịch lặp/nhập HUST và âm lịch. |
| `main.js`, `preload.js` | Cửa sổ Electron và cầu nối IPC giới hạn. |
| `hust-connector.js`, `hust-extractor.js`, `hust-ui.js` | Đăng nhập, đọc thời khóa biểu, xem trước/đồng bộ. |
| `notes.js`, `notes-store.js`, `notes-richtext.js` | Soạn thảo, lưu và định dạng/checklist. |
| `appearance.js` | Xử lý ảnh nền và IndexedDB. |
| `chatbot.js`, `chatbot.css`, `chatbot-core.js` | Giao diện, kiểm tra dữ liệu và tạo theo xác nhận. |
| `chatbot-local.js`, `chatbot-nlu.js`, `chatbot-knowledge.js` | Hội thoại/ngày giờ, phân loại và kiến thức app. |
| `chatbot-training.json`, `chatbot-model.js`, `chatbot-training-report.json` | Mẫu huấn luyện, trọng số offline, đánh giá. |
| `assets/`, `Calendar.ico` | Avatar và biểu tượng. |
| `scripts/`, `tests/`, `.github/workflows/` | Kiểm tra, huấn luyện, đóng gói, triển khai. |
| `package.json`, `package-lock.json` | Lệnh chạy và phiên bản thư viện cố định. |
| `dist/`, `node_modules/` | Đầu ra/thư viện cục bộ, được bỏ qua trong Git. |

## Lỗi thường gặp

| Hiện tượng | Kiểm tra |
| --- | --- |
| Thiếu Electron/module | Kiểm tra Node.js, chạy `npm ci` tại thư mục project. |
| `npm.ps1` bị chặn | Dùng `npm.cmd` trên Windows. |
| `ELECTRON_RUN_AS_NODE` khiến app không mở | PowerShell: `Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue`. |
| Mở bản mới vẫn thấy giao diện cũ | Đóng app đang chạy, kiểm tra Target shortcut; app giữ một cửa sổ chính cho cùng hồ sơ. |
| Web không có lịch EXE | Hai bản có bộ nhớ riêng, không tự đồng bộ. |
| Không đọc được HUST | Kiểm tra đăng nhập, học kỳ/trang thời khóa biểu; gửi lỗi đã che thông tin cá nhân. |
| Không lưu được / bộ nhớ đầy | Giữ cửa sổ đang sửa, xuất TXT nếu là ghi chú, sao lưu hồ sơ trước khi xử lý. |

## Đóng góp và giấy phép

Mở Issue nêu phiên bản, hệ điều hành, bước tái hiện và kết quả mong đợi. Không gửi mật khẩu, cookie, hồ sơ thật hoặc ảnh chứa thông tin nhạy cảm. Pull request cần chạy kiểm tra liên quan; thay đổi định dạng dữ liệu cần giữ tương thích và có đường sao lưu.

Mã dự án dùng [ISC](LICENSE), theo khai báo trong `package.json`. Electron và các thư viện đi kèm giữ giấy phép riêng.
