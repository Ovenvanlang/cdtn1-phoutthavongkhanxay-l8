// Validation dữ liệu vào cho API khảo sát (routes/surveys.routes.js).
const E = require('../errors/AppError');
const { positiveInt, optionalPositiveInt, isMissing, oneOf, pagination, bodyObject } = require('./common');

const MAX_COMMENT = 500;              // FR-02, CHECK trong migration 001
const STATUSES = ['DA_GUI', 'DA_TRA_LOI'];

const ticketId = (value) => positiveInt(value, 'ticket_id');

/** Tên header mang mã truy cập khảo sát (BUG-006, BUG-010). */
const SURVEY_CODE_HEADER = 'X-Survey-Code';

/**
 * Mã truy cập khảo sát: 32 ký tự hex, gửi trong header X-Survey-Code.
 * KHÔNG nhận mã trong query string (?t=…): URL bị ghi vào log máy chủ/proxy và lịch sử trình duyệt (BUG-010).
 */
function accessToken(headerValue, queryValue) {
  if (!isMissing(queryValue))
    throw E.invalid(`Không gửi mã truy cập trong URL; dùng header ${SURVEY_CODE_HEADER}`, 't');
  if (isMissing(headerValue)) throw E.invalid(`Thiếu mã truy cập khảo sát (header ${SURVEY_CODE_HEADER})`, SURVEY_CODE_HEADER);
  if (typeof headerValue !== 'string' || !/^[0-9a-f]{32}$/.test(headerValue))
    throw E.invalid(`Mã truy cập khảo sát không hợp lệ (header ${SURVEY_CODE_HEADER})`, SURVEY_CODE_HEADER);
  return headerValue;
}

/** POST /api/surveys  { ticket_id } */
function createBody(body) {
  return { ticketId: ticketId(bodyObject(body).ticket_id) };
}

/** POST /api/surveys/:ticketId  { score: 1..5, comment?: string <= 500 } */
function submitBody(body) {
  const { score, comment } = bodyObject(body);
  if (!Number.isInteger(score) || score < 1 || score > 5)
    throw E.invalid('score là bắt buộc, phải là số nguyên từ 1 đến 5', 'score');
  if (isMissing(comment)) return { score, comment: null };
  if (typeof comment !== 'string') throw E.invalid('comment phải là chuỗi', 'comment');
  const text = comment.trim();
  if (text.length > MAX_COMMENT) throw E.invalid(`comment tối đa ${MAX_COMMENT} ký tự`, 'comment');
  return { score, comment: text || null };
}

/** GET /api/surveys?status=&center_id=&score_max=&page=&limit= */
function listQuery(query = {}) {
  const scoreMax = optionalPositiveInt(query.score_max, 'score_max');
  if (scoreMax != null && scoreMax > 5) throw E.invalid('score_max phải từ 1 đến 5', 'score_max');
  return {
    status: isMissing(query.status) ? null : oneOf(query.status, STATUSES, 'status'),
    centerId: optionalPositiveInt(query.center_id, 'center_id'),
    scoreMax,
    ...pagination(query),
  };
}

module.exports = { ticketId, accessToken, SURVEY_CODE_HEADER, createBody, submitBody, listQuery, MAX_COMMENT };
