// Nạp DỮ LIỆU CASE STUDY từ bộ CSV của LMS (Smart CRM – Mekong Mobile, gen_dataset.py seed 20260901).
//   npm run import -- data/sample     (mẫu nhỏ trích từ bộ chính thức, đã commit – xem data/sample/README.md)
//   npm run import -- data/raw        (bộ đầy đủ tải từ LMS, KHÔNG commit)
// Tệp cần: service_centers.csv, tickets_history.csv; nên có: technicians.csv, survey_responses.csv;
// tùy chọn: customers.csv (customer_id, full_name, phone) nếu có bảng khách đã hợp nhất.
// Tên cột theo đúng bộ của case study (ho_ten, thanh_pho, is_active = true/false…), có nhận thêm vài tên thường gặp.
// Chạy lại nhiều lần được: dữ liệu nghiệp vụ cũ bị xóa trước khi nạp nên KHÔNG nhân đôi (tài khoản giữ nguyên).
const fs = require('node:fs');
const path = require('node:path');

const TICKET_STATUSES = ['MOI', 'DA_PHAN_CONG', 'DANG_XU_LY', 'CHO_LINH_KIEN', 'HOAN_TAT', 'DA_DONG', 'DA_HUY'];
const LEVELS = ['SO_CAP', 'TRUNG_CAP', 'CAO_CAP'];

/** Đọc CSV: hỗ trợ dấu nháy kép và dấu phẩy trong ô, không hỗ trợ xuống dòng trong ô. */
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

/** Giá trị đầu tiên có mặt theo danh sách tên cột (tên của case study đứng trước). */
function pick(row, ...keys) {
  for (const k of keys) if (row[k] !== undefined && row[k] !== '') return row[k];
  return null;
}

/** "true"/"1"/"x" -> true; "false"/"0" -> false; trống -> giá trị mặc định. */
function toBool(value, fallback = true) {
  if (value == null) return fallback;
  return !['false', '0', 'no', 'khong', 'không'].includes(String(value).trim().toLowerCase());
}

/** QT-02: chuẩn hóa về 10 số bắt đầu bằng 0 (bỏ +84/84, dấu cách, dấu chấm); không hợp lệ -> null. */
function normalizePhone(value) {
  if (!value) return null;
  let p = String(value).replace(/[\s.\-()]/g, '');
  if (p.startsWith('+84')) p = `0${p.slice(3)}`;
  else if (p.startsWith('84') && p.length === 11) p = `0${p.slice(2)}`;
  return /^0\d{9}$/.test(p) ? p : null;
}

/** "2026-02-06 21:01" -> "2026-02-06T21:01" (ISO, để so sánh chuỗi theo ngày). */
const toIsoDateTime = (v) => (v ? String(v).trim().replace(' ', 'T') : null);

/** Thêm đủ các ngày của các năm [fromYear, toYear] vào dim_date (bỏ qua ngày đã có). */
function fillDimDate(db, fromYear, toYear) {
  const ins = db.prepare('INSERT OR IGNORE INTO dim_date VALUES (?,?,?,?,?)');
  for (let d = new Date(Date.UTC(fromYear, 0, 1)); d.getUTCFullYear() <= toYear; d.setUTCDate(d.getUTCDate() + 1)) {
    const m = d.getUTCMonth() + 1;
    ins.run(d.toISOString().slice(0, 10), d.getUTCDate(), m, Math.ceil(m / 3), d.getUTCFullYear());
  }
}

