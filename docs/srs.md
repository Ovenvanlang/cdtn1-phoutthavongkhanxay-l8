# SRS – Luồng L8: Khảo sát hài lòng CSAT

**Dự án:** Smart CRM – Mekong Mobile · **Sinh viên:** PHOUTTHAVONG Khanxay · **MSSV:** 237480201IS10 · **Track:** SE
**Phiên bản:** 3 – khớp mã nguồn BT2, tag `v0.2` (thay đổi so với BT1: `docs/thay-doi-thiet-ke.md`)

---

## 1. Giới thiệu

### 1.1. Mục đích và phạm vi
Hệ thống thu thập phản hồi của khách sau khi phiếu bảo hành được đóng và tổng hợp chỉ số hài lòng CSAT theo trung tâm, kỹ thuật viên và thời gian. Giải quyết vấn đề **V7** của case study: không có kênh phản hồi sau bảo hành, khiếu nại chỉ được biết khi khách đăng lên mạng xã hội.

**Phạm vi một câu:** Sau khi phiếu bảo hành chuyển sang ĐÃ ĐÓNG, hệ thống tự tạo khảo sát, khách chấm điểm 1–5 kèm nhận xét, và quản lý trung tâm, ban giám đốc, marketing xem CSAT theo trung tâm, kỹ thuật viên và thời gian; phản hồi điểm thấp được chuyển đến quản lý trung tâm.

### 1.2. Ngoài phạm vi (WON'T)
- Không quản lý bán hàng/đơn hàng; không tiếp nhận, phân công, đóng phiếu (L2, L4) – chỉ đọc phiếu đã ĐÃ ĐÓNG.
- Không gửi khảo sát thật qua email/SMS/Zalo.
- Không tính NPS (thang 0–10) vì mô hình dữ liệu gốc dùng thang 1–5.
- Không phân loại cảm xúc nhận xét bằng AI/NLP (ý tưởng COULD, để giai đoạn sau).
- Không xử lý khiếu nại sau khi liên hệ khách; không SSO, không container hóa.

### 1.3. Thuật ngữ
| Thuật ngữ | Định nghĩa | Tên kỹ thuật |
|---|---|---|
| Khảo sát hài lòng | Phản hồi của khách sau khi phiếu được đóng, thang 1–5 kèm nhận xét | `survey_response` |
| Phiếu bảo hành | Yêu cầu bảo hành/sửa chữa có mã duy nhất và vòng đời trạng thái | `ticket` |
| CSAT (BS) | Tỷ lệ phản hồi đã trả lời có điểm ≥ 4 trên tổng phản hồi đã trả lời | `csat_percent` |
| Phản hồi điểm thấp (BS) | Phản hồi đã trả lời có điểm ≤ 2 | `score ≤ 2` |
| Mẫu chưa đủ tin cậy (BS) | Nhóm số liệu có dưới 5 phản hồi đã trả lời | `MAU_CHUA_DU_TIN_CAY` |
| Kỳ trước (BS-06) | Khoảng thời gian cùng số ngày, liền ngay trước khoảng đang xem – mốc so sánh của mọi chỉ số CSAT | `comparison.previous` |
| Tài khoản | Người dùng nội bộ đăng nhập hệ thống; khóa thay vì xóa (QT-13) | `app_user` |
| Vai trò | Hệ thống · Quản lý trung tâm · Ban giám đốc · Marketing (khách hàng không cần tài khoản) | `he_thong` · `quan_ly` · `bgd` · `marketing` |
| Khảo sát đã gửi / đã trả lời | Trạng thái của một khảo sát: tạo khi phiếu đóng / khách đã chấm điểm | `DA_GUI` / `DA_TRA_LOI` |

## 2. Các bên liên quan

