# Nhật ký thay đổi thiết kế

Luồng L8 – Khảo sát hài lòng CSAT · Sinh viên: PHOUTTHAVONG Khanxay · MSSV 237480201IS10 · Track SE

Mỗi thay đổi có mã TD-xx. Bốn dòng bắt buộc: **phản hồi → quyết định → lý do → ảnh hưởng**.
File này được nối tiếp ở BT3 khi nhận phản hồi BT2.

## Sau phản hồi Bài tập 1 (buổi 8, ngày 21/10/2026)

Điểm BT1: 6,5/10 (Đầy đủ 7,25 · Kỹ thuật 5,75 · Nhất quán 7,5 · Trình bày 7).

### TD-01 Thêm chú thích ký hiệu cho ba sơ đồ
- Phản hồi của GV: Use Case Diagram, sơ đồ kiến trúc và ERD chưa có chú thích ký hiệu; cần khung giải thích actor, extend, mũi tên, PK, FK, 1–N.
- Quyết định: **SỬA**
- Lý do: người đọc không biết các ký hiệu tự đặt (màu khối, mũi tên, chân chim) mang nghĩa gì thì không kiểm tra được thiết kế; thêm khung chú thích không làm đổi nội dung thiết kế.
- Ảnh hưởng: vẽ lại Hình 2.1, 3.1, 4.1 có khung "Chú thích ký hiệu"; cập nhật `docs/usecase_L8_v2.drawio`, `docs/kien-truc_L8.drawio`, `docs/erd_L8_v2.drawio`; thêm một câu trỏ tới khung chú thích trong SRS mục Use Case, Kiến trúc, ERD.

### TD-02 Sửa cột customer trong ERD cho khớp DDL
- Phản hồi của GV: ERD Hình 4.1 ghi bảng customer có cột `center_name`, nhưng DDL dùng `full_name`.
- Quyết định: **SỬA**
- Lý do: hai tài liệu mâu thuẫn nhau thì người hiện thực không biết tin bên nào; DDL (đã chạy thử) là nguồn đúng. Nguyên nhân là nhãn bị gõ nhầm khi chỉnh sơ đồ bằng tay, và dòng `is_deleted` bị đẩy lên đầu bảng do tính năng tự xếp dòng của draw.io.
- Ảnh hưởng: ERD vẽ lại với customer gồm `customer_id`, `full_name`, `phone`; file draw.io mới bỏ tự xếp dòng nên thứ tự cột giữ nguyên khi kéo bảng; migration `001_schema.sql` dùng đúng các cột này.

### TD-03 Giảm User Story từ 8 xuống 7
- Phản hồi của GV: có 8 User Story, đề yêu cầu 5–7.
- Quyết định: **SỬA** (bỏ US7 cũ "gắn nhãn cảm xúc cho nhận xét", mức COULD; US8 cũ thành US7)
- Lý do: US7 cũ là mức COULD, cần xử lý văn bản và độ chính xác thấp với nhận xét tiếng Việt không dấu; bỏ nó vừa đạt khung 5–7 vừa tập trung nguồn lực vào 4 story MUST. Giữ story này trong danh sách WON'T thay vì xóa hẳn ý tưởng.
- Ảnh hưởng: SRS còn 7 US / 7 FR / 7 UC (đánh số lại FR-07 = thông báo điểm thấp, UC7 = nhận thông báo); mục 1.3 thêm "không phân loại cảm xúc nhận xét"; bỏ cột `sentiment` khỏi `survey_response` (ERD, DDL, migration); bỏ khối Sentiment Module khỏi sơ đồ kiến trúc; Marketing chỉ còn UC5; BS-05 sửa lại.

### TD-04 Thêm cột MoSCoW vào bảng truy vết
- Phản hồi của GV: bảng truy vết chưa có cột MoSCoW.
- Quyết định: **SỬA**
- Lý do: truy vết cần cho biết yêu cầu nào bắt buộc để biết thứ tự hiện thực; mức MoSCoW của FR bằng mức của US tương ứng nên không phát sinh mâu thuẫn.
- Ảnh hưởng: bảng truy vết SRS mục 7 có cột FR – US – UC – MoSCoW – NFR – Quy tắc – Test case.

