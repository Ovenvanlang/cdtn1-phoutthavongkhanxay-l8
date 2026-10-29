// Nạp DỮ LIỆU MẪU THẬT từ bộ CSV của LMS (case study Smart CRM – Mekong Mobile).
//   npm run import -- data/raw
// Thư mục data/raw cần có: service_centers.csv, technicians.csv, customers.csv (tùy chọn),
//                          tickets_history.csv, survey_responses.csv
// Tệp thiếu sẽ bị bỏ qua và báo rõ. Chạy lại nhiều lần được: dữ liệu cũ bị xóa trước khi nạp.
const fs = require('node:fs');
const path = require('node:path');

/** Đọc CSV đơn giản: hỗ trợ dấu nháy kép và dấu phẩy trong ô, không hỗ trợ xuống dòng trong ô. */
function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const split = (line) => {
    const out = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuote) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQuote = false;
        else cur += c;
      } else if (c === '"') inQuote = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };
  const header = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => Object.fromEntries(split(line).map((v, i) => [header[i], v])));
}

/** Lấy giá trị đầu tiên có trong hàng theo danh sách tên cột có thể gặp. */
const lay = (row, ...keys) => {
  for (const k of keys) if (row[k] !== undefined && row[k] !== '') return row[k];
  return null;
};
const ngay = (v) => (v ? String(v).replace(' ', 'T') : null);