| Vai trò | Nhiệm vụ | Hạn chế |
|---|---|---|
| Khách hàng | Mở liên kết khảo sát, chấm điểm và nhận xét | Mỗi phiếu khảo sát một lần (QT-10) |
| Quản lý trung tâm | Xem CSAT theo trung tâm/kỹ thuật viên, danh sách điểm thấp, nhận thông báo | Chỉ xem trung tâm mình (QT-14); thấy số điện thoại đầy đủ (QT-15) |
| Ban giám đốc | Xem CSAT toàn công ty, xu hướng, danh sách điểm thấp | Chỉ xem |
| Marketing | Xem xu hướng CSAT (UC5) | Chỉ xem số liệu tổng hợp, không xem thông tin định danh (QT-15) |
| Hệ thống | Tạo khảo sát khi phiếu đóng (tài khoản `he_thong` gọi `POST /api/surveys` – TD-25); phát thông báo điểm thấp (UC7 đã cắt – TD-16) | Không tạo cho phiếu chưa đóng/đã có khảo sát |
| Ban giám đốc (quản trị) | Quản lý tài khoản nội bộ (yêu cầu hỗ trợ FR-S1 – TD-21) | Không tự khóa mình; luôn còn ≥ 1 BGĐ |

## 3. Yêu cầu chức năng

| Mã | Yêu cầu | MoSCoW | Trạng thái (BT2, tag `v0.2`) |
|---|---|---|---|
| FR-01 | Tự tạo khảo sát (DA_GUI) khi phiếu chuyển sang ĐÃ ĐÓNG; mỗi phiếu tối đa một | MUST | ✅ `POST /api/surveys` do tác nhân hệ thống gọi (TD-25) |
| FR-02 | Tiếp nhận phản hồi: điểm 1–5 bắt buộc, nhận xét ≤ 500 ký tự | MUST | ✅ `POST /api/surveys/:ticketId` + màn hình 1 |
| FR-03 | Báo cáo CSAT theo trung tâm theo khoảng thời gian; cảnh báo khi < 5 phản hồi; kèm kỳ trước (BS-06) | MUST | ✅ `GET /api/reports/csat` + màn hình 2 |
| FR-04 | Báo cáo CSAT theo kỹ thuật viên, xếp CSAT giảm dần | MUST | ✅ bảng kỹ thuật viên của màn hình 2 |
| FR-05 | Biểu đồ xu hướng CSAT theo tháng/quý, kỳ thiếu dữ liệu để trống; kèm trung bình năm | SHOULD | ✅ `GET /api/reports/trend` + màn hình 3 |
| FR-06 | Danh sách phản hồi điểm thấp (≤ 2) | SHOULD | ✅ `GET /api/reports/low-score` + màn hình 3 |
| FR-07 | Thông báo trong ứng dụng cho quản lý khi có điểm ≤ 2 | SHOULD | ✂ cắt khỏi phạm vi BT2 (TD-16); vẫn có cờ `low_score` |

**Yêu cầu hỗ trợ** (không phải luồng nghiệp vụ L8 nên không thêm User Story; phục vụ đăng nhập và QT-14):

| Mã | Yêu cầu | Trạng thái |
|---|---|---|
| FR-S1 | Ban giám đốc quản lý tài khoản nội bộ: tạo, xem, sửa, khóa (không xóa vật lý) | ✅ `/api/users` (TD-21) |

## 4. User Story (7)

