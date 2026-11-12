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

/** Khóa ký token phải đủ dài: khóa ngắn đoán/dò được thì ai cũng tự ký token BGĐ (bài 46a §3). */
const MIN_AUTH_SECRET_LENGTH = 32;
function authSecretProblem(secret) {
  if (!secret) return 'Thiếu AUTH_SECRET. Hãy chạy: cp .env.example .env   (rồi đổi giá trị AUTH_SECRET)';
  if (secret.length < MIN_AUTH_SECRET_LENGTH)
    return `AUTH_SECRET quá ngắn (${secret.length} ký tự, cần ít nhất ${MIN_AUTH_SECRET_LENGTH}). `
      + 'Sinh khóa mới: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';
  return null;
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  databaseFile: process.env.DATABASE_FILE || './data/khao-sat.db',

  // Khóa ký token đăng nhập. KHÔNG có giá trị mặc định: thiếu thì server từ chối chạy
  // (tránh việc vô tình phát hành token ký bằng khóa ai cũng biết).
  authSecret: process.env.AUTH_SECRET || null,
  // Token truy cập ngắn hạn (bài 46a §3: 15–60 phút); hết hạn thì giao diện tự đưa về trang đăng nhập.
  tokenTtlHours: Number(process.env.TOKEN_TTL_HOURS) || 1,

  // Múi giờ dùng để quy thời điểm trả lời ra NGÀY/THÁNG khi báo cáo (BUG-007).
  // Lưu trữ vẫn là ISO UTC; chỉ khi gán responded_date và tính "hôm nay" mới đổi sang giờ địa phương.
  appTimezone: checkTimezone(process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh'),

  // Mật khẩu của 4 tài khoản DEMO do seed tạo ra (chỉ dùng cho môi trường học tập).
  demoPassword: process.env.DEMO_PASSWORD || 'Demo@2026',

  authSecretProblem,
  MIN_AUTH_SECRET_LENGTH,
};
