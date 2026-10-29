// Màn hình 2 – Báo cáo CSAT (UC3) và bảng theo kỹ thuật viên (UC4), theo bản thiết kế wireframe.
// Mọi lệnh gọi máy chủ đi qua lớp api/ (trang này KHÔNG dùng fetch).
import * as reportsApi from '../api/reports.api.mjs';
import { requireLogin, getUser } from '../api/client.mjs';
import { createDataState, load, escapeHtml } from '../components/DataState.mjs';
import { renderThanhBen, capNhatPhamVi } from '../components/thanh-ben.mjs';
import { veCotPhanBo } from '../components/bieu-do.mjs';
import { phanTram, so, nguyen } from '../components/dinh-dang.mjs';

requireLogin();                                   // chưa có token -> client.mjs tự chuyển về đăng nhập
const vaiTro = getUser()?.role;
const dangChon = location.hash === '#ky-thuat-vien' ? 'ky-thuat-vien' : 'tong-quan';
renderThanhBen(document.getElementById('thanh-ben'), { dangChon });

const dsTongQuan = createDataState(document.getElementById('tong-quan'));
const dsPhanBo = createDataState(document.getElementById('vung-phan-bo'));
const dsKtv = createDataState(document.getElementById('vung-ktv'), { emptyText: 'Chưa có phản hồi nào gắn với kỹ thuật viên' });
const form = document.getElementById('form-loc');
const oTrungTam = document.getElementById('center');
const oPhamVi = document.getElementById('pham-vi');

const NHAN_CANH_BAO = {
  CHUA_CO_PHAN_HOI: 'Chưa có phản hồi trong khoảng đã chọn – không quy ra phần trăm (BS-02).',
  MAU_CHUA_DU_TIN_CAY: 'Dưới 5 phản hồi: mẫu chưa đủ tin cậy – nên chọn khoảng thời gian dài hơn (BS-02).',
};

let bieuDo = null;

function veTongQuan(d) {
  oPhamVi.textContent = d.filters.center_id
    ? `Trung tâm ${d.filters.center_name} (QT-14)`
    : 'Tất cả trung tâm';

  const canhBao = d.warning
    ? `<div class="ghi-chu ghi-chu--vang" style="margin-top:14px">⚠ ${escapeHtml(NHAN_CANH_BAO[d.warning] || d.warning)}</div>`
    : '';
  const phuCsat = d.total_responses
    ? `${nguyen(d.high_score_count)} / ${nguyen(d.total_responses)} phản hồi`
    : 'chưa có phản hồi';
  const phuTong = d.closed_tickets != null
    ? `trên ${nguyen(d.closed_tickets)} phiếu đã đóng`
    : 'phiếu đã trả lời';

  return `
    <div class="hang-the">
      <div class="the">
        <div class="the__nhan">CSAT (điểm ≥ 4)</div>
        <div class="the__so ${d.csat_percent != null ? 'the__so--tot' : ''}">${phanTram(d.csat_percent)}</div>
        <div class="the__phu">${escapeHtml(phuCsat)}</div>
      </div>
      <div class="the">
        <div class="the__nhan">Điểm trung bình</div>
        <div class="the__so">${so(d.avg_score)}</div>
        <div class="the__phu">thang 1–5</div>
      </div>
      <div class="the">
        <div class="the__nhan">Tổng phản hồi</div>
        <div class="the__so">${nguyen(d.total_responses)}</div>
        <div class="the__phu">${escapeHtml(phuTong)}</div>
      </div>
      <div class="the">
        <div class="the__nhan">Điểm thấp (≤ 2)</div>
        <div class="the__so the__so--canh-bao">${nguyen(d.low_score_count)}</div>
        <div class="the__phu">cần liên hệ khách</div>
      </div>
    </div>${canhBao}`;
}

