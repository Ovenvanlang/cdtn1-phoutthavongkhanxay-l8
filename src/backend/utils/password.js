// Băm và kiểm tra mật khẩu bằng scrypt + muối ngẫu nhiên (chỉ dùng node:crypto).
// Lưu dạng "scrypt$<muối hex>$<băm hex>". Tách khỏi auth.service để seed/script dùng được
// mà không phải gọi ngược lên lớp service.
const crypto = require('node:crypto');

const SALT_BYTES = 16;
const KEY_BYTES = 32;

/** So sánh hai chuỗi bằng thời gian hằng định để không lộ thông tin qua thời gian phản hồi. */
function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function hashPassword(plain) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = crypto.scryptSync(plain, salt, KEY_BYTES);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

function verifyPassword(plain, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const key = crypto.scryptSync(plain, salt, KEY_BYTES).toString('hex');
  return safeEqual(key, parts[2]);
}

/** Chuỗi băm giả dùng khi không có tài khoản: vẫn tính scrypt để thời gian phản hồi như nhau. */
const DUMMY_HASH = `scrypt$${'0'.repeat(32)}$${'0'.repeat(64)}`;

module.exports = { hashPassword, verifyPassword, safeEqual, DUMMY_HASH };
