// Lớp routes: nhận/trả HTTP. Thứ tự: phân quyền -> validators (định dạng) -> service (nghiệp vụ).
// Không chứa quy tắc nghiệp vụ hay SQL.
const { Router } = require('express');
const { requireRole } = require('../middleware/access');
const v = require('../validators/survey.validator');

function createSurveyRoutes(service) {
  const r = Router();

  // Create (UC1) – chỉ tác nhân hệ thống kích hoạt khi phiếu ĐÃ ĐÓNG
  r.post('/', requireRole('he_thong'), (req, res) => {
    res.status(201).json({ data: service.create(v.createBody(req.body)) });
  });

  // Read danh sách – quản lý (theo trung tâm) và ban giám đốc
  r.get('/', requireRole('quan_ly', 'bgd'), (req, res) => {
    res.json(service.list(req.user, v.listQuery(req.query)));
  });

  // Read một khảo sát – khách mở liên kết (công khai, không lộ thông tin khách)
  r.get('/:ticketId', (req, res) => {
    res.json({ data: service.getByTicket(v.ticketId(req.params.ticketId)) });
  });

  // Update (UC2) – khách gửi phản hồi { score, comment }
  r.post('/:ticketId', (req, res) => {
    res.json({ data: service.submit(v.ticketId(req.params.ticketId), v.submitBody(req.body)) });
  });

  // Delete mềm (QT-13)
  r.delete('/:ticketId', requireRole('quan_ly', 'bgd'), (req, res) => {
    res.json({ data: service.remove(req.user, v.ticketId(req.params.ticketId)) });
  });

  return r;
}

module.exports = { createSurveyRoutes };
