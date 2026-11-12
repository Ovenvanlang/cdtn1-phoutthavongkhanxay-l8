# Test Report – Luồng L8: Khảo sát hài lòng CSAT (track SE)

Kế hoạch: `docs/test-plan.md` · lỗi phát hiện: `docs/bug-log.md` · mã test: `tests/test-cases.test.js` (mỗi test mang đúng mã TC-xx).
Mẫu 8 cột theo `07_implementation/69_testing_qa_principles.md` §2 và `69a_testing_se.md` §5. Mỗi case **tự dựng tiền điều kiện bằng code**
(hàm `dungMoiTruong`: SQLite trong bộ nhớ, dữ liệu cố định) nên chạy lại ở máy nào cũng cho cùng kết quả.

**Chạy lại:** cả 12 case `npm run tc` · một case `npm run tc -- TC-07` (in kết quả thực tế ở các dòng `ℹ`) · toàn bộ kèm hồi quy `npm test`.
**Ảnh minh chứng:** `docs/screenshots/TC-xx.png` (lần chạy sau sửa) và `TC-10-truoc-sua.png`, `TC-11-truoc-sua.png` (lần chạy đầu, FAIL);
cả 12 case một lượt: `tc-all.png`; toàn bộ `npm test`: `npm-test.png`; `npm audit`: `npm-audit.png`.

## Tổng hợp các lần chạy

| Lần chạy | Commit | Ngày | PASS | FAIL | Ghi chú |
|---|---|---|---:|---:|---|
| 1 – ngay sau khi viết test | [`8ab0d75`](https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8/commit/8ab0d752699b13a63498e95c323d938c56270cc9) | 07/11/2026 | 10 | **2** | TC-10 FAIL → **BUG-006** (Critical) · TC-11 FAIL → **BUG-007** (Major) |
| 2 – sau khi sửa BUG-006…009 | [`f474165`](https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8/commit/f4741652a264e46d52e035f48ed6f1057a153ec1) | 07/11/2026 | **12** | 0 | `npm test`: 87/87 PASS (12 TC + 75 test hồi quy) |
| 3 – bản nộp `v1.0` (sau BUG-010, BUG-011, đối chiếu tự học buổi 15) | tag `v1.0` | 12/11/2026 | **12** | 0 | `npm test`: 90/90 PASS (12 TC + 78 test hồi quy); ảnh `TC-xx.png` là lần chạy này |

Phân loại (đủ 5 loại của BT3): **luồng đúng** TC-01…05 (mỗi quy tắc đã hiện thực ≥ 1 case) · **giá trị biên** TC-06/TC-07 (hai bên ranh giới
5 phản hồi của BS-02) và TC-11 (hai bên nửa đêm giờ Việt Nam) · **dữ liệu sai** TC-08, TC-09 · **bảo mật** TC-10 (OWASP A01) · **tái lập** TC-12.

> Ghi chú trung thực: ở lần chạy 1, TC-01 chưa có bước kiểm `survey_link` (vì lúc đó hệ thống chưa có đường dẫn có mã); bước này được thêm
> cùng bản sửa BUG-006. TC-10 bước 3 (khách thật vẫn gửi được) thêm sau bản sửa ở commit `18db0de` để chắc bản sửa không làm hỏng luồng đúng.
> Từ lần chạy 3, mã truy cập khảo sát đi trong header `X-Survey-Code` thay vì `?t=` (BUG-010): các bước của TC-02/04/08/10/11 đổi cách gửi mã,
> kết quả mong đợi giữ nguyên. Thời gian (ms) và mã truy cập ngẫu nhiên trong ảnh thay đổi theo từng lần chạy, mọi giá trị khác không đổi.

## Bảng test case (8 cột)

