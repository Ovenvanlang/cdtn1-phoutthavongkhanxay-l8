// Lớp routes cho báo cáo CSAT (UC3–UC6) và danh sách trung tâm. Nhận/trả HTTP, gọi service.
const { Router } = require('express');
const { requireRole } = require('../middleware/access');
const v = require('../validators/report.validator');

function createReportRoutes(service) {
  const r = Router();

  // UC3 + UC4: CSAT theo trung tâm và theo kỹ thuật viên (Marketing chỉ nhận số tổng hợp – BS-05)
  r.get('/csat', requireRole('quan_ly', 'bgd', 'marketing'), (req, res) =>
    res.json(service.csat(req.user, v.csatQuery(req.query))));

  // UC5: xu hướng theo tháng/quý
  r.get('/trend', requireRole('quan_ly', 'bgd', 'marketing'), (req, res) =>
    res.json(service.trend(req.user, v.trendQuery(req.query))));

  // UC6: danh sách phản hồi điểm thấp (<= 2)
  r.get('/low-score', requireRole('quan_ly', 'bgd'), (req, res) =>
    res.json(service.lowScore(req.user, v.lowScoreQuery(req.query))));

  return r;
}

/** GET /api/centers – danh sách trung tâm cho bộ lọc trên giao diện. */
function createCenterRoutes(service) {
  const r = Router();
  r.get('/', requireRole('quan_ly', 'bgd', 'marketing'), (req, res) => res.json(service.listCenters(req.user)));
  return r;
}

module.exports = { createReportRoutes, createCenterRoutes };