### TD-05 Bổ sung thông tin trang bìa và sửa link GitHub
- Phản hồi của GV: bìa thiếu lớp, ngày nộp, link GitHub; link ở cuối bài bị cắt (`.../Khao_sat_hai_long-`) nên không mở được repo để kiểm file .drawio.
- Quyết định: **SỬA**
- Lý do: giảng viên cần mở được repo để đối chiếu tài liệu với mã nguồn; link dài nên bị cắt khi xuống dòng.
- Ảnh hưởng: bìa có Lớp, Ngày nộp, GitHub (gắn hyperlink vào chữ ngắn); repo để chế độ public và kiểm tra bằng cửa sổ ẩn danh.

### TD-06 Thống nhất MSSV
- Phản hồi của GV: dòng cam kết ghi sai MSSV (ISS10).
- Quyết định: **SỬA**
- Lý do: MSSV đúng là 237480201IS10 như trên bìa; dòng cam kết lấy nhầm theo phiếu phạm vi cũ.
- Ảnh hưởng: sửa dòng cam kết ở phụ lục AI; kiểm lại phiếu phạm vi và báo cáo buổi 4 nếu còn ghi ISS10. (Bản `docs/ai-disclosure.md` trong repo còn sót ISS10 tới BT2 – đã sửa ở TD-29.)

### TD-07 Đưa file .drawio gốc vào docs/ của repo
- Phản hồi của GV (gợi ý BT2): gửi lại link repo đầy đủ, có `docs/` với các file `.drawio` gốc.
- Quyết định: **SỬA**
- Lý do: file gốc cho phép giảng viên và chính em chỉnh tiếp sơ đồ; ảnh PNG chỉ để xem.
- Ảnh hưởng: `docs/` chứa 3 file `.drawio` (use case, kiến trúc, ERD), `docs/srs.md` đã cập nhật theo TD-01 → TD-06 và ảnh trong `docs/img/`.

### TD-08 Viết test cho ràng buộc UNIQUE(ticket_id)
- Phản hồi của GV (gợi ý BT2): viết test cho `UNIQUE(ticket_id)` khi gửi phản hồi 2 lần.
- Quyết định: **SỬA**
- Lý do: QT-10 và NFR4 là yêu cầu quan trọng nhất của luồng; chỉ kiểm tra ở tầng service là chưa đủ vì hai yêu cầu đồng thời vẫn có thể lọt qua, nên cần test cả ở tầng service và tầng CSDL.
- Ảnh hưởng: thêm `tests/survey.test.js` (16 test qua HTTP, trong đó QT-10 được kiểm ở ba chỗ: tạo trùng, gửi lại, ràng buộc UNIQUE ở CSDL) và `tests/survey.service.test.js` (2 test tình huống đua: kiểm tra ở service bị vượt qua nhưng CSDL vẫn chặn); `npm test` chạy 18 test.

## Quyết định phát sinh khi hiện thực (buổi 8)

### TD-09 Mô phỏng vai trò bằng header, chưa đăng nhập thật
- Phản hồi của GV: không có (quyết định khi dựng Access Middleware).
- Quyết định: **GIỮ NGUYÊN** phạm vi "không đăng nhập SSO" của BT1
- Lý do: SRS mục 1.3 đã loại SSO khỏi phạm vi; quy tắc cần kiểm chứng là QT-14 và QT-15 (phân quyền theo vai trò và trung tâm), không phải cơ chế xác thực. Dùng header `X-Role` và `X-Center-Id` cho phép test đủ các vai trò mà không tốn thời gian làm đăng nhập.
- Ảnh hưởng: `src/middleware/access.js` (nay là `src/backend/middleware/access.js` – TD-13) đọc header; mọi quy tắc phân quyền vẫn nằm ở middleware và service nên khi thay bằng đăng nhập thật chỉ phải sửa một file. Ghi rõ trong README mục 5 là cơ chế mô phỏng.

