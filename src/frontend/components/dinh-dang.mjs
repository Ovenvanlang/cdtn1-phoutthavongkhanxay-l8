// Định dạng số và ngày theo thói quen Việt Nam (dấu phẩy thập phân, ngày dd/mm/yyyy).
const VN = 'vi-VN';

/** 82.5 -> "82,5%" ; null -> "—" (BS-02: không có phản hồi thì KHÔNG hiển thị 0%). */
export function phanTram(value, soLe = 1) {
  if (value == null) return '—';
  return `${value.toLocaleString(VN, { minimumFractionDigits: soLe, maximumFractionDigits: soLe })}%`;
}

/** Chênh lệch điểm phần trăm: 3.4 -> "▲ +3,4 điểm"; -2 -> "▼ −2,0 điểm"; 0 -> "= 0,0 điểm". */
export function chenhLech(value) {
  if (value == null) return '—';
  const so = Math.abs(value).toLocaleString(VN, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (value > 0) return `▲ +${so} điểm`;
  if (value < 0) return `▼ −${so} điểm`;
  return `= ${so} điểm`;
}

/** 4.21 -> "4,21" */
export function so(value, soLe = 2) {
  if (value == null) return '—';
  return value.toLocaleString(VN, { minimumFractionDigits: soLe, maximumFractionDigits: soLe });
}

/** 126 -> "126" (có dấu phân nhóm khi lớn) */
export function nguyen(value) {
  return value == null ? '—' : Number(value).toLocaleString(VN);
}

/** "2026-10-07T09:12:00Z" -> "07/10/2026" */
export function ngay(value) {
  if (!value) return '—';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return d ? `${d}/${m}/${y}` : String(value);
}

/** "2026-10-07T09:12:00Z" -> "07/10 09:12" */
export function ngayGio(value) {
  if (!value) return '—';
  const s = String(value);
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m} ${s.slice(11, 16)}`;
}
