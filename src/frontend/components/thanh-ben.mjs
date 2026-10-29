// Thanh bên trái theo bản thiết kế: tên hệ thống, 4 mục chức năng, thông tin người đăng nhập.
import { getUser, logout } from '../api/client.mjs';
import { escapeHtml } from './DataState.mjs';

const TEN_VAI_TRO = {
  he_thong: 'Tác nhân hệ thống',
  quan_ly: 'Quản lý trung tâm',
  bgd: 'Ban giám đốc',
  marketing: 'Marketing',
};

const MUC = [
  { ma: 'tong-quan', ten: 'Tổng quan CSAT', href: 'bao-cao-csat.html#tong-quan', vaiTro: ['quan_ly', 'bgd', 'marketing'] },
  { ma: 'ky-thuat-vien', ten: 'Theo kỹ thuật viên', href: 'bao-cao-csat.html#ky-thuat-vien', vaiTro: ['quan_ly', 'bgd'] },
  { ma: 'xu-huong', ten: 'Xu hướng theo thời gian', href: 'xu-huong.html#xu-huong', vaiTro: ['quan_ly', 'bgd', 'marketing'] },
  { ma: 'diem-thap', ten: 'Phản hồi điểm thấp', href: 'xu-huong.html#diem-thap', vaiTro: ['quan_ly', 'bgd'] },
];

/** @param {{dangChon:string}} opts mã mục đang mở (tong-quan | ky-thuat-vien | xu-huong | diem-thap) */
export function renderThanhBen(el, { dangChon } = {}) {
  const user = getUser();
  const vaiTro = user?.role;
  const phamVi = vaiTro === 'quan_ly' ? 'Trung tâm phụ trách'
    : vaiTro === 'marketing' ? 'Số liệu tổng hợp' : 'Toàn công ty';
  // Như bản thiết kế: "QLTT – Trần Thị Trâm" cho quản lý, "Ban giám đốc" cho BGĐ
  const tenHienThi = !user ? 'Chưa đăng nhập'
    : vaiTro === 'bgd' ? TEN_VAI_TRO.bgd
    : vaiTro === 'quan_ly' ? `QLTT – ${user.full_name}`
    : `${TEN_VAI_TRO[vaiTro] || vaiTro} – ${user.full_name}`;

  el.className = 'thanh-ben';
  el.innerHTML = `
    <div class="thanh-ben__hieu">
      <strong>MEKONG MOBILE</strong>
      <span>Smart CRM · Khảo sát CSAT</span>
    </div>
    <ul class="thanh-ben__menu">
      ${MUC.filter((m) => !vaiTro || m.vaiTro.includes(vaiTro)).map((m) => `
        <li><a href="${m.href}" class="${m.ma === dangChon ? 'dang-chon' : ''}">${escapeHtml(m.ten)}</a></li>`).join('')}
    </ul>
    <div class="thanh-ben__chan">
      <strong>${escapeHtml(tenHienThi)}</strong>
      <span data-pham-vi>${escapeHtml(vaiTro ? phamVi : '')}</span>
      <button type="button" data-dang-xuat>Đăng xuất</button>
    </div>`;
  el.querySelector('[data-dang-xuat]').addEventListener('click', () => logout());
}

/** Ghi rõ phạm vi dữ liệu ở chân thanh bên khi đã biết tên trung tâm (ví dụ "Trung tâm TTBH Quận 10"). */
export function capNhatPhamVi(el, text) {
  const o = el.querySelector('[data-pham-vi]');
  if (o) o.textContent = text;
}