### TD-10 Dữ liệu danh mục tạm dùng seed sinh mô phỏng
- Phản hồi của GV: không có (đề buổi 8 yêu cầu nạp danh mục từ bộ mẫu).
- Quyết định: **SỬA** (làm sau) — hiện **chưa** nạp CSV mẫu của LMS
- Lý do: để module chạy được ngay, `src/db/seed.js` (nay là `seeds/seed.js` – TD-20) sinh dữ liệu mô phỏng có seed cố định (42) với đúng quy mô case study (6 trung tâm, 38 kỹ thuật viên, 150 phiếu, tỷ lệ phản hồi khoảng 30% phiếu đóng). Đây chỉ là bước tạm; dữ liệu thật từ `service_centers.csv`, `technicians.csv`, `tickets_history.csv`, `survey_responses.csv` sẽ nạp thay thế.
- Ảnh hưởng: README mục 6 ghi việc còn dở "nạp CSV mẫu"; không đổi thiết kế vì bảng và cột đã khớp từ điển dữ liệu.

### TD-11 Khảo sát tạo trước, điểm cho phép rỗng
- Phản hồi của GV: không có (phát sinh từ BT1, nay đã hiện thực).
- Quyết định: **GIỮ NGUYÊN** điều chỉnh đã nêu ở BT1 Chương 4 mục 3
- Lý do: UC1 tạo khảo sát lúc phiếu đóng, trước khi khách trả lời nên `score`, `responded_at` phải cho phép NULL khi `status = DA_GUI`; ràng buộc CHECK đảm bảo hai trạng thái luôn nhất quán. Khi viết service, mọi phép tính CSAT lọc `status = 'DA_TRA_LOI'`.
- Ảnh hưởng: không đổi; có test xác nhận CSDL chặn dòng DA_TRA_LOI thiếu điểm và dòng DA_GUI đã có điểm.

### TD-12 Dùng `node:sqlite` có sẵn thay cho `better-sqlite3`
- Phản hồi của GV: không có (phát sinh ở chặng 2 – lỗi môi trường khi cài thư viện).
- Quyết định: **SỬA** thư viện truy cập CSDL; **GIỮ NGUYÊN** quyết định dùng SQLite
- Lý do: khi đã có `package-lock.json`, `npm install` cố biên dịch `better-sqlite3` từ mã nguồn và thất bại trong môi trường sạch (thiếu công cụ build/mạng tải header của Node). Đề buổi 8 dặn không để cả buổi trôi vào cài đặt; `node:sqlite` đi kèm Node 22.13+ nên không cần biên dịch, và dự án chỉ còn hai thư viện thuần JavaScript (express, dotenv).
- Ảnh hưởng: chỉ sửa `src/db/connection.js` (nay là `src/backend/db/connection.js`) (lớp bọc có `prepare`, `exec`, `transaction`, `close`) và một dòng nhận diện lỗi ràng buộc trong `survey.service.js`; repositories, routes, migration, seed, test giữ nguyên. Yêu cầu môi trường ghi ở README mục 2: Node ≥ 22.13. Đánh đổi: `node:sqlite` còn ở mức thử nghiệm (đã ẩn cảnh báo trong các script `npm`).

### TD-13 Tách `src/` thành `backend/` và `frontend/`
- Phản hồi của GV: không có (đề buổi 8 yêu cầu thư mục `src/` ánh xạ một–một với các lớp trong sơ đồ kiến trúc).
- Quyết định: **SỬA** cấu trúc thư mục; **GIỮ NGUYÊN** thiết kế các lớp bên trong
- Lý do: sơ đồ kiến trúc BT1 có hai khối lớn là Frontend và Backend API; cấu trúc cũ để backend ở `src/` còn frontend ở `public/` nên chưa khớp trực tiếp. Frontend vẫn là HTML/JS tĩnh (lập luận 4, BT1 Chương 3) nên được Express phục vụ chung cổng, không cần CORS và không cần máy chủ thứ hai. Nếu sau này dùng React/Vue thì tách `frontend/` thành dự án riêng có `package.json` và ghi lại ở TD mới.
- Ảnh hưởng: chuyển toàn bộ mã backend vào `src/backend/`, `public/` thành `src/frontend/`; sửa đường dẫn trong `package.json`, `app.js` (thư mục tĩnh), `tests/`, `commit-plan.sh`, README mục 4, `docs/anh-xa-kien-truc.md`, `docs/kien-truc_L8.drawio`. Không đổi hành vi: 18 test vẫn đạt.

