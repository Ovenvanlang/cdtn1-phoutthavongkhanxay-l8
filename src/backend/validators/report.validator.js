// Validation dữ liệu vào cho API báo cáo (routes/reports.routes.js).
const E = require('../errors/AppError');
const { optionalPositiveInt, optionalIsoDate, isMissing, oneOf, pagination } = require('./common');

/** GET /api/reports/csat?center_id=&from=&to= */
function csatQuery(query = {}) {
  const from = optionalIsoDate(query.from, 'from');
  const to = optionalIsoDate(query.to, 'to');
  if (from && to && from > to) throw E.invalid('from phải nhỏ hơn hoặc bằng to', 'from');
  return { centerId: optionalPositiveInt(query.center_id, 'center_id'), from, to };
}

/** GET /api/reports/trend?granularity=month|quarter&year=&center_id= */
function trendQuery(query = {}) {
  const granularity = isMissing(query.granularity) ? 'month' : oneOf(query.granularity, ['month', 'quarter'], 'granularity');
  let year = null;
  if (!isMissing(query.year)) {
    year = Number(query.year);
    if (!/^\d{4}$/.test(String(query.year)) || year < 2000 || year > 2100)
      throw E.invalid('year phải là năm 4 chữ số từ 2000 đến 2100', 'year');
  }
  return { centerId: optionalPositiveInt(query.center_id, 'center_id'), granularity, year };
}

/** GET /api/reports/low-score?center_id=&page=&limit= */
function lowScoreQuery(query = {}) {
  return { centerId: optionalPositiveInt(query.center_id, 'center_id'), ...pagination(query) };
}

module.exports = { csatQuery, trendQuery, lowScoreQuery };
