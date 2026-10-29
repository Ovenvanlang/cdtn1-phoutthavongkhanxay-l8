// Test qua HTTP (routes + validators + services + repositories + CSDL thật trong bộ nhớ).
// Chạy: npm test     (dùng node:test có sẵn, CSDL SQLite trong bộ nhớ, không đụng tới data/*.db)
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../src/backend/db/connection');
const { migrate } = require('../src/backend/db/migrate');
const { createApp } = require('../src/backend/app');
const { hashPassword } = require('../src/backend/utils/password');

let db, server, base;
const TOKEN = {};
const SECRET = 'khoa-ky-token-chi-dung-khi-chay-test';
const MAT_KHAU = 'Test@12345';
const FIXED_NOW = () => new Date('2026-10-10T08:00:00.000Z');

// Dữ liệu tối thiểu: 2 trung tâm; phiếu #1,#2,#4 ở trung tâm 1 (ĐÃ ĐÓNG), #3 chưa đóng, #5 ĐÃ ĐÓNG ở trung tâm 2
before(async () => {
  db = openDb(':memory:');
  migrate(db);
  db.exec(`
    INSERT INTO service_center(center_name, city) VALUES ('HCM-01','TP.HCM'), ('CT-01','Cần Thơ');
    INSERT INTO customer(full_name, phone) VALUES ('Khach A','0912345678'), ('Khach B','0987654321');
    INSERT INTO ticket(ticket_code, customer_id, center_id, status, closed_at) VALUES
      ('BH000001/2026',1,1,'DA_DONG','2026-10-09T10:00:00Z'),
      ('BH000002/2026',2,1,'DA_DONG','2026-10-09T11:00:00Z'),
      ('BH000003/2026',1,1,'DANG_XU_LY',NULL),
      ('BH000004/2026',2,1,'DA_DONG','2026-10-09T12:00:00Z'),
      ('BH000005/2026',1,2,'DA_DONG','2026-10-09T13:00:00Z');
  `);
  const insUser = db.prepare('INSERT INTO app_user(username, password_hash, full_name, role, center_id) VALUES (?,?,?,?,?)');
  for (const [username, role, centerId] of [
    ['hethong', 'he_thong', null], ['ql1', 'quan_ly', 1], ['ql2', 'quan_ly', 2],
    ['bgd', 'bgd', null], ['mkt', 'marketing', null],
  ]) insUser.run(username, hashPassword(MAT_KHAU), username, role, centerId);

  server = createApp({ db, now: FIXED_NOW, authSecret: SECRET }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;

  for (const username of ['hethong', 'ql1', 'ql2', 'bgd', 'mkt']) {
    const r = await call('POST', '/api/auth/login', { body: { username, password: MAT_KHAU } });
    TOKEN[username] = r.json.data.token;
  }
});

after(() => { server.close(); db.close(); });

const call = async (method, path, { token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json() };
};
const he_thong = () => ({ token: TOKEN.hethong });

test('UC1: hệ thống tạo khảo sát cho phiếu ĐÃ ĐÓNG -> 201, trạng thái DA_GUI, chưa có điểm', async () => {
  const r = await call('POST', '/api/surveys', { ...he_thong(), body: { ticket_id: 1 } });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.json.data.status, 'DA_GUI');
  assert.strictEqual(r.json.data.score, null);
});

test('QT-10: tạo khảo sát lần 2 cho cùng một phiếu -> 409 DA_KHAO_SAT', async () => {
  const r = await call('POST', '/api/surveys', { ...he_thong(), body: { ticket_id: 1 } });
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.json.error, 'DA_KHAO_SAT');
});

test('QT-10: phiếu chưa ĐÃ ĐÓNG -> 409 PHIEU_CHUA_DONG', async () => {
  const r = await call('POST', '/api/surveys', { ...he_thong(), body: { ticket_id: 3 } });
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.json.error, 'PHIEU_CHUA_DONG');
});

test('Phiếu không tồn tại -> 404; ticket_id sai kiểu -> 400', async () => {
  assert.strictEqual((await call('POST', '/api/surveys', { ...he_thong(), body: { ticket_id: 999 } })).status, 404);
  assert.strictEqual((await call('POST', '/api/surveys', { ...he_thong(), body: { ticket_id: 'abc' } })).status, 400);
});

