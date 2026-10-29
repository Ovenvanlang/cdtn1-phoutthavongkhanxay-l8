// Test lớp nghiệp vụ ĐĂNG NHẬP, độc lập với HTTP và CSDL (dùng repository giả).
const { test } = require('node:test');
const assert = require('node:assert');
const { createAuthService } = require('../src/backend/services/auth.service');
const { hashPassword, verifyPassword } = require('../src/backend/utils/password');

const SECRET = 'khoa-test';
const MAT_KHAU = 'Demo@2026';

function setup({ ttlHours = 8, now = () => new Date('2026-10-10T08:00:00Z'), user } = {}) {
  const macDinh = {
    user_id: 7, username: 'ql1', full_name: 'Quản lý TTBH Quận 10',
    role: 'quan_ly', center_id: 1, is_active: 1, password_hash: hashPassword(MAT_KHAU),
  };
  const taiKhoan = user === null ? null : { ...macDinh, ...user };
  const userRepo = {
    findByUsername: (u) => (taiKhoan && taiKhoan.username === u ? taiKhoan : undefined),
    findById: (id) => (taiKhoan && taiKhoan.user_id === id ? { ...taiKhoan, is_active: Boolean(taiKhoan.is_active) } : undefined),
  };
  return { service: createAuthService({ userRepo, secret: SECRET, ttlHours, now }), taiKhoan };
}

test('Băm mật khẩu: mỗi lần băm ra chuỗi khác nhau (có muối) nhưng đều kiểm tra đúng', () => {
  const a = hashPassword(MAT_KHAU);
  const b = hashPassword(MAT_KHAU);
  assert.notStrictEqual(a, b, 'hai lần băm phải khác nhau nhờ muối ngẫu nhiên');
  assert.ok(a.startsWith('scrypt$'));
  assert.ok(!a.includes(MAT_KHAU), 'không được lưu mật khẩu dạng rõ');
  assert.strictEqual(verifyPassword(MAT_KHAU, a), true);
  assert.strictEqual(verifyPassword('sai-mat-khau', a), false);
  assert.strictEqual(verifyPassword(MAT_KHAU, 'chuoi-hong'), false, 'chuỗi băm hỏng -> false, không được ném lỗi');
});

test('Đăng nhập đúng -> token mang đúng vai trò và trung tâm (QT-14)', () => {
  const { service } = setup();
  const kq = service.login({ username: 'ql1', password: MAT_KHAU });
  assert.strictEqual(kq.user.role, 'quan_ly');
  assert.strictEqual(kq.user.center_id, 1);
  const payload = service.verifyToken(kq.token);
  assert.strictEqual(payload.role, 'quan_ly');
  assert.strictEqual(payload.centerId, 1);
  assert.strictEqual(payload.userId, 7);
});

test('Ngoại lệ đăng nhập: sai mật khẩu / không có tài khoản / tài khoản đã khóa -> cùng một mã lỗi', () => {
  const { service } = setup();
  assert.throws(() => service.login({ username: 'ql1', password: 'sai' }),
    (e) => e.code === 'SAI_TAI_KHOAN_HOAC_MAT_KHAU');
  assert.throws(() => service.login({ username: 'khong-co', password: MAT_KHAU }),
    (e) => e.code === 'SAI_TAI_KHOAN_HOAC_MAT_KHAU', 'không được lộ việc tài khoản có tồn tại hay không');
  const khoa = setup({ user: { is_active: 0 } }).service;
  assert.throws(() => khoa.login({ username: 'ql1', password: MAT_KHAU }), (e) => e.code === 'SAI_TAI_KHOAN_HOAC_MAT_KHAU');
});

test('Token bị sửa chữ ký, sai định dạng hoặc đổi thuật toán đều bị từ chối (TOKEN_KHONG_HOP_LE)', () => {
  const { service } = setup();
  const token = service.login({ username: 'ql1', password: MAT_KHAU }).token;
  const [header, payload, chuKy] = token.split('.');

  const sai = (t) => assert.throws(() => service.verifyToken(t), (e) => e.code === 'TOKEN_KHONG_HOP_LE');
  sai(`${header}.${payload}.${chuKy.slice(0, -2)}xx`);                 // sửa chữ ký
  sai(`${header}.${Buffer.from('{"sub":1,"role":"bgd","exp":99999999999}').toString('base64url')}.${chuKy}`); // nâng quyền
  sai(`${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${payload}.`);                      // alg=none
  sai('khong-phai-token');
  sai('');
});

test('Biên hết hạn: còn 1 giây thì chấp nhận, qua đúng thời điểm hết hạn thì từ chối', () => {
  let gio = new Date('2026-10-10T08:00:00Z');
  const { service } = setup({ ttlHours: 1, now: () => gio });
  const token = service.login({ username: 'ql1', password: MAT_KHAU }).token;

  gio = new Date('2026-10-10T08:59:59Z');
  assert.strictEqual(service.verifyToken(token).role, 'quan_ly', 'còn 1 giây vẫn phải dùng được');

  gio = new Date('2026-10-10T09:00:00Z');
  assert.throws(() => service.verifyToken(token), (e) => e.code === 'TOKEN_KHONG_HOP_LE', 'đúng giây hết hạn phải bị từ chối');
});

test('Tài khoản bị khóa SAU khi đăng nhập: token cũ bị từ chối ngay, không chờ hết hạn (QT-13, TD-21)', () => {
  const { service, taiKhoan } = setup();
  const token = service.login({ username: 'ql1', password: MAT_KHAU }).token;
  assert.strictEqual(service.verifyToken(token).role, 'quan_ly');
  taiKhoan.is_active = 0;                                     // BGĐ khóa tài khoản
  assert.throws(() => service.verifyToken(token), (e) => e.code === 'TOKEN_KHONG_HOP_LE');
});
