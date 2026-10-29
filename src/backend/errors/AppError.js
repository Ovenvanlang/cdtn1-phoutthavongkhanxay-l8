// Lỗi nghiệp vụ của ứng dụng: chỉ mang MÃ ổn định + thông điệp (+ tên trường nếu do dữ liệu vào sai).
// KHÔNG mang mã HTTP: services ném AppError, còn việc quy mã lỗi ra mã HTTP là của lớp HTTP
// (middleware/error-handler.js). Nhờ vậy cùng một quy tắc dùng được cho API, script và test (bài 61 A1).
class AppError extends Error {
  /**
   * @param {string} code mã lỗi ổn định, frontend/test dựa vào mã chứ không dựa vào câu chữ
   * @param {string} [message] thông điệp cho người đọc
   * @param {{field?: string}} [extra] tên trường bị sai (lỗi dữ liệu vào)
   */
  constructor(code, message, { field } = {}) {
    super(message || code);
    this.name = 'AppError';
    this.code = code;
    if (field) this.field = field;
  }
}

module.exports = {
  AppError,

  // Dữ liệu vào sai (validators/) – luôn kèm tên trường
  invalid: (message, field) => new AppError('DU_LIEU_KHONG_HOP_LE', message, { field }),

  // Phân quyền (QT-14, BS-05) và đăng nhập (TD-14)
  forbidden: (message) => new AppError('KHONG_DU_QUYEN', message),
  unauthenticated: () => new AppError('CHUA_DANG_NHAP', 'Cần đăng nhập để dùng chức năng này'),
  invalidToken: () => new AppError('TOKEN_KHONG_HOP_LE', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn'),
  badCredentials: () => new AppError('SAI_TAI_KHOAN_HOAC_MAT_KHAU', 'Tên đăng nhập hoặc mật khẩu không đúng'),

  notFound: (message) => new AppError('KHONG_TIM_THAY', message),

  // Khảo sát (QT-10)
  ticketNotClosed: () => new AppError('PHIEU_CHUA_DONG', 'Chỉ khảo sát phiếu ở trạng thái ĐÃ ĐÓNG (QT-10)'),
  alreadySurveyed: () => new AppError('DA_KHAO_SAT', 'Mỗi phiếu chỉ khảo sát một lần (QT-10)'),

  // Tài khoản (TD-21)
  usernameTaken: () => new AppError('TEN_DANG_NHAP_DA_TON_TAI', 'Tên đăng nhập đã được dùng'),
  selfAction: (message) => new AppError('KHONG_TU_THAO_TAC', message),
  lastDirector: () => new AppError('PHAI_CON_MOT_BGD', 'Hệ thống phải còn ít nhất một tài khoản Ban giám đốc đang hoạt động'),
};
