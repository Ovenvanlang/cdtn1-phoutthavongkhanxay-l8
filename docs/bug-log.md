# Bug Log – Luồng L8 Khảo sát hài lòng CSAT

Mẫu 7 dòng theo `07_implementation/68_integration_debugging_and_config.md` §4 và `69_testing_qa_principles.md` §5. Mức độ: **Critical** (không dùng được / dữ liệu sai / lỗ hổng),
**Major** (chức năng quan trọng sai nhưng có cách khác), **Minor** (trải nghiệm/trình bày). Chỉ ghi lỗi đã thực sự gỡ, mỗi lỗi có commit sửa.
Phân loại theo cây quyết định của buổi 13: (1) không dùng được / dữ liệu sai / lộ dữ liệu – lỗ hổng → Critical; nếu không,
(2) một chức năng quan trọng sai → Major; còn lại → Minor.

| Mã | Mức | Tóm tắt | Phát hiện bởi | Commit sửa |
|---|---|---|---|---|
| BUG-001 | Major | `npm test` lỗi 7 test trên Windows | phép thử thư mục trống (BT2) | `feb0d9d` |
| BUG-002 | Critical | Nhập CSV chính thức bị vỡ, KTV bị đánh dấu nghỉ | rà soát BT2 | `4d42ba8` (chung với BUG-003 – xem ghi chú) |
| BUG-003 | Major | Nạp CSV lần 2 lỗi khóa ngoại | rà soát BT2 | `4d42ba8` |
| BUG-004 | Major | Báo cáo CSAT mở lần đầu luôn trống | rà soát BT2 | `a91fc0b`, `b10115a` |
| BUG-005 | Minor | Trang giao diện cũ vẫn mở được | rà soát BT2 | `eac16ec` |
| **BUG-006** | **Critical** | Người lạ đoán số phiếu là gửi điểm thay khách (A01) | **TC-10** | `377c641` |
| **BUG-007** | **Major** | Phản hồi 00:00–06:59 giờ VN bị tính sang ngày/tháng trước | **TC-11** | `5520988` |
| **BUG-008** | **Critical** | body-parser 2.3.0 có lỗ hổng DoS đã công bố | checklist bảo mật mục 7 (`npm audit`) | `7ce09b2` |
| **BUG-009** | **Minor** | Mọi phản hồi để lộ `X-Powered-By: Express` | checklist bảo mật mục 5 (`curl -i`) | `f474165` |
| **BUG-010** | **Major** | Mã truy cập khảo sát nằm trong URL (`?t=`) → vào log máy chủ/proxy và lịch sử trình duyệt | đối chiếu tự học buổi 15 (`46a` §1) | `8c6d915` |
| **BUG-011** | **Minor** | Payload token chứa họ tên nhân viên (ai cầm token cũng đọc được) | đối chiếu tự học buổi 15 (`46a` §3), giải mã thử token | `a1c38ed` |

> **Ghi chú trung thực về BUG-002 và BUG-003:** hai lỗi này được sửa chung trong commit `4d42ba8` (29/10/2026, BT2) – trước khi
> áp dụng quy tắc "mỗi bug một commit `fix(...) (BUG-xx)`" của buổi 13–14. Em không viết lại lịch sử Git đã nộp ở tag `v0.2`
> để tách commit, nên hai mục dùng chung một link. Từ BUG-006 trở đi mỗi lỗi có đúng một commit riêng; trước mỗi bản sửa có
> test case FAIL chứng minh lỗi (commit `8ab0d75`: 10 PASS / 2 FAIL).

