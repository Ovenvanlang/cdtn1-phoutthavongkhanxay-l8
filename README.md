# Khảo sát hài lòng CSAT – Smart CRM Mekong Mobile (Luồng L8)

Chuyên đề tốt nghiệp 1 · Track SE · PHOUTTHAVONG Khanxay – 237480201IS10 · GVHD: ThS. Nguyễn Minh Tân · Bài tập 2 – tag `v0.2`

## 1. Giới thiệu
Sau khi phiếu bảo hành chuyển sang **ĐÃ ĐÓNG**, hệ thống tạo khảo sát; khách chấm điểm 1–5 kèm nhận xét.
Quản lý trung tâm, ban giám đốc và marketing xem chỉ số CSAT theo trung tâm, theo kỹ thuật viên và theo thời gian, luôn kèm mốc so sánh với kỳ trước.
Quản lý xem được danh sách phản hồi điểm thấp để gọi lại khách trước khi họ phàn nàn trên mạng xã hội (vấn đề **V7** của case study).
Ban giám đốc quản lý tài khoản nội bộ.

Tài liệu: `docs/srs.md` (SRS) · `docs/thay-doi-thiet-ke.md` (nhật ký thay đổi so với BT1, TD-01 → TD-29) · `docs/architecture-thuc-te.png`
(kiến trúc đã hiện thực) · `docs/erd-thuc-te.png` · `docs/anh-xa-kien-truc.md` · `docs/anh-man-hinh.md` · `docs/ket-qua-chay-mau.txt` · `docs/bug-log.md` · `docs/ai-disclosure.md`.

## 2. Yêu cầu môi trường
- **Node.js 22.13 trở lên** (đã thử với 22.23; image Docker dùng 22.20), npm 10 – kiểm tra: `node -v`
- **CSDL: SQLite 3** dùng qua module `node:sqlite` có sẵn trong Node – không cần cài máy chủ CSDL, không biên dịch thư viện (TD-12)
- Không cần Internet khi chạy: Chart.js được phục vụ từ `node_modules`; CSS tự viết (TD-18)
- Biến môi trường: xem `.env.example` (`PORT`, `DATABASE_FILE`, `AUTH_SECRET`, `TOKEN_TTL_HOURS`, `DEMO_PASSWORD`)
- Phiên bản thư viện khóa trong `package-lock.json` (cài bằng `npm ci`)
- Tùy chọn: Docker Desktop / Docker Engine có `docker compose` (mục 3b)

## 3. Cài đặt và chạy (mỗi bước một lệnh, chạy lần lượt)
| # | Việc | Lệnh | Kết quả mong đợi |
|---|---|---|---|
| 1 | Tải mã nguồn | `git clone --branch v0.2 https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8.git` | có thư mục `cdtn1-phoutthavongkhanxay-l8` |
| 2 | Vào thư mục dự án | `cd cdtn1-phoutthavongkhanxay-l8` | |
| 3 | Cài thư viện đúng phiên bản khóa | `npm ci` | cài xong, không biên dịch native |
| 4 | Tạo tệp cấu hình | `cp .env.example .env` (Windows CMD: `copy .env.example .env`) | có tệp `.env` |
| 5 | Dựng CSDL từ trống + dữ liệu mẫu | `npm run db:setup` | `Đã chạy migration: 001…004`, `1200 phiếu`, 4 tài khoản demo |
| 6 | Chạy bộ test | `npm test` | `# tests 69` · `# pass 69` · `# fail 0` |
| 7 | Chạy thử trọn luồng | `npm run chay-luong` | `== TOÀN BỘ LUỒNG CHẠY XONG, KHÔNG CÓ BƯỚC NÀO THẤT BẠI ==` |
| 8 | Khởi động máy chủ | `npm start` | `API khảo sát CSAT chạy tại http://localhost:3000` |
| 9 | Mở giao diện | trình duyệt vào `http://localhost:3000` | trang chủ với 3 màn hình |