| Mã | User Story | MoSCoW |
|---|---|---|
| US1 | Là hệ thống, tôi muốn tự tạo khảo sát ngay khi phiếu chuyển sang ĐÃ ĐÓNG để mọi phiếu hoàn tất đều được hỏi ý kiến mà không cần nhân viên nhớ gửi. | MUST |
| US2 | Là khách hàng, tôi muốn chấm điểm 1–5 và viết nhận xét ngắn trên một biểu mẫu đơn giản để phản hồi nhanh bằng điện thoại thay vì đăng lên mạng xã hội. | MUST |
| US3 | Là quản lý trung tâm, tôi muốn xem CSAT của trung tâm mình theo khoảng thời gian để biết chất lượng dịch vụ đang tốt lên hay xấu đi. | MUST |
| US4 | Là quản lý trung tâm, tôi muốn xem CSAT theo từng kỹ thuật viên để ghi nhận người làm tốt và hỗ trợ người cần cải thiện. | MUST |
| US5 | Là ban giám đốc, tôi muốn xem xu hướng CSAT theo tháng/quý để theo dõi chất lượng dịch vụ toàn công ty. | SHOULD |
| US6 | Là quản lý trung tâm, tôi muốn xem danh sách phản hồi điểm thấp kèm số điện thoại để chủ động liên hệ khách trước khi họ phàn nàn trên mạng xã hội. | SHOULD |
| US7 | Là quản lý trung tâm, tôi muốn được thông báo ngay khi có phản hồi điểm thấp để xử lý sớm thay vì phải tự vào kiểm tra định kỳ. | SHOULD |

### Tiêu chí chấp nhận (Given – When – Then)
| Mã | Given | When – Then | Ngoại lệ |
|---|---|---|---|
| US1 | Phiếu chưa ĐÃ ĐÓNG, chưa có khảo sát | Khi phiếu ĐÃ ĐÓNG, tạo 1 `survey_response` (DA_GUI) | Đã có khảo sát: không tạo (QT-10); phiếu ĐÃ HỦY: không tạo |
| US2 | Khảo sát của phiếu ĐÃ ĐÓNG đang DA_GUI | Khi khách gửi điểm 1–5, lưu điểm, nhận xét, thời điểm, đổi sang DA_TRA_LOI | Điểm ngoài 1–5: lỗi; đã trả lời: từ chối |
| US3 | Có ≥ 1 phản hồi đã trả lời | Khi chọn trung tâm + khoảng thời gian, hiện tổng, CSAT %, điểm TB, phân bố | < 5 phản hồi: cảnh báo; không có: "Chưa có phản hồi"; trung tâm khác: 403 |
| US4 | Trung tâm có kỹ thuật viên có phản hồi | Hiện CSAT từng người, giảm dần | Chưa có phản hồi: "chưa đủ dữ liệu"; < 5: cảnh báo |
| US5 | Có phản hồi nhiều tháng | Vẽ biểu đồ CSAT theo kỳ | Kỳ không dữ liệu: để trống, không nội suy |
| US6 | Có phản hồi ≤ 2 | Hiện danh sách mới nhất trước | Không có: "Không có phản hồi cần xử lý"; vai trò khác: 403 |
| US7 | Vừa lưu khảo sát ≤ 2 điểm | Tạo thông báo cho quản lý của phiếu | Không xác định quản lý: ghi log, vẫn lưu phản hồi |

## 5. Yêu cầu phi chức năng

| Mã | Yêu cầu (có ngưỡng đo được) | Nhóm |
|---|---|---|
| NFR1 | Báo cáo CSAT với tối đa 10.000 phản hồi hiển thị ≤ 2 giây ở phân vị 95 | Hiệu năng |
| NFR2 | Form khảo sát tải ≤ 3 giây (p95, 4G) và dùng đủ chức năng ở màn hình ≥ 360 px | Hiệu năng / thiết bị |
| NFR3 | 100% yêu cầu ngoài phạm vi vai trò bị từ chối (403, QT-14); 100% số điện thoại hiển thị đúng quy tắc che (QT-15) | Bảo mật |
| NFR4 | 0 phiếu có hơn 1 khảo sát (UNIQUE `ticket_id`); 100% phản hồi đã trả lời có điểm 1–5; 0 phản hồi bị xóa vật lý (QT-13) | Toàn vẹn |
| NFR5 | Sẵn sàng ≥ 99% trong 08:00–20:00 mỗi tháng | Khả dụng |

## 6. Quy tắc nghiệp vụ