## BUG-001 · Major — `npm test` thất bại 7 test khi chạy trên Windows
| Dòng | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-001 · Major (bộ test – tiêu chí cốt lõi C4 – không PASS trên máy Windows; hệ thống vẫn chạy) |
| 2. Phát hiện bởi | Phép thử thư mục trống trên máy Windows của em (30/10/2026): `git clone --branch v0.2` → `npm ci` → `npm run db:setup` → `npm test` |
| 3. Triệu chứng | 7 test của `tests/frontend.test.js` báo ✖ `ERR_UNSUPPORTED_ESM_URL_SCHEME … Received protocol 'c:'`; tổng kết `pass 62 · fail 7` |
| 4. Cách tái lập | Trên Windows, ở commit `18cc3be`: `npm ci` rồi `npm test` (trên Linux không tái lập được) |
| 5. Nguyên nhân | Test nạp module giao diện bằng `import(path.join(FRONTEND, …))`. Trên Windows `path.join` trả đường dẫn tuyệt đối `C:\…`; bộ nạp ESM của Node chỉ nhận URL `file://` nên hiểu `c:` là một scheme lạ. Trên Linux đường dẫn bắt đầu bằng `/` nên lỗi không lộ ra khi chạy thử trước đó |
| 6. Cách sửa | Thêm hàm `nhapModule` dùng `pathToFileURL(path.join(…)).href` (ra `file:///C:/…` trên Windows) cho mọi lệnh `import()` động trong test |
| 7. Commit và xác nhận | https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8/commit/feb0d9d319b4385525aacd9b6b95a2beb6871930 · `frontend.test.js` 8/8 PASS; `pathToFileURL` ở chế độ Windows cho URL `file:///C:/Users/…/DataState.mjs` hợp lệ |

## BUG-002 · Critical — Nhập bộ CSV chính thức của case study bị vỡ, KTV bị đánh dấu nghỉ việc
| Dòng | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-002 · Critical (đường nạp dữ liệu thật không dùng được; nếu chạy qua được thì dữ liệu sai) |
| 2. Phát hiện bởi | Rà soát 29/10/2026: sinh lại bộ CSV chính thức bằng `gen_dataset.py` (seed 20260901, `02_case_study/20`) rồi chạy `npm run import` |
| 3. Triệu chứng | `Error: NOT NULL constraint failed: technician.full_name` (`import-csv.js:71`), không nạp được dòng nào; khi đổi tên cột cho chạy qua thì cả 38 KTV có `is_active = 0` và mọi trung tâm có `city = "Không rõ"` |
| 4. Cách tái lập | Ở commit `aa970ff`: chép `service_centers.csv`, `technicians.csv`, `tickets_history.csv`, `survey_responses.csv` của bộ chính thức vào `data/raw/` → `npm run import -- data/raw` |
| 5. Nguyên nhân | `importCsv` đọc cột `full_name`/`name` và `city`, nhưng bộ case study dùng `ho_ten` và `thanh_pho`; cột `is_active` có giá trị `true`/`false` bị `Number()` đổi thành `NaN` → 0. Script trước đó chỉ chạy với tệp CSV tự soạn đúng tên cột em đặt, chưa từng chạy với bộ dữ liệu chính thức |
| 6. Cách sửa | Đọc `ho_ten`, `thanh_pho` (vẫn nhận tên cũ); hàm `toBool` cho `true/false/1/0`; từ chối kèm lý do các dòng vi phạm QT-10 hoặc điểm ngoài 1–5; thêm `data/sample/` chép nguyên văn từ bộ chính thức để luôn kiểm được (TD-23) |
| 7. Commit và xác nhận | https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8/commit/4d42ba83588ec66c60de8425ec9ad92066c1427b · test "Luồng đúng: đọc đúng cột của case study (ho_ten, thanh_pho, is_active=false)…" PASS; nạp bộ đầy đủ: 6 trung tâm, 38 KTV (35 đang làm, 3 nghỉ – đúng tệp nguồn), 7.800 phiếu, 2.600 khảo sát |

