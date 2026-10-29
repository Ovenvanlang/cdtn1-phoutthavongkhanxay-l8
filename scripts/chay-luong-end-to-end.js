// Chạy TRỌN luồng nghiệp vụ L8 trên dữ liệu mẫu, không cần can thiệp tay.
//   node scripts/chay-luong-end-to-end.js            (dùng CSDL trong .env)
//   node scripts/chay-luong-end-to-end.js --memory   (CSDL trong bộ nhớ: không đụng dữ liệu thật)
//
// Các bước: đăng nhập 4 vai trò -> UC1 tạo khảo sát -> UC2 khách gửi điểm ->
//           UC3/UC4 báo cáo CSAT -> UC5 xu hướng -> UC6 điểm thấp -> kiểm tra QT-14/QT-15/BS-02.
// Mỗi bước in ra INPUT và OUTPUT thật để dán vào báo cáo (docs/ket-qua-chay-mau.txt).
const config = require('../src/backend/config');
const { openDb } = require('../src/backend/db/connection');
const { migrate } = require('../src/backend/db/migrate');
const { seed, seedUsers } = require('../seeds/seed');
const { createApp } = require('../src/backend/app');

const SECRET = config.authSecret || 'khoa-chi-dung-cho-script-demo';
const PASSWORD = config.demoPassword;
const inMemory = process.argv.includes('--memory');

