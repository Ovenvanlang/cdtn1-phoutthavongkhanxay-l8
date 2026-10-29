// Validation dữ liệu vào cho API đăng nhập (routes/auth.routes.js).
const E = require('../errors/AppError');
const { bodyObject } = require('./common');

/** POST /api/auth/login  { username, password } */
function loginBody(body) {
  const { username, password } = bodyObject(body);
  if (typeof username !== 'string' || !username.trim()) throw E.invalid('username là bắt buộc', 'username');
  if (typeof password !== 'string' || !password) throw E.invalid('password là bắt buộc', 'password');
  return { username: username.trim(), password };
}

module.exports = { loginBody };
