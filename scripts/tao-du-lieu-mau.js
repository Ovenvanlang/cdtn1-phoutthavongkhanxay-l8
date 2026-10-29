// Trích MẪU NHỎ từ bộ CSV chính thức của case study (data/raw, tải từ LMS) vào data/sample để commit.
//   node scripts/tao-du-lieu-mau.js [thu-muc-nguon=data/raw] [thu-muc-dich=data/sample] [so-khao-sat=1200]
// Quy tắc chọn (tất định – chạy lại ra đúng các dòng như cũ):
//   - service_centers.csv, technicians.csv: lấy toàn bộ (6 và 38 dòng).
//   - survey_responses.csv: N phản hồi MỚI NHẤT theo responded_at (hòa thì theo response_id).
//   - tickets_history.csv : các phiếu của những phản hồi đó + 200 phiếu khác có ticket_id lớn nhất
//                           (gồm phiếu đang xử lý và phiếu đã đóng chưa khảo sát, để thử UC1).
// Các dòng được CHÉP NGUYÊN VĂN từ tệp gốc (không sửa giá trị) để giữ đúng định dạng của case study.
const fs = require('node:fs');
const path = require('node:path');
const { readCsv } = require('../src/backend/db/import-csv');

const [src = 'data/raw', dest = 'data/sample', nArg = '1200'] = process.argv.slice(2);
const N = Number(nArg);
const EXTRA_TICKETS = 200;

/** Trả về [dòng tiêu đề, ...các dòng dữ liệu] nguyên văn, cùng thứ tự với readCsv. */
const rawLines = (file) => fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');

function copyWhole(name) {
  fs.copyFileSync(path.join(src, name), path.join(dest, name));
  return rawLines(path.join(dest, name)).length - 1;
}

function copyRows(name, keep) {
  const file = path.join(src, name);
  const lines = rawLines(file);
  const rows = readCsv(file);
  const out = [lines[0]];
  rows.forEach((row, i) => { if (keep(row)) out.push(lines[i + 1]); });
  fs.writeFileSync(path.join(dest, name), `${out.join('\n')}\n`);
  return out.length - 1;
}

fs.mkdirSync(dest, { recursive: true });
const surveys = readCsv(path.join(src, 'survey_responses.csv'))
  .sort((a, b) => b.responded_at.localeCompare(a.responded_at) || Number(b.response_id) - Number(a.response_id))
  .slice(0, N);
const surveyIds = new Set(surveys.map((s) => s.response_id));
const ticketIds = new Set(surveys.map((s) => s.ticket_id));
readCsv(path.join(src, 'tickets_history.csv'))
  .filter((t) => !ticketIds.has(t.ticket_id))
  .sort((a, b) => Number(b.ticket_id) - Number(a.ticket_id))
  .slice(0, EXTRA_TICKETS)
  .forEach((t) => ticketIds.add(t.ticket_id));

console.log(`service_centers.csv  ${copyWhole('service_centers.csv')} dòng`);
console.log(`technicians.csv      ${copyWhole('technicians.csv')} dòng`);
console.log(`tickets_history.csv  ${copyRows('tickets_history.csv', (r) => ticketIds.has(r.ticket_id))} dòng`);
console.log(`survey_responses.csv ${copyRows('survey_responses.csv', (r) => surveyIds.has(r.response_id))} dòng`);
