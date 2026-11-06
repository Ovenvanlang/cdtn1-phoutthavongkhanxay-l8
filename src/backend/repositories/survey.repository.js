// Lớp repository: CHỈ chứa SQL (câu lệnh tham số hóa, không nối chuỗi từ dữ liệu người dùng).
// Form công khai: chỉ thông tin phiếu, KHÔNG có thông tin khách hàng.
const PUBLIC_SELECT = `
  SELECT s.response_id, s.ticket_id, t.ticket_code, t.center_id, sc.center_name, t.closed_at,
         s.status, s.sent_at, s.score, s.comment, s.responded_at
  FROM survey_response s
  JOIN ticket t          ON t.ticket_id  = s.ticket_id
  JOIN service_center sc ON sc.center_id = t.center_id`;

// Danh sách cho nhân viên: thêm kỹ thuật viên phụ trách và thông tin liên hệ khách (QT-15).
const STAFF_SELECT = `
  SELECT s.response_id, s.ticket_id, t.ticket_code, t.center_id, sc.center_name, t.closed_at,
         t.technician_id, tech.full_name AS technician_name,
         c.full_name AS customer_name, c.phone AS customer_phone,
         s.status, s.sent_at, s.score, s.comment, s.responded_at
  FROM survey_response s
  JOIN ticket t          ON t.ticket_id   = s.ticket_id
  JOIN service_center sc ON sc.center_id  = t.center_id
  JOIN customer c        ON c.customer_id = t.customer_id
  LEFT JOIN technician tech ON tech.technician_id = t.technician_id`;

function createSurveyRepository(db) {
  const insert = db.prepare(
    "INSERT INTO survey_response(ticket_id, status, sent_at) VALUES (?, 'DA_GUI', ?)");
  const publicByTicket = db.prepare(`${PUBLIC_SELECT} WHERE s.ticket_id = ? AND s.is_deleted = 0`);
  const rawByTicket = db.prepare(
    'SELECT response_id, status, is_deleted, access_token FROM survey_response WHERE ticket_id = ?');
  const ensureDate = db.prepare(
    'INSERT OR IGNORE INTO dim_date(date_id, day, month, quarter, year) VALUES (?, ?, ?, ?, ?)');
  const submit = db.prepare(
    `UPDATE survey_response
        SET status = 'DA_TRA_LOI', score = ?, comment = ?, responded_at = ?, responded_date = ?
      WHERE ticket_id = ? AND status = 'DA_GUI' AND is_deleted = 0`);
  const softDelete = db.prepare(
    'UPDATE survey_response SET is_deleted = 1 WHERE ticket_id = ? AND is_deleted = 0');

  const submitTx = db.transaction((ticketId, score, comment, respondedAt) => {
    const d = new Date(respondedAt);
    const dateId = respondedAt.slice(0, 10);
    const m = d.getUTCMonth() + 1;
    ensureDate.run(dateId, d.getUTCDate(), m, Math.ceil(m / 3), d.getUTCFullYear());
    return submit.run(score, comment, respondedAt, dateId, ticketId).changes;
  });

  return {
    insert: (ticketId, sentAt) => insert.run(ticketId, sentAt),
    findByTicketId: (ticketId) => publicByTicket.get(ticketId),
    findRawByTicketId: (ticketId) => rawByTicket.get(ticketId),
    /** @returns {number} số dòng được cập nhật (0 nếu không còn ở DA_GUI) */
    submitResponse: (ticketId, score, comment, respondedAt) => submitTx(ticketId, score, comment, respondedAt),
    softDelete: (ticketId) => softDelete.run(ticketId).changes,

    /** Danh sách cho nhân viên; các điều kiện lọc là mảnh SQL cố định, giá trị truyền qua tham số. */
    list({ status, centerId, scoreMax, limit, offset }) {
      const where = ['s.is_deleted = 0'];
      const params = [];
      if (status)           { where.push('s.status = ?');     params.push(status); }
      if (centerId != null) { where.push('t.center_id = ?');  params.push(centerId); }
      if (scoreMax != null) { where.push('s.score <= ?');     params.push(scoreMax); }
      const w = where.join(' AND ');
      const total = db.prepare(
        `SELECT COUNT(*) AS n FROM survey_response s JOIN ticket t ON t.ticket_id = s.ticket_id WHERE ${w}`
      ).get(...params).n;
      const rows = db.prepare(
        `${STAFF_SELECT} WHERE ${w} ORDER BY COALESCE(s.responded_at, s.sent_at) DESC LIMIT ? OFFSET ?`
      ).all(...params, limit, offset);
      return { rows, total };
    },
  };
}

module.exports = { createSurveyRepository };