## BUG-003 · Major — Nạp CSV lần thứ hai lỗi khóa ngoại, không nạp lại được
| Dòng | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-003 · Major (vi phạm "chạy lại lần 2 không lỗi" – C5; lần đầu vẫn nạp được) |
| 2. Phát hiện bởi | Chạy lại `npm run import` lần 2 trong lúc kiểm BUG-002 |
| 3. Triệu chứng | Lần 2: `Error: FOREIGN KEY constraint failed`, cả transaction bị hủy, dữ liệu giữ nguyên bản cũ |
| 4. Cách tái lập | `npm run db:setup` (tạo tài khoản `quanly.*` gắn trung tâm 1) → `npm run import -- data/sample` → chạy lại đúng lệnh đó |
| 5. Nguyên nhân | `importCsv` xóa toàn bộ bảng `service_center` trước khi nạp, trong khi `app_user.center_id` của tài khoản quản lý trỏ tới trung tâm (khóa ngoại – QT-14) nên SQLite chặn lệnh xóa |
| 6. Cách sửa | Không xóa trung tâm nữa: ghi đè theo `center_id` (`INSERT … ON CONFLICT(center_id) DO UPDATE`), đổi tên tạm trước để tránh trùng `UNIQUE(center_name)`; chỉ xóa trung tâm cũ không còn tài khoản nào gắn vào |
| 7. Commit và xác nhận | https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8/commit/4d42ba83588ec66c60de8425ec9ad92066c1427b · test "Chạy lại lần 2 trên cùng CSDL: không lỗi, không nhân đôi, tài khoản quản lý gắn trung tâm vẫn giữ" PASS; `docs/ket-qua-chay-mau.txt` mục 5 (2 lần nạp cùng số dòng) |

## BUG-004 · Major — Mở trang Báo cáo CSAT lần đầu luôn hiện "Chưa có phản hồi"
| Dòng | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-004 · Major (màn hình chính trống khi mở mặc định; chọn lại khoảng ngày thì vẫn xem được) |
| 2. Phát hiện bởi | Rà soát 29/10/2026: `npm run db:setup` → `npm start` → đăng nhập `bgd` → Báo cáo CSAT, không chọn ngày |
| 3. Triệu chứng | `GET /api/reports/csat` không tham số trả `total_responses = 0`, `warning = CHUA_CO_PHAN_HOI`; cả 3 vùng dữ liệu trống dù CSDL có phản hồi |
| 4. Cách tái lập | Ở commit `aa970ff`, ngày từ 01/10/2026 trở đi: `curl -H "Authorization: Bearer $TOKEN" localhost:3000/api/reports/csat` |
| 5. Nguyên nhân | Khoảng mặc định của báo cáo là "quý hiện tại" (`currentQuarterRange`), còn seed chỉ sinh phiếu đóng trong 270 ngày từ 01/01/2026 (tới khoảng 27/09) nên quý 4 không có phản hồi nào |
| 6. Cách sửa | Seed sinh phiếu đóng tới 23/10/2026; khoảng mặc định đổi thành từ đầu năm đến hôm nay và mọi số liệu kèm kỳ trước (BS-06, TD-24, TD-27) |
| 7. Commit và xác nhận | https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8/commit/a91fc0b9974e853f9f98a671f6878f1a16dc6203 · https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8/commit/b10115aac465f429aeebcd4e438eaea9d9d554c7 · test "Khoảng thời gian: mặc định từ đầu năm đến hôm nay…" PASS; ảnh `docs/img/bt2-06_…` |

## BUG-005 · Minor — Trang giao diện bản cũ vẫn mở được và hiển thị dữ liệu ghi cứng
| Dòng | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-005 · Minor (trang không nằm trong luồng chính, không ảnh hưởng nghiệp vụ) |
| 2. Phát hiện bởi | Rà soát cấu trúc repo 29/10/2026: `curl -o /dev/null -w "%{http_code}" localhost:3000/dashboard.html` → 200 |
| 3. Triệu chứng | `dashboard.html`, `trend.html`, `form.html` hiện tên "QLTT – Trần Thị Trâm", "HCM-01" ghi cứng và gọi API thất bại (401) |
| 4. Cách tái lập | Ở commit `aa970ff`: `npm start` → mở `http://localhost:3000/dashboard.html` |
| 5. Nguyên nhân | Tệp của bản giao diện trước (gửi header `X-Role` mô phỏng, tải Chart.js qua CDN) không được xóa khi làm lại giao diện theo wireframe (TD-14, TD-18); Express phục vụ mọi tệp trong `src/frontend/` |
| 6. Cách sửa | Xóa 3 trang cũ, `api/client.js`, `api/survey.api.js`, `css/style.css`; chỉ còn một lớp gọi API `api/client.mjs` (TD-22) |
| 7. Commit và xác nhận | https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8/commit/eac16ec3ee6987f225c852e2de5ba3aea85bd445 · `/dashboard.html` trả 404; test "không trang nào trong pages/ gọi fetch( trực tiếp" PASS |