### TD-14 Thay vai trò mô phỏng bằng header bằng ĐĂNG NHẬP THẬT dùng token
- Phản hồi của GV: không có (đề buổi 10 yêu cầu frontend có đăng nhập và xử lý 401).
- Quyết định: **SỬA** TD-09 — header `X-Role` / `X-Center-Id` bị bỏ hoàn toàn.
- Lý do: khi frontend chạy trên trình duyệt, ai cũng tự đặt được `X-Role: bgd` nên QT-14/QT-15 chỉ còn là hình thức. Nay có bảng `app_user` (migration 003), mật khẩu băm bằng scrypt kèm muối, token ký HMAC-SHA256 theo cấu trúc 3 phần như JWT, hạn 8 giờ. Chỉ dùng `node:crypto` nên không thêm thư viện. Đây **không** phải SSO của công ty (vẫn ngoài phạm vi, SRS mục 1.3).
- Ảnh hưởng: thêm `services/auth.service.js`, `routes/auth.routes.js`, `repositories/user.repository.js`, migration `003_users.sql`; viết lại `middleware/access.js` (đọc Bearer, trả 401 `CHUA_DANG_NHAP` / `TOKEN_KHONG_HOP_LE`, 403 `KHONG_DU_QUYEN`); `seed.js` tạo 4 tài khoản demo với mật khẩu lấy từ `DEMO_PASSWORD`; toàn bộ test HTTP chuyển sang đăng nhập lấy token; README mục 3 và Phụ lục A của SRS cập nhật theo. Máy chủ **từ chối khởi động** nếu thiếu `AUTH_SECRET`.

### TD-15 Ba màn hình của L8 không phải list/detail/intake như ví dụ của đề
- Phản hồi của GV: không có (đề buổi 10 nêu ví dụ 3 màn hình "danh sách / chi tiết / nhập liệu" cho luồng phiếu bảo hành).
- Quyết định: **SỬA** cách hiểu yêu cầu, **GIỮ NGUYÊN** số lượng tối thiểu 3 màn hình.
- Lý do: L8 không có nghiệp vụ CRUD phiếu; màn hình tương ứng của luồng khảo sát là: (1) *nhập liệu* = form khảo sát khách hàng (UC2), (2) *danh sách/tổng hợp* = báo cáo CSAT kèm bảng kỹ thuật viên (UC3, UC4), (3) *chi tiết/lọc* = xu hướng theo thời gian và danh sách phản hồi điểm thấp (UC5, UC6). Thêm màn hình đăng nhập (bắt buộc theo đề) là 4.
- Ảnh hưởng: `src/frontend/` có 4 trang; mỗi vùng dữ liệu bọc trong component `DataState`; `pages/` không gọi `fetch` (có test kiểm tra).

### TD-16 Cắt UC7 (thông báo điểm thấp) khỏi phạm vi hiện tại
- Phản hồi của GV: không có.
- Quyết định: **CẮT** UC7 khỏi Sprint 2; giữ cờ `low_score` và danh sách điểm thấp.
- Lý do: UC7 cần kênh gửi thật (email/Zalo OA) với tài khoản dịch vụ, hàng đợi gửi lại khi lỗi và chính sách chống gửi trùng — khối lượng này vượt thời lượng buổi 10 và không làm tăng giá trị kiểm chứng BS-01/BS-02. Quản lý vẫn phát hiện phản hồi điểm thấp ngay trên màn hình "Xu hướng & điểm thấp" (UC6), nên nhu cầu nghiệp vụ không bị bỏ trống, chỉ chậm hơn so với thông báo đẩy.
- Ảnh hưởng: FR-07/US7 giữ ở mức SHOULD trong SRS nhưng đánh dấu chưa hiện thực; README mục 7 ghi rõ phần bị cắt và lý do.

