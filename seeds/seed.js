// Nạp dữ liệu mẫu SINH MÔ PHỎNG, tái lập được nhờ SEED cố định (42) – dùng khi chấm và khi chạy test tay.
// Bám theo case study (02_case_study/10, 14, 15, 20):
//   - 6 trung tâm đúng tên/thành phố trong service_centers.csv, tổng 38 kỹ thuật viên;
//   - mã phiếu dạng BH-000123/2026 (từ điển dữ liệu);
//   - ~81% phiếu ĐÃ ĐÓNG, phần còn lại ở DANG_XU_LY / CHO_LINH_KIEN / HOAN_TAT / DA_PHAN_CONG như bộ CSV;
//   - phản hồi ≈ 41% số phiếu đã đóng (2.600 / 6.350 trong bộ chính thức), trả lời sau 1–5 ngày;
//   - điểm 5/4/3/2/1 theo tỉ lệ 42/28/15/9/6 và ~72% có nhận xét, nhận xét KHỚP với điểm (câu chữ lấy từ gen_dataset.py).
// Phiếu đóng từ 01/01/2025 đến 23/10/2026 nên báo cáo mặc định (từ đầu năm đến hôm nay) và kỳ so sánh đều có dữ liệu.
// Dùng:  npm run seed            (bỏ qua nếu đã có dữ liệu)
//        npm run seed -- --reset (xóa dữ liệu rồi nạp lại)
const SEED = 42;

const { hashPassword } = require('../src/backend/utils/password');
const { createUserRepository } = require('../src/backend/repositories/user.repository');

const CENTERS = [                                     // [tên, thành phố, số KTV] – tổng 38 KTV
  ['TTBH Quận 10', 'TP. Hồ Chí Minh', 8], ['TTBH Quận Tân Bình', 'TP. Hồ Chí Minh', 7],
  ['TTBH TP. Thủ Đức', 'TP. Hồ Chí Minh', 6], ['TTBH Ninh Kiều', 'Cần Thơ', 6],
  ['TTBH Cái Răng', 'Cần Thơ', 5], ['TTBH Cầu Giấy', 'Hà Nội', 6]];
const N_TICKETS = 1200;
const N_CUSTOMERS = 300;
const CLOSED_FROM = Date.UTC(2025, 0, 1);
const CLOSED_TO = Date.UTC(2026, 9, 23, 18);
const CLOSED_RATE = 0.81;
const SURVEY_SENT_RATE = 0.85;                       // UC1 đã chạy cho 85% phiếu đóng
const ANSWER_RATE = 0.41 / SURVEY_SENT_RATE;         // -> ~41% phiếu đóng có phản hồi
const OPEN_STATUSES = [['DANG_XU_LY', 35], ['CHO_LINH_KIEN', 28], ['HOAN_TAT', 20], ['DA_PHAN_CONG', 17]];
const SCORE_WEIGHTS = [[5, 42], [4, 28], [3, 15], [2, 9], [1, 6]];
const COMMENT_RATE = 0.72;
const COMMENTS = {                                    // câu chữ theo gen_dataset.py của case study
  5: ['Nhân viên nhiệt tình, sửa nhanh', 'Rất hài lòng, máy chạy tốt lại', 'Dịch vụ tốt sẽ quay lại',
    'Kỹ thuật viên giải thích rõ ràng', 'Trả máy đúng hẹn'],
  4: ['Ổn, chỉ hơi lâu một chút', 'Hài lòng nhưng chỗ ngồi chờ hơi chật', 'Sửa được nhưng phải chờ linh kiện', 'Tốt, giá hơi cao'],
  3: ['Bình thường', 'Máy sửa xong nhưng vẫn hơi nóng', 'Chờ hơi lâu', 'Tạm được'],
  2: ['Trả máy trễ hẹn 3 ngày', 'Gọi điện không ai nghe máy', 'Phải quay lại lần 2 mới xong', 'Nhân viên trả lời không rõ ràng'],
  1: ['Sửa xong vẫn bị lỗi cũ', 'Trễ hẹn cả tuần không ai báo', 'Thái độ nhân viên không tốt', 'Mất phụ kiện kèm theo máy'],
};
const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô', 'Dương'];
const DEM = ['Văn', 'Thị', 'Hữu', 'Đức', 'Minh', 'Ngọc', 'Thanh', 'Quang', 'Xuân', 'Tuấn', 'Kim', 'Bảo', 'Gia'];
const TEN = ['An', 'Bình', 'Châu', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hùng', 'Khoa', 'Lan', 'Linh', 'Long', 'Minh', 'Nam',
  'Ngân', 'Phúc', 'Quyên', 'Tâm', 'Thảo', 'Trâm', 'Trung', 'Tuấn', 'Vy', 'Yến'];
