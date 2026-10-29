// Nạp dữ liệu mẫu SINH MÔ PHỎNG, tái lập được nhờ SEED cố định (mặc định 42).
// Quy mô bám theo case study: 6 trung tâm, 38 kỹ thuật viên; tỷ lệ phản hồi ~30% phiếu đóng (gần mức ~33% của dataset).
// Dùng:  npm run seed            (bỏ qua nếu đã có dữ liệu)
//        npm run seed -- --reset (xóa dữ liệu rồi nạp lại)
const SEED = 42;

const { hashPassword } = require('../src/backend/services/auth.service');
const { createUserRepository } = require('../src/backend/repositories/user.repository');

/** Tạo 4 tài khoản DEMO (mỗi vai trò một tài khoản). Mật khẩu lấy từ DEMO_PASSWORD, chỉ lưu dạng băm. */
function seedUsers(db, password) {
  const userRepo = createUserRepository(db);
  if (userRepo.count() > 0) return { skipped: true, accounts: [] };
  const center = db.prepare('SELECT center_id, center_name FROM service_center ORDER BY center_id LIMIT 1').get();
  if (!center) throw new Error('Cần nạp dữ liệu trung tâm trước khi tạo tài khoản');
  const accounts = [
    { username: 'hethong',      fullName: 'Tác nhân hệ thống',                   role: 'he_thong',  centerId: null },
    { username: 'quanly.hcm01', fullName: `Quản lý trung tâm ${center.center_name}`, role: 'quan_ly', centerId: center.center_id },
    { username: 'bgd',          fullName: 'Ban giám đốc',                        role: 'bgd',       centerId: null },
    { username: 'marketing',    fullName: 'Phòng Marketing',                     role: 'marketing', centerId: null },
  ];
  for (const a of accounts) userRepo.insert({ ...a, passwordHash: hashPassword(password) });
  return { skipped: false, accounts: accounts.map((a) => `${a.username} (${a.role})`) };
}

function mulberry32(a) {                       // bộ sinh số giả ngẫu nhiên có seed
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Huỳnh', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô'];
const DEM = ['Văn', 'Thị', 'Minh', 'Quốc', 'Thanh', 'Hoàng', 'Ngọc', 'Gia'];
const TEN = ['An', 'Bảo', 'Cường', 'Dũng', 'Hà', 'Hùng', 'Lan', 'Linh', 'Minh', 'Nam', 'Phước', 'Trâm', 'Tuấn', 'Vy', 'Khoa', 'Hải'];
const CENTERS = [['HCM-01', 'TP.HCM', 8], ['HCM-02', 'TP.HCM', 7], ['HCM-03', 'TP.HCM', 6],
                 ['CT-01', 'Cần Thơ', 6], ['CT-02', 'Cần Thơ', 5], ['HN-01', 'Hà Nội', 6]]; // tổng 38 KTV
const COMMENTS = ['Nhân viên hỗ trợ nhiệt tình', 'Máy sửa nhanh hơn dự kiến', 'Sửa lâu, hẹn hai lần mới xong',
                  'Không được báo khi máy xong', 'Máy vẫn nóng sau khi thay pin', 'Hài lòng, sẽ quay lại'];