## BUG-006 · Critical — Người lạ đoán số phiếu là gửi điểm thay khách hàng (OWASP A01)
| Dòng | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-006 · Critical – lỗ hổng kiểm soát truy cập (A01 Broken Access Control), dữ liệu bị thay đổi thật: điểm giả đi thẳng vào CSAT của trung tâm/KTV và khóa luôn khảo sát (QT-10) nên khách thật không trả lời được nữa |
| 2. Phát hiện bởi | **TC-10** (bảo mật – quyền truy cập theo chủ sở hữu), lần chạy 07/11/2026 ở commit `8ab0d75` – ảnh `docs/screenshots/TC-10-truoc-sua.png` |
| 3. Triệu chứng | `POST /api/surveys/2` **không đăng nhập, không mã gì** với `{"score":1,"comment":"đánh giá giả"}` → **HTTP 200**, CSDL: phiếu 2 chuyển `DA_TRA_LOI`, `score = 1`. Khách thật bấm đường dẫn sau đó nhận 409 `DA_KHAO_SAT` |
| 4. Cách tái lập | Ở commit `8ab0d75`: `npm run tc -- TC-10`; hoặc `npm run db:setup && npm start`, lấy một `ticket_id` bất kỳ đang `DA_GUI` (là số tăng dần 1, 2, 3…) rồi `curl -X POST -H "Content-Type: application/json" -d '{"score":1}' localhost:3000/api/surveys/<id>` |
| 5. Nguyên nhân | Đường dẫn khảo sát gửi cho khách chỉ có `khao-sat.html?ticket=<ticket_id>` (thiết kế BT1/BT2) và `ticket_id` là khóa tự tăng nên ai cũng đoán được. Route `POST/GET /api/surveys/:ticketId` để công khai (Access Middleware coi người không có token là "khách hàng"), còn `surveyService.submit(ticketId, body)` chỉ kiểm khảo sát tồn tại và đang `DA_GUI` – **không có dữ liệu nào chứng minh người gọi chính là khách nhận đường dẫn**, nên không thể kiểm "chủ sở hữu" |
| 6. Cách sửa | Migration `005_survey_access_token.sql`: cột `access_token` 128 bit ngẫu nhiên (`randomblob(16)`), sinh bù cho dữ liệu cũ, `UNIQUE` index và trigger tự sinh cho mọi khảo sát mới (API, seed, nạp CSV). Validator `accessToken` (32 ký tự hex, thiếu → 400 `field: t`); service `openForCustomer` so mã bằng `safeEqual` (thời gian hằng), sai mã/đã xóa → 404 `KHONG_TIM_THAY` giống khảo sát không tồn tại. UC1 trả `survey_link` `/khao-sat.html?ticket=<id>&t=<mã>`; trang `khao-sat` đọc `t`. Cập nhật mọi chỗ gọi: `survey.api.test.js`, `survey.service.test.js`, `scripts/chay-luong-end-to-end.js` (TD-30) |
| 7. Commit và xác nhận | https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8/commit/377c6415c7c9ee9be651714048cefce548747f97 · chạy lại TC-10: không mã → 400 `DU_LIEU_KHONG_HOP_LE` (field `t`), mã đoán `000…0` → 404 `KHONG_TIM_THAY`, CSDL vẫn `DA_GUI`/`score = null` → **PASS**. Chống hỏng luồng đúng: TC-10 bước 3 (commit `18db0de`) và TC-02 – khách thật mở đúng đường dẫn vẫn gửi được → 200 **PASS**; thêm test "BUG-006: … không có mã → 400; sai mã → 404" |