| Mã | Quy tắc | Áp dụng |
|---|---|---|
| QT-06 | Phiếu chỉ chuyển trạng thái theo vòng đời; khảo sát chỉ phát sinh sau ĐÃ ĐÓNG | FR-01 |
| QT-10 | Chỉ khảo sát phiếu ĐÃ ĐÓNG, mỗi phiếu một lần | FR-01, FR-02 |
| QT-13 | Không xóa vật lý; chỉ xóa mềm | `survey_response` |
| QT-14 | Nhân viên xem đơn vị mình; quản lý xem đơn vị phụ trách; BGĐ xem toàn công ty | FR-03 → FR-07 |
| QT-15 | Số điện thoại che (090****567) với mọi vai trò trừ Quản lý và BGĐ | FR-06 |
| BS-01 | CSAT % = phản hồi đã trả lời có điểm ≥ 4 ÷ tổng phản hồi đã trả lời × 100 (làm tròn 1 chữ số); DA_GUI không tính | FR-03, 04, 05 |
| BS-02 | < 5 phản hồi: cảnh báo "mẫu chưa đủ tin cậy"; không có: "Chưa có phản hồi" (không hiện 0%) | FR-03, 04 |
| BS-03 | Điểm ≤ 2 là điểm thấp; lưu phản hồi như vậy thì tạo thông báo cho quản lý của phiếu | FR-06, 07 |
| BS-04 | Trung tâm và kỹ thuật viên của khảo sát suy ra từ phiếu | FR-03, 04 |
| BS-05 | Marketing chỉ xem số liệu tổng hợp, không xem thông tin định danh (giả định, chờ xác nhận) | FR-05 |
| BS-06 | Mỗi chỉ số CSAT hiển thị kèm **kỳ trước cùng số ngày**; BGĐ lọc một trung tâm thì kèm thêm **toàn hệ thống** (quản lý trung tâm không nhận số toàn hệ thống – QT-14); biểu đồ xu hướng kèm CSAT trung bình năm. Khoảng mặc định: từ đầu năm đến hôm nay | FR-03, 05 (TD-27) |
| TK-01 | Tên đăng nhập là duy nhất | FR-S1 |
| TK-02 | Không tự khóa hay tự đổi vai trò tài khoản của chính mình | FR-S1 |
| TK-03 | Luôn còn ít nhất một tài khoản Ban giám đốc đang hoạt động | FR-S1 |

QT-14 với tài khoản: tài khoản `quan_ly` bắt buộc gắn đúng một trung tâm có thật; vai trò khác không gắn trung tâm.

## 7. Bảng truy vết

| FR | US | UC | MoSCoW | NFR | Quy tắc | Test case |
|---|---|---|---|---|---|---|
| FR-01 | US1 | UC1 | MUST | NFR4 | QT-06, QT-10 | `tests/survey.api.test.js` (UC1, QT-10); `tests/survey.service.test.js` (đua tạo trùng) |
| FR-02 | US2 | UC2 | MUST | NFR2, NFR4 | QT-10, QT-13 | `tests/survey.api.test.js` (UC2, thiếu `score` → 400 kèm tên trường, NFR4); `tests/validators.test.js` (biên điểm 1/5, nhận xét 500/501) |
| FR-03 | US3 | UC3 | MUST | NFR1, NFR3 | QT-14, BS-01, BS-02, BS-04, BS-06 | `tests/report.service.test.js` (BS-01, BS-02 biên, QT-14, kỳ trước); `tests/survey.api.test.js` (UC3 qua HTTP) |
| FR-04 | US4 | UC4 | MUST | NFR1, NFR3 | QT-14, BS-01, BS-02, BS-04 | `tests/report.service.test.js` (UC4 xếp hạng + cảnh báo mẫu nhỏ) |
| FR-05 | US5 | UC5 | SHOULD | NFR1 | QT-14, BS-01, BS-05, BS-06 | `tests/report.service.test.js` (UC5, BS-05) |
| FR-06 | US6 | UC6 | SHOULD | NFR3 | QT-14, QT-15, BS-03 | `tests/report.service.test.js` (UC6); `tests/survey.api.test.js` (QT-14, QT-15, lọc điểm thấp) |
| FR-07 | US7 | UC7 | SHOULD | NFR3 | QT-14, BS-03 | — (cắt, TD-16) |
| FR-S1 | — | — | (hỗ trợ) | NFR3 | QT-13, QT-14, TK-01..03 | `tests/user.service.test.js`, `tests/user.api.test.js`, `tests/auth.service.test.js` (token của tài khoản đã khóa) |

