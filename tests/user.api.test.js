// Test CRUD tài khoản qua HTTP: phân quyền, mã trạng thái, thông báo lỗi kèm tên trường.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../src/backend/db/connection');
const { migrate } = require('../src/backend/db/migrate');
const { createApp } = require('../src/backend/app');
const { hashPassword } = require('../src/backend/utils/password');

let db, server, base;
const TOKEN = {};
const MAT_KHAU = 'Test@12345';

before(async () => {
  db = openDb(':memory:');
  migrate(db);
  db.exec("INSERT INTO service_center(center_name, city) VALUES ('TTBH Quận 10','TP. Hồ Chí Minh')");
  const ins = db.prepare('INSERT INTO app_user(username, password_hash, full_name, role, center_id) VALUES (?,?,?,?,?)');
  ins.run('bgd', hashPassword(MAT_KHAU), 'Ban giám đốc', 'bgd', null);
  ins.run('ql1', hashPassword(MAT_KHAU), 'Quản lý', 'quan_ly', 1);
  server = createApp({ db, authSecret: 'khoa-test-user-api' }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const u of ['bgd', 'ql1']) TOKEN[u] = (await call('POST', '/api/auth/login', { body: { username: u, password: MAT_KHAU } })).json.data.token;
});
after(() => { server.close(); db.close(); });

async function call(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json() };
}

test('CRUD đầy đủ bởi BGĐ: tạo 201 -> đọc 200 -> sửa 200 -> xóa mềm 200 -> không đăng nhập được nữa', async () => {
  const bgd = { token: TOKEN.bgd };
  const tao = await call('POST', '/api/users', { ...bgd,
    body: { username: 'mkt.moi', password: 'Marketing2026', full_name: 'Marketing mới', role: 'marketing' } });
  assert.strictEqual(tao.status, 201);
  const id = tao.json.data.user_id;
  assert.strictEqual((await call('GET', `/api/users/${id}`, bgd)).json.data.username, 'mkt.moi');
  assert.ok((await call('GET', '/api/users?role=marketing', bgd)).json.data.some((u) => u.user_id === id));
  const sua = await call('PATCH', `/api/users/${id}`, { ...bgd, body: { full_name: 'Phòng Marketing' } });
  assert.strictEqual(sua.status, 200);
  assert.strictEqual(sua.json.data.full_name, 'Phòng Marketing');
  assert.strictEqual((await call('DELETE', `/api/users/${id}`, bgd)).status, 200);
  const dangNhap = await call('POST', '/api/auth/login', { body: { username: 'mkt.moi', password: 'Marketing2026' } });
  assert.strictEqual(dangNhap.status, 401, 'tài khoản đã khóa không đăng nhập được');
});

test('Phân quyền: quản lý trung tâm gọi API tài khoản -> 403; chưa đăng nhập -> 401', async () => {
  assert.strictEqual((await call('GET', '/api/users', { token: TOKEN.ql1 })).status, 403);
  assert.strictEqual((await call('GET', '/api/users')).status, 401);
});

test('Dữ liệu sai -> 400 kèm tên trường; trùng tên -> 409; BGĐ tự khóa mình -> 409', async () => {
  const bgd = { token: TOKEN.bgd };
  const thieu = await call('POST', '/api/users', { ...bgd, body: { username: 'abc', password: 'ngan', full_name: 'A', role: 'bgd' } });
  assert.strictEqual(thieu.status, 400);
  assert.strictEqual(thieu.json.field, 'password');
  const qlKhongTrungTam = await call('POST', '/api/users', { ...bgd, body: { username: 'ql2', password: 'QuanLy2026', full_name: 'QL', role: 'quan_ly' } });
  assert.strictEqual(qlKhongTrungTam.status, 400);
  assert.strictEqual(qlKhongTrungTam.json.field, 'center_id');
  const trung = await call('POST', '/api/users', { ...bgd, body: { username: 'ql1', password: 'QuanLy2026', full_name: 'QL', role: 'quan_ly', center_id: 1 } });
  assert.strictEqual(trung.status, 409);
  assert.strictEqual(trung.json.error, 'TEN_DANG_NHAP_DA_TON_TAI');
  const tuKhoa = await call('DELETE', '/api/users/1', bgd);
  assert.strictEqual(tuKhoa.status, 409);
  assert.strictEqual(tuKhoa.json.error, 'KHONG_TU_THAO_TAC');
  assert.strictEqual((await call('PATCH', '/api/users/1', { ...bgd, body: { username: 'doi' } })).json.field, 'username');
});