const PHONE_PREFIX = ['090', '091', '093', '097', '098', '032', '035', '070', '076', '083', '084', '086'];

/** 4 tài khoản DEMO (mỗi vai trò một tài khoản). Mật khẩu lấy từ DEMO_PASSWORD, chỉ lưu dạng băm. */
function seedUsers(db, password) {
  const userRepo = createUserRepository(db);
  if (userRepo.count() > 0) return { skipped: true, accounts: [] };
  const center = db.prepare('SELECT center_id, center_name FROM service_center ORDER BY center_id LIMIT 1').get();
  if (!center) throw new Error('Cần nạp dữ liệu trung tâm trước khi tạo tài khoản');
  const accounts = [
    { username: 'hethong',     fullName: 'Tác nhân hệ thống',                        role: 'he_thong',  centerId: null },
    { username: 'quanly.tt01', fullName: `Quản lý trung tâm ${center.center_name}`, role: 'quan_ly',   centerId: center.center_id },
    { username: 'bgd',         fullName: 'Ban giám đốc',                             role: 'bgd',       centerId: null },
    { username: 'marketing',   fullName: 'Phòng Marketing',                          role: 'marketing', centerId: null },
  ];
  for (const a of accounts) userRepo.insert({ ...a, passwordHash: hashPassword(password) });
  return { skipped: false, accounts: accounts.map((a) => `${a.username} (${a.role})`) };
}

