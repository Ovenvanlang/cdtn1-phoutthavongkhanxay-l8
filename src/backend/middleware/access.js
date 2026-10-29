// Access Middleware (QT-14, QT-15).
// Buổi 10: vai trò lấy từ TOKEN đăng nhập trong header `Authorization: Bearer <token>`
// (thay cho header X-Role mô phỏng ở buổi 8 – xem docs/thay-doi-thiet-ke.md, TD-14).
// Không có token  -> coi là KHÁCH HÀNG: chỉ dùng được các API khảo sát công khai.
// Token sai/hết hạn -> 401 để frontend xóa token và quay về trang đăng nhập.
const E = require('../errors/AppError');

const GUEST = { role: 'khach_hang', centerId: null, userId: null, name: 'Khách hàng' };

function createAttachUser(authService) {
  return function attachUser(req, res, next) {
    const header = req.header('Authorization') || '';
    if (!header) { req.user = GUEST; return next(); }
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (!match) return next(E.invalidToken());
    try {
      req.user = authService.verifyToken(match[1].trim());
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireLogin(req, res, next) {
  if (!req.user || req.user.role === 'khach_hang') return next(E.unauthenticated());
  next();
}

/** Chặn theo vai trò: chưa đăng nhập -> 401 (để frontend chuyển về đăng nhập), sai vai trò -> 403. */
function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user || req.user.role === 'khach_hang') return next(E.unauthenticated());
    if (!allowed.includes(req.user.role)) return next(E.forbidden(`Vai trò ${req.user.role} không có quyền`));
    next();
  };
}

module.exports = { createAttachUser, requireLogin, requireRole, GUEST };
