// 12 TEST CASE CỦA TEST REPORT BT3 (docs/test-report.md) – mỗi test mang đúng mã TC-xx.
// Chạy cả bộ:        npm test
// Chạy lại 1 case:   npm run tc -- TC-05          (scripts/chay-tc.js lọc theo mã test)
// Mỗi case TỰ DỰNG tiền điều kiện bằng code (CSDL SQLite trong bộ nhớ, dữ liệu cố định bên dưới),
// không dựa vào dữ liệu trên máy; kết quả thực tế được in ra bằng t.diagnostic để chép vào Test Report.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDb } = require('../src/backend/db/connection');
const { migrate } = require('../src/backend/db/migrate');
const { createApp } = require('../src/backend/app');
const { hashPassword } = require('../src/backend/utils/password');
const { createReportService } = require('../src/backend/services/report.service');
const { seed } = require('../seeds/seed');
const { importCsv } = require('../src/backend/db/import-csv');

const MAT_KHAU = 'Test@12345';

/**
 * Tiền điều kiện chung cho các case qua API:
 *   trung tâm 1 TTBH Quận 10, trung tâm 2 TTBH Ninh Kiều;
 *   phiếu #1 ĐÃ ĐÓNG chưa khảo sát · #2 ĐÃ ĐÓNG có khảo sát DA_GUI · #3 DANG_XU_LY (cả 3 ở trung tâm 1);
 *   tài khoản hethong (he_thong), bgd (bgd), quanly.tt01 (quan_ly, trung tâm 1).
 */
async function dungMoiTruong(t, { now } = {}) {
  const db = openDb(':memory:');
  migrate(db);
  db.exec(`
    INSERT INTO service_center(center_name, city) VALUES ('TTBH Quận 10','TP. Hồ Chí Minh'), ('TTBH Ninh Kiều','Cần Thơ');
    INSERT INTO customer(full_name, phone) VALUES ('Nguyễn Văn An','0912345678'), ('Trần Thị Bình','0987654321');
    INSERT INTO ticket(ticket_code, customer_id, center_id, status, closed_at) VALUES
      ('BH-000001/2026',1,1,'DA_DONG','2026-10-28T03:00:00Z'),
      ('BH-000002/2026',2,1,'DA_DONG','2026-10-28T04:00:00Z'),
      ('BH-000003/2026',1,1,'DANG_XU_LY',NULL);
    INSERT INTO survey_response(ticket_id, status, sent_at) VALUES (2,'DA_GUI','2026-10-28T04:00:00Z');
  `);
  const ins = db.prepare('INSERT INTO app_user(username, password_hash, full_name, role, center_id) VALUES (?,?,?,?,?)');
  for (const [u, role, c] of [['hethong', 'he_thong', null], ['bgd', 'bgd', null], ['quanly.tt01', 'quan_ly', 1]])
    ins.run(u, hashPassword(MAT_KHAU), u, role, c);
  const server = createApp({ db, now, authSecret: 'khoa-test-case-bt3' }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, { token, body, raw } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(base + url, { method, headers, body: raw ?? (body ? JSON.stringify(body) : undefined) });
    return { status: res.status, json: await res.json() };
  };
  const token = async (u) => (await call('POST', '/api/auth/login', { body: { username: u, password: MAT_KHAU } })).json.data.token;
  const dem = (sql) => db.prepare(sql).get().n;
  t.after(() => { server.close(); db.close(); });
  return { db, call, token, dem };
}

/** Mã truy cập trong đường dẫn khảo sát gửi cho khách (migration 005, BUG-006). */
const lienKet = (db, ticketId) =>
  db.prepare('SELECT access_token AS t FROM survey_response WHERE ticket_id = ?').get(ticketId).t;

// ---------------------------------------------------------------- 1. LUỒNG ĐÚNG
test('TC-01 [Luồng đúng · QT-10] hệ thống tạo khảo sát cho phiếu ĐÃ ĐÓNG -> 201, DA_GUI, chưa có điểm', async (t) => {
  const { call, token, dem } = await dungMoiTruong(t);
  const truoc = dem('SELECT COUNT(*) n FROM survey_response');
  const r = await call('POST', '/api/surveys', { token: await token('hethong'), body: { ticket_id: 1 } });
  const sau = dem('SELECT COUNT(*) n FROM survey_response');
  t.diagnostic(`HTTP ${r.status} · status=${r.json.data?.status} · score=${r.json.data?.score} · survey_response ${truoc} -> ${sau}`);
  t.diagnostic(`survey_link=${r.json.data?.survey_link}`);
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.json.data.status, 'DA_GUI');
  assert.strictEqual(r.json.data.score, null);
  assert.strictEqual(sau, truoc + 1);
  assert.match(r.json.data.survey_link, /^\/khao-sat\.html\?ticket=1&t=[0-9a-f]{32}$/, 'đường dẫn gửi khách phải có mã truy cập');
});

