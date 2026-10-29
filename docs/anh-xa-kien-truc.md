# Ánh xạ kiến trúc ↔ thư mục (bản ĐÃ HIỆN THỰC – BT2, tag v0.2)

Sơ đồ thực tế: `docs/architecture-thuc-te.png` (nguồn Mermaid `docs/architecture-thuc-te.mmd`).
Sơ đồ thiết kế BT1 (`docs/kien-truc_L8.drawio`, Hình 3.1) giữ nguyên làm mốc; mọi khác biệt ghi ở `docs/thay-doi-thiet-ke.md`.

| Lớp | Thư mục / tệp | Việc làm | Ghi chú so với BT1 |
|---|---|---|---|
| Frontend – trang | `src/frontend/*.html`, `pages/*.page.mjs` | 1 tệp cho 1 màn hình wireframe: khảo sát, báo cáo CSAT, xu hướng & điểm thấp, đăng nhập | bỏ Bootstrap, tự dựng CSS theo wireframe (TD-18) |
| Frontend – dùng lại | `src/frontend/components/` | `DataState` (đang tải · rỗng 2 kiểu · lỗi + Thử lại), biểu đồ, định dạng số Việt Nam, thanh bên | |
| Frontend – gọi API | `src/frontend/api/client.mjs`, `*.api.mjs` | NƠI DUY NHẤT gọi `fetch`; gắn token; 401 → về đăng nhập | test tự động chặn `fetch(` trong `pages/` |
| Backend – khởi động | `src/backend/app.js`, `server.js`, `config/` | ráp các lớp; đọc biến môi trường | |
| Access Middleware | `src/backend/middleware/access.js` | đọc token Bearer, `requireRole` (QT-14, BS-05) | header mô phỏng của buổi 8 đã thay bằng token (TD-14) |
| Xử lý lỗi HTTP | `src/backend/middleware/error-handler.js` | NƠI DUY NHẤT quy mã lỗi nghiệp vụ → mã HTTP; định dạng `{error, message, field?}` | TD-20 |
| Routes | `src/backend/routes/` – `auth`, `surveys`, `reports` (+ `/api/centers`), `users` | nhận/trả HTTP; thứ tự: phân quyền → validators → service | `users` mới (TD-21) |
| Validators | `src/backend/validators/` | tầng validation 1: định dạng & kiểu, lỗi kèm tên trường | mới (TD-20) |
| Services | `src/backend/services/` – `survey` (QT-10, QT-13), `report` (BS-01..05, mốc so sánh), `auth`, `user` (QT-13, QT-14, TK-01..03) | quy tắc nghiệp vụ; không SQL, không HTTP | `user` mới (TD-21); UC7 cắt (TD-16) |
| Lỗi nghiệp vụ | `src/backend/errors/AppError.js` | mã lỗi ổn định, không mang mã HTTP | TD-20 |
| Repositories | `src/backend/repositories/` – `survey`, `report`, `ticket`, `center`, `user` | CHỈ SQL tham số hóa | |
| CSDL | `src/backend/db/connection.js` (SQLite qua `node:sqlite`), `migrate.js` | nơi duy nhất biết thư viện CSDL | SQLite thay PostgreSQL (lập luận 5 BT1); `node:sqlite` (TD-12) |
| Migration | `migrations/001–004` | dựng CSDL từ trống, chạy lại không lỗi | chuyển ra gốc repo (TD-20); 004 mới (TD-23) |
| Dữ liệu mẫu | `seeds/seed.js` (mô phỏng, seed = 42); `data/sample/*.csv` + `src/backend/db/import-csv.js` (mẫu bộ CSV chính thức) | | TD-23, TD-24 |
| Đóng gói | `Dockerfile`, `docker-compose.yml` | chạy cả hệ thống bằng 2 lệnh | mới (TD-28) |

## Quy tắc phụ thuộc giữa các lớp
`routes` → `validators` + `services` → `repositories` → CSDL. Mũi tên chỉ đi xuống: services không `require` gì của Express và
không chứa SQL (kiểm bằng `grep -nE "req|res|status\(|SELECT" src/backend/services/*.js` → không có kết quả);
repositories không chứa quy tắc nghiệp vụ; `seeds/` dùng `utils/password.js`, không gọi ngược lên services.

## Vì sao chia như vậy
- Quy tắc QT-10, QT-13, QT-14, BS-01..05, TK-01..03 nằm ở **một chỗ** (services) nên test được không cần dựng HTTP
  (`tests/*.service.test.js`), còn `tests/*.api.test.js` kiểm cả chuỗi qua HTTP.
- Service ném lỗi có **mã** (`DA_KHAO_SAT`, `KHONG_DU_QUYEN`…), nên cùng quy tắc dùng được cho API, script nhập CSV và test.
- Đổi SQLite → PostgreSQL chỉ sửa `db/connection.js` và câu SQL trong `repositories/`.