function mulberry32(a) {                       // bộ sinh số giả ngẫu nhiên có seed (tái lập được)
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seed(db, { seedValue = SEED, reset = false } = {}) {
  const rnd = mulberry32(seedValue);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const weighted = (pairs) => {
    let r = rnd() * pairs.reduce((s, [, w]) => s + w, 0);
    for (const [value, w] of pairs) { r -= w; if (r < 0) return value; }
    return pairs[pairs.length - 1][0];
  };
  const personName = () => `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`;

  const existing = db.prepare('SELECT COUNT(*) n FROM service_center').get().n;
  if (existing > 0 && !reset) return { skipped: true };

  const run = db.transaction(() => {
    if (reset) {
      for (const t of ['survey_response', 'ticket', 'technician', 'customer', 'dim_date', 'service_center']) db.exec(`DELETE FROM ${t}`);
      db.exec('DELETE FROM sqlite_sequence');
    }
    // dim_date 2024-01-01 .. 2026-12-31 (trục thời gian liên tục cho báo cáo xu hướng)
    const insDate = db.prepare('INSERT OR IGNORE INTO dim_date VALUES (?,?,?,?,?)');
    for (let d = new Date(Date.UTC(2024, 0, 1)); d <= new Date(Date.UTC(2026, 11, 31)); d.setUTCDate(d.getUTCDate() + 1)) {
      const m = d.getUTCMonth() + 1;
      insDate.run(d.toISOString().slice(0, 10), d.getUTCDate(), m, Math.ceil(m / 3), d.getUTCFullYear());
    }

    const insCenter = db.prepare('INSERT INTO service_center(center_name, city) VALUES (?,?)');
    const insTech = db.prepare('INSERT INTO technician(center_id, full_name, level) VALUES (?,?,?)');
    const techByCenter = {};
    for (const [name, city, nTech] of CENTERS) {
      const centerId = Number(insCenter.run(name, city).lastInsertRowid);
      techByCenter[centerId] = [];
      for (let k = 0; k < nTech; k++) {
        techByCenter[centerId].push(Number(insTech.run(centerId, personName(), pick(['SO_CAP', 'TRUNG_CAP', 'CAO_CAP'])).lastInsertRowid));
      }
    }

    const insCust = db.prepare('INSERT INTO customer(full_name, phone) VALUES (?,?)');
    const phones = new Set();
    const customerIds = [];
    while (customerIds.length < N_CUSTOMERS) {               // QT-01/QT-02: SĐT 10 số, duy nhất
      const phone = pick(PHONE_PREFIX) + String(between(0, 9999999)).padStart(7, '0');
      if (phones.has(phone)) continue;
      phones.add(phone);
      customerIds.push(Number(insCust.run(personName(), phone).lastInsertRowid));
    }

    const centerIds = Object.keys(techByCenter).map(Number);
    const insTicket = db.prepare(
      'INSERT INTO ticket(ticket_code, customer_id, center_id, technician_id, status, closed_at) VALUES (?,?,?,?,?,?)');
    const insSurvey = db.prepare(
      'INSERT INTO survey_response(ticket_id, status, sent_at, score, comment, responded_at, responded_date) VALUES (?,?,?,?,?,?,?)');
    const stats = { tickets: 0, closed: 0, sent: 0, answered: 0 };

    // Sinh theo thứ tự thời gian để mã phiếu tăng dần như thực tế
    const closedTimes = Array.from({ length: N_TICKETS }, () => CLOSED_FROM + rnd() * (CLOSED_TO - CLOSED_FROM)).sort((a, b) => a - b);
    closedTimes.forEach((time, i) => {
      const centerId = pick(centerIds);
      const isClosed = rnd() < CLOSED_RATE;
      const closedAt = new Date(time);
      closedAt.setUTCSeconds(0, 0);
      const code = `BH-${String(i + 1).padStart(6, '0')}/${closedAt.getUTCFullYear()}`;
      const ticketId = Number(insTicket.run(code, pick(customerIds), centerId, pick(techByCenter[centerId]),
        isClosed ? 'DA_DONG' : weighted(OPEN_STATUSES), isClosed ? closedAt.toISOString() : null).lastInsertRowid);
      stats.tickets++;
      if (!isClosed) return;
      stats.closed++;
      if (rnd() >= SURVEY_SENT_RATE) return;                 // phiếu đóng chưa tạo khảo sát (để thử UC1)
      stats.sent++;
      if (rnd() >= ANSWER_RATE) {                            // đã gửi, khách chưa trả lời
        insSurvey.run(ticketId, 'DA_GUI', closedAt.toISOString(), null, null, null, null);
        return;
      }
      const score = weighted(SCORE_WEIGHTS);
      const respondedAt = new Date(closedAt.getTime() + between(24 * 60, 5 * 24 * 60) * 60000);   // sau 1–5 ngày
      const comment = rnd() < COMMENT_RATE ? pick(COMMENTS[score]) : null;
      insSurvey.run(ticketId, 'DA_TRA_LOI', closedAt.toISOString(), score, comment,
        respondedAt.toISOString(), respondedAt.toISOString().slice(0, 10));
      stats.answered++;
    });
    return stats;
  });
  return { skipped: false, ...run() };
}

module.exports = { seed, seedUsers, SEED };

if (require.main === module) {
  const { openDb } = require('../src/backend/db/connection');
  const { migrate } = require('../src/backend/db/migrate');
  const config = require('../src/backend/config');
  const db = openDb(config.databaseFile);
  migrate(db);
  const reset = process.argv.includes('--reset');
  if (reset) db.exec('DELETE FROM app_user');
  const res = seed(db, { reset });
  if (res.skipped) console.log('Đã có dữ liệu, bỏ qua. Dùng "npm run seed -- --reset" để nạp lại.');
  else {
    console.log(`Đã nạp dữ liệu mẫu (seed=${SEED}): ${res.tickets} phiếu, đã đóng=${res.closed}, `
      + `khảo sát đã gửi=${res.sent}, đã trả lời=${res.answered}`);
    for (const t of ['service_center', 'technician', 'customer', 'ticket', 'dim_date', 'survey_response'])
      console.log(`  ${t.padEnd(16)} ${db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n} dòng`);
  }
  const users = seedUsers(db, config.demoPassword);
  if (users.skipped) console.log('Tài khoản demo: đã có, bỏ qua.');
  else console.log(`Đã tạo ${users.accounts.length} tài khoản demo: ${users.accounts.join(', ')} – mật khẩu lấy từ DEMO_PASSWORD trong .env`);
  db.close();
}