function importCsv(db, dir) {
  const doc = (ten) => {
    const p = path.join(dir, ten);
    return fs.existsSync(p) ? readCsv(p) : null;
  };
  const centers = doc('service_centers.csv');
  const techs = doc('technicians.csv');
  const customers = doc('customers.csv');
  const tickets = doc('tickets_history.csv');
  const surveys = doc('survey_responses.csv');
  if (!centers || !tickets) {
    throw new Error(`Thiếu service_centers.csv hoặc tickets_history.csv trong ${dir}`);
  }

  const dem = { center: 0, technician: 0, customer: 0, ticket: 0, survey: 0, boQua: [] };

  db.transaction(() => {
    for (const t of ['survey_response', 'ticket', 'technician', 'customer', 'service_center']) db.exec(`DELETE FROM ${t}`);
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('survey_response','ticket','technician','customer','service_center')");

    const insCenter = db.prepare('INSERT INTO service_center(center_id, center_name, city) VALUES (?,?,?)');
    for (const r of centers) {
      insCenter.run(Number(lay(r, 'center_id', 'id')), lay(r, 'center_name', 'name'), lay(r, 'city') || 'Không rõ');
      dem.center++;
    }

    if (techs) {
      const insTech = db.prepare('INSERT INTO technician(technician_id, center_id, full_name, level, is_active) VALUES (?,?,?,?,?)');
      for (const r of techs) {
        const level = String(lay(r, 'level', 'bac') || 'TRUNG_CAP').toUpperCase();
        insTech.run(Number(lay(r, 'technician_id', 'id')), Number(lay(r, 'center_id')),
          lay(r, 'full_name', 'name'), ['SO_CAP', 'TRUNG_CAP', 'CAO_CAP'].includes(level) ? level : 'TRUNG_CAP',
          Number(lay(r, 'is_active') ?? 1) ? 1 : 0);
        dem.technician++;
      }
    }

    const insCust = db.prepare('INSERT INTO customer(customer_id, full_name, phone) VALUES (?,?,?)');
    if (customers) {
      for (const r of customers) {
        insCust.run(Number(lay(r, 'customer_id', 'id')), lay(r, 'full_name', 'name'), lay(r, 'phone'));
        dem.customer++;
      }
    }

    const coKhach = new Set(db.prepare('SELECT customer_id FROM customer').all().map((r) => r.customer_id));
    const insTicket = db.prepare(
      'INSERT INTO ticket(ticket_id, ticket_code, customer_id, center_id, technician_id, status, closed_at) VALUES (?,?,?,?,?,?,?)');
    for (const r of tickets) {
      const ticketId = Number(lay(r, 'ticket_id', 'id'));
      const customerId = Number(lay(r, 'customer_id'));
      if (!coKhach.has(customerId)) {       // không có customers.csv thì tạo khách tối thiểu để giữ khóa ngoại
        insCust.run(customerId, `Khách hàng ${customerId}`, `KH${String(customerId).padStart(8, '0')}`);
        coKhach.add(customerId);
        dem.customer++;
      }
      const status = String(lay(r, 'status', 'trang_thai') || '').toUpperCase().replace(/[\s-]/g, '_');
      try {
        insTicket.run(ticketId, lay(r, 'ticket_code', 'code') || `BH${String(ticketId).padStart(6, '0')}`,
          customerId, Number(lay(r, 'center_id')),
          lay(r, 'technician_id') ? Number(lay(r, 'technician_id')) : null,
          status, ngay(lay(r, 'closed_at', 'closed_date')));
        dem.ticket++;
      } catch (err) {
        dem.boQua.push(`ticket ${ticketId}: ${err.message}`);
      }
    }

    if (surveys) {
      const insDate = db.prepare('INSERT OR IGNORE INTO dim_date VALUES (?,?,?,?,?)');
      const insSurvey = db.prepare(
        `INSERT INTO survey_response(ticket_id, status, sent_at, score, comment, responded_at, responded_date)
         VALUES (?,?,?,?,?,?,?)`);
      for (const r of surveys) {
        const ticketId = Number(lay(r, 'ticket_id'));
        const scoreRaw = lay(r, 'score', 'rating', 'diem');
        const score = scoreRaw == null ? null : Number(scoreRaw);
        const respondedAt = ngay(lay(r, 'responded_at', 'response_date'));
        const sentAt = ngay(lay(r, 'sent_at', 'sent_date')) || respondedAt;
        const traLoi = score != null && respondedAt != null;
        try {
          const dateId = traLoi ? respondedAt.slice(0, 10) : null;
          if (dateId) {
            const d = new Date(`${dateId}T00:00:00Z`);
            const m = d.getUTCMonth() + 1;
            insDate.run(dateId, d.getUTCDate(), m, Math.ceil(m / 3), d.getUTCFullYear());
          }
          insSurvey.run(ticketId, traLoi ? 'DA_TRA_LOI' : 'DA_GUI', sentAt,
            traLoi ? score : null, lay(r, 'comment', 'feedback') || null, traLoi ? respondedAt : null, dateId);
          dem.survey++;
        } catch (err) {
          dem.boQua.push(`survey ticket ${ticketId}: ${err.message}`);
        }
      }
    }
  })();

  return dem;
}

module.exports = { importCsv, readCsv };

if (require.main === module) {
  const { openDb } = require('./connection');
  const { migrate } = require('./migrate');
  const { seedUsers } = require('../../../seeds/seed');
  const config = require('../config');
  const dir = process.argv[2] || 'data/raw';
  if (!fs.existsSync(dir)) {
    console.error(`Không thấy thư mục ${dir}. Hãy tải bộ CSV từ LMS và giải nén vào đó.`);
    process.exit(1);
  }
  const db = openDb(config.databaseFile);
  migrate(db);
  const dem = importCsv(db, path.resolve(dir));
  console.log(`Đã nạp từ ${dir}: ${dem.center} trung tâm, ${dem.technician} KTV, ${dem.customer} khách, ` +
              `${dem.ticket} phiếu, ${dem.survey} khảo sát`);
  if (dem.boQua.length) console.log(`Bỏ qua ${dem.boQua.length} dòng không hợp lệ, ví dụ: ${dem.boQua.slice(0, 3).join(' | ')}`);
  const users = seedUsers(db, config.demoPassword);
  console.log(users.skipped ? 'Tài khoản demo: đã có.' : `Đã tạo tài khoản demo: ${users.accounts.join(', ')}`);
  db.close();
}
