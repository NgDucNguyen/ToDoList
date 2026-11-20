# Hướng dẫn sử dụng

[← Giới thiệu dự án](../README.md)

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

