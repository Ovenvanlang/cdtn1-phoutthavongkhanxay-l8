// Ngày/tháng/năm theo GIỜ VIỆT NAM (hoặc APP_TIMEZONE), không theo UTC (BUG-007).
// Phản hồi lúc 00:30 ngày 01/11 giờ VN là 17:30 ngày 31/10 UTC: nếu cắt chuỗi ISO thì bị tính nhầm
// sang ngày/tháng trước, làm lệch báo cáo theo khoảng ngày (UC3) và xu hướng theo tháng/quý (UC5).
const config = require('../config');

const formatters = new Map();
function formatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }));
  }
  return formatters.get(timeZone);
}

/** @returns {{date_id:string, day:number, month:number, quarter:number, year:number}} */
function localDateParts(when, timeZone = config.appTimezone) {
  const parts = Object.fromEntries(
    formatter(timeZone).formatToParts(new Date(when)).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return { date_id: `${parts.year}-${parts.month}-${parts.day}`, day, month, quarter: Math.ceil(month / 3), year };
}

/** 'YYYY-MM-DD' theo giờ địa phương của hệ thống. */
const localDate = (when, timeZone) => localDateParts(when, timeZone).date_id;

module.exports = { localDateParts, localDate };
