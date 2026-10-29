// Validation dữ liệu vào cho API quản lý tài khoản (routes/users.routes.js).
const E = require('../errors/AppError');
const { positiveInt, optionalPositiveInt, isMissing, oneOf, requiredText, pagination, bodyObject } = require('./common');

const ROLES = ['he_thong', 'quan_ly', 'bgd', 'marketing'];
const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;

const userId = (value) => positiveInt(value, 'user_id');

function password(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 72)
    throw E.invalid('password phải dài từ 8 đến 72 ký tự', 'password');
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value))
    throw E.invalid('password phải có cả chữ và số', 'password');
  return value;
}

/** center_id: bỏ trống/null = không gắn trung tâm; có thì phải là số nguyên dương. */
const centerId = (value) => (isMissing(value) ? null : positiveInt(value, 'center_id'));

/** POST /api/users  { username, password, full_name, role, center_id? } */
function createBody(body) {
  const b = bodyObject(body);
  if (typeof b.username !== 'string' || !USERNAME_RE.test(b.username.trim()))
    throw E.invalid('username gồm 3–40 ký tự a-z, 0-9, dấu chấm, gạch dưới hoặc gạch ngang', 'username');
  return {
    username: b.username.trim(),
    password: password(b.password),
    fullName: requiredText(b.full_name, 'full_name', { max: 120 }),
    role: oneOf(b.role, ROLES, 'role'),
    centerId: centerId(b.center_id),
  };
}

/** PATCH /api/users/:id – chỉ gửi trường cần đổi: full_name, role, center_id, password, is_active. */
function updateBody(body) {
  const b = bodyObject(body);
  if ('username' in b) throw E.invalid('username không được đổi sau khi tạo', 'username');
  const changes = {};
  if ('full_name' in b) changes.fullName = requiredText(b.full_name, 'full_name', { max: 120 });
  if ('role' in b) changes.role = oneOf(b.role, ROLES, 'role');
  if ('center_id' in b) changes.centerId = centerId(b.center_id);
  if ('password' in b) changes.password = password(b.password);
  if ('is_active' in b) {
    if (typeof b.is_active !== 'boolean') throw E.invalid('is_active phải là true hoặc false', 'is_active');
    changes.isActive = b.is_active;
  }
  if (!Object.keys(changes).length)
    throw E.invalid('Cần ít nhất một trường để cập nhật: full_name, role, center_id, password, is_active', 'body');
  return changes;
}

/** GET /api/users?role=&center_id=&is_active=&page=&limit= */
function listQuery(query = {}) {
  let isActive = null;
  if (!isMissing(query.is_active)) isActive = oneOf(query.is_active, ['true', 'false'], 'is_active') === 'true';
  return {
    role: isMissing(query.role) ? null : oneOf(query.role, ROLES, 'role'),
    centerId: optionalPositiveInt(query.center_id, 'center_id'),
    isActive,
    ...pagination(query),
  };
}

module.exports = { ROLES, userId, createBody, updateBody, listQuery };