test('Chưa đăng nhập không được tạo khảo sát -> 401; sai vai trò -> 403', async () => {
  const khach = await call('POST', '/api/surveys', { body: { ticket_id: 2 } });
  assert.strictEqual(khach.status, 401);
  assert.strictEqual(khach.json.error, 'CHUA_DANG_NHAP');
  const saiVaiTro = await call('POST', '/api/surveys', { token: TOKEN.mkt, body: { ticket_id: 2 } });
  assert.strictEqual(saiVaiTro.status, 403);
  assert.strictEqual(saiVaiTro.json.error, 'KHONG_DU_QUYEN');
});

test('UC2: điểm ngoài 1–5 hoặc sai kiểu -> 400 và khảo sát vẫn ở DA_GUI', async () => {
  for (const bad of [0, 6, 9, 2.5, '5', null]) {
    const r = await call('POST', '/api/surveys/1', { body: { score: bad } });
    assert.strictEqual(r.status, 400, `score=${JSON.stringify(bad)} phải bị từ chối`);
  }
  assert.strictEqual(db.prepare('SELECT status FROM survey_response WHERE ticket_id=1').get().status, 'DA_GUI');
});

test('Dữ liệu sai (thiếu trường bắt buộc): gửi phản hồi không có score -> 400 kèm tên trường, không sập', async () => {
  const r = await call('POST', '/api/surveys/1', { body: { comment: 'Quên chấm điểm' } });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.json.error, 'DU_LIEU_KHONG_HOP_LE');
  assert.strictEqual(r.json.field, 'score', 'phải nói rõ trường nào sai');
  assert.match(r.json.message, /score/);
  const thieuTicket = await call('POST', '/api/surveys', { ...he_thong(), body: {} });
  assert.strictEqual(thieuTicket.status, 400);
  assert.strictEqual(thieuTicket.json.field, 'ticket_id');
});

test('UC2: nhận xét quá 500 ký tự -> 400', async () => {
  const r = await call('POST', '/api/surveys/1', { body: { score: 4, comment: 'x'.repeat(501) } });
  assert.strictEqual(r.status, 400);
});

test('UC2: gửi điểm hợp lệ -> 200, DA_TRA_LOI, low_score đúng theo BS-03', async () => {
  const ok = await call('POST', '/api/surveys/1', { body: { score: 5, comment: '  Tốt  ' } });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.json.data.status, 'DA_TRA_LOI');
  assert.strictEqual(ok.json.data.comment, 'Tốt');
  assert.strictEqual(ok.json.data.low_score, false);
  assert.strictEqual(ok.json.data.responded_at, '2026-10-10T08:00:00.000Z');
  await call('POST', '/api/surveys', { ...he_thong(), body: { ticket_id: 2 } });
  const low = await call('POST', '/api/surveys/2', { body: { score: 2 } });
  assert.strictEqual(low.json.data.low_score, true);
});

test('QT-10: gửi phản hồi lần 2 -> 409 và điểm cũ KHÔNG bị ghi đè', async () => {
  const r = await call('POST', '/api/surveys/1', { body: { score: 1 } });
  assert.strictEqual(r.status, 409);
  assert.strictEqual(db.prepare('SELECT score FROM survey_response WHERE ticket_id=1').get().score, 5);
});

