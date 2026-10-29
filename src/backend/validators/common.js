// Tầng validation 1 (bài 60 §7): kiểm tra ĐỊNH DẠNG & KIỂU của dữ liệu vào, chạy TRƯỚC service.
// Mỗi hàm trả giá trị đã chuẩn hóa hoặc ném lỗi DU_LIEU_KHONG_HOP_LE kèm tên trường.
// Quy tắc nghiệp vụ (cần tra dữ liệu: QT-10, QT-14…) KHÔNG nằm ở đây mà ở services/.
const E = require('../errors/AppError');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAGE_SIZE = 100;

const isMissing = (value) => value === undefined || value === null || value === '';

/** "12" hoặc 12 -> 12; còn lại (0, -1, 2.5, "abc", true) -> lỗi. */
function positiveInt(value, field) {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(n) || n <= 0) throw E.invalid(`${field} phải là số nguyên dương`, field);
  return n;
}

const optionalPositiveInt = (value, field) => (isMissing(value) ? null : positiveInt(value, field));

/** Ngày dạng YYYY-MM-DD và có thật trên lịch (2026-02-30 bị từ chối). */
function isoDate(value, field) {
  const s = String(value);
  const d = new Date(`${s}T00:00:00Z`);
  if (!DATE_RE.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s)
    throw E.invalid(`${field} phải là ngày hợp lệ dạng YYYY-MM-DD`, field);
  return s;
}

const optionalIsoDate = (value, field) => (isMissing(value) ? null : isoDate(value, field));

function oneOf(value, allowed, field) {
  if (!allowed.includes(value)) throw E.invalid(`${field} phải là một trong: ${allowed.join(', ')}`, field);
  return value;
}

/** Chuỗi bắt buộc, cắt khoảng trắng hai đầu, giới hạn độ dài. */
function requiredText(value, field, { min = 1, max }) {
  if (typeof value !== 'string') throw E.invalid(`${field} là bắt buộc và phải là chuỗi`, field);
  const s = value.trim();
  if (s.length < min) throw E.invalid(`${field} cần ít nhất ${min} ký tự`, field);
  if (max && s.length > max) throw E.invalid(`${field} tối đa ${max} ký tự`, field);
  return s;
}

/** Phân trang: page >= 1, 1 <= limit <= 100 (mặc định 20). */
function pagination(query = {}) {
  const page = isMissing(query.page) ? 1 : positiveInt(query.page, 'page');
  const limit = isMissing(query.limit) ? 20 : positiveInt(query.limit, 'limit');
  if (limit > MAX_PAGE_SIZE) throw E.invalid(`limit tối đa ${MAX_PAGE_SIZE}`, 'limit');
  return { page, limit };
}

/** Thân yêu cầu phải là object JSON (không phải mảng, chuỗi, null). */
function bodyObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw E.invalid('Nội dung gửi lên phải là một đối tượng JSON', 'body');
  return body;
}

module.exports = {
  isMissing, positiveInt, optionalPositiveInt, isoDate, optionalIsoDate, oneOf, requiredText, pagination, bodyObject,
};