let step = 0;
function title(text) {
  step += 1;
  console.log(`\n===== BƯỚC ${step}. ${text}`);
}
function show(label, value) {
  console.log(`  ${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
}

async function main() {
  const db = openDb(inMemory ? ':memory:' : config.databaseFile);
  migrate(db);
  if (inMemory) { seed(db); seedUsers(db, PASSWORD); }
  else if (!db.prepare('SELECT COUNT(*) n FROM app_user').get().n) {
    console.error('Chưa có dữ liệu mẫu. Hãy chạy: npm run db:setup');
    process.exit(1);
  }

  const server = createApp({ db, authSecret: SECRET }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, path, { token, body } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json() };
  };
  const expect = (cond, msg) => { if (!cond) { console.error(`  ✗ THẤT BẠI: ${msg}`); process.exitCode = 1; } else console.log(`  ✓ ${msg}`); };

  // ---------------------------------------------------------------- 1. Đăng nhập
  title('Đăng nhập 4 vai trò (POST /api/auth/login)');
  const tokens = {};
  for (const username of ['hethong', 'quanly.tt01', 'bgd', 'marketing']) {
    const r = await call('POST', '/api/auth/login', { body: { username, password: PASSWORD } });
    expect(r.status === 200 && r.json.data.token, `${username} đăng nhập -> 200, vai trò ${r.json.data?.user?.role}`);
    tokens[username] = r.json.data.token;
  }
  const sai = await call('POST', '/api/auth/login', { body: { username: 'bgd', password: 'sai-mat-khau' } });
  expect(sai.status === 401 && sai.json.error === 'SAI_TAI_KHOAN_HOAC_MAT_KHAU', 'Mật khẩu sai -> 401 SAI_TAI_KHOAN_HOAC_MAT_KHAU');
  const khongToken = await call('GET', '/api/reports/csat');
  expect(khongToken.status === 401 && khongToken.json.error === 'CHUA_DANG_NHAP', 'Gọi báo cáo khi chưa đăng nhập -> 401 CHUA_DANG_NHAP');

  // ---------------------------------------------------------------- 2. UC1
  title('UC1 – hệ thống tạo khảo sát cho một phiếu ĐÃ ĐÓNG chưa có khảo sát');
  // Chọn phiếu thuộc ĐÚNG trung tâm của tài khoản quản lý, để bước 6 kiểm chứng QT-14/QT-15 trên dữ liệu vừa tạo.
  const centerQuanLy = db.prepare('SELECT center_id FROM app_user WHERE username = ?').get('quanly.tt01').center_id;
  const timUngVien = db.prepare(`
    SELECT t.ticket_id, t.ticket_code, t.center_id FROM ticket t
     LEFT JOIN survey_response s ON s.ticket_id = t.ticket_id
     WHERE t.status = 'DA_DONG' AND s.response_id IS NULL AND (? IS NULL OR t.center_id = ?) LIMIT 1`);
  // Ưu tiên phiếu thuộc trung tâm của tài khoản quản lý; không có thì lấy phiếu bất kỳ
  let ungVien = timUngVien.get(centerQuanLy, centerQuanLy) || timUngVien.get(null, null);

  if (ungVien) {
    expect(true, `Tìm được phiếu ĐÃ ĐÓNG chưa khảo sát: ${ungVien.ticket_code} (trung tâm ${ungVien.center_id})`);
    show('INPUT', { ticket_id: ungVien.ticket_id });
    const tao = await call('POST', '/api/surveys', { token: tokens.hethong, body: { ticket_id: ungVien.ticket_id } });
    show('OUTPUT', tao.json.data);
    expect(tao.status === 201 && tao.json.data.status === 'DA_GUI', 'Tạo khảo sát -> 201, trạng thái DA_GUI');
    const taoLai = await call('POST', '/api/surveys', { token: tokens.hethong, body: { ticket_id: ungVien.ticket_id } });
    expect(taoLai.status === 409 && taoLai.json.error === 'DA_KHAO_SAT', 'QT-10: tạo lần hai -> 409 DA_KHAO_SAT');
  } else {
    // Bộ dữ liệu đã khảo sát hết các phiếu đóng: bỏ qua UC1, dùng một khảo sát còn chờ trả lời để chạy UC2.
    ungVien = db.prepare(`
      SELECT t.ticket_id, t.ticket_code, t.center_id FROM survey_response s
        JOIN ticket t ON t.ticket_id = s.ticket_id
       WHERE s.status = 'DA_GUI' AND s.is_deleted = 0
       ORDER BY (t.center_id = ?) DESC LIMIT 1`).get(centerQuanLy);
    if (!ungVien) {
      console.error('  ! Dữ liệu hiện tại không còn phiếu nào để khảo sát – hãy nạp lại: npm run seed -- --reset');
      server.close(); db.close(); process.exit(1);
    }
    console.log(`  (bỏ qua UC1: dữ liệu đã tạo khảo sát cho mọi phiếu đóng; dùng phiếu ${ungVien.ticket_code} đang chờ trả lời)`);
  }

  // ---------------------------------------------------------------- 3. UC2
  title('UC2 – khách hàng mở liên kết và gửi điểm (không cần đăng nhập)');
  const form = await call('GET', `/api/surveys/${ungVien.ticket_id}`);
  expect(form.status === 200 && form.json.data.customer_phone === undefined, 'Form công khai không chứa thông tin khách hàng');
  show('INPUT', { score: 2, comment: 'Sửa lâu, hẹn hai lần mới xong' });
  const guiPH = await call('POST', `/api/surveys/${ungVien.ticket_id}`, { body: { score: 2, comment: 'Sửa lâu, hẹn hai lần mới xong' } });
  show('OUTPUT', guiPH.json.data);
  expect(guiPH.status === 200 && guiPH.json.data.status === 'DA_TRA_LOI' && guiPH.json.data.low_score === true,
    'Gửi phản hồi -> 200, DA_TRA_LOI, BS-03 đánh dấu điểm thấp');
  const guiLai = await call('POST', `/api/surveys/${ungVien.ticket_id}`, { body: { score: 5 } });
  expect(guiLai.status === 409 && guiLai.json.error === 'DA_KHAO_SAT', 'QT-10: gửi lần hai -> 409 DA_KHAO_SAT');
  const diemSai = await call('POST', `/api/surveys/${ungVien.ticket_id}`, { body: { score: 6 } });
  expect(diemSai.status === 400 && diemSai.json.error === 'DU_LIEU_KHONG_HOP_LE', 'Điểm 6 (ngoài 1–5) -> 400 DU_LIEU_KHONG_HOP_LE');

  // ---------------------------------------------------------------- 4. UC3 + UC4
  title('UC3/UC4 – báo cáo CSAT toàn hệ thống và theo kỹ thuật viên (ban giám đốc)');
  const csat = await call('GET', '/api/reports/csat?from=2026-01-01&to=2026-12-31', { token: tokens.bgd });
  const d = csat.json.data;
  show('INPUT', 'from=2026-01-01&to=2026-12-31');
  show('OUTPUT', { total_responses: d.total_responses, csat_percent: d.csat_percent, avg_score: d.avg_score,
                   low_score_count: d.low_score_count, distribution: d.distribution, warning: d.warning });
  const high = d.distribution[4] + d.distribution[5];
  expect(csat.status === 200 && d.csat_percent === Math.round((high / d.total_responses) * 1000) / 10,
    `BS-01: CSAT% = ${high}/${d.total_responses} = ${d.csat_percent}%`);
  show('Top KTV', d.by_technician.slice(0, 3).map((t) => `${t.full_name}: ${t.csat_percent}% (${t.total_responses} phản hồi)`));
  expect(Array.isArray(d.by_technician) && d.by_technician.length > 0, `UC4: có bảng theo kỹ thuật viên (${d.by_technician.length} người)`);
  expect(d.by_technician.some((t) => t.warning === 'MAU_CHUA_DU_TIN_CAY'),
    'BS-02: kỹ thuật viên có dưới 5 phản hồi được gắn cảnh báo MAU_CHUA_DU_TIN_CAY');

  // ---------------------------------------------------------------- 5. UC5
  title('UC5 – xu hướng CSAT theo quý (Marketing, chỉ số liệu tổng hợp)');
  const xuHuong = await call('GET', '/api/reports/trend?granularity=quarter&year=2026', { token: tokens.marketing });
  show('OUTPUT', xuHuong.json.data.points.map((p) => `${p.label}: ${p.csat_percent}% (${p.total_responses} phản hồi)`));
  expect(xuHuong.status === 200 && xuHuong.json.data.points.length > 0, 'Trả về các kỳ có phản hồi (không nội suy kỳ trống)');
  const mktCenter = await call('GET', '/api/reports/trend?center_id=1', { token: tokens.marketing });
  expect(mktCenter.status === 403, 'BS-05: Marketing lọc theo trung tâm -> 403 KHONG_DU_QUYEN');
  const mktCsat = await call('GET', '/api/reports/csat', { token: tokens.marketing });
  expect(mktCsat.json.data.by_technician === null, 'BS-05: Marketing không nhận bảng theo kỹ thuật viên');

  // ---------------------------------------------------------------- 6. UC6 + QT-14/QT-15
  title('UC6 – danh sách phản hồi điểm thấp và kiểm tra QT-14/QT-15 (quản lý trung tâm)');
  const thap = await call('GET', '/api/reports/low-score?limit=5', { token: tokens['quanly.tt01'] });
  show('OUTPUT', thap.json.data.map((r) => `${r.ticket_code} | ${r.center_name} | điểm ${r.score} | ${r.customer_phone}`));
  expect(thap.status === 200 && thap.json.data.every((r) => r.score <= 2),
    `BS-03: ${thap.json.data.length} dòng, mọi dòng đều có điểm <= 2`);
  if (ungVien.center_id === centerQuanLy) {
    expect(thap.json.data.some((r) => r.ticket_code === ungVien.ticket_code),
      `Phản hồi vừa gửi ở bước 3 (${ungVien.ticket_code}) xuất hiện trong danh sách điểm thấp`);
  } else {
    const tatCa = await call('GET', '/api/reports/low-score?limit=50', { token: tokens.bgd });
    expect(tatCa.json.data.some((r) => r.ticket_code === ungVien.ticket_code),
      `Phản hồi vừa gửi ở bước 3 (${ungVien.ticket_code}) xuất hiện trong danh sách điểm thấp của ban giám đốc`);
  }
  expect(thap.json.data.every((r) => r.center_id === centerQuanLy), `QT-14: chỉ có dữ liệu trung tâm ${centerQuanLy}`);
  expect(thap.json.data.every((r) => r.customer_phone && !String(r.customer_phone).includes('*')),
    'QT-15: quản lý thấy số điện thoại đầy đủ (không che bằng dấu *)');
  const xemTTKhac = await call('GET', '/api/reports/csat?center_id=999', { token: tokens['quanly.tt01'] });
  expect(xemTTKhac.status === 403 && xemTTKhac.json.error === 'KHONG_DU_QUYEN', 'QT-14: quản lý xem trung tâm khác -> 403');
  const mktLowScore = await call('GET', '/api/reports/low-score', { token: tokens.marketing });
  expect(mktLowScore.status === 403, 'Marketing xem danh sách phản hồi chi tiết -> 403');

  // ---------------------------------------------------------------- 7. Token
  title('Kiểm tra token: token bị sửa và token hết hạn đều phải bị từ chối');
  const choc = tokens.bgd.slice(0, -2) + (tokens.bgd.endsWith('aa') ? 'bb' : 'aa');
  const rChoc = await call('GET', '/api/reports/csat', { token: choc });
  expect(rChoc.status === 401 && rChoc.json.error === 'TOKEN_KHONG_HOP_LE', 'Token bị sửa chữ ký -> 401 TOKEN_KHONG_HOP_LE');
  const { createAuthService } = require('../src/backend/services/auth.service');
  const quaHan = createAuthService({ userRepo: { findByUsername: () => undefined }, secret: SECRET, ttlHours: -1 })
    .issueToken({ user_id: 1, full_name: 'Ban giám đốc', role: 'bgd', center_id: null }).token;
  const rHan = await call('GET', '/api/reports/csat', { token: quaHan });
  expect(rHan.status === 401 && rHan.json.error === 'TOKEN_KHONG_HOP_LE', 'Token hết hạn -> 401 TOKEN_KHONG_HOP_LE');

  server.close();
  db.close();
  console.log(process.exitCode ? '\n== CÓ BƯỚC THẤT BẠI ==' : '\n== TOÀN BỘ LUỒNG CHẠY XONG, KHÔNG CÓ BƯỚC NÀO THẤT BẠI ==');
}

main().catch((err) => { console.error(err); process.exit(1); });