function importCsv(db, dir) {
  const load = (name) => {
    const p = path.join(dir, name);
    return fs.existsSync(p) ? readCsv(p) : null;
  };
  const centers = load('service_centers.csv');
  const technicians = load('technicians.csv');
  const customers = load('customers.csv');
  const tickets = load('tickets_history.csv');
  const surveys = load('survey_responses.csv');
  if (!centers || !tickets) throw new Error(`Thiếu service_centers.csv hoặc tickets_history.csv trong ${dir}`);

  const count = { center: 0, technician: 0, customer: 0, placeholderCustomer: 0, ticket: 0, survey: 0 };
  const rejected = [];                                 // { file, line, reason } – lý do viết cho người đọc
  const notes = [];
  if (!customers && fs.existsSync(path.join(dir, 'customers_raw.csv'))) {
    notes.push('customers_raw.csv không có customer_id liên kết với tickets_history.csv (record_id riêng, ~20% trùng; '
      + 'hợp nhất khách thuộc luồng L1/L7) nên KHÔNG dùng; khách của phiếu được tạo tối thiểu, chưa có SĐT (TD-23).');
  }

  db.transaction(() => {
    for (const t of ['survey_response', 'ticket', 'technician', 'customer']) db.exec(`DELETE FROM ${t}`);
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('survey_response','ticket','technician','customer')");

    // Trung tâm: GHI ĐÈ theo center_id thay vì xóa, vì tài khoản quản lý (app_user) đang trỏ tới (QT-14).
    // Đổi tên tạm trước để không vướng UNIQUE(center_name) khi hai bộ dữ liệu đánh số khác nhau.
    db.exec("UPDATE service_center SET center_name = '__cu_' || center_id");
    const upsertCenter = db.prepare(`INSERT INTO service_center(center_id, center_name, city) VALUES (?,?,?)
      ON CONFLICT(center_id) DO UPDATE SET center_name = excluded.center_name, city = excluded.city`);
    for (const r of centers) {
      upsertCenter.run(Number(pick(r, 'center_id', 'id')), pick(r, 'center_name', 'name'), pick(r, 'thanh_pho', 'city') || 'Không rõ');
      count.center++;
    }
    db.exec(`DELETE FROM service_center WHERE substr(center_name, 1, 5) = '__cu_'
             AND center_id NOT IN (SELECT center_id FROM app_user WHERE center_id IS NOT NULL)`);
    const orphan = db.prepare("SELECT COUNT(*) n FROM service_center WHERE substr(center_name, 1, 5) = '__cu_'").get().n;
    if (orphan) notes.push(`${orphan} trung tâm cũ không có trong CSV nhưng còn tài khoản quản lý gắn vào – giữ lại, cần BGĐ đổi trung tâm cho tài khoản đó.`);

    const insTech = db.prepare('INSERT INTO technician(technician_id, center_id, full_name, level, is_active) VALUES (?,?,?,?,?)');
    (technicians || []).forEach((r, i) => {
      const name = pick(r, 'ho_ten', 'full_name', 'name');
      const level = String(pick(r, 'level', 'bac') || '').toUpperCase();
      if (!name) { rejected.push({ file: 'technicians.csv', line: i + 2, reason: 'thiếu họ tên kỹ thuật viên' }); return; }
      insTech.run(Number(pick(r, 'technician_id', 'id')), Number(pick(r, 'center_id')), name,
        LEVELS.includes(level) ? level : 'TRUNG_CAP', toBool(pick(r, 'is_active')) ? 1 : 0);
      count.technician++;
    });

    const insCust = db.prepare('INSERT INTO customer(customer_id, full_name, phone) VALUES (?,?,?)');
    const seenPhones = new Set();
    (customers || []).forEach((r, i) => {
      let phone = normalizePhone(pick(r, 'phone', 'so_dien_thoai'));
      if (phone && seenPhones.has(phone)) {                // QT-01: SĐT là duy nhất – bản ghi sau giữ khách, bỏ số trùng
        rejected.push({ file: 'customers.csv', line: i + 2, reason: `SĐT ${phone} trùng với khách khác, để trống SĐT` });
        phone = null;
      }
      if (phone) seenPhones.add(phone);
      insCust.run(Number(pick(r, 'customer_id', 'id')), pick(r, 'full_name', 'ho_ten', 'name') || 'Khách hàng', phone);
      count.customer++;
    });

    const knownCustomers = new Set(db.prepare('SELECT customer_id FROM customer').all().map((r) => r.customer_id));
    const insTicket = db.prepare(
      'INSERT INTO ticket(ticket_id, ticket_code, customer_id, center_id, technician_id, status, closed_at) VALUES (?,?,?,?,?,?,?)');
    tickets.forEach((r, i) => {
      const ticketId = Number(pick(r, 'ticket_id', 'id'));
      const customerId = Number(pick(r, 'customer_id'));
      const status = String(pick(r, 'status', 'trang_thai') || '').toUpperCase().replace(/[\s-]/g, '_');
      if (!TICKET_STATUSES.includes(status)) {
        rejected.push({ file: 'tickets_history.csv', line: i + 2, reason: `trạng thái "${status}" không thuộc vòng đời phiếu` });
        return;
      }
      if (!knownCustomers.has(customerId)) {           // giữ khóa ngoại: khách tối thiểu, chưa có SĐT
        insCust.run(customerId, `Khách hàng #${customerId}`, null);
        knownCustomers.add(customerId);
        count.placeholderCustomer++;
      }
      const technicianId = pick(r, 'technician_id');
      insTicket.run(ticketId, pick(r, 'ticket_code', 'code') || `BH-${String(ticketId).padStart(6, '0')}`,
        customerId, Number(pick(r, 'center_id')), technicianId ? Number(technicianId) : null,
        status, toIsoDateTime(pick(r, 'closed_at', 'closed_date')));
      count.ticket++;
    });

    if (surveys) {
      // dim_date phủ trọn các năm có phản hồi (khóa ngoại responded_date + trục thời gian liên tục cho UC5)
      const years = surveys.map((r) => Number(String(pick(r, 'responded_at', 'response_date') || '').slice(0, 4)))
        .filter((y) => y >= 2000 && y <= 2100);
      if (years.length) fillDimDate(db, Math.min(...years), Math.max(...years));
      const ticketStatus = new Map(db.prepare('SELECT ticket_id, status, closed_at FROM ticket').all()
        .map((t) => [t.ticket_id, t]));
      const insSurvey = db.prepare(
        `INSERT INTO survey_response(ticket_id, status, sent_at, score, comment, responded_at, responded_date)
         VALUES (?,?,?,?,?,?,?)`);
      const seenTickets = new Set();
      surveys.forEach((r, i) => {
        const line = i + 2;
        const ticketId = Number(pick(r, 'ticket_id'));
        const ticket = ticketStatus.get(ticketId);
        const score = Number(pick(r, 'score', 'diem', 'rating'));
        const respondedAt = toIsoDateTime(pick(r, 'responded_at', 'response_date'));
        let reason = null;
        if (!ticket) reason = `phiếu ${ticketId} không có trong tickets_history.csv`;
        else if (ticket.status !== 'DA_DONG') reason = `phiếu ${ticketId} chưa ĐÃ ĐÓNG (QT-10)`;
        else if (seenTickets.has(ticketId)) reason = `phiếu ${ticketId} đã có khảo sát (QT-10: mỗi phiếu một lần)`;
        else if (!Number.isInteger(score) || score < 1 || score > 5) reason = `điểm "${pick(r, 'score')}" ngoài thang 1–5`;
        else if (!respondedAt || Number.isNaN(new Date(respondedAt).getTime())) reason = 'không đọc được thời điểm trả lời';
        if (reason) { rejected.push({ file: 'survey_responses.csv', line, reason }); return; }
        seenTickets.add(ticketId);
        const sentAt = toIsoDateTime(pick(r, 'sent_at')) || ticket.closed_at || respondedAt;
        insSurvey.run(ticketId, 'DA_TRA_LOI', sentAt, score, pick(r, 'comment', 'nhan_xet') || null, respondedAt, respondedAt.slice(0, 10));
        count.survey++;
      });
    }

  })();

  return { count, rejected, notes };
}