**Dữ liệu dựng sẵn cho mọi case qua API ("Môi trường chuẩn")**: trung tâm 1 *TTBH Quận 10*, trung tâm 2 *TTBH Ninh Kiều*; phiếu #1 `DA_DONG`
chưa khảo sát, #2 `DA_DONG` có khảo sát `DA_GUI`, #3 `DANG_XU_LY` (cả 3 thuộc trung tâm 1); tài khoản `hethong` (he_thong), `bgd` (bgd),
`quanly.tt01` (quan_ly, trung tâm 1), mật khẩu `Test@12345`; máy chủ Express thật trên cổng ngẫu nhiên.

| Mã | Tiền điều kiện | Các bước | Dữ liệu thử | Kết quả mong đợi | Ưu tiên | Kết quả thực tế | P/F |
|---|---|---|---|---|---|---|---|
| **TC-01**<br>Luồng đúng · QT-10, UC1 | Môi trường chuẩn; phiếu #1 `DA_DONG` chưa có khảo sát; `survey_response` có 1 dòng | 1. Đăng nhập `hethong` lấy token. 2. `POST /api/surveys` với token. 3. Đếm `survey_response` trước/sau | body `{"ticket_id":1}` | 201; `status = DA_GUI`, `score = null`; có `survey_link` dạng `/khao-sat.html?ticket=1#t=<32 hex>` (mã sau `#`, BUG-010); số dòng +1 | Cao | HTTP 201 · `status=DA_GUI` · `score=null` · `survey_response 1 -> 2` · `survey_link=/khao-sat.html?ticket=1#t=a81c…6827` | **PASS** |
| **TC-02**<br>Luồng đúng · UC2, BS-03 | Môi trường chuẩn; khảo sát của phiếu #2 đang `DA_GUI`, mã truy cập đọc từ CSDL (như trong tin nhắn gửi khách) | 1. `POST /api/surveys/2` không đăng nhập, header `X-Survey-Code: <mã đúng>`. 2. Đọc lại dòng khảo sát | `{"score":2,"comment":"Trả máy trễ hẹn 3 ngày"}` | 200; `status = DA_TRA_LOI`; `low_score = true` (điểm ≤ 2); CSDL lưu đúng điểm và nhận xét | Cao | HTTP 200 · `status=DA_TRA_LOI` · `low_score=true` · CSDL: `DA_TRA_LOI, score=2, comment="Trả máy trễ hẹn 3 ngày"` | **PASS** |
| **TC-03**<br>Luồng đúng · BS-01, BS-06 (unit) | Service báo cáo với repository giả: kỳ 01–10/10/2026 có 20 phản hồi (15 điểm ≥ 4); kỳ trước có 10 (6 điểm ≥ 4) | 1. Gọi `reportService.csat()` vai trò `bgd`. 2. Kiểm khoảng kỳ trước repository được hỏi | `from=2026-10-01`, `to=2026-10-10` | `csat_percent = 75` (15/20); kỳ trước = 21–30/09 (cùng 10 ngày, liền trước), `csat_percent = 60`; `csat_delta = 15` | Cao | `csat_percent=75` · kỳ trước `2026-09-21..2026-09-30`: `csat_percent=60` · `csat_delta=15` | **PASS** |
| **TC-04**<br>Luồng đúng · QT-13 | Môi trường chuẩn; khảo sát phiếu #2 tồn tại | 1. Đăng nhập `bgd`. 2. `DELETE /api/surveys/2`. 3. Khách mở lại `GET /api/surveys/2` với `X-Survey-Code: <mã đúng>`. 4. Đếm dòng, đọc `is_deleted` | token `bgd`; ticket 2 | DELETE 200; mở lại 404 `KHONG_TIM_THAY`; số dòng **không đổi**; `is_deleted = 1` (xóa mềm) | Cao | DELETE → HTTP 200 `{"ticket_id":2,"deleted":true}` · GET lại → HTTP 404 `KHONG_TIM_THAY` · `survey_response 1 -> 1`, `is_deleted=1` | **PASS** |
| **TC-05**<br>Luồng đúng · QT-14, TK-01 | Môi trường chuẩn; chưa có tài khoản `quanly.tt02` | 1. Đăng nhập `bgd`. 2. `POST /api/users`. 3. Đăng nhập bằng tài khoản mới | `{"username":"quanly.tt02","password":"QuanLy2026","full_name":"Quản lý Ninh Kiều","role":"quan_ly","center_id":2}` | 201; trả `center_name = "TTBH Ninh Kiều"`; **không** trả `password_hash`; tài khoản mới đăng nhập 200 | Trung bình | POST → HTTP 201 `center_name="TTBH Ninh Kiều"`, có `password_hash`? `false` · đăng nhập → HTTP 200 `role=quan_ly` | **PASS** |
| **TC-06**<br>Biên · BS-02 (unit) | Repository giả trả đúng **5** phản hồi (4 điểm ≥ 4) | Gọi `reportService.csat()` vai trò `bgd` | `total_responses = 5` | Ngay tại ngưỡng: `warning = null` (không cảnh báo mẫu nhỏ); `csat_percent = 80` | Cao | `total_responses=5` · `csat_percent=80` · `warning=null` | **PASS** |
| **TC-07**<br>Biên · BS-02 (unit) | Repository giả trả **4** phản hồi (3 điểm ≥ 4) – một dưới ngưỡng | Gọi `reportService.csat()` vai trò `bgd` | `total_responses = 4` | `warning = "MAU_CHUA_DU_TIN_CAY"` nhưng **vẫn trả số** `csat_percent = 75` | Cao | `total_responses=4` · `csat_percent=75` · `warning=MAU_CHUA_DU_TIN_CAY` | **PASS** |
| **TC-08**<br>Dữ liệu sai · FR-02 | Môi trường chuẩn; khảo sát phiếu #2 `DA_GUI` | 1. `POST /api/surveys/2` (`X-Survey-Code: <mã đúng>`) thiếu trường `score`. 2. Đọc lại dòng khảo sát | `{"comment":"Quên chấm điểm"}` | 400 `DU_LIEU_KHONG_HOP_LE`, `field = "score"`, thông báo nêu `score`; khảo sát vẫn `DA_GUI`, `score = null` | Cao | HTTP 400 · `{"error":"DU_LIEU_KHONG_HOP_LE","message":"score là bắt buộc, phải là số nguyên từ 1 đến 5","field":"score"}` · CSDL: `DA_GUI`, `score=null` | **PASS** |
| **TC-09**<br>Dữ liệu sai | Môi trường chuẩn; `app_user` có 3 dòng | 1. Đăng nhập `bgd`. 2. `POST /api/users` với thân JSON bị cắt ngang. 3. Đếm `app_user` | thân thô `{"username":"x", "password":` | 400 (không phải 500), thông báo nói rõ JSON không hợp lệ, không lộ stack trace; số tài khoản không đổi | Trung bình | HTTP 400 · `{"error":"DU_LIEU_KHONG_HOP_LE","message":"Nội dung gửi lên không phải JSON hợp lệ"}` · `app_user 3 -> 3` | **PASS** |
| **TC-10**<br>Bảo mật · OWASP A01 | Môi trường chuẩn; khảo sát phiếu #2 (của khách *Trần Thị Bình*) đang `DA_GUI`; người tấn công **không** có tin nhắn của khách, chỉ biết số phiếu tăng dần | 1. `POST /api/surveys/2` không mã. 2. `POST /api/surveys/2` với `X-Survey-Code: 000…0` (đoán mã). 3. Đọc lại dòng khảo sát. 4. Khách thật gửi bằng đúng đường dẫn | `{"score":1,"comment":"đánh giá giả"}`; mã đoán `"0"×32`; bước 4 `{"score":4}` | Bước 1–2 bị từ chối (400/404, không 200); khảo sát **không đổi** (`DA_GUI`, `score = null`); bước 4: 200, `score = 4` | Cao | **Lần 1 (`8ab0d75`):** không mã → **HTTP 200 `DA_TRA_LOI`**; mã đoán → 409; CSDL `status=DA_TRA_LOI, score=1` → **FAIL**, ghi **BUG-006**.<br>**Lần 2–3:** không mã → HTTP 400 `DU_LIEU_KHONG_HOP_LE` (lần 3: field `X-Survey-Code`) · mã đoán → HTTP 404 `KHONG_TIM_THAY` · CSDL `DA_GUI, score=null` · khách thật → HTTP 200 `DA_TRA_LOI score=4` | **FAIL → PASS** (sau BUG-006) |
| **TC-11**<br>Biên · UC5 (ranh giới ngày giờ VN) | Môi trường chuẩn; đồng hồ hệ thống giả lập; khảo sát phiếu #1 và #2 `DA_GUI` | 1. Lúc `2026-10-31T16:59Z` (23:59 31/10 giờ VN) khách phiếu #1 gửi 5 điểm. 2. Lúc `2026-10-31T17:30Z` (00:30 01/11 giờ VN) khách phiếu #2 gửi 4 điểm. 3. Đọc `responded_date`. 4. `GET /api/reports/trend?year=2026` (bgd) | 2 thời điểm hai bên nửa đêm 31/10 → 01/11 giờ Việt Nam | `responded_date` = `2026-10-31` và `2026-11-01`; xu hướng tháng 10 = 1, tháng 11 = 1 | Trung bình | **Lần 1 (`8ab0d75`):** cả hai `2026-10-31`; xu hướng `{"10":2}` → **FAIL**, ghi **BUG-007**.<br>**Lần 2:** `2026-10-31` và `2026-11-01`; xu hướng `{"10":1,"11":1}` | **FAIL → PASS** (sau BUG-007) |
| **TC-12**<br>Tái lập (integration) | Tệp CSDL tạm **trống** trên đĩa | 1. `migrate` + `seed` lần 1, đếm. 2. Chạy lại y hệt lần 2, đếm. 3. `importCsv(data/sample)` 2 lần liên tiếp, đếm sau mỗi lần | seed = 42; `data/sample/` (mẫu bộ CSV chính thức) | Lần 2: 0 migration mới, seed tự bỏ qua, số dòng y hệt lần 1; nạp CSV lần 2 không lỗi, số dòng y hệt lần 1 (không nhân đôi) | Cao | Lần 1: 6 migration, `{"ticket":1200,"survey_response":813,"technician":38,"service_center":6}` · lần 2: 0 migration, seed bỏ qua, cùng số · nạp mẫu lần 1 = lần 2 = `{"ticket":1400,"survey_response":1200,"technician":38,"service_center":6}` | **PASS** |