**Kiểm tra hệ thống đã chạy đúng:** `http://localhost:3000/health` trả `{"status":"ok"}`; đăng nhập `bgd` / `Demo@2026` → trang
**Báo cáo CSAT** hiện 4 thẻ số liệu kèm "so với kỳ trước". Chạy lại bước 5 lần hai: `CSDL đã ở phiên bản mới nhất`, `Đã có dữ liệu, bỏ qua` – không lỗi, không nhân đôi.

### 3b. Chạy bằng Docker (2 lệnh)
```bash
cp .env.example .env
docker compose up --build
```
Mở `http://localhost:3000`. Container tự chạy migration và seed (đã có dữ liệu thì bỏ qua); dữ liệu nằm trong volume `csat_data`.
Dừng: `Ctrl+C` rồi `docker compose down` (thêm `-v` để xóa dữ liệu).

### Lệnh phụ trợ
```bash
npm run seed -- --reset          # nạp lại dữ liệu mô phỏng từ đầu (seed = 42, tái lập được)
npm run import -- data/sample    # nạp MẪU bộ CSV chính thức của case study (đã có sẵn trong repo, mục 6)
npm run import -- data/raw       # nạp bộ CSV ĐẦY ĐỦ tải từ LMS (không commit)
npm run dev                      # chạy có tự khởi động lại khi sửa mã
```

**Tài khoản demo** (mật khẩu lấy từ `DEMO_PASSWORD` trong `.env`, mặc định `Demo@2026`):

| Tài khoản | Vai trò | Thấy được gì |
|---|---|---|
| `bgd` | Ban giám đốc | toàn hệ thống, mọi báo cáo, quản lý tài khoản (`/api/users`) |
| `quanly.tt01` | Quản lý trung tâm TTBH Quận 10 | chỉ trung tâm mình (QT-14) |
| `marketing` | Marketing | chỉ số liệu tổng hợp, không xem chi tiết kỹ thuật viên/khách hàng (BS-05) |
| `hethong` | Tác nhân hệ thống | tạo khảo sát cho phiếu ĐÃ ĐÓNG (UC1, TD-25) |

## 4. Kiểm thử
```bash
npm test
```
69 test chạy trên CSDL SQLite trong bộ nhớ, tự dựng dữ liệu – không phụ thuộc dữ liệu trên máy. Đủ 3 loại theo đề BT2:

| Loại | Ví dụ (tệp) |
|---|---|
| Luồng đúng | tạo khảo sát cho phiếu ĐÃ ĐÓNG → 201 (`survey.api.test.js`); CRUD tài khoản đầy đủ (`user.api.test.js`); nạp CSV đúng cột case study (`import-csv.test.js`) |
| Giá trị biên | đúng 5 phản hồi không cảnh báo, 4 phản hồi có cảnh báo BS-02 (`report.service.test.js`); điểm 1 và 5 nhận, 0 và 6 từ chối; nhận xét 500 nhận, 501 từ chối (`validators.test.js`); token còn 1 giây / đúng giây hết hạn (`auth.service.test.js`) |
| Dữ liệu sai | thiếu `score` → 400 kèm `"field":"score"` (`survey.api.test.js`); JSON hỏng → 400 không phải 500; ngày 30/02 bị từ chối; khảo sát cho phiếu chưa đóng trong CSV bị bỏ qua kèm lý do (`import-csv.test.js`) |

