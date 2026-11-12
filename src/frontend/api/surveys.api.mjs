// API khảo sát (ứng với routes/surveys.routes.js).
import { request } from './client.mjs';

/** Mã truy cập đi trong header, KHÔNG trong URL (BUG-010). */
const maTruyCap = (accessToken) => ({ 'X-Survey-Code': accessToken });

/** UC2 – khách mở form bằng đường dẫn trong tin nhắn: không đăng nhập nhưng phải có mã truy cập. */
export async function getByTicket(ticketId, accessToken) {
  const res = await request(`/api/surveys/${encodeURIComponent(ticketId)}`, { auth: false, headers: maTruyCap(accessToken) });
  return res.data;
}

/** UC2 – khách gửi điểm 1–5 và nhận xét. */
export async function submit(ticketId, accessToken, { score, comment }) {
  const res = await request(`/api/surveys/${encodeURIComponent(ticketId)}`, {
    method: 'POST',
    auth: false,
    headers: maTruyCap(accessToken),
    body: { score, comment: comment || undefined },
  });
  return res.data;
}

/** UC1 – hệ thống tạo khảo sát cho phiếu ĐÃ ĐÓNG (cần tài khoản vai trò he_thong). */
export async function create(ticketId) {
  const res = await request('/api/surveys', { method: 'POST', body: { ticket_id: Number(ticketId) } });
  return res.data;
}

/** Danh sách khảo sát cho nhân viên (QT-14 áp dụng ở máy chủ). */
export async function list(filters = {}) {
  return request('/api/surveys', { query: filters });
}
