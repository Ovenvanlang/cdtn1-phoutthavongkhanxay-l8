# Test Plan – Luồng L8: Khảo sát hài lòng CSAT (track SE)

Phiên bản BT3 · repo `cdtn1-phoutthavongkhanxay-l8` · mẫu 4 mục theo `07_implementation/69_testing_qa_principles.md` §3.
Viết **trước** khi chạy test case; kết quả thực tế ghi ở `docs/test-report.md`, lỗi ở `docs/bug-log.md`.

## 1. Phạm vi
**Kiểm:** tạo khảo sát cho phiếu ĐÃ ĐÓNG (UC1, QT-10) · khách gửi điểm qua đường dẫn (UC2, BS-03) · xóa mềm (QT-13) ·
báo cáo CSAT và mốc so sánh (UC3–UC5, BS-01, BS-02, BS-06) · quản lý tài khoản (QT-14, TK-01) · kiểm định dữ liệu vào ·
kiểm soát truy cập (OWASP A01) · chạy lại migration/seed/nạp CSV.

**CHỦ Ý KHÔNG kiểm (và lý do):**
- Giao diện bằng trình duyệt tự động (Selenium/Playwright): giao diện chỉ gọi API đã kiểm ở đây; 3 trạng thái DataState đã có test DOM (`tests/frontend.test.js`) và ảnh chụp tay (`docs/img/bt2-*`).
- Hiệu năng, tải, kiểm thử xâm nhập đầy đủ: ngoài phạm vi BT3 (thuộc CĐTN2); chỉ kiểm 5 mục OWASP ở mức nhận biết (`docs/checklist-bao-mat.md`).
- UC7 thông báo điểm thấp: đã cắt khỏi phạm vi (TD-16), không có mã để kiểm.
- Đồng thời nhiều người dùng: chỉ kiểm tình huống đua QT-10 ở tầng service (đã có trong bộ test tự động).

## 2. Loại test và số lượng
| Tầng | Số TC | TC | Công cụ |
|---|---:|---|---|
| Unit (service với repository giả, không CSDL) | 3 | TC-03, TC-06, TC-07 | `node:test` + đối tượng giả |
| Integration (migration + seed + nạp CSV trên CSDL tệp thật) | 1 | TC-12 | `node:test` |
| API / hệ thống (Express thật + SQLite trong bộ nhớ, gọi HTTP) | 8 | TC-01, 02, 04, 05, 08, 09, 10, 11 | `node:test` + `fetch` |

Ngoài 12 TC trong Test Report còn **bộ hồi quy tự động** (`tests/*.test.js`) chạy cùng lệnh `npm test`: 69 test lúc lập kế hoạch,
**75 test sau khi sửa BUG-006…009** (mỗi bug thêm test hồi quy riêng) → `npm test` chạy tổng cộng **87 test**.
Mỗi bug đã sửa có ít nhất 1 test hồi quy (`docs/bug-log.md`, dòng 7).

**Đủ 5 loại BT3:** luồng đúng ×5 (TC-01 → TC-05) · giá trị biên ×3 (TC-06/TC-07 hai bên ranh giới 5 phản hồi của BS-02; TC-11 ranh giới nửa đêm giờ Việt Nam) ·
dữ liệu sai ×2 (TC-08, TC-09 – kiểm cả mã trạng thái, thông báo và tác dụng phụ) · bảo mật ×1 (TC-10, A01) · tái lập ×1 (TC-12).

**Kỹ thuật chọn dữ liệu:**
- *Giá trị biên:* số phản hồi tối thiểu BS-02 → thử **5** (không cảnh báo) và **4** (cảnh báo); ranh giới ngày → **23:59 ngày 31/10** và **00:30 ngày 01/11** giờ Việt Nam; điểm hợp lệ 1–5 → 0, 1, 5, 6 và nhận xét 500/501 ký tự (bộ hồi quy `tests/validators.test.js`).
- *Phân vùng tương đương:* người gửi phản hồi chia 3 nhóm – khách có đúng đường dẫn (TC-02) · người không có mã (TC-10) · người đoán mã (TC-10); vai trò chia theo QT-14 – BGĐ (TC-04, TC-05) · quản lý trung tâm · khách không đăng nhập.
- *Tác dụng phụ:* mọi TC ghi dữ liệu đều đếm số dòng/đọc lại bản ghi **trước và sau** khi gọi.

**Truy vết quy tắc → test:** QT-10 → TC-01, TC-10 · QT-13 → TC-04 · QT-14 → TC-05 (+ hồi quy `survey.api.test.js` "QT-14…") ·
BS-01 → TC-03 · BS-02 → TC-06, TC-07 · BS-03 → TC-02 · BS-06 → TC-03 · TK-01 → TC-05 · UC5 gom theo tháng → TC-11 ·
QT-15, BS-05, TK-02, TK-03 → bộ hồi quy (`survey.api.test.js`, `report.service.test.js`, `user.service.test.js`).

## 3. Tiêu chí thành công (đặt trước khi chạy)
- 12/12 test case có kết quả thực tế ghi cụ thể (mã HTTP, thông báo, số dòng trước/sau) và ảnh chụp trong `docs/screenshots/`.
- Mọi quy tắc nghiệp vụ đã hiện thực có ≥ 1 test (bảng truy vết ở mục 2).
- **Không còn bug Critical đang mở**; bug Major còn lại (nếu có) ghi lý do và hướng xử lý.
- `npm test` PASS toàn bộ bằng một lệnh sau khi sửa lỗi; `npm audit` không còn lỗ hổng mức high/critical.

## 4. Môi trường và dữ liệu thử
- **Chạy ở đâu:** máy Windows của em, Node.js 22 (≥ 22.13), không cần máy chủ CSDL (SQLite qua `node:sqlite`); hoặc trong container `docker compose up --build`.
- **Dữ liệu thử:** mỗi TC tự dựng bằng code trong `tests/test-cases.test.js` (hàm `dungMoiTruong`): 2 trung tâm, 2 khách, 3 phiếu (#1 ĐÃ ĐÓNG chưa khảo sát, #2 ĐÃ ĐÓNG có khảo sát DA_GUI, #3 DANG_XU_LY), 3 tài khoản (`hethong`, `bgd`, `quanly.tt01`). CSDL trong bộ nhớ nên **mỗi TC bắt đầu từ trạng thái sạch**, không phụ thuộc dữ liệu trên máy. TC-12 dùng tệp CSDL tạm, `seeds/seed.js` (seed = 42) và `data/sample/` (mẫu bộ CSV chính thức của case study).
- **Lệnh:** `npm test` (toàn bộ) · `npm run tc` (12 TC) · `npm run tc -- TC-05` (chạy lại đúng một case, in kết quả thực tế ở các dòng `ℹ`).
