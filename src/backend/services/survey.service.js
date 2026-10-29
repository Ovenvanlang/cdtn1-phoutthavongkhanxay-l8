// Lớp service: quy tắc nghiệp vụ của khảo sát (QT-10, QT-13, QT-14, BS-03).
// Không chứa SQL, không biết gì về HTTP. Dữ liệu vào ĐÃ được validators/survey.validator.js
// kiểm định dạng; ở đây chỉ còn các điều kiện phải tra dữ liệu mới biết (tầng validation 2).
const E = require('../errors/AppError');

const LOW_SCORE = 2; // BS-03

function createSurveyService({ surveyRepo, ticketRepo, now = () => new Date() }) {
  function present(row) {
    return { ...row, low_score: row.score != null && row.score <= LOW_SCORE };
  }

  return {
    /** UC1 – tạo khảo sát cho phiếu ĐÃ ĐÓNG (do tác nhân hệ thống kích hoạt – TD-25). */
    create({ ticketId }) {
      const ticket = ticketRepo.findById(ticketId);
      if (!ticket) throw E.notFound('Không có phiếu bảo hành này');
      if (ticket.status !== 'DA_DONG') throw E.ticketNotClosed();            // QT-10
      if (surveyRepo.findRawByTicketId(ticketId)) throw E.alreadySurveyed(); // QT-10
      try {
        surveyRepo.insert(ticketId, now().toISOString());
      } catch (err) {                                    // hai yêu cầu đồng thời: UNIQUE(ticket_id) chặn
        if (/constraint failed/i.test(err.message)) throw E.alreadySurveyed();
        throw err;
      }
      return present(surveyRepo.findByTicketId(ticketId));
    },

    /** Xem form khảo sát của một phiếu (khách mở liên kết). Không lộ thông tin khách. */
    getByTicket(ticketId) {
      const row = surveyRepo.findByTicketId(ticketId);
      if (!row) throw E.notFound('Khảo sát không khả dụng');
      return present(row);
    },

    /** UC2 – khách gửi điểm 1–5 và nhận xét. */
    submit(ticketId, { score, comment }) {
      const raw = surveyRepo.findRawByTicketId(ticketId);
      if (!raw || raw.is_deleted) throw E.notFound('Khảo sát không khả dụng');
      if (raw.status === 'DA_TRA_LOI') throw E.alreadySurveyed();           // QT-10
      const changed = surveyRepo.submitResponse(ticketId, score, comment, now().toISOString());
      if (changed !== 1) throw E.alreadySurveyed();                          // thua cuộc đua gửi đồng thời
      return present(surveyRepo.findByTicketId(ticketId));
    },

    /** Danh sách cho nhân viên – phạm vi theo QT-14. */
    list(user, { status = null, centerId = null, scoreMax = null, page = 1, limit = 20 } = {}) {
      let scope = centerId;
      if (user.role === 'quan_ly') {
        if (!user.centerId) throw E.forbidden('Quản lý phải thuộc một trung tâm');
        if (centerId != null && centerId !== user.centerId) throw E.forbidden('Không được xem dữ liệu trung tâm khác (QT-14)');
        scope = user.centerId;
      }
      const { rows, total } = surveyRepo.list({ status, centerId: scope, scoreMax, limit, offset: (page - 1) * limit });
      return { data: rows.map(present), meta: { page, limit, total } };
    },

    /** Xóa MỀM (QT-13): không xóa vật lý, giữ nguyên lịch sử. */
    remove(user, ticketId) {
      const ticket = ticketRepo.findById(ticketId);
      if (!ticket) throw E.notFound('Không có phiếu bảo hành này');
      if (user.role === 'quan_ly' && ticket.center_id !== user.centerId) throw E.forbidden('Không được thao tác trung tâm khác (QT-14)');
      if (surveyRepo.softDelete(ticketId) !== 1) throw E.notFound('Khảo sát không khả dụng');
      return { ticket_id: ticketId, deleted: true };
    },
  };
}

module.exports = { createSurveyService, LOW_SCORE };
