// BUG-007: quy thời điểm (lưu UTC) ra ngày theo giờ Việt Nam.
const { test } = require('node:test');
const assert = require('node:assert');
const { localDate, localDateParts } = require('../src/backend/utils/local-date');

test('00:30 ngày 01/11 giờ VN (17:30 UTC ngày 31/10) là ngày 2026-11-01, tháng 11, quý 4', () => {
  assert.deepStrictEqual(localDateParts('2026-10-31T17:30:00.000Z'),
    { date_id: '2026-11-01', day: 1, month: 11, quarter: 4, year: 2026 });
});

test('23:59 ngày 31/10 giờ VN (16:59 UTC) vẫn là 2026-10-31', () => {
  assert.strictEqual(localDate('2026-10-31T16:59:00.000Z'), '2026-10-31');
});

test('Giao thừa: 18:00 UTC ngày 31/12 đã là năm mới ở Việt Nam; múi giờ khác cho kết quả khác', () => {
  assert.strictEqual(localDate('2026-12-31T18:00:00.000Z'), '2027-01-01');
  assert.strictEqual(localDate('2026-12-31T18:00:00.000Z', 'UTC'), '2026-12-31');
});

test('Migration 006 sửa responded_date của dữ liệu cũ (ghi theo UTC) và giữ nguyên dòng nạp từ CSV giờ địa phương', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { openDb } = require('../src/backend/db/connection');
  const { migrate } = require('../src/backend/db/migrate');
  const db = openDb(':memory:');
  migrate(db);
  db.exec(`
    INSERT INTO dim_date VALUES ('2026-10-31',31,10,4,2026), ('2026-12-31',31,12,4,2026);
    INSERT INTO service_center(center_name, city) VALUES ('TTBH Quận 10','TP. Hồ Chí Minh');
    INSERT INTO customer(full_name, phone) VALUES ('Khach A','0912345678');
    INSERT INTO ticket(ticket_code, customer_id, center_id, status, closed_at) VALUES
      ('BH-000001/2026',1,1,'DA_DONG','2026-10-30T10:00:00Z'), ('BH-000002/2026',1,1,'DA_DONG','2026-10-30T10:00:00Z'),
      ('BH-000003/2026',1,1,'DA_DONG','2026-10-30T10:00:00Z');
    -- dữ liệu do bản cũ ghi: ngày cắt theo UTC (sai với 2 dòng đầu)
    INSERT INTO survey_response(ticket_id,status,sent_at,score,responded_at,responded_date) VALUES
      (1,'DA_TRA_LOI','x',5,'2026-10-31T17:30:00.000Z','2026-10-31'),
      (2,'DA_TRA_LOI','x',4,'2026-12-31T18:00:00.000Z','2026-12-31'),
      (3,'DA_TRA_LOI','x',3,'2026-10-31T23:30','2026-10-31');
  `);
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '006_responded_date_vn.sql'), 'utf8');
  db.exec(sql);
  db.exec(sql);                                                      // chạy lần 2 không đổi gì thêm
  const ngay = db.prepare('SELECT ticket_id, responded_date d FROM survey_response ORDER BY ticket_id').all().map((r) => r.d);
  assert.deepStrictEqual(ngay, ['2026-11-01', '2027-01-01', '2026-10-31']);
  assert.ok(db.prepare("SELECT 1 FROM dim_date WHERE date_id = '2027-01-01' AND quarter = 1").get());
  db.close();
});