## Đánh giá theo tiêu chí thành công (Test Plan mục 3)

| Tiêu chí | Kết quả | Minh chứng |
|---|---|---|
| 12/12 case có kết quả thực tế cụ thể và ảnh | Đạt | Bảng trên; `docs/screenshots/TC-01.png` … `TC-12.png` |
| Mọi quy tắc đã hiện thực có ≥ 1 test | Đạt | Truy vết ở Test Plan mục 2 (QT-10, QT-13, QT-14, BS-01/02/03/06, TK-01 trong 12 TC; QT-15, BS-05, TK-02/03 trong bộ hồi quy) |
| Không còn bug Critical đang mở | Đạt | BUG-006 và BUG-008 (Critical) đã sửa, có commit; 11 bug trong `docs/bug-log.md` đều đã đóng |
| `npm test` PASS bằng một lệnh | Đạt | 90/90 PASS – `docs/screenshots/npm-test.png`; CI `.github/workflows/ci.yml` |
| `npm audit` không còn lỗ hổng high/critical | Đạt (sau BUG-008) | `npm audit` → `found 0 vulnerabilities` |

## Kiểm tra bằng tay qua HTTP (bổ sung, không thay test case)
Tệp `docs/api-docs/khao-sat.http` (REST Client của VS Code / IntelliJ HTTP Client) chứa đủ các lệnh gọi của luồng: đăng nhập, UC1 tạo khảo sát,
UC2 mở/gửi bằng đường dẫn có mã, thử không mã/sai mã (TC-10 làm tay), báo cáo, tài khoản. Dùng khi GV yêu cầu gọi thử một endpoint tại chỗ.
