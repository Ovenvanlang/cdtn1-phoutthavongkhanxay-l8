// Màn hình 3 – Xu hướng CSAT theo thời gian (UC5) và phản hồi điểm thấp (UC6), theo bản thiết kế wireframe.
// Mọi lệnh gọi máy chủ đi qua lớp api/ (trang này KHÔNG dùng fetch).
import * as reportsApi from '../api/reports.api.mjs';
import { requireLogin, getUser } from '../api/client.mjs';
import { createDataState, load, escapeHtml } from '../components/DataState.mjs';
import { renderThanhBen, capNhatPhamVi } from '../components/thanh-ben.mjs';
import { veDuongXuHuong } from '../components/bieu-do.mjs';
import { nguyen, ngayGio, phanTram } from '../components/dinh-dang.mjs';

requireLogin();
const vaiTro = getUser()?.role;
const dangChon = location.hash === '#diem-thap' ? 'diem-thap' : 'xu-huong';
renderThanhBen(document.getElementById('thanh-ben'), { dangChon });

const dsXuHuong = createDataState(document.getElementById('vung-xu-huong'));
const dsDiemThap = createDataState(document.getElementById('vung-diem-thap'), { emptyText: 'Không có phản hồi điểm thấp – một tin tốt' });
const form = document.getElementById('form-loc');
const oTrungTam = document.getElementById('center');
const oNam = document.getElementById('year');
const oTenBieuDo = document.getElementById('ten-bieu-do');
const oGhiChuBieuDo = document.getElementById('ghi-chu-bieu-do');

const namNay = new Date().getFullYear();
for (let y = namNay; y >= namNay - 3; y--) {
  const opt = document.createElement('option');
  opt.value = String(y);
  opt.textContent = String(y);
  oNam.append(opt);
}

let bieuDo = null;

/** Đang lọc khác mặc định? (năm khác năm nay hoặc chọn trung tâm; trung tâm bị khóa theo QT-14 không tính) */
const dangLoc = () => Number(oNam.value) !== namNay || Boolean(oTrungTam.value && !oTrungTam.disabled);

function xoaBoLoc() {
  oNam.value = String(namNay);
  if (!oTrungTam.disabled) oTrungTam.value = '';
  tai();
}

/** Dàn các kỳ của năm theo trục thời gian: kỳ không có phản hồi để TRỐNG (null) – BS-02. */
function dungTrucThoiGian(points, granularity) {
  const soKy = granularity === 'quarter' ? 4 : 12;
  const theoKy = new Map(points.map((p) => [p.period, p]));
  const truc = [];
  for (let k = 1; k <= soKy; k++) {
    const p = theoKy.get(k);
    truc.push({
      label: granularity === 'quarter' ? `Q${k}` : `T${k}`,
      value: p ? p.csat_percent : null,
      diem: p || null,
    });
  }
  // Cắt bỏ các kỳ trống ở cuối năm (chưa tới) cho biểu đồ gọn như bản thiết kế
  while (truc.length && truc[truc.length - 1].value === null) truc.pop();
  return truc;
}

