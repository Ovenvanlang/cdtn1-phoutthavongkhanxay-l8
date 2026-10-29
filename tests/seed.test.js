// Test dữ liệu mẫu mô phỏng: TÁI LẬP (cùng seed -> cùng dữ liệu), chạy lại không nhân đôi, bám case study.
const { test } = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../src/backend/db/connection');
const { migrate } = require('../src/backend/db/migrate');
const { seed } = require('../seeds/seed');

function seeded() {
  const db = openDb(':memory:');
  migrate(db);
  seed(db);
  return db;
}
const all = (db, sql) => db.prepare(sql).all().map((r) => ({ ...r }));

test('Tái lập: hai lần sinh với seed = 42 cho ra đúng cùng phiếu và phản hồi', () => {
  const a = seeded();
  const b = seeded();
  const sql = 'SELECT t.ticket_code, t.status, t.closed_at, s.score, s.comment, s.responded_at FROM ticket t LEFT JOIN survey_response s USING(ticket_id) ORDER BY t.ticket_id';
  assert.deepStrictEqual(all(a, sql), all(b, sql));
  a.close(); b.close();
});

test('Chạy lại khi đã có dữ liệu: bỏ qua, không nhân đôi', () => {
  const db = seeded();
  const before = db.prepare('SELECT COUNT(*) n FROM ticket').get().n;
  assert.deepStrictEqual(seed(db), { skipped: true });
  assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM ticket').get().n, before);
  db.close();
});

test('Bám case study: 6 trung tâm đúng tên, 38 KTV, mã phiếu BH-000123/2026, khảo sát chỉ cho phiếu ĐÃ ĐÓNG', () => {
  const db = seeded();
  assert.deepStrictEqual(all(db, 'SELECT center_name FROM service_center ORDER BY center_id').map((r) => r.center_name),
    ['TTBH Quận 10', 'TTBH Quận Tân Bình', 'TTBH TP. Thủ Đức', 'TTBH Ninh Kiều', 'TTBH Cái Răng', 'TTBH Cầu Giấy']);
  assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM technician').get().n, 38);
  assert.ok(all(db, 'SELECT ticket_code FROM ticket').every((r) => /^BH-\d{6}\/\d{4}$/.test(r.ticket_code)));
  assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM survey_response s JOIN ticket t USING(ticket_id) WHERE t.status <> 'DA_DONG'").get().n, 0, 'QT-10');
  const csat = db.prepare("SELECT 100.0 * SUM(score >= 4) / COUNT(*) p FROM survey_response WHERE status = 'DA_TRA_LOI'").get().p;
  assert.ok(csat > 60 && csat < 80, `CSAT mô phỏng ${csat.toFixed(1)}% phải gần mức ~70% của bộ dữ liệu chính thức`);
  const lech = db.prepare(`SELECT COUNT(*) n FROM survey_response WHERE (score >= 4 AND comment IN ('Sửa xong vẫn bị lỗi cũ','Trễ hẹn cả tuần không ai báo'))
                           OR (score <= 2 AND comment = 'Dịch vụ tốt sẽ quay lại')`).get().n;
  assert.strictEqual(lech, 0, 'nhận xét phải khớp với điểm');
  db.close();
});
