// Lớp gọi API duy nhất của giao diện. Các trang (pages/) KHÔNG được gọi fetch() trực tiếp:
// mọi yêu cầu đi qua đây để xử lý token, lỗi 401 và lỗi mất kết nối ở MỘT chỗ.
export const DANG_NHAP_URL = 'dang-nhap.html';

const TOKEN_KEY = 'csat.token';
const USER_KEY = 'csat.user';

export class ApiError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** localStorage có thể bị chặn (chế độ riêng tư) nên mọi truy cập đều bọc try/catch. */
function store() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function getToken() {
  try {
    return store()?.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function getUser() {
  try {
    return JSON.parse(store()?.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveSession({ token, user }) {
  try {
    store()?.setItem(TOKEN_KEY, token);
    store()?.setItem(USER_KEY, JSON.stringify(user || null));
  } catch {
    /* không lưu được thì phiên chỉ tồn tại trong trang hiện tại */
  }
}

export function clearSession() {
  try {
    store()?.removeItem(TOKEN_KEY);
    store()?.removeItem(USER_KEY);
  } catch {
    /* bỏ qua */
  }
}

/** Hết phiên: xóa token rồi quay về trang đăng nhập (không lặp nếu đang ở chính trang đó). */
function veTrangDangNhap() {
  clearSession();
  const loc = globalThis.location;
  if (!loc || typeof loc.replace !== 'function') return;
  if (String(loc.pathname || '').endsWith(DANG_NHAP_URL)) return;
  loc.replace(`${DANG_NHAP_URL}?ly_do=het_phien`);
}

function buildUrl(path, query) {
  const origin = globalThis.location ? globalThis.location.origin : 'http://localhost';
  const url = new URL(path, origin);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Gọi API. Luôn trả về phần thân JSON hoặc ném ApiError có mã lỗi ổn định.
 * @param {{method?:string, body?:object, query?:object, auth?:boolean, headers?:object}} options
 */
export async function request(path, { method = 'GET', body, query, auth = true, headers: extra = {} } = {}) {
  const headers = { ...extra };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('KHONG_KET_NOI_DUOC',
      'Không kết nối được tới máy chủ. Hãy kiểm tra server đã chạy (npm start) rồi bấm "Thử lại".');
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (res.status === 401) {
    if (auth) veTrangDangNhap();                       // token sai/hết hạn -> xóa token, về đăng nhập
    throw new ApiError(payload?.error || 'CHUA_DANG_NHAP', payload?.message || 'Phiên đăng nhập đã hết hạn', 401);
  }
  if (!res.ok) {
    throw new ApiError(payload?.error || 'LOI_HE_THONG',
      payload?.message || `Máy chủ trả về lỗi ${res.status}`, res.status);
  }
  return payload;
}

/** Bắt buộc có token mới xem được trang quản trị; chưa có thì về đăng nhập ngay. */
export function requireLogin() {
  if (getToken()) return getUser();
  veTrangDangNhap();
  return null;
}

export function logout() {
  clearSession();
  globalThis.location?.replace(DANG_NHAP_URL);
}