## 5. Cấu trúc thư mục
```
src/
  backend/                    # khối "Backend API" trong sơ đồ kiến trúc
    app.js, server.js         #   ráp các lớp, khởi động
    config/                   #   đọc biến môi trường
    middleware/               #   access.js (token, QT-14, BS-05) · error-handler.js (mã lỗi -> HTTP)
    routes/                   #   tầng 1: nhận/trả HTTP (auth, surveys, reports + centers, users)
    validators/               #   kiểm định dạng dữ liệu vào, lỗi kèm tên trường
    services/                 #   tầng 2: quy tắc nghiệp vụ (QT-10, QT-13, QT-14, BS-01..06, TK-01..03)
    repositories/             #   tầng 3: CHỈ SQL
    errors/AppError.js        #   lỗi có mã nghiệp vụ, không mang mã HTTP
    utils/password.js         #   băm mật khẩu scrypt
    db/                       #   connection.js (SQLite), migrate.js, import-csv.js
  frontend/                   # khối "Frontend"
    index.html, dang-nhap.html, khao-sat.html, bao-cao-csat.html, xu-huong.html
    api/                      #   client.mjs + *.api.mjs – NƠI DUY NHẤT gọi fetch
    components/               #   DataState, biểu đồ, định dạng số Việt Nam, thanh bên
    pages/                    #   mã của từng màn hình (không gọi fetch trực tiếp)
    assets/giao-dien.css
migrations/                   # 001–004: dựng CSDL từ trống, chạy lại không lỗi
seeds/seed.js                 # dữ liệu mô phỏng bám case study, seed = 42
data/sample/                  # mẫu chép nguyên văn từ bộ CSV chính thức (xem data/sample/README.md)
scripts/                      # chạy trọn luồng end-to-end; trích mẫu CSV
tests/                        # 69 test (node:test)
docs/                         # SRS, sơ đồ, ảnh chụp, nhật ký thay đổi, khai báo AI
Dockerfile, docker-compose.yml
```
Express phục vụ luôn `src/frontend/` cùng cổng với API nên giao diện gọi API bằng đường dẫn tương đối (`/api/...`), không cần CORS.

### Quy ước đặt tên (bài 60 §6)
- **Backend và lớp `api/` của giao diện dùng tiếng Anh**, trùng tên kỹ thuật trong bảng thuật ngữ SRS (`survey`, `ticket`, `report`, `user`):
  `survey.service.js`, `createSurveyService`, `findByTicketId`.
- **Mã giao diện trong `pages/`, `components/`, CSS dùng tiếng Việt không dấu**, khớp chữ trên màn hình wireframe: `bao-cao-csat.page.mjs`, `veTongQuan`, `.the__so`.
  Riêng component `DataState` giữ tên chuẩn của bài 65.
- Tên tệp viết thường, nối bằng gạch ngang; hàm là động từ, dữ liệu là danh từ.

### Quy ước giao diện
- Trang trong `pages/` **không gọi `fetch(`**; có test tự động kiểm tra.
- Mỗi vùng dữ liệu bọc trong **DataState**: *đang tải* · *rỗng* (phân biệt "chưa có dữ liệu" với "bộ lọc không ra kết quả" kèm nút **Xóa bộ lọc**) · *lỗi* kèm nút **Thử lại**.
- Mọi chỉ số CSAT kèm mốc so sánh: kỳ trước cùng số ngày; BGĐ lọc một trung tâm thì kèm toàn hệ thống; biểu đồ xu hướng có đường trung bình năm (BS-06).
- Gặp HTTP 401, `client.mjs` xóa token và chuyển về `dang-nhap.html?ly_do=het_phien`.

## 6. Dữ liệu
- `npm run db:setup` nạp **dữ liệu mô phỏng tái lập được** (seed = 42): 6 trung tâm đúng tên case study, 38 kỹ thuật viên, 1.200 phiếu
  `BH-000123/2026`, ~40% phiếu đóng có phản hồi, điểm theo tỉ lệ của bộ chính thức (CSAT ~70%) – TD-24.
- `npm run import -- data/sample` nạp **mẫu bộ CSV chính thức** (seed 20260901 của case study): 1.200 khảo sát, 1.400 phiếu, đọc đúng
  cột `ho_ten`, `thanh_pho`, `is_active`; dòng sai bị bỏ qua kèm lý do. Bộ đầy đủ: giải nén vào `data/raw/` rồi `npm run import -- data/raw`.
  Chạy lại không nhân đôi; tài khoản giữ nguyên – TD-23.
- `data/raw/`, `*.csv` (trừ `data/sample/`) và `data/*.db` không commit (`.gitignore`).