## BUG-007 · Major — Phản hồi từ 00:00 đến 06:59 giờ Việt Nam bị tính sang ngày (và tháng) trước
| Dòng | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-007 · Major – báo cáo xu hướng theo tháng/quý (UC5) và lọc theo ngày (UC3) xếp sai một phần phản hồi ở ranh giới ngày. Không phải Critical: thời điểm gốc `responded_at` vẫn lưu đúng, tổng và CSAT của cả năm không đổi, và tính lại được (đã làm ở migration 006); chức năng sai ở biên, xem được bằng cách khác (danh sách phản hồi có giờ trả lời) |
| 2. Phát hiện bởi | **TC-11** (giá trị biên 23:59 ngày 31/10 và 00:30 ngày 01/11 giờ VN), lần chạy 07/11/2026 ở commit `8ab0d75` – ảnh `docs/screenshots/TC-11-truoc-sua.png` |
| 3. Triệu chứng | Phản hồi lúc 00:30 ngày 01/11 (giờ VN) có `responded_date = 2026-10-31`; báo cáo xu hướng 2026 trả `{"10": 2}` thay vì tháng 10 = 1, tháng 11 = 1 |
| 4. Cách tái lập | Ở commit `377c641`: `npm run tc -- TC-11` (đồng hồ hệ thống giả lập `2026-10-31T17:30:00Z` = 00:30 01/11 giờ VN rồi gửi phản hồi, đọc lại `survey_response.responded_date` và `GET /api/reports/trend?year=2026`) |
| 5. Nguyên nhân | `survey.repository.submitTx` lấy ngày bằng `respondedAt.slice(0, 10)` và `getUTCMonth()` trên chuỗi ISO **UTC**; Việt Nam là UTC+7 nên mọi phản hồi trước 07:00 sáng giờ VN rơi vào ngày UTC hôm trước. Cùng lỗi ở `report.service` (`yearToDateRange` dùng `toISOString()` làm "hôm nay", năm mặc định dùng `getUTCFullYear()`) và seed. Test cũ dùng giờ 08:00 UTC (15:00 VN) nên không chạm ranh giới |
| 6. Cách sửa | `utils/local-date.js` (`localDateParts`, `localDate`) dùng `Intl.DateTimeFormat` theo biến `APP_TIMEZONE` (mặc định `Asia/Ho_Chi_Minh`, sai tên thì dừng khi khởi động); áp dụng ở `submitTx`, `yearToDateRange`, năm mặc định của UC5 và seed. Migration `006_responded_date_vn.sql` tính lại `responded_date` (+7 giờ) cho dữ liệu cũ ghi theo UTC, bổ sung `dim_date` còn thiếu; dòng CSV giờ địa phương giữ nguyên (TD-31) |
| 7. Commit và xác nhận | https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8/commit/55209881386c56c0aea39e70bf248984158966c8 · chạy lại TC-11: `responded_date` = 2026-10-31 và 2026-11-01, xu hướng tháng 10 = 1, tháng 11 = 1 → **PASS**; thêm `tests/local-date.test.js` (00:30 01/11, 23:59 31/10, giao thừa 18:00 UTC 31/12 = 01/01 năm sau, migration 006 chạy 2 lần) |

## BUG-008 · Critical — Phụ thuộc `body-parser` 2.3.0 có lỗ hổng từ chối dịch vụ đã công bố
| Dòng | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-008 · Critical – lỗ hổng bảo mật (OWASP A03 Software Supply Chain Failures) mức **high** theo GitHub Advisory: một request nén được dựng sẵn có thể làm máy chủ ngừng phục vụ. Ứng dụng nhận JSON qua `express.json()` (mặc định chấp nhận thân nén gzip/deflate) trên cả API công khai của khách nên bị ảnh hưởng thật |
| 2. Phát hiện bởi | Điền checklist bảo mật mục 7 (phụ thuộc + cảnh báo lỗ hổng), 07/11/2026: `npm audit` |
| 3. Triệu chứng | `npm audit` → `body-parser 2.0.0 - 2.3.0 · Severity: high · body-parser vulnerable to Denial of Service via trailing bytes after a compressed request body – GHSA-27r3-jxmh-p828 · 1 high severity vulnerability` |
| 4. Cách tái lập | Ở commit `5520988`: `npm ci` rồi `npm audit` (hoặc `grep -A1 '"node_modules/body-parser"' package-lock.json` → `"version": "2.3.0"`) |
| 5. Nguyên nhân | `package-lock.json` ghim `body-parser@2.3.0` (phụ thuộc gián tiếp của `express@5`) từ lúc cài ở BT2; lỗ hổng được công bố sau đó và quy trình chưa có bước `npm audit` trước khi nộp nên không ai cập nhật |
| 6. Cách sửa | `npm audit fix` → `body-parser@2.4.0` (bản vá, cùng major nên không đổi API); chỉ `package-lock.json` thay đổi. Thêm bước `npm audit --audit-level=high` vào CI (`.github/workflows/ci.yml`) để lỗ hổng mới làm đỏ build (TD-32) |
| 7. Commit và xác nhận | https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8/commit/7ce09b2ca7393bc2188c3ec73c44beefd9806fb1 · `npm audit` → `found 0 vulnerabilities`; `npm test` 86/86 PASS ở commit này |