test('TC-02 [Luồng đúng · UC2, BS-03] khách mở đúng đường dẫn và gửi 2 điểm -> 200, DA_TRA_LOI, low_score = true', async (t) => {
  const { db, call } = await dungMoiTruong(t);
  const r = await call('POST', `/api/surveys/2?t=${lienKet(db, 2)}`, { body: { score: 2, comment: 'Trả máy trễ hẹn 3 ngày' } });
  const dong = db.prepare('SELECT status, score, comment FROM survey_response WHERE ticket_id = 2').get();
  t.diagnostic(`HTTP ${r.status} · status=${r.json.data?.status} · low_score=${r.json.data?.low_score} · CSDL: ${dong.status}, score=${dong.score}, comment="${dong.comment}"`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.data.status, 'DA_TRA_LOI');
  assert.strictEqual(r.json.data.low_score, true);
  assert.deepStrictEqual({ ...dong }, { status: 'DA_TRA_LOI', score: 2, comment: 'Trả máy trễ hẹn 3 ngày' });
});

test('TC-03 [Luồng đúng · BS-01, BS-06] CSAT = 15/20 = 75,0% và so với kỳ trước 6/10 = 60,0% -> chênh +15,0 điểm', (t) => {
  const tong = { total_responses: 20, high_count: 15, low_count: 2, avg_score: 4 };
  const kyTruoc = { total_responses: 10, high_count: 6, low_count: 3, avg_score: 3.6 };
  const goi = [];
  const reportRepo = {
    summary: (f) => { goi.push(f); return goi.length === 1 ? tong : kyTruoc; },
    distribution: () => [], byTechnician: () => [], closedTickets: () => 30,
  };
  const svc = createReportService({ reportRepo, centerRepo: { findById: () => ({ center_id: 1 }) },
    surveyService: {}, now: () => new Date('2026-10-10T08:00:00Z') });
  const d = svc.csat({ role: 'bgd' }, { from: '2026-10-01', to: '2026-10-10' }).data;
  t.diagnostic(`csat_percent=${d.csat_percent} · kỳ trước ${goi[1].from}..${goi[1].to}: csat_percent=${d.comparison.previous.csat_percent} · csat_delta=${d.comparison.csat_delta}`);
  assert.strictEqual(d.csat_percent, 75);
  assert.deepStrictEqual({ from: goi[1].from, to: goi[1].to }, { from: '2026-09-21', to: '2026-09-30' });
  assert.strictEqual(d.comparison.previous.csat_percent, 60);
  assert.strictEqual(d.comparison.csat_delta, 15);
});

test('TC-04 [Luồng đúng · QT-13] BGĐ xóa khảo sát -> 200; khách mở lại -> 404; bản ghi VẪN còn trong CSDL (xóa mềm)', async (t) => {
  const { db, call, token, dem } = await dungMoiTruong(t);
  const truoc = dem('SELECT COUNT(*) n FROM survey_response');
  const xoa = await call('DELETE', '/api/surveys/2', { token: await token('bgd') });
  const moLai = await call('GET', `/api/surveys/2?t=${lienKet(db, 2)}`);
  const dong = db.prepare('SELECT is_deleted FROM survey_response WHERE ticket_id = 2').get();
  t.diagnostic(`DELETE -> HTTP ${xoa.status} ${JSON.stringify(xoa.json.data)} · GET lại -> HTTP ${moLai.status} ${moLai.json.error} · survey_response ${truoc} -> ${dem('SELECT COUNT(*) n FROM survey_response')}, is_deleted=${dong.is_deleted}`);
  assert.strictEqual(xoa.status, 200);
  assert.strictEqual(moLai.status, 404);
  assert.strictEqual(dem('SELECT COUNT(*) n FROM survey_response'), truoc);
  assert.strictEqual(dong.is_deleted, 1);
});

test('TC-05 [Luồng đúng · QT-14, TK-01] BGĐ tạo tài khoản quản lý gắn trung tâm 2 -> 201; tài khoản mới đăng nhập được', async (t) => {
  const { call, token } = await dungMoiTruong(t);
  const r = await call('POST', '/api/users', { token: await token('bgd'),
    body: { username: 'quanly.tt02', password: 'QuanLy2026', full_name: 'Quản lý Ninh Kiều', role: 'quan_ly', center_id: 2 } });
  const dn = await call('POST', '/api/auth/login', { body: { username: 'quanly.tt02', password: 'QuanLy2026' } });
  t.diagnostic(`POST /api/users -> HTTP ${r.status} center_name="${r.json.data?.center_name}" có password_hash? ${'password_hash' in (r.json.data || {})} · đăng nhập -> HTTP ${dn.status} role=${dn.json.data?.user?.role}`);
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.json.data.center_name, 'TTBH Ninh Kiều');
  assert.ok(!('password_hash' in r.json.data));
  assert.strictEqual(dn.status, 200);
});