test('NFR4: CSDL tự chặn khảo sát trùng và điểm sai kể cả khi bỏ qua tầng service', () => {
  assert.throws(() => db.prepare("INSERT INTO survey_response(ticket_id,status,sent_at) VALUES (1,'DA_GUI','x')").run(), /UNIQUE/);
  assert.throws(() => db.prepare("INSERT INTO survey_response(ticket_id,status,sent_at,score,responded_at) VALUES (4,'DA_TRA_LOI','x',9,'y')").run(), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO survey_response(ticket_id,status,sent_at) VALUES (999,'DA_GUI','x')").run(), /FOREIGN KEY/);
  assert.throws(() => db.prepare("INSERT INTO survey_response(ticket_id,status,sent_at,responded_at) VALUES (4,'DA_TRA_LOI','x','y')").run(), /CHECK/, 'DA_TRA_LOI bắt buộc có điểm');
  assert.throws(() => db.prepare("INSERT INTO survey_response(ticket_id,status,sent_at,score) VALUES (4,'DA_GUI','x',3)").run(), /CHECK/, 'DA_GUI không được có điểm');
});

test('CSDL chặn tài khoản quản lý không gắn trung tâm (QT-14 ở mức ràng buộc dữ liệu)', () => {
  assert.throws(
    () => db.prepare("INSERT INTO app_user(username,password_hash,full_name,role) VALUES ('ql-loi','x','x','quan_ly')").run(),
    /CHECK/);
});

test('Ngày trả lời được ghi vào dim_date (khóa ngoại) kể cả ngoài khoảng seed', async () => {
  const dateId = db.prepare('SELECT responded_date d FROM survey_response WHERE ticket_id=1').get().d;
  assert.strictEqual(dateId, '2026-10-10');
  assert.ok(db.prepare('SELECT 1 FROM dim_date WHERE date_id = ?').get(dateId));
});

test('QT-14: quản lý chỉ thấy trung tâm mình; xin trung tâm khác -> 403; chưa đăng nhập -> 401', async () => {
  await call('POST', '/api/surveys', { ...he_thong(), body: { ticket_id: 5 } });          // khảo sát ở trung tâm 2
  const own = await call('GET', '/api/surveys', { token: TOKEN.ql1 });
  assert.strictEqual(own.status, 200);
  assert.ok(own.json.data.length >= 2);
  assert.ok(own.json.data.every((s) => s.center_id === 1), 'không được lẫn dữ liệu trung tâm 2');
  assert.strictEqual((await call('GET', '/api/surveys?center_id=2', { token: TOKEN.ql1 })).status, 403);
  assert.strictEqual((await call('GET', '/api/surveys')).status, 401);
  const all = await call('GET', '/api/surveys', { token: TOKEN.bgd });                    // BGĐ thấy toàn công ty
  assert.ok(all.json.data.some((s) => s.center_id === 2));
});

test('QT-15: quản lý và ban giám đốc đều thấy số điện thoại đầy đủ của khách', async () => {
  const r = await call('GET', '/api/surveys', { token: TOKEN.ql1 });
  assert.ok(r.json.data.every((s) => /^\d{10}$/.test(s.customer_phone)));
});

test('Lọc điểm thấp score_max=2 chỉ trả phản hồi đã trả lời có điểm ≤ 2', async () => {
  const r = await call('GET', '/api/surveys?score_max=2', { token: TOKEN.ql1 });
  assert.ok(r.json.data.length >= 1 && r.json.data.every((s) => s.score <= 2));
  assert.strictEqual((await call('GET', '/api/surveys?score_max=9', { token: TOKEN.bgd })).status, 400);
});

test('QT-13: xóa mềm -> đọc lại 404 nhưng bản ghi vẫn còn; quản lý trung tâm khác không xóa được', async () => {
  assert.strictEqual((await call('DELETE', '/api/surveys/5', { token: TOKEN.ql1 })).status, 403);
  assert.strictEqual((await call('DELETE', '/api/surveys/5', { token: TOKEN.ql2 })).status, 200);
  assert.strictEqual((await call('GET', '/api/surveys/5')).status, 404);
  assert.strictEqual(db.prepare('SELECT is_deleted FROM survey_response WHERE ticket_id=5').get().is_deleted, 1);
  assert.strictEqual((await call('POST', '/api/surveys', { ...he_thong(), body: { ticket_id: 5 } })).status, 409,
    'phiếu đã khảo sát (kể cả đã xóa mềm) không tạo lại được');
});

test('UC3: báo cáo CSAT đã hiện thực -> 200 và tính đúng theo BS-01 trên dữ liệu test', async () => {
  const r = await call('GET', '/api/reports/csat?from=2026-01-01&to=2026-12-31', { token: TOKEN.bgd });
  assert.strictEqual(r.status, 200);
  // Trong bộ test: phiếu 1 = 5 điểm, phiếu 2 = 2 điểm (phiếu 5 đã xóa mềm nên không tính) -> 1/2 = 50%
  assert.strictEqual(r.json.data.total_responses, 2);
  assert.strictEqual(r.json.data.csat_percent, 50);
  assert.strictEqual(r.json.data.low_score_count, 1);
});

test('JSON hỏng -> 400 thay vì 500', async () => {
  const res = await fetch(`${base}/api/surveys/1`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{score:' });
  assert.strictEqual(res.status, 400);
});