### TD-17 Script nhập CSV tách khỏi seed mô phỏng
- Phản hồi của GV: không có (đề buổi 10 yêu cầu chạy trên dữ liệu mẫu thật).
- Quyết định: **SỬA** TD-10 — bổ sung `src/backend/db/import-csv.js` (`npm run import -- data/raw`) thay vì sửa seed.
- Lý do: giữ hai đường nạp dữ liệu tách bạch: seed mô phỏng (tái lập được, dùng khi chấm/thi lại) và nhập CSV thật từ LMS. Script tự khớp một số tên cột thường gặp, tạo khách tối thiểu khi thiếu `customers.csv`, bỏ qua và báo rõ dòng sai thay vì dừng giữa chừng.
- Ảnh hưởng: thêm script và mục 6 của README; `data/` vẫn không commit. Nhật ký `docs/ket-qua-chay-mau.txt` ghi cả hai lần chạy: dữ liệu mô phỏng và dữ liệu nạp từ CSV.

### TD-18 Giao diện dựng lại đúng bản thiết kế wireframe, bỏ khung CSS ngoài
- Phản hồi của GV/chủ đồ án: "bắt buộc phải đúng theo bản thiết kế" (3 wireframe: form khảo sát, Báo cáo CSAT, Xu hướng & phản hồi điểm thấp).
- Quyết định: **SỬA** toàn bộ lớp hiển thị; **GIỮ NGUYÊN** kiến trúc frontend (api/ – components/ – pages/).
- Lý do: bản dựng trước dùng Bootstrap nên bố cục và màu sắc lệch khỏi thiết kế (không có thanh bên tối, thẻ KPI, nhãn số trên biểu đồ, nút điểm tròn). Nay `assets/giao-dien.css` tự định nghĩa bộ nhận diện (đỏ #d62828, thanh bên #1e1e1e, nền #eceff1), nên bỏ hẳn phụ thuộc `bootstrap`; chỉ còn Chart.js phục vụ cục bộ. Nhãn số trên biểu đồ vẽ bằng một plugin nhỏ tự viết thay vì thêm thư viện `chartjs-plugin-datalabels`.
- Ảnh hưởng: viết lại `assets/giao-dien.css`, 4 tệp HTML, 3 tệp trong `pages/`; thêm `components/thanh-ben.mjs` (thanh bên 4 mục), `components/dinh-dang.mjs` (số và ngày kiểu Việt Nam: 90,0% · 4,43 · 07/10/2026), `components/bieu-do.mjs`; bỏ `components/thanh-dieu-huong.mjs` và route tĩnh `/vendor/bootstrap`. API bổ sung ba trường mà bản thiết kế cần: `closed_at` (dòng "đóng ngày" trên phiếu), `technician_name` (cột Kỹ thuật viên của bảng điểm thấp), `closed_tickets` (dòng "trên N phiếu đã đóng" ở thẻ KPI); `avg_score` làm tròn 2 chữ số để hiển thị đúng dạng 4,43. 40 test vẫn đạt.
- Phần KHÔNG hiện thực theo thiết kế: dòng "Thiết bị: iPhone 15 Pro Max" trên thẻ phiếu — ERD của BT1 không có thực thể thiết bị; thêm cột chỉ để hiển thị sẽ lệch từ điển dữ liệu, nên để lại cho bản sau nếu nghiệp vụ cần.

## Hoàn thiện trước khi nộp BT2 (tự rà soát theo đề BT2 và học liệu `organized/`, 29/10/2026)

### TD-19 Đổi tên repo theo quy ước của học phần
- Phản hồi của GV: không có (tự rà soát theo `05_delivery/40` §1: tên repo `cdtn1-<họ-tên-không-dấu>-<mã-luồng>`).
- Quyết định: **SỬA** – `Khao_sat_hai_long-` → `cdtn1-phoutthavongkhanxay-l8`; `package.json` đổi `name` tương ứng, `version` 0.2.0.
- Lý do: tên cũ sai quy ước và có dấu `-` ở cuối từng làm link bị cắt (TD-05); README cũ ghi `cd Khao_sat_hai_long` không khớp thư mục sau khi clone.
- Ảnh hưởng: README mục 3 dùng link mới + `--branch v0.2`; GitHub tự chuyển hướng link cũ. Trên máy: `git remote set-url origin https://github.com/Ovenvanlang/cdtn1-phoutthavongkhanxay-l8.git`.

### TD-20 Cấu trúc thư mục và tầng lỗi theo bài 60/61
- Phản hồi của GV: không có (đề BT2 §3 "cấu trúc repo tối thiểu", bài 60 §7 "ba tầng validation", bài 61 A1).
- Quyết định: **SỬA** – (1) `migrations/` và `seeds/` ra thư mục gốc; (2) thêm `src/backend/validators/` (tầng 1: định dạng, kèm tên trường); (3) `errors/AppError.js` chỉ mang mã nghiệp vụ, bảng mã → HTTP chỉ ở `middleware/error-handler.js`; (4) `utils/password.js` tách khỏi `auth.service`; (5) đổi tên tài liệu cho nhất quán: `DDL_LB.sql` → `ddl_L8.sql`, `*_L8_v2.drawio` → `*_L8.drawio`.
- Lý do: bản cũ để kiểm tra định dạng trong service và để `AppError` mang mã HTTP (400/403/409), trái nguyên tắc "service không biết HTTP"; seed gọi ngược lên service để băm mật khẩu.
- Ảnh hưởng: routes gọi validator trước service; lỗi trả thêm `field` (ví dụ thiếu `score` → `{"field":"score"}`); test service kiểm theo mã lỗi, thêm `tests/validators.test.js`; `tests/survey.test.js` đổi tên `survey.api.test.js`. Không đổi hợp đồng API ngoài trường `field`.

### TD-21 Thêm CRUD tài khoản app_user cho Ban giám đốc (thực thể thứ hai đủ CRUD)
- Phản hồi của GV: không có (đề BT2 tiêu chí S1 "≥ 2 thực thể đủ CRUD"; trước đây chỉ `survey_response` có đủ).
- Quyết định: **SỬA** – thêm `/api/users` (GET danh sách/một, POST, PATCH, DELETE = khóa) chỉ cho vai trò `bgd`; ghi là yêu cầu hỗ trợ FR-S1 trong SRS, KHÔNG thêm User Story (giữ 7 US theo TD-03).
- Lý do: chọn `app_user` vì có quy tắc nghiệp vụ thật (QT-14 quản lý phải gắn trung tâm, QT-13 không xóa vật lý, TK-01..03) và không lấn sang luồng khác; CRUD kỹ thuật viên thuộc luồng L4, CRUD trung tâm không có quy tắc.
- Ảnh hưởng: thêm `routes/users.routes.js`, `validators/user.validator.js`, `services/user.service.js`, mở rộng `user.repository.js`; `verifyToken` đọc lại tài khoản nên tài khoản bị khóa thì token cũ hết hiệu lực ngay và vai trò luôn theo dữ liệu hiện tại; thêm `tests/user.service.test.js`, `tests/user.api.test.js`.

### TD-22 Gỡ giao diện bản cũ và tệp thừa
- Phản hồi của GV: không có.
- Quyết định: **SỬA** – xóa `dashboard.html`, `trend.html`, `form.html`, `api/client.js`, `api/survey.api.js`, `css/style.css`, `commit-plan.sh`, `.vscode/`.
- Lý do: các trang cũ vẫn mở được qua máy chủ nhưng gửi header `X-Role` (trái TD-14), tải Chart.js qua CDN và Bootstrap (trái TD-18), ghi cứng tên người dùng/trung tâm (lỗi bị trừ nặng ở TP3), và tạo ra lớp gọi API thứ hai (đề yêu cầu một lớp client riêng).
- Ảnh hưởng: `src/frontend/` còn đúng 5 trang (trang chủ, đăng nhập, 3 màn hình) và một lớp `api/`; `.gitignore` bổ sung theo bài 40 §3 và case study 15 §3 (`data/raw/`, `*.csv`, `!data/sample/*.csv`).

### TD-23 Nạp đúng bộ CSV của case study; customer.phone cho phép trống
- Phản hồi của GV: không có (tự kiểm bằng cách sinh lại bộ dữ liệu chính thức từ `gen_dataset.py`, seed 20260901).
- Quyết định: **SỬA** TD-17 – `import-csv.js` đọc đúng cột của case study (`ho_ten`, `thanh_pho`, `is_active` = true/false); từ chối có lý do khảo sát cho phiếu chưa đóng/khảo sát lần hai (QT-10) và điểm ngoài 1–5; trung tâm ghi đè theo `center_id` để chạy lại không vướng tài khoản quản lý. Migration `004_customer_phone.sql`: `customer.phone` cho phép NULL, có thì phải đúng 10 số bắt đầu bằng 0 (QT-02 ở mức CSDL).
- Lý do: bản cũ chạy trên bộ chính thức thì vỡ ngay (NOT NULL `technician.full_name`), và nếu sửa tên cột thì cả 38 KTV thành "nghỉ việc"; lần chạy "CSV" ghi trong nhật ký cũ thực ra dùng tệp tự soạn. Bộ dữ liệu không có bảng khách đã hợp nhất liên kết được với `tickets_history.csv` (`customers_raw.csv` dùng `record_id` riêng, ~20% trùng – việc của L1/L7), nên khách của phiếu chỉ có mã, không có SĐT; trước đây SĐT bị điền chuỗi giả `KH00000005`, sai QT-02.
- Ảnh hưởng: thêm `data/sample/` (1.200 khảo sát + 1.400 phiếu chép nguyên văn từ bộ chính thức, tạo bằng `scripts/tao-du-lieu-mau.js`), `npm run import` mặc định nạp mẫu này; màn hình điểm thấp ghi "chưa có SĐT"; `migrate.js` hỗ trợ dựng lại bảng khi tắt khóa ngoại kèm `PRAGMA foreign_key_check`; thêm `tests/import-csv.test.js`. ERD thực tế: `docs/erd-thuc-te.png`.

### TD-24 Dữ liệu mô phỏng bám case study
- Phản hồi của GV: không có.
- Quyết định: **SỬA** TD-10 – seed dùng tên 6 trung tâm của case study, mã phiếu `BH-000123/2026`, ~81% phiếu ĐÃ ĐÓNG, phản hồi ~40% phiếu đóng sau 1–5 ngày, điểm 5/4/3/2/1 theo 42/28/15/9/6, nhận xét lấy từ `gen_dataset.py` và khớp với điểm; tài khoản quản lý đổi thành `quanly.tt01`.
- Lý do: seed cũ đặt tên trung tâm tự chế (`HCM-01`), mã phiếu thiếu dấu gạch, CSAT 92,6% (bộ chính thức ~70%), nhận xét không khớp điểm; phiếu chỉ đóng tới tháng 9 nên trang báo cáo mở mặc định (quý 4) trống trơn.
- Ảnh hưởng: số liệu trên ảnh chụp và nhật ký chạy thay đổi; thêm `tests/seed.test.js` (tái lập theo seed, chạy lại không nhân đôi).

### TD-25 "Tự tạo khảo sát khi phiếu đóng" được mô phỏng bằng tác nhân hệ thống
- Phản hồi của GV: không có.
- Quyết định: **GIỮ NGUYÊN** FR-01/US1, ghi rõ cách hiện thực: tài khoản `he_thong` gọi `POST /api/surveys {ticket_id}`.
- Lý do: việc đóng phiếu thuộc luồng L2/L4 (ngoài phạm vi, SRS 1.2) nên L8 không có sự kiện "phiếu vừa đóng" để bắt; API này là điểm nối để luồng đóng phiếu (hoặc tác vụ định kỳ) gọi khi tích hợp. Quy tắc QT-10 vẫn kiểm đủ ở service.
- Ảnh hưởng: SRS mục 2 và mục 3 ghi chú TD-25; không đổi mã.

### TD-26 Bảng technician giữ full_name thay vì liên kết employee
- Phản hồi của GV: không có (đối chiếu từ điển dữ liệu case study: `technician.employee_id → employee`).
- Quyết định: **GIỮ NGUYÊN** thiết kế BT1 (`technician.full_name`), không thêm bảng `employee`.
- Lý do: L8 chỉ cần tên kỹ thuật viên để hiện trong báo cáo; bảng nhân sự thuộc phạm vi khác và bộ CSV `technicians.csv` cũng cho sẵn `ho_ten`. Từ điển dữ liệu cho phép bớt cột khi có lý do.
- Ảnh hưởng: không đổi.

### TD-27 Mốc so sánh cho số liệu, khoảng mặc định từ đầu năm, hai kiểu trạng thái rỗng
- Phản hồi của GV: không có (đề BT2 TP3: "số liệu không có mốc so sánh" là lỗi bị trừ; trạng thái rỗng phải phân biệt "chưa có dữ liệu" với "bộ lọc không ra kết quả").
- Quyết định: **SỬA** – thêm quy tắc BS-06; `/api/reports/csat` trả `comparison` (kỳ trước cùng số ngày, chênh lệch, toàn hệ thống khi BGĐ lọc trung tâm); `/api/reports/trend` trả `year_summary`; khoảng mặc định đổi từ "quý hiện tại" sang "từ đầu năm đến hôm nay"; `DataState.empty` có nút "Xóa bộ lọc" khi rỗng do bộ lọc.
- Lý do: con số CSAT đứng một mình không cho biết tốt hay xấu; quý mới bắt đầu thì mẫu quá nhỏ (BS-02) nên mặc định cả năm hữu ích hơn. Quản lý trung tâm không nhận số toàn hệ thống để giữ QT-14.
- Ảnh hưởng: thẻ KPI có dòng "▲/▼ … so với kỳ trước", biểu đồ có đường đứt nét trung bình năm (lệch bản thiết kế nhưng là bổ sung, không bỏ thành phần nào); SRS Phụ lục A cập nhật; thêm test mốc so sánh và hai kiểu rỗng.

### TD-28 Đóng gói Docker
- Phản hồi của GV: không có (đề BT2 TP4 mức "đánh giá cao"; chuẩn bị BT3).
- Quyết định: **SỬA** phạm vi "không container hóa" của SRS 1.2 cho riêng việc chạy demo: thêm `Dockerfile` (nhiều giai đoạn, `node:22.20-alpine`, người dùng không đặc quyền, HEALTHCHECK), `docker-compose.yml`, `.dockerignore`.
- Lý do: lên được bằng 2 lệnh (`cp .env.example .env`, `docker compose up --build`) trên máy chỉ có Docker; vẫn giữ cách chạy bằng Node làm đường chính.
- Ảnh hưởng: README mục 3b; dữ liệu SQLite trong volume `csat_data`.

### TD-29 Sơ đồ thực tế, tài liệu và khai báo AI cập nhật cho BT2
- Phản hồi của GV: không có (đề BT2 §3 yêu cầu `docs/architecture-thuc-te.*`; tự rà soát thấy tài liệu còn ở trạng thái buổi 8–10).
- Quyết định: **SỬA** – thêm `docs/architecture-thuc-te.(mmd|png)` và `docs/erd-thuc-te.(mmd|png)`; sơ đồ `.drawio` của BT1 giữ nguyên làm mốc thiết kế (bản cũ vẫn còn chữ Bootstrap, không có khối đăng nhập – đó là thiết kế ban đầu, khác biệt ghi ở TD-14, TD-18); viết lại `anh-xa-kien-truc.md`, `anh-man-hinh.md` (13 ảnh mới), `ket-qua-chay-mau.txt` (đầu ra thật), SRS phiên bản 3; `ai-disclosure.md` thêm bảng BT2 4 cột và sửa MSSV IS10 (TD-06).
- Lý do: GV chấm bằng cách đối chiếu tài liệu với mã; tài liệu cũ mô tả sai năng lực hiện tại (route 501, header mô phỏng, CSV "thật").
- Ảnh hưởng: chỉ tài liệu.