// ---------------------------------------------------------------- 2. GIÁ TRỊ BIÊN (hai bên ranh giới BS-02: 5 phản hồi)
function baoCaoVoi(soPhanHoi) {
  const reportRepo = {
    summary: () => ({ total_responses: soPhanHoi, high_count: soPhanHoi - 1, low_count: 0, avg_score: 4 }),
    distribution: () => [], byTechnician: () => [], closedTickets: () => 10,
  };
  return createReportService({ reportRepo, centerRepo: { findById: () => ({}) }, surveyService: {},
    now: () => new Date('2026-10-10T08:00:00Z') }).csat({ role: 'bgd' }, { from: '2026-10-01', to: '2026-10-10' }).data;
}

test('TC-06 [Biên · BS-02] đúng 5 phản hồi -> KHÔNG gắn cảnh báo mẫu nhỏ', (t) => {
  const d = baoCaoVoi(5);
  t.diagnostic(`total_responses=${d.total_responses} · csat_percent=${d.csat_percent} · warning=${d.warning}`);
  assert.strictEqual(d.warning, null);
  assert.strictEqual(d.csat_percent, 80);
});

test('TC-07 [Biên · BS-02] 4 phản hồi -> gắn MAU_CHUA_DU_TIN_CAY nhưng VẪN trả số', (t) => {
  const d = baoCaoVoi(4);
  t.diagnostic(`total_responses=${d.total_responses} · csat_percent=${d.csat_percent} · warning=${d.warning}`);
  assert.strictEqual(d.warning, 'MAU_CHUA_DU_TIN_CAY');
  assert.strictEqual(d.csat_percent, 75);
});

// ---------------------------------------------------------------- 3. DỮ LIỆU SAI (kiểm mã trạng thái VÀ thông báo VÀ tác dụng phụ)
test('TC-08 [Dữ liệu sai · FR-02] gửi phản hồi thiếu điểm -> 400 nêu rõ trường score; khảo sát không đổi', async (t) => {
  const { db, call } = await dungMoiTruong(t);
  const r = await call('POST', `/api/surveys/2?t=${lienKet(db, 2)}`, { body: { comment: 'Quên chấm điểm' } });
  const dong = db.prepare('SELECT status, score FROM survey_response WHERE ticket_id = 2').get();
  t.diagnostic(`HTTP ${r.status} · ${JSON.stringify(r.json)} · CSDL: status=${dong.status}, score=${dong.score}`);
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.json.error, 'DU_LIEU_KHONG_HOP_LE');
  assert.strictEqual(r.json.field, 'score');
  assert.match(r.json.message, /score/);
  assert.deepStrictEqual({ ...dong }, { status: 'DA_GUI', score: null });
});

test('TC-09 [Dữ liệu sai] gửi JSON hỏng khi tạo tài khoản -> 400 thông báo rõ, KHÔNG phải 500; không thêm tài khoản', async (t) => {
  const { call, token, dem } = await dungMoiTruong(t);
  const truoc = dem('SELECT COUNT(*) n FROM app_user');
  const r = await call('POST', '/api/users', { token: await token('bgd'), raw: '{"username":"x", "password":' });
  t.diagnostic(`HTTP ${r.status} · ${JSON.stringify(r.json)} · app_user ${truoc} -> ${dem('SELECT COUNT(*) n FROM app_user')}`);
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.json.error, 'DU_LIEU_KHONG_HOP_LE');
  assert.match(r.json.message, /JSON/);
  assert.strictEqual(dem('SELECT COUNT(*) n FROM app_user'), truoc);
});

// ---------------------------------------------------------------- 4. BẢO MẬT (OWASP A01 – Broken Access Control)
test('TC-10 [Bảo mật · A01] người lạ đoán ticket_id rồi gửi điểm cho khảo sát của khách khác -> bị từ chối, khảo sát không đổi', async (t) => {
  const { db, call } = await dungMoiTruong(t);
  const khongMa = await call('POST', '/api/surveys/2', { body: { score: 1, comment: 'đánh giá giả' } });
  const maDoan = await call('POST', `/api/surveys/2?t=${'0'.repeat(32)}`, { body: { score: 1, comment: 'đánh giá giả' } });
  const dong = db.prepare('SELECT status, score FROM survey_response WHERE ticket_id = 2').get();
  t.diagnostic(`không có mã -> HTTP ${khongMa.status} ${khongMa.json.error || khongMa.json.data?.status} · mã đoán -> HTTP ${maDoan.status} ${maDoan.json.error || maDoan.json.data?.status} · CSDL: status=${dong.status}, score=${dong.score}`);
  assert.ok([400, 404].includes(khongMa.status), `không có mã phải bị từ chối, nhận ${khongMa.status}`);
  assert.strictEqual(maDoan.status, 404);
  assert.deepStrictEqual({ ...dong }, { status: 'DA_GUI', score: null });

  // Bước 3 (sau BUG-006): bản sửa KHÔNG được làm hỏng luồng đúng – khách thật mở đúng đường dẫn vẫn gửi được
  const khachThat = await call('POST', `/api/surveys/2?t=${lienKet(db, 2)}`, { body: { score: 4 } });
  t.diagnostic(`khách thật đúng mã -> HTTP ${khachThat.status} ${khachThat.json.data?.status} score=${khachThat.json.data?.score}`);
  assert.strictEqual(khachThat.status, 200);
  assert.strictEqual(khachThat.json.data.score, 4);
});