function veXuHuong(d) {
  const granularity = d.filters.granularity;
  const tenKy = granularity === 'quarter' ? 'quý' : 'tháng';
  oTenBieuDo.textContent = `CSAT theo ${tenKy} (%)`;
  const tb = d.year_summary;
  oGhiChuBieuDo.textContent = `${tenKy[0].toUpperCase()}${tenKy.slice(1)} không có dữ liệu để trống, không nội suy`
    + (tb.csat_percent != null ? ` · đường đứt nét: CSAT trung bình năm ${d.filters.year} = ${phanTram(tb.csat_percent)}` : '');
  if (!d.points.length) return null;

  const truc = dungTrucThoiGian(d.points, granularity);
  // Kỳ có dưới 5 phản hồi: chỉ nhắc khi có, để biểu đồ vẫn gọn như bản thiết kế (BS-02)
  const kyMauNho = d.points.filter((p) => p.warning === 'MAU_CHUA_DU_TIN_CAY').map((p) => p.label);

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div style="height:240px"><canvas id="bieu-do-xu-huong"></canvas></div>
    ${kyMauNho.length ? `<div class="ghi-chu ghi-chu--vang" style="margin-top:10px">⚠ ${escapeHtml(kyMauNho.join(', '))}:
       dưới 5 phản hồi – mẫu chưa đủ tin cậy (BS-02)</div>` : ''}`;

  requestAnimationFrame(() => {
    if (bieuDo) bieuDo.destroy();
    bieuDo = veDuongXuHuong(document.getElementById('bieu-do-xu-huong'), truc,
      tb.csat_percent != null ? { value: tb.csat_percent, label: `TB năm ${d.filters.year}` } : null);
  });
  return wrap;
}

function veDiemThap(res) {
  if (!res.data.length) return null;
  const dong = res.data.map((r) => `
    <tr>
      <td>${escapeHtml(ngayGio(r.responded_at))}</td>
      <td>${escapeHtml(r.ticket_code)}</td>
      <td>${escapeHtml(r.technician_name || '—')}</td>
      <td class="diem-thap">${r.score}</td>
      <td>${r.comment ? escapeHtml(r.comment) : '<span class="mo">(không nhận xét)</span>'}</td>
      <td>${r.customer_phone ? escapeHtml(r.customer_phone) : '<span class="mo">chưa có SĐT</span>'}</td>
    </tr>`).join('');
  return `<div class="bang-cuon">
      <table class="bang">
        <thead><tr><th>Thời điểm</th><th>Mã phiếu</th><th>Kỹ thuật viên</th>
          <th>Điểm</th><th>Nhận xét</th><th>SĐT khách hàng</th></tr></thead>
        <tbody>${dong}</tbody>
      </table>
    </div>
    <p class="khoi__ghi-chu" style="margin:10px 0 0">Tổng ${nguyen(res.meta.total)} phản hồi có điểm
       ≤ ${res.meta.low_score_threshold} trong phạm vi được xem.</p>`;
}

const locHienTai = () => ({
  centerId: oTrungTam.value || undefined,
  granularity: form.granularity.value,
  year: Number(oNam.value) || undefined,
});

async function tai() {
  const loc = locHienTai();
  const rong = dangLoc()
    ? { emptyText: `Không có phản hồi nào khớp bộ lọc (năm ${loc.year}${loc.centerId ? ', trung tâm đã chọn' : ''}).`,
        emptyOptions: { actionLabel: 'Xóa bộ lọc', onAction: xoaBoLoc, kind: 'bo-loc' } }
    : { emptyText: `Chưa có phản hồi nào trong năm ${namNay}.`, emptyOptions: { kind: 'chua-co-du-lieu' } };
  await load(dsXuHuong, () => reportsApi.trend(loc), veXuHuong, { loadingText: 'Đang tính xu hướng…', ...rong });

  if (vaiTro === 'marketing') {                    // BS-05: Marketing không xem phản hồi chi tiết
    dsDiemThap.content('<div class="ghi-chu ghi-chu--xanh">Vai trò Marketing không xem phản hồi chi tiết của khách hàng (BS-05).</div>');
    return;
  }
  await load(dsDiemThap, () => reportsApi.lowScore({ centerId: loc.centerId, limit: 20 }), veDiemThap,
    { loadingText: 'Đang tải phản hồi điểm thấp…' });
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
    if (vaiTro === 'quan_ly' && list.length === 1) {
      oTrungTam.value = String(list[0].center_id);
      oTrungTam.disabled = true;                   // QT-14
      capNhatPhamVi(document.getElementById('thanh-ben'), `Trung tâm ${list[0].center_name}`);
    }
    if (vaiTro === 'marketing') oTrungTam.disabled = true;  // BS-05
  } catch {
    oTrungTam.disabled = true;
  }
}

form.addEventListener('submit', (ev) => { ev.preventDefault(); tai(); });

await taiTrungTam();
await tai();
if (dangChon === 'diem-thap') document.getElementById('diem-thap').scrollIntoView({ block: 'start' });