Chạy toàn bộ: `npm test` (69 test). Dữ liệu vào: `tests/import-csv.test.js`, `tests/seed.test.js`; giao diện: `tests/frontend.test.js`.

---

## Phụ lục A – Hợp đồng API (khớp mã nguồn BT2, tag `v0.2`)

Xác thực bằng **token**: đăng nhập ở `POST /api/auth/login`, các lệnh sau gửi `Authorization: Bearer <token>` (thay cơ chế header mô phỏng của buổi 8 – xem TD-14). Không gửi token = khách hàng, chỉ dùng được hai endpoint công khai của form khảo sát.
Mọi lỗi có dạng `{ "error": "<MA_LOI>", "message": "...", "field": "<tên trường – chỉ khi dữ liệu vào sai>" }`.
Mã lỗi do service ném; bảng quy đổi sang HTTP duy nhất ở `src/backend/middleware/error-handler.js`: 400 `DU_LIEU_KHONG_HOP_LE` ·
401 `CHUA_DANG_NHAP`/`TOKEN_KHONG_HOP_LE`/`SAI_TAI_KHOAN_HOAC_MAT_KHAU` · 403 `KHONG_DU_QUYEN` · 404 `KHONG_TIM_THAY` ·
409 `PHIEU_CHUA_DONG`/`DA_KHAO_SAT`/`TEN_DANG_NHAP_DA_TON_TAI`/`KHONG_TU_THAO_TAC`/`PHAI_CON_MOT_BGD`. Mã 401: `CHUA_DANG_NHAP` (chưa đăng nhập) hoặc `TOKEN_KHONG_HOP_LE` (token sai/hết hạn); 403 `KHONG_DU_QUYEN` (sai vai trò hoặc vi phạm QT-14/BS-05).

