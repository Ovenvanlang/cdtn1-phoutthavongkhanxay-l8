// Test lớp nghiệp vụ QUẢN LÝ TÀI KHOẢN (QT-13, QT-14, TK-01..03) trên CSDL SQLite trong bộ nhớ.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../src/backend/db/connection');
const { migrate } = require('../src/backend/db/migrate');
const { createUserRepository } = require('../src/backend/repositories/user.repository');
const { createCenterRepository } = require('../src/backend/repositories/center.repository');
const { createUserService } = require('../src/backend/services/user.service');
const { verifyPassword } = require('../src/backend/utils/password');

let db, service, bgd;
const MAT_KHAU = 'MatKhau123';

beforeEach(() => {
  db = openDb(':memory:');
  migrate(db);
  db.exec("INSERT INTO service_center(center_name, city) VALUES ('TTBH Quận 10','TP. Hồ Chí Minh'), ('TTBH Ninh Kiều','Cần Thơ')");
  service = createUserService({ userRepo: createUserRepository(db), centerRepo: createCenterRepository(db) });
  bgd = service.create({ username: 'bgd', password: MAT_KHAU, fullName: 'Ban giám đốc', role: 'bgd', centerId: null });
});

const loi = (code, field) => (e) => e.code === code && (field === undefined || e.field === field);

test('Luồng đúng: tạo quản lý gắn trung tâm -> đọc lại được, mật khẩu chỉ lưu dạng băm', () => {
  const ql = service.create({ username: 'quanly.tt02', password: MAT_KHAU, fullName: 'Quản lý Ninh Kiều', role: 'quan_ly', centerId: 2 });
  assert.strictEqual(ql.center_name, 'TTBH Ninh Kiều');
  assert.strictEqual(ql.is_active, true);
  assert.ok(!('password_hash' in ql), 'không được trả mật khẩu băm ra ngoài');
  const luu = db.prepare('SELECT password_hash FROM app_user WHERE username = ?').get('quanly.tt02').password_hash;
  assert.ok(luu.startsWith('scrypt$') && verifyPassword(MAT_KHAU, luu));
  assert.strictEqual(service.list({ role: 'quan_ly' }).meta.total, 1);
});

test('QT-14: quản lý thiếu trung tâm hoặc trung tâm không tồn tại -> lỗi; vai trò khác không được gắn trung tâm', () => {
  const tao = (role, centerId) => () => service.create({ username: `u${role}${centerId}`, password: MAT_KHAU, fullName: 'X', role, centerId });
  assert.throws(tao('quan_ly', null), loi('DU_LIEU_KHONG_HOP_LE', 'center_id'));
  assert.throws(tao('quan_ly', 99), loi('DU_LIEU_KHONG_HOP_LE', 'center_id'));
  assert.throws(tao('marketing', 1), loi('DU_LIEU_KHONG_HOP_LE', 'center_id'));
});

test('TK-01: trùng tên đăng nhập -> TEN_DANG_NHAP_DA_TON_TAI', () => {
  assert.throws(() => service.create({ username: 'bgd', password: MAT_KHAU, fullName: 'Y', role: 'bgd', centerId: null }),
    loi('TEN_DANG_NHAP_DA_TON_TAI'));
});

test('Cập nhật: đổi quản lý sang marketing mà không gửi center_id -> tự bỏ trung tâm (QT-14)', () => {
  const ql = service.create({ username: 'ql', password: MAT_KHAU, fullName: 'QL', role: 'quan_ly', centerId: 1 });
  const sau = service.update({ userId: bgd.user_id }, ql.user_id, { role: 'marketing' });
  assert.strictEqual(sau.role, 'marketing');
  assert.strictEqual(sau.center_id, null);
  assert.throws(() => service.update({ userId: bgd.user_id }, sau.user_id, { role: 'quan_ly' }), loi('DU_LIEU_KHONG_HOP_LE', 'center_id'),
    'chuyển lại thành quản lý thì phải chỉ rõ trung tâm');
});

test('QT-13: xóa = khóa tài khoản, dòng dữ liệu vẫn còn; mở khóa lại được', () => {
  const mkt = service.create({ username: 'mkt', password: MAT_KHAU, fullName: 'MKT', role: 'marketing', centerId: null });
  assert.deepStrictEqual(service.deactivate({ userId: bgd.user_id }, mkt.user_id), { user_id: mkt.user_id, is_active: false });
  assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM app_user WHERE user_id = ?').get(mkt.user_id).n, 1);
  assert.strictEqual(service.update({ userId: bgd.user_id }, mkt.user_id, { isActive: true }).is_active, true);
});

test('TK-02 và TK-03 (biên): không tự khóa mình; không khóa/hạ quyền BGĐ cuối cùng, còn BGĐ thứ hai thì được', () => {
  assert.throws(() => service.deactivate({ userId: bgd.user_id }, bgd.user_id), loi('KHONG_TU_THAO_TAC'));
  const bgd2 = service.create({ username: 'bgd2', password: MAT_KHAU, fullName: 'BGĐ 2', role: 'bgd', centerId: null });
  service.deactivate({ userId: bgd.user_id }, bgd2.user_id);                         // còn 2 BGĐ -> khóa 1 được
  const he = service.create({ username: 'hethong', password: MAT_KHAU, fullName: 'Hệ thống', role: 'he_thong', centerId: null });
  assert.throws(() => service.deactivate({ userId: he.user_id }, bgd.user_id), loi('PHAI_CON_MOT_BGD'),
    'chỉ còn đúng 1 BGĐ đang hoạt động -> không được khóa');
  assert.throws(() => service.update({ userId: he.user_id }, bgd.user_id, { role: 'marketing' }), loi('PHAI_CON_MOT_BGD'));
});

test('Không có tài khoản -> KHONG_TIM_THAY', () => {
  assert.throws(() => service.get(999), loi('KHONG_TIM_THAY'));
  assert.throws(() => service.update({ userId: bgd.user_id }, 999, { fullName: 'X' }), loi('KHONG_TIM_THAY'));
});