function seed(db, { seedValue = SEED, reset = false } = {}) {
  const rnd = mulberry32(seedValue);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const name = () => `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`;

  const existing = db.prepare('SELECT COUNT(*) n FROM service_center').get().n;
  if (existing > 0 && !reset) return { skipped: true };

  const run = db.transaction(() => {
    if (reset) {
      for (const t of ['survey_response', 'ticket', 'technician', 'customer', 'dim_date', 'service_center']) db.exec(`DELETE FROM ${t}`);
      db.exec("DELETE FROM sqlite_sequence");
    }
    // dim_date 2024-01-01 .. 2026-12-31
    const insDate = db.prepare('INSERT OR IGNORE INTO dim_date VALUES (?,?,?,?,?)');
    for (let d = new Date(Date.UTC(2024, 0, 1)); d <= new Date(Date.UTC(2026, 11, 31)); d.setUTCDate(d.getUTCDate() + 1)) {
      const m = d.getUTCMonth() + 1;
      insDate.run(d.toISOString().slice(0, 10), d.getUTCDate(), m, Math.ceil(m / 3), d.getUTCFullYear());
    }
    const insCenter = db.prepare('INSERT INTO service_center(center_name, city) VALUES (?,?)');
    const insTech = db.prepare('INSERT INTO technician(center_id, full_name, level) VALUES (?,?,?)');
    const techByCenter = {};
    CENTERS.forEach(([cn, city, nTech], i) => {
      const cid = Number(insCenter.run(cn, city).lastInsertRowid);
      techByCenter[cid] = [];
      for (let k = 0; k < nTech; k++) techByCenter[cid].push(Number(insTech.run(cid, name(), pick(['SO_CAP', 'TRUNG_CAP', 'CAO_CAP'])).lastInsertRowid));
    });
    const insCust = db.prepare('INSERT INTO customer(full_name, phone) VALUES (?,?)');
    const phones = new Set(); const custIds = [];
    while (custIds.length < 80) {
      const phone = '09' + String(between(0, 99999999)).padStart(8, '0');
      if (phones.has(phone)) continue;
      phones.add(phone); custIds.push(Number(insCust.run(name(), phone).lastInsertRowid));
    }
    const centerIds = Object.keys(techByCenter).map(Number);
    const insTicket = db.prepare('INSERT INTO ticket(ticket_code, customer_id, center_id, technician_id, status, closed_at) VALUES (?,?,?,?,?,?)');
    const insSurvey = db.prepare('INSERT INTO survey_response(ticket_id, status, sent_at, score, comment, responded_at, responded_date) VALUES (?,?,?,?,?,?,?)');
    const OPEN = ['MOI', 'DA_PHAN_CONG', 'DANG_XU_LY', 'CHO_LINH_KIEN', 'HOAN_TAT', 'DA_HUY'];
    let closed = 0, sent = 0, answered = 0;
    for (let i = 1; i <= 150; i++) {
      const cid = pick(centerIds); const isClosed = rnd() < 0.6;
      const closedAt = isClosed ? new Date(Date.UTC(2026, 0, 1) + rnd() * 270 * 86400000) : null;
      const tid = Number(insTicket.run(`BH${String(i).padStart(6, '0')}/2026`, pick(custIds), cid,
        rnd() < 0.95 ? pick(techByCenter[cid]) : null, isClosed ? 'DA_DONG' : pick(OPEN), closedAt ? closedAt.toISOString() : null).lastInsertRowid);
      if (!isClosed) continue;
      closed++;
      if (rnd() > 0.8) continue;                       // ~20% phiếu đóng chưa tạo khảo sát
      sent++;
      if (rnd() < 0.42) {                              // ~30% phiếu đóng có phản hồi
        const r = rnd(); const score = r < 0.04 ? 1 : r < 0.08 ? 2 : r < 0.18 ? 3 : r < 0.51 ? 4 : 5;
        const respAt = new Date(closedAt.getTime() + between(1, 72) * 3600000);
        insSurvey.run(tid, 'DA_TRA_LOI', closedAt.toISOString(), score, rnd() < 0.5 ? pick(COMMENTS) : null,
          respAt.toISOString(), respAt.toISOString().slice(0, 10));
        answered++;
      } else insSurvey.run(tid, 'DA_GUI', closedAt.toISOString(), null, null, null, null);
    }
    return { closed, sent, answered };
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
    console.log(`Đã nạp dữ liệu mẫu (seed=${SEED}): phiếu đóng=${res.closed}, khảo sát đã tạo=${res.sent}, đã trả lời=${res.answered}`);
    for (const t of ['service_center', 'technician', 'customer', 'ticket', 'dim_date', 'survey_response'])
      console.log(`  ${t.padEnd(16)} ${db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n} dòng`);
  }
  const users = seedUsers(db, config.demoPassword);
  if (users.skipped) console.log('Tài khoản demo: đã có, bỏ qua.');
  else console.log(`Đã tạo ${users.accounts.length} tài khoản demo: ${users.accounts.join(', ')} – mật khẩu lấy từ DEMO_PASSWORD trong .env`);
  db.close();
}