## BUG-009 · Minor — Mọi phản hồi để lộ header `X-Powered-By: Express`
| Dòng | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-009 · Minor – không lộ dữ liệu nghiệp vụ hay dữ liệu cá nhân, không khai thác trực tiếp được; chỉ cho người dò quét biết công nghệ máy chủ để tra lỗ hổng theo phiên bản (OWASP A02 Security Misconfiguration) |
| 2. Phát hiện bởi | Điền checklist bảo mật mục 5 (thông báo lỗi không lộ cấu trúc bên trong), 07/11/2026: gọi endpoint gây lỗi và đọc **toàn bộ** phản hồi bằng `curl -i` |
| 3. Triệu chứng | `curl -i localhost:3000/api/khong-co` → thân lỗi sạch (`{"error":"KHONG_TIM_THAY",…}`, không stack trace) nhưng header có `X-Powered-By: Express`; tương tự ở `/health`, 401, 400 |
| 4. Cách tái lập | Ở commit `7ce09b2`: `npm start` rồi `curl -si localhost:3000/health | grep -i x-powered-by` |
| 5. Nguyên nhân | Express bật header `X-Powered-By` theo mặc định; `createApp` trong `src/backend/app.js` chưa tắt (chỉ mới lo phần thân phản hồi lỗi trong `error-handler.js`) |
| 6. Cách sửa | `app.disable('x-powered-by')` ngay sau khi tạo app, trước mọi middleware, nên áp dụng cho cả tệp tĩnh và lỗi 404 |
| 7. Commit và xác nhận | https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8/commit/f4741652a264e46d52e035f48ed6f1057a153ec1 · test "BUG-009: phản hồi không để lộ công nghệ máy chủ qua header X-Powered-By" kiểm 3 loại phản hồi (200, 401, 404) → PASS; `curl -si localhost:3000/health` không còn dòng `X-Powered-By` |

