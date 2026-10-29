// Lớp routes: quản lý tài khoản (CRUD app_user) – chỉ Ban giám đốc (TD-21).
// Thứ tự: phân quyền -> validators (định dạng) -> service (nghiệp vụ). Không chứa SQL.
const { Router } = require('express');
const { requireRole } = require('../middleware/access');
const v = require('../validators/user.validator');

function createUserRoutes(service) {
  const r = Router();
  r.use(requireRole('bgd'));

  r.get('/', (req, res) => res.json(service.list(v.listQuery(req.query))));                       // Read (danh sách)
  r.get('/:id', (req, res) => res.json({ data: service.get(v.userId(req.params.id)) }));         // Read (một)
  r.post('/', (req, res) => res.status(201).json({ data: service.create(v.createBody(req.body)) }));   // Create
  r.patch('/:id', (req, res) =>                                                                  // Update
    res.json({ data: service.update(req.user, v.userId(req.params.id), v.updateBody(req.body)) }));
  r.delete('/:id', (req, res) =>                                                                 // Delete mềm (QT-13)
    res.json({ data: service.deactivate(req.user, v.userId(req.params.id)) }));

  return r;
}

module.exports = { createUserRoutes };
