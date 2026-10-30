# Phụ lục khai báo sử dụng công cụ AI

Chính sách học phần (`00_ai_disclosure_and_integrity.md`): được dùng AI để học khái niệm, gợi ý hàm, tìm nguyên nhân lỗi, rà soát mã;
bắt buộc khai báo cụ thể và hiểu mọi dòng nộp. Phần có AI hỗ trợ được liệt kê theo từng tệp/hàm trong bảng dưới đây.

## BT1 – Thiết kế
| Công cụ | Dùng vào việc gì | Áp dụng ở phần nào | Em đã kiểm chứng thế nào |
| :--- | :--- | :--- | :--- |
| **Claude (Anthropic)** | Hỗ trợ phân tích yêu cầu, gợi ý nháp User Story, SRS, đặc tả use case, kiến trúc, ERD, DDL và vẽ sơ đồ, wireframe. | Chương 1 (SRS), Chương 2 (Use Case), Chương 3 (Kiến trúc), Chương 4 (ERD), Chương 5 (Wireframe) | Đối chiếu từng mục với case study (Mục 3, 8, 9, 11); chạy thử DDL và truy vấn CSAT trên SQLite; rà soát truy vết US – FR – UC – NFR – QT; tự đọc lại toàn bộ nội dung trước khi nộp. |

## BT2 – Hiện thực (4 cột theo đề BT2 §2, TP5)
| Công cụ | Dùng vào việc gì | Áp dụng ở tệp / hàm nào | Em đã kiểm chứng thế nào |
| :--- | :--- | :--- | :--- |
| **Claude Code** (buổi 8) | Gợi ý khung 3 lớp và mã CRUD khảo sát; gợi ý chuyển `better-sqlite3` sang `node:sqlite` khi cài lỗi (TD-12) | `src/backend/app.js`; `routes/surveys.routes.js`; `services/survey.service.js` (`create`, `submit`, `list`, `remove`); `repositories/survey.repository.js`; `db/connection.js`, `db/migrate.js`; `migrations/001–002` | So migration với DDL BT1 (`docs/ddl_L8.sql`) từng cột; test QT-10 ở 3 chỗ (tạo trùng, gửi lại, UNIQUE ở CSDL) và 2 test tình huống đua (`tests/survey.service.test.js`); chạy `npm run db:setup` hai lần không lỗi |
| **Claude Code** (buổi 9–10) | Gợi ý đăng nhập bằng token HMAC + băm scrypt (TD-14), báo cáo CSAT (BS-01..05), giao diện 3 màn hình theo wireframe và component DataState | `services/auth.service.js` (`login`, `verifyToken`, `issueToken`); `services/report.service.js` (`csat`, `trend`, `lowScore`, `resolveCenter`); `src/frontend/api/client.mjs` (`request`); `components/DataState.mjs`; `pages/*.page.mjs`; `scripts/chay-luong-end-to-end.js` | Test token bị sửa chữ ký / `alg=none` / hết hạn đúng giây (`tests/auth.service.test.js`); test biên BS-02 (5 và 4 phản hồi) và CSAT = 25/28 = 89,3% (`tests/report.service.test.js`); tắt backend bấm "Thử lại" (ảnh `bt2-11`, `bt2-12`); test "pages/ không gọi fetch(" |
| **Claude Code** (rà soát trước khi nộp, 29/10/2026) | Rà repo theo đề BT2 + học liệu; gợi ý sửa: tầng `validators/`, `AppError` không mang mã HTTP, CRUD `app_user`, nhập CSV đúng cột case study, seed bám case study, mốc so sánh, Docker, cập nhật tài liệu (TD-19 → TD-29) | `validators/*.js`; `errors/AppError.js`; `middleware/error-handler.js` (`HTTP_STATUS_BY_CODE`); `services/user.service.js` (`create`, `update`, `deactivate`, `checkCenterForRole`, `checkLastDirector`); `db/import-csv.js` (`importCsv`, `normalizePhone`); `migrations/004_customer_phone.sql`; `seeds/seed.js`; `report.service.js` (`previousRange`, `benchmark`); `Dockerfile`, `docker-compose.yml`; `tests/validators`, `user.*`, `import-csv`, `seed` | Sinh lại bộ CSV chính thức bằng `gen_dataset.py` (seed 20260901) rồi nạp 2 lần: 6 TT, 38 KTV, 7.800 phiếu, 2.600 khảo sát, không nhân đôi; so CSAT seed (~70%) với bộ chính thức; `npm test` 69/69; phép thử thư mục trống theo README; chụp lại 13 ảnh trên bản chạy thật; Docker: đã chạy `docker compose up --build` trên máy em trước khi gắn tag |

---

Tôi xác nhận đã đọc, hiểu và chịu trách nhiệm về toàn bộ nội dung nộp, kể cả phần có AI hỗ trợ.  
**Họ tên:** PHOUTTHAVONG KHANXAY – 237480201IS10  

