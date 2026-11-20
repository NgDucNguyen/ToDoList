# Phát triển và phát hành

[← Giới thiệu dự án](../README.md)

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

