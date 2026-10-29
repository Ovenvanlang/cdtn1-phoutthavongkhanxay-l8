// Test nhập CSV theo ĐÚNG tên cột của bộ dữ liệu case study (ho_ten, thanh_pho, is_active = true/false…).
// Tự dựng các tệp CSV nhỏ trong thư mục tạm nên không phụ thuộc dữ liệu trên máy.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDb } = require('../src/backend/db/connection');
const { migrate } = require('../src/backend/db/migrate');
const { importCsv, normalizePhone, toBool } = require('../src/backend/db/import-csv');

let dir;
before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csat-csv-'));
  const write = (name, lines) => fs.writeFileSync(path.join(dir, name), `${lines.join('\n')}\n`);
  write('service_centers.csv', ['center_id,center_code,center_name,thanh_pho',
    '1,TT01,TTBH Quận 10,TP. Hồ Chí Minh', '4,TT04,TTBH Ninh Kiều,Cần Thơ']);
  write('technicians.csv', ['technician_id,technician_code,ho_ten,center_id,level,is_active',
    '1,KT001,Phạm Minh Quyên,1,TRUNG_CAP,false', '2,KT002,Trần Hoài Giang,4,CAO_CAP,true']);
  write('tickets_history.csv', [
    'ticket_id,ticket_code,customer_id,serial_no,product_id,center_id,issue_desc,category_id,priority,status,technician_id,received_at,due_date,closed_at,is_warranty',
    '10,BH-000010/2026,501,SN1,21,1,"man hinh soc, khong len",1,CAO,DA_DONG,1,2026-03-01 09:00,2026-03-02 09:00,2026-03-03 10:00,true',
    '11,BH-000011/2026,502,SN2,21,4,pin chai,2,THAP,DA_DONG,2,2026-03-01 09:00,2026-03-06 09:00,2026-03-04 15:30,true',
    '12,BH-000012/2026,501,SN3,21,4,sac khong vao,3,TRUNG_BINH,DANG_XU_LY,2,2026-03-05 09:00,2026-03-08 09:00,,true',
    '13,BH-000013/2026,503,SN4,21,1,vao nuoc,5,CAO,DA_DONG,1,2026-03-06 09:00,2026-03-07 09:00,2026-03-07 08:00,true']);
  write('survey_responses.csv', ['response_id,ticket_id,score,comment,responded_at',
    '1,10,5,"Nhân viên nhiệt tình, sửa nhanh",2026-03-04 20:00',
    '2,11,2,,2026-03-06 08:15',
    '3,12,4,Tốt,2026-03-09 10:00',             // phiếu chưa đóng -> QT-10 từ chối
    '4,10,1,Khảo sát lần hai,2026-03-10 10:00', // trùng phiếu -> QT-10 từ chối
    '5,13,7,Điểm lạ,2026-03-10 10:00']);       // ngoài 1–5
  fs.writeFileSync(path.join(dir, 'customers_raw.csv'), 'record_id,ho_ten,so_dien_thoai\n1,A,0912345678\n');
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('Luồng đúng: đọc đúng cột của case study (ho_ten, thanh_pho, is_active=false) và nạp đủ dòng hợp lệ', () => {
  const db = openDb(':memory:');
  migrate(db);
  const { count } = importCsv(db, dir);
  assert.deepStrictEqual([count.center, count.technician, count.ticket, count.survey], [2, 2, 4, 2]);
  assert.strictEqual(db.prepare('SELECT city FROM service_center WHERE center_id = 4').get().city, 'Cần Thơ');
  const ktv1 = db.prepare('SELECT full_name, is_active FROM technician WHERE technician_id = 1').get();
  assert.deepStrictEqual({ ...ktv1 }, { full_name: 'Phạm Minh Quyên', is_active: 0 }, '"false" phải thành 0, không phải 1');
  assert.strictEqual(db.prepare('SELECT ticket_code FROM ticket WHERE ticket_id = 10').get().ticket_code, 'BH-000010/2026');
  assert.strictEqual(db.prepare('SELECT comment FROM survey_response WHERE ticket_id = 10').get().comment,
    'Nhân viên nhiệt tình, sửa nhanh', 'dấu phẩy trong ô có nháy kép');
  db.close();
});

test('Dữ liệu sai bị bỏ qua kèm lý do đọc được: phiếu chưa đóng, khảo sát lần hai, điểm ngoài 1–5', () => {
  const db = openDb(':memory:');
  migrate(db);
  const { rejected, notes } = importCsv(db, dir);
  const lyDo = rejected.map((r) => `${r.file}:${r.line} ${r.reason}`);
  assert.strictEqual(rejected.length, 3);
  assert.ok(lyDo.some((s) => /survey_responses\.csv:4 .*chưa ĐÃ ĐÓNG \(QT-10\)/.test(s)));
  assert.ok(lyDo.some((s) => /survey_responses\.csv:5 .*đã có khảo sát/.test(s)));
  assert.ok(lyDo.some((s) => /survey_responses\.csv:6 .*ngoài thang 1–5/.test(s)));
  assert.ok(notes.some((n) => /customers_raw\.csv/.test(n)), 'phải giải thích vì sao không dùng customers_raw.csv');
  assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM customer WHERE phone IS NULL').get().n, 3, 'khách tối thiểu chưa có SĐT');
  db.close();
});

test('Chạy lại lần 2 trên cùng CSDL: không lỗi, không nhân đôi, tài khoản quản lý gắn trung tâm vẫn giữ', () => {
  const db = openDb(':memory:');
  migrate(db);
  importCsv(db, dir);
  db.prepare("INSERT INTO app_user(username,password_hash,full_name,role,center_id) VALUES ('ql','x','QL','quan_ly',1)").run();
  importCsv(db, dir);
  const dem = (t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
  assert.deepStrictEqual([dem('service_center'), dem('technician'), dem('ticket'), dem('survey_response'), dem('app_user')], [2, 2, 4, 2, 1]);
  db.close();
});

test('QT-02 (biên): chuẩn hóa SĐT về 10 số bắt đầu bằng 0; sai độ dài -> null', () => {
  assert.strictEqual(normalizePhone('+84 912 345 678'), '0912345678');
  assert.strictEqual(normalizePhone('84912345678'), '0912345678');
  assert.strictEqual(normalizePhone('0912.345.678'), '0912345678');
  assert.strictEqual(normalizePhone('091234567'), null, '9 số là sai');
  assert.strictEqual(normalizePhone(''), null);
  assert.deepStrictEqual(['true', 'false', '1', '0', null].map((v) => toBool(v)), [true, false, true, false, true]);
});
