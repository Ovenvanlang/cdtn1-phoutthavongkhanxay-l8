// Lớp service: đăng nhập và token. Chỉ dùng node:crypto, KHÔNG thêm thư viện ngoài.
//
// Mật khẩu: băm bằng scrypt + muối (utils/password.js).
// Token:    cấu trúc 3 phần như JWT (header.payload.chữ ký) ký bằng HMAC-SHA256.
//           Đây KHÔNG phải SSO của công ty (ngoài phạm vi – SRS mục 1.3), chỉ đủ để
//           phân quyền thật cho QT-14/QT-15 thay cho header mô phỏng ở buổi 8 (TD-14).
const crypto = require('node:crypto');
const E = require('../errors/AppError');
const { verifyPassword, safeEqual, DUMMY_HASH } = require('../utils/password');

const HEADER_B64 = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function createAuthService({ userRepo, secret, ttlHours = 8, now = () => new Date() }) {
  if (!secret) throw new Error('Thiếu AUTH_SECRET: không thể ký token đăng nhập');

  const sign = (data) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

  function issueToken(user) {
    const iat = Math.floor(now().getTime() / 1000);
    const payload = {
      sub: user.user_id,
      name: user.full_name,
      role: user.role,
      center_id: user.center_id ?? null,
      iat,
      exp: iat + Math.round(ttlHours * 3600),
    };
    const body = `${HEADER_B64}.${base64url(JSON.stringify(payload))}`;
    return { token: `${body}.${sign(body)}`, expires_at: new Date(payload.exp * 1000).toISOString() };
  }

  /** Giải mã + kiểm tra token. Mọi trường hợp sai đều trả cùng một lỗi 401 (không nói rõ sai ở đâu). */
  function verifyToken(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw E.invalidToken();
    const [header, payloadB64, signature] = parts;
    if (header !== HEADER_B64) throw E.invalidToken();                    // chặn alg=none / alg khác
    if (!safeEqual(signature, sign(`${header}.${payloadB64}`))) throw E.invalidToken();
    let payload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
      throw E.invalidToken();
    }
    if (!payload || typeof payload.exp !== 'number') throw E.invalidToken();
    if (payload.exp * 1000 <= now().getTime()) throw E.invalidToken();     // hết hạn
    return {
      userId: payload.sub,
      name: payload.name,
      role: payload.role,
      centerId: payload.center_id ?? null,
    };
  }

  return {
    issueToken,
    verifyToken,

    /**
     * UC0 – đăng nhập. Dữ liệu vào đã qua validators/auth.validator.js.
     * Luôn tính băm (kể cả khi không có tài khoản) để thời gian phản hồi như nhau.
     */
    login({ username, password }) {
      const user = userRepo.findByUsername(username);
      const ok = verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
      if (!user || !ok || !user.is_active) throw E.badCredentials();

      const { token, expires_at } = issueToken(user);
      return {
        token,
        expires_at,
        user: { username: user.username, full_name: user.full_name, role: user.role, center_id: user.center_id ?? null },
      };
    },
  };
}

module.exports = { createAuthService };
