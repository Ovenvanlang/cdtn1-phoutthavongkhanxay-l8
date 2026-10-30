# Bug Log – Luồng L8 Khảo sát hài lòng CSAT

Mẫu 7 dòng theo `07_implementation/68_integration_debugging_and_config.md` §4. Mức độ: **Critical** (không dùng được / dữ liệu sai / lỗ hổng),
**Major** (chức năng quan trọng sai nhưng có cách khác), **Minor** (trải nghiệm/trình bày). Chỉ ghi lỗi đã thực sự gỡ, mỗi lỗi có commit sửa.

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
