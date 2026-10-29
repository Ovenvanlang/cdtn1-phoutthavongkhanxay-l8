// Test lớp service độc lập với HTTP: kiểm chứng tình huống đua (race) của QT-10 / NFR4.
// Service chỉ ném lỗi có MÃ nghiệp vụ (DA_KHAO_SAT); mã HTTP 409 do middleware/error-handler.js quy đổi.
const { test } = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../src/backend/db/connection');
const { migrate } = require('../src/backend/db/migrate');
const { createSurveyRepository } = require('../src/backend/repositories/survey.repository');
const { createTicketRepository } = require('../src/backend/repositories/ticket.repository');
const { createSurveyService } = require('../src/backend/services/survey.service');

function setup() {
  const db = openDb(':memory:');
  migrate(db);
  db.exec(`
    INSERT INTO service_center(center_name, city) VALUES ('TTBH Quận 10','TP. Hồ Chí Minh');
    INSERT INTO customer(full_name, phone) VALUES ('Khach A','0912345678');
    INSERT INTO ticket(ticket_code, customer_id, center_id, status, closed_at)
      VALUES ('BH-000001/2026',1,1,'DA_DONG','2026-10-09T10:00:00Z');
  `);
  return db;
}

test('Đua tạo khảo sát: kiểm tra ở service bị vượt qua nhưng UNIQUE ở CSDL vẫn chặn -> 409 DA_KHAO_SAT', () => {
  const db = setup();
  const realRepo = createSurveyRepository(db);
  const ticketRepo = createTicketRepository(db);
  // Mô phỏng yêu cầu thứ hai: lúc kiểm tra thì CHƯA thấy khảo sát (yêu cầu thứ nhất chưa kịp ghi)...
  const service = createSurveyService({ surveyRepo: { ...realRepo, findRawByTicketId: () => undefined }, ticketRepo });
  realRepo.insert(1, '2026-10-10T00:00:00.000Z');                  // ...nhưng yêu cầu thứ nhất đã ghi xong
  assert.throws(() => service.create({ ticketId: 1 }), (err) => err.code === 'DA_KHAO_SAT');
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM survey_response WHERE ticket_id = 1').get().n, 1);
  db.close();
});

test('Đua gửi phản hồi: yêu cầu đến sau khi dòng đã chuyển DA_TRA_LOI -> 409 và điểm đầu tiên được giữ', () => {
  const db = setup();
  const realRepo = createSurveyRepository(db);
  const ticketRepo = createTicketRepository(db);
  realRepo.insert(1, '2026-10-10T00:00:00.000Z');
  // Mô phỏng: lúc service kiểm tra thì khảo sát còn DA_GUI, nhưng ngay sau đó có yêu cầu khác trả lời trước
  const racing = { ...realRepo, findRawByTicketId: (id) => { const row = realRepo.findRawByTicketId(id);
    realRepo.submitResponse(id, 5, 'Nhanh tay hơn', '2026-10-10T01:00:00.000Z'); return row; } };
  const service = createSurveyService({ surveyRepo: racing, ticketRepo });
  assert.throws(() => service.submit(1, { score: 1, comment: null }), (err) => err.code === 'DA_KHAO_SAT');
  assert.strictEqual(db.prepare('SELECT score FROM survey_response WHERE ticket_id = 1').get().score, 5);
  db.close();
});