## BUG-010 · Major — Mã truy cập khảo sát nằm trong query string của URL
| Dòng | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-010 · Major. Câu 1 của cây quyết định: hệ thống vẫn dùng được, dữ liệu không sai, và ở bản chạy hiện tại **chưa có thành phần nào ghi URL** (không có log truy cập, không proxy) nên chưa lộ thật → không phải Critical. Câu 2: chức năng bảo vệ khảo sát (BUG-006) bị yếu đi – khi đặt sau proxy hoặc bật log truy cập, ai đọc log lấy được mã và gửi điểm thay khách → Major |
| 2. Phát hiện bởi | Đối chiếu mã với tự học buổi 15 (`46a` §1 "Token, mật khẩu, khoá **không bao giờ** trong query string") ngày 12/11/2026; checklist bảo mật mục 1 và 6 |
| 3. Triệu chứng | Đường dẫn gửi khách là `/khao-sat.html?ticket=8&t=<mã>`; trang gọi `GET/POST /api/surveys/8?t=<mã>` – mã xuất hiện trong mọi URL gửi lên máy chủ và trong lịch sử trình duyệt |
| 4. Cách tái lập | Ở commit `1210a5d`: `POST /api/surveys` (vai trò he_thong) → xem `survey_link`; mở trang bằng link đó với DevTools → tab Network: request `/api/surveys/8?t=…` chứa mã; `curl -s -X POST "localhost:3000/api/surveys/8?t=<mã>" -d '{"score":5}'` → 200 (API chấp nhận mã trong URL) |
| 5. Nguyên nhân | Bản sửa BUG-006 chọn cách nhanh nhất là đọc mã từ `req.query.t` (route) và `URLSearchParams(location.search)` (trang), coi mã như một tham số lọc bình thường; thiết kế không tính tới việc URL (khác với header/thân request) bị ghi lại ở log máy chủ, proxy và lịch sử trình duyệt |
| 6. Cách sửa | Link gửi khách đổi thành `/khao-sat.html?ticket=<id>#t=<mã>` (phần sau `#` trình duyệt không gửi lên máy chủ); API nhận mã qua header `X-Survey-Code`, mã trong `?t=` bị từ chối 400 kể cả khi đúng; trang `khao-sat` đọc mã từ `#t`, giữ trong `sessionStorage` của tab và xóa khỏi thanh địa chỉ; `client.mjs` cho phép header riêng. Cập nhật test, TC-01/02/04/08/10/11, `chay-luong`, API docs, `.http` (TD-37) |
| 7. Commit và xác nhận | https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8/commit/8c6d915027dbab655cb06a7220d16f5b7b739718 · test "BUG-006, BUG-010: … mã trong URL -> 400" PASS; TC-10 PASS (không mã → 400 field `X-Survey-Code`, mã đoán → 404, khách thật → 200); Playwright: mở link `#t=` → form hiện, thanh địa chỉ còn `?ticket=1`, request API không có mã trong URL (header `X-Survey-Code`), tải lại trang vẫn mở được |

## BUG-011 · Minor — Payload của token đăng nhập chứa họ tên nhân viên
| Dòng | Nội dung |
|---|---|
| 1. Mã và mức độ | BUG-011 · Minor – token chỉ nằm trong trình duyệt của chính nhân viên đó, họ tên nhân viên không phải dữ liệu khách hàng, nghiệp vụ vẫn đúng; nhưng trái quy tắc "payload chỉ id, vai trò, thời hạn" (`46a` §3) và sẽ lộ tên nếu token bị chép ra ngoài |
| 2. Phát hiện bởi | Đối chiếu tự học buổi 15 (`46a` §3, bảng "JWT — bốn lỗi phổ biến") ngày 12/11/2026: giải mã thử phần giữa của token đăng nhập |
| 3. Triệu chứng | `echo <phần giữa token> \| base64 -d` → `{"sub":2,"name":"Quản lý trung tâm TTBH Quận 10","role":"quan_ly","center_id":1,…}` – đọc được không cần khóa |
| 4. Cách tái lập | Ở commit `8c6d915`: `POST /api/auth/login` (`quanly.tt01`), lấy `data.token`, giải mã base64url phần thứ hai |
| 5. Nguyên nhân | `auth.service.issueToken` đưa cả `user.full_name` vào payload để giao diện tiện hiển thị, coi payload như dữ liệu kín; thực ra payload chỉ được **ký** (chống sửa), không được **mã hóa** (không chống đọc). Giao diện cũng không đọc tên từ token (lấy từ `data.user` khi đăng nhập), nên trường này thừa |
| 6. Cách sửa | Bỏ `name` khỏi payload (còn `sub, role, center_id, iat, exp`); `verifyToken` vẫn trả tên đọc từ CSDL nên `/api/auth/me` không đổi. Cùng đợt rà soát (không phải bug, ghi ở TD-38): khóa `AUTH_SECRET` bắt buộc ≥ 32 ký tự, thời hạn token mặc định 1 giờ, `/health` kiểm cả CSDL – commit `8235ac3` |
| 7. Commit và xác nhận | https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8/commit/a1c38ed0a26fd5b4c000eda1bddfa45127b3eb11 · test "BUG-011: phần payload của token … chỉ có id, vai trò, trung tâm, thời hạn" PASS (kiểm danh sách khóa, không có họ tên, tên vẫn có sau xác thực); `npm test` 90/90 ở bản `v1.0` |