function vePhanBo(d) {
  if (!d.total_responses) return null;
  const wrap = document.createElement('div');
  wrap.innerHTML = '<div style="height:230px"><canvas id="bieu-do-phan-bo"></canvas></div>';
  requestAnimationFrame(() => {
    if (bieuDo) bieuDo.destroy();
    bieuDo = veCotPhanBo(document.getElementById('bieu-do-phan-bo'), d.distribution);
  });
  return wrap;
}

function veBangKtv(d) {
  if (d.by_technician === null) {
    return '<div class="ghi-chu ghi-chu--xanh">Vai trò Marketing chỉ xem số liệu tổng hợp toàn hệ thống (BS-05).</div>';
  }
  if (!d.by_technician.length) return null;        // -> trạng thái "không có dữ liệu" của DataState

  const dong = d.by_technician.map((t) => `
    <tr>
      <td>${escapeHtml(t.full_name)}</td>
      <td>${nguyen(t.total_responses)}</td>
      <td>${phanTram(t.csat_percent)}</td>
      <td>${so(t.avg_score)}</td>
      <td>${t.warning === 'MAU_CHUA_DU_TIN_CAY' ? `<span class="mau-nho">⚠ n &lt; ${d.min_sample}</span>` : ''}</td>
    </tr>`).join('');

  const coMauNho = d.by_technician.some((t) => t.warning === 'MAU_CHUA_DU_TIN_CAY');
  return `<div class="bang-cuon">
      <table class="bang">
        <thead><tr><th>Kỹ thuật viên</th><th>Phản hồi</th><th>CSAT</th>
          <th>Điểm TB</th><th>Ghi chú</th></tr></thead>
        <tbody>${dong}</tbody>
      </table>
    </div>
    ${coMauNho ? `<div class="ghi-chu ghi-chu--vang" style="margin-top:12px">⚠ n &lt; ${d.min_sample}:
      mẫu chưa đủ tin cậy – nên chọn khoảng thời gian dài hơn (BS-02)</div>` : ''}`;
}

const locHienTai = () => ({
  centerId: oTrungTam.value || undefined,
  from: form.from.value || undefined,
  to: form.to.value || undefined,
});

async function taiBaoCao() {
  const loc = locHienTai();
  // Một lần gọi API dùng cho cả ba vùng; mỗi vùng vẫn có đủ 3 trạng thái của DataState
  const d = await load(dsTongQuan, () => reportsApi.csat(loc), veTongQuan, { loadingText: 'Đang tính CSAT…' });
  if (d) {
    await load(dsPhanBo, async () => d, vePhanBo, { emptyText: 'Chưa có phản hồi để vẽ biểu đồ' });
    await load(dsKtv, async () => d, veBangKtv);
  } else {
    const loi = { message: 'Không tải được dữ liệu vì báo cáo lỗi', code: 'PHU_THUOC_BAO_CAO' };
    dsPhanBo.error(loi, taiBaoCao);
    dsKtv.error(loi, taiBaoCao);
  }
}

async function taiTrungTam() {
  try {
    const list = await reportsApi.centers();
    for (const c of list) {
      const opt = document.createElement('option');
      opt.value = String(c.center_id);
      opt.textContent = c.center_name;           // tên trung tâm theo case study (TTBH Quận 10…)
      opt.title = c.city;
      oTrungTam.append(opt);
    }
    if (vaiTro === 'quan_ly' && list.length === 1) {   // QT-14: khóa vào trung tâm của mình
      oTrungTam.value = String(list[0].center_id);
      oTrungTam.disabled = true;
      capNhatPhamVi(document.getElementById('thanh-ben'), `Trung tâm ${list[0].center_name}`);
    }
    if (vaiTro === 'marketing') oTrungTam.disabled = true;  // BS-05
  } catch {
    oTrungTam.disabled = true;
  }
}

form.addEventListener('submit', (ev) => { ev.preventDefault(); taiBaoCao(); });

await taiTrungTam();
await taiBaoCao();
if (dangChon === 'ky-thuat-vien') document.getElementById('ky-thuat-vien').scrollIntoView({ block: 'start' });