| Method & đường dẫn | Vai trò | Mô tả | Mã trả về |
|---|---|---|---|
| `POST /api/auth/login` body `{username, password}` | công khai | Đăng nhập, trả `{token, expires_at, user}` | 200; 400; 401 `SAI_TAI_KHOAN_HOAC_MAT_KHAU` |
| `GET /api/auth/me` | đã đăng nhập | Thông tin phiên hiện tại | 200; 401 |
| `POST /api/surveys` body `{ticket_id}` | `he_thong` | UC1: tạo khảo sát cho phiếu ĐÃ ĐÓNG | 201; 400; 401; 403; 404; 409 `PHIEU_CHUA_DONG` / `DA_KHAO_SAT` |
| `GET /api/surveys/:ticketId` | công khai | Khách mở form; không lộ thông tin khách | 200; 404 |
| `POST /api/surveys/:ticketId` body `{score, comment?}` | công khai | UC2: gửi phản hồi | 200; 400; 404; 409 `DA_KHAO_SAT` |
| `GET /api/surveys?status=&center_id=&score_max=&page=&limit=` | `quan_ly`, `bgd` | Danh sách (số điện thoại đầy đủ theo QT-15); quản lý bị ép theo trung tâm mình | 200; 400; 401; 403 |
| `DELETE /api/surveys/:ticketId` | `quan_ly`, `bgd` | Xóa mềm (QT-13) | 200; 401; 403; 404 |
| `GET /api/reports/csat?center_id=&from=&to=` | `quan_ly`, `bgd`, `marketing` | UC3 + UC4: CSAT, phân bố điểm, bảng theo kỹ thuật viên, mốc so sánh (BS-06). Mặc định từ đầu năm đến hôm nay | 200; 400; 401; 403; 404 |
| `GET /api/reports/trend?granularity=month\|quarter&year=&center_id=` | `quan_ly`, `bgd`, `marketing` | UC5: xu hướng; chỉ trả kỳ CÓ phản hồi, không nội suy; `year_summary` = CSAT cả năm (mốc) | 200; 400; 401; 403 |
| `GET /api/reports/low-score?center_id=&page=&limit=` | `quan_ly`, `bgd` | UC6: phản hồi điểm ≤ 2 (BS-03) | 200; 400; 401; 403 |
| `GET /api/centers` | `quan_ly`, `bgd`, `marketing` | Danh sách trung tâm cho bộ lọc (quản lý chỉ thấy trung tâm mình) | 200; 401; 403 |
| `GET /api/users?role=&center_id=&is_active=&page=&limit=` | `bgd` | FR-S1: danh sách tài khoản (không bao giờ trả mật khẩu băm) | 200; 400; 401; 403 |
| `GET /api/users/:id` | `bgd` | Xem một tài khoản | 200; 401; 403; 404 |
| `POST /api/users` body `{username, password, full_name, role, center_id?}` | `bgd` | Tạo tài khoản; `quan_ly` bắt buộc `center_id` (QT-14) | 201; 400; 401; 403; 409 `TEN_DANG_NHAP_DA_TON_TAI` |
| `PATCH /api/users/:id` body (chỉ trường cần đổi) `{full_name?, role?, center_id?, password?, is_active?}` | `bgd` | Sửa tài khoản; `username` không đổi được | 200; 400; 401; 403; 404; 409 `KHONG_TU_THAO_TAC`/`PHAI_CON_MOT_BGD` |
| `DELETE /api/users/:id` | `bgd` | Khóa tài khoản (QT-13); token cũ của tài khoản đó hết hiệu lực ngay | 200; 401; 403; 404; 409 |

Thân phản hồi của `GET /api/reports/csat`:

```json
{ "data": { "filters": {"center_id": null, "center_name": "Toàn hệ thống", "from": "2026-01-01", "to": "2026-12-31"},
            "total_responses": 28, "csat_percent": 89.3, "avg_score": 4.5,
            "high_score_count": 25, "low_score_count": 3,
            "distribution": {"1":2,"2":1,"3":0,"4":4,"5":21},
            "warning": null, "min_sample": 5,
            "by_technician": [ {"technician_id": 12, "full_name": "…", "total_responses": 8,
                                "csat_percent": 75, "avg_score": 4, "low_score_count": 1, "warning": null} ],
            "comparison": { "previous": {"from": "2025-01-01", "to": "2025-12-31", "total_responses": 31,
                                         "csat_percent": 80.6, "avg_score": 4.3, "low_score_count": 2},
                            "csat_delta": 8.7,
                            "company": null } },
  "meta": { "generated_at": "2026-10-10T08:00:00.000Z" } }
```

Quy ước số liệu: `comparison.previous` là kỳ cùng số ngày liền trước; `csat_delta` = chênh lệch điểm phần trăm, `null` nếu một
trong hai kỳ không có phản hồi; `company` chỉ có khi BGĐ lọc một trung tâm (BS-06). `csat_percent` làm tròn 1 chữ số (BS-01); **không có phản hồi** thì `csat_percent = null` kèm `warning = "CHUA_CO_PHAN_HOI"` (không bao giờ hiển thị 0%), dưới 5 phản hồi thì vẫn trả số kèm `warning = "MAU_CHUA_DU_TIN_CAY"` (BS-02).

Ghi chú: số điện thoại chỉ xuất hiện ở danh sách dành cho Quản lý/BGĐ nên được trả đầy đủ (QT-15); endpoint công khai không bao giờ trả thông tin khách. Vai trò Marketing nhận `by_technician = null` và không được lọc theo trung tâm (BS-05).
