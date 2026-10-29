// Lớp routes: đăng nhập / xem thông tin phiên. Không chứa quy tắc nghiệp vụ.
const { Router } = require('express');
const { requireLogin } = require('../middleware/access');
const v = require('../validators/auth.validator');

function createAuthRoutes(authService) {
  const r = Router();

  // Đăng nhập: { username, password } -> { token, expires_at, user }
  r.post('/login', (req, res) => {
    res.json({ data: authService.login(v.loginBody(req.body)) });
  });

  // Thông tin người đang đăng nhập (frontend dùng để hiện tên/vai trò và kiểm tra token còn hạn)
  r.get('/me', requireLogin, (req, res) => {
    res.json({ data: { name: req.user.name, role: req.user.role, center_id: req.user.centerId } });
  });

  return r;
}

module.exports = { createAuthRoutes };