module.exports = { importCsv, readCsv, normalizePhone, toBool, fillDimDate };

if (require.main === module) {
  const { openDb } = require('./connection');
  const { migrate } = require('./migrate');
  const { seedUsers } = require('../../../seeds/seed');
  const config = require('../config');
  const dir = process.argv[2] || 'data/sample';
  if (!fs.existsSync(dir)) {
    console.error(`Không thấy thư mục ${dir}. Dùng "npm run import -- data/sample" hoặc giải nén bộ CSV của LMS vào data/raw.`);
    process.exit(1);
  }
  const db = openDb(config.databaseFile);
  migrate(db);
  const { count, rejected, notes } = importCsv(db, path.resolve(dir));
  console.log(`Đã nạp từ ${dir}: ${count.center} trung tâm, ${count.technician} KTV, ${count.ticket} phiếu, `
    + `${count.survey} khảo sát, ${count.customer + count.placeholderCustomer} khách `
    + `(${count.placeholderCustomer} khách tối thiểu chưa có SĐT)`);
  for (const n of notes) console.log(`Ghi chú: ${n}`);
  if (rejected.length) {
    console.log(`Bỏ qua ${rejected.length} dòng không hợp lệ:`);
    for (const r of rejected.slice(0, 10)) console.log(`  - ${r.file} dòng ${r.line}: ${r.reason}`);
    if (rejected.length > 10) console.log(`  … và ${rejected.length - 10} dòng khác`);
  }
  const users = seedUsers(db, config.demoPassword);
  console.log(users.skipped ? 'Tài khoản demo: đã có, giữ nguyên.' : `Đã tạo tài khoản demo: ${users.accounts.join(', ')}`);
  db.close();
}