// ---------------------------------------------------------------- 2b. BIÊN NGÀY THEO GIỜ VIỆT NAM (UC5 gom theo tháng)
test('TC-11 [Biên · UC5] phản hồi 23:59 ngày 31/10 và 00:30 ngày 01/11 (giờ Việt Nam) -> tính vào tháng 10 và tháng 11', async (t) => {
  let bayGio = new Date('2026-10-28T05:00:00Z');
  const { db, call, token } = await dungMoiTruong(t, { now: () => bayGio });
  await call('POST', '/api/surveys', { token: await token('hethong'), body: { ticket_id: 1 } });
  bayGio = new Date('2026-10-31T16:59:00Z');                       // 23:59 31/10 giờ Việt Nam
  await call('POST', `/api/surveys/1?t=${lienKet(db, 1)}`, { body: { score: 5 } });
  bayGio = new Date('2026-10-31T17:30:00Z');                       // 00:30 01/11 giờ Việt Nam
  await call('POST', `/api/surveys/2?t=${lienKet(db, 2)}`, { body: { score: 4 } });
  const ngay = db.prepare('SELECT ticket_id, responded_date FROM survey_response ORDER BY ticket_id').all().map((r) => ({ ...r }));
  const xh = await call('GET', '/api/reports/trend?year=2026', { token: await token('bgd') });
  const theoThang = Object.fromEntries(xh.json.data.points.map((p) => [p.period, p.total_responses]));
  t.diagnostic(`responded_date: ${JSON.stringify(ngay)} · xu hướng: ${JSON.stringify(theoThang)}`);
  assert.deepStrictEqual(ngay, [{ ticket_id: 1, responded_date: '2026-10-31' }, { ticket_id: 2, responded_date: '2026-11-01' }]);
  assert.strictEqual(theoThang[10], 1, 'tháng 10 có đúng 1 phản hồi');
  assert.strictEqual(theoThang[11], 1, 'tháng 11 có đúng 1 phản hồi');
});

// ---------------------------------------------------------------- 5. TÍNH TÁI LẬP
test('TC-12 [Tái lập] migration + seed + nạp mẫu CSV chạy lần 2 trên cùng CSDL -> không lỗi, số dòng y như lần 1', (t) => {
  const tep = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'csat-tc12-')), 'khao-sat.db');
  t.after(() => fs.rmSync(path.dirname(tep), { recursive: true, force: true }));
  const dem = (db) => Object.fromEntries(['ticket', 'survey_response', 'technician', 'service_center']
    .map((b) => [b, db.prepare(`SELECT COUNT(*) n FROM ${b}`).get().n]));
  const lan = () => {
    const db = openDb(tep);
    const migrations = migrate(db);
    const ketQuaSeed = seed(db);
    const sauSeed = dem(db);
    db.close();
    return { migrations, seedBoQua: Boolean(ketQuaSeed.skipped), sauSeed };
  };
  const lan1 = lan();
  const lan2 = lan();
  const db = openDb(tep);
  importCsv(db, path.join(__dirname, '..', 'data', 'sample'));
  const nap1 = dem(db);
  importCsv(db, path.join(__dirname, '..', 'data', 'sample'));
  const nap2 = dem(db);
  db.close();
  t.diagnostic(`lần 1: migrations=${lan1.migrations.length}, seed bỏ qua=${lan1.seedBoQua}, ${JSON.stringify(lan1.sauSeed)}`);
  t.diagnostic(`lần 2: migrations=${lan2.migrations.length}, seed bỏ qua=${lan2.seedBoQua}, ${JSON.stringify(lan2.sauSeed)}`);
  t.diagnostic(`nạp data/sample lần 1: ${JSON.stringify(nap1)} · lần 2: ${JSON.stringify(nap2)}`);
  assert.ok(lan1.migrations.length > 0 && lan2.migrations.length === 0);
  assert.strictEqual(lan2.seedBoQua, true);
  assert.deepStrictEqual(lan2.sauSeed, lan1.sauSeed);
  assert.deepStrictEqual(nap2, nap1);
});
