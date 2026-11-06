// Cấu hình đọc từ biến môi trường (.env). Không ghi mật khẩu/khóa vào mã nguồn.
require('dotenv').config({ quiet: true });

/** Sai tên múi giờ thì dừng ngay khi khởi động, không để báo cáo lệch ngày một cách âm thầm. */
function checkTimezone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
  } catch {
    throw new Error(`APP_TIMEZONE không hợp lệ: "${timeZone}" (ví dụ đúng: Asia/Ho_Chi_Minh)`);
  }
  return timeZone;
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  databaseFile: process.env.DATABASE_FILE || './data/khao-sat.db',

  // Khóa ký token đăng nhập. KHÔNG có giá trị mặc định: thiếu thì server từ chối chạy
  // (tránh việc vô tình phát hành token ký bằng khóa ai cũng biết).
  authSecret: process.env.AUTH_SECRET || null,
  tokenTtlHours: Number(process.env.TOKEN_TTL_HOURS) || 8,

  // Múi giờ dùng để quy thời điểm trả lời ra NGÀY/THÁNG khi báo cáo (BUG-007).
  // Lưu trữ vẫn là ISO UTC; chỉ khi gán responded_date và tính "hôm nay" mới đổi sang giờ địa phương.
  appTimezone: checkTimezone(process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh'),

  // Mật khẩu của 4 tài khoản DEMO do seed tạo ra (chỉ dùng cho môi trường học tập).
  demoPassword: process.env.DEMO_PASSWORD || 'Demo@2026',
};