## 7. API
Đăng nhập trả **token**; các lệnh sau gửi `Authorization: Bearer <token>`. Lỗi luôn có dạng `{"error","message","field"?}`. Hợp đồng đầy đủ: `docs/srs.md` Phụ lục A.

| Endpoint | Vai trò | Việc làm |
|---|---|---|
| `POST /api/auth/login` · `GET /api/auth/me` | công khai · đã đăng nhập | đăng nhập · thông tin phiên |
| `POST /api/surveys` `{"ticket_id":149}` | `he_thong` | UC1: tạo khảo sát cho phiếu ĐÃ ĐÓNG |
| `GET /api/surveys/:ticketId` · `POST /api/surveys/:ticketId` `{"score":4,"comment":"..."}` | công khai | UC2: khách xem form · gửi phản hồi |
| `GET /api/surveys?status=&center_id=&score_max=&page=&limit=` · `DELETE /api/surveys/:ticketId` | `quan_ly`, `bgd` | danh sách (QT-14) · xóa mềm (QT-13) |
| `GET /api/reports/csat?center_id=&from=&to=` | `quan_ly`, `bgd`, `marketing` | UC3 + UC4 + mốc so sánh |
| `GET /api/reports/trend?granularity=month\|quarter&year=&center_id=` | `quan_ly`, `bgd`, `marketing` | UC5 + CSAT trung bình năm |
| `GET /api/reports/low-score?center_id=&page=&limit=` | `quan_ly`, `bgd` | UC6: phản hồi điểm ≤ 2 |
| `GET /api/centers` | `quan_ly`, `bgd`, `marketing` | trung tâm cho bộ lọc |
| `GET/POST /api/users` · `GET/PATCH/DELETE /api/users/:id` | `bgd` | CRUD tài khoản (QT-13, QT-14, TK-01..03) |

Ví dụ (Git Bash / Linux / macOS):
```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H "Content-Type: application/json" \
        -d '{"username":"bgd","password":"Demo@2026"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).data.token")
curl -s -H "Authorization: Bearer $TOKEN" "localhost:3000/api/reports/csat?from=2026-01-01&to=2026-10-29"
curl -s -X POST localhost:3000/api/surveys/5 -H "Content-Type: application/json" -d '{"comment":"quên điểm"}'
# HTTP 400  {"error":"DU_LIEU_KHONG_HOP_LE","message":"score là bắt buộc, phải là số nguyên từ 1 đến 5","field":"score"}
curl -s -X POST localhost:3000/api/users -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"username":"quanly.tt02","password":"QuanLy2026","full_name":"Quản lý Tân Bình","role":"quan_ly","center_id":2}'
# HTTP 201  {"data":{"user_id":5,"username":"quanly.tt02",...,"center_name":"TTBH Quận Tân Bình","is_active":true}}
```

## 8. Trạng thái (BT2 – tag `v0.2`)
- [x] Module cốt lõi: UC1, UC2, danh sách, xóa mềm (QT-10, QT-13, QT-14, QT-15) – 3 lớp routes / services / repositories + validators
- [x] Thực thể thứ hai đủ CRUD: tài khoản `app_user` (TD-21)
- [x] UC3–UC6: CSAT theo trung tâm, theo kỹ thuật viên, xu hướng tháng/quý, phản hồi điểm thấp, kèm mốc so sánh (BS-01..06)
- [x] Giao diện 3 màn hình theo wireframe + đăng nhập; đủ 3 trạng thái, 2 kiểu rỗng (`docs/anh-man-hinh.md`)
- [x] 69 test tự động, đủ 3 loại; chạy trọn luồng trên dữ liệu mô phỏng và mẫu CSV case study (`docs/ket-qua-chay-mau.txt`)
- [x] Migration/seed/import chạy lại không lỗi, không nhân đôi; Dockerfile + docker-compose
- [ ] UC7 thông báo điểm thấp – **cắt khỏi phạm vi** (TD-16)
- [ ] Phân loại nhận xét (COULD) – ngoài phạm vi
