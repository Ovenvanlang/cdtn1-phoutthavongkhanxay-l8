// Màn hình 1 – form khảo sát của khách hàng (UC2), dựng theo bản thiết kế wireframe.
// Mọi lệnh gọi máy chủ đi qua lớp api/ (trang này KHÔNG dùng fetch).
import * as surveysApi from '../api/surveys.api.mjs';
import { createDataState, load, escapeHtml } from '../components/DataState.mjs';
import { ngay } from '../components/dinh-dang.mjs';

const MAX_COMMENT = 500;
const ds = createDataState(document.getElementById('vung-khao-sat'));
const formTim = document.getElementById('form-tim');
const oMaPhieu = document.getElementById('ticket');
const oMaTruyCap = document.getElementById('ma-truy-cap');

/** Thẻ phiếu bảo hành như bản thiết kế; dòng "Thiết bị" chỉ hiện khi API trả về tên thiết bị. */
function veThePhieu(khaoSat) {
  const thietBi = khaoSat.device_name
    ? `<div class="the-phieu__dong the-phieu__dong--lon">Thiết bị: ${escapeHtml(khaoSat.device_name)}</div>`
    : '';
  return `<div class="the-phieu">
      <div class="the-phieu__nhan">Phiếu bảo hành</div>
      <div class="the-phieu__ma">${escapeHtml(khaoSat.ticket_code)}</div>
      ${thietBi}
      <div class="the-phieu__dong">Trung tâm ${escapeHtml(khaoSat.center_name)}
        · đóng ngày ${escapeHtml(ngay(khaoSat.closed_at))}</div>
    </div>`;
}

function veFormTraLoi(khaoSat, maTruyCap) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    ${veThePhieu(khaoSat)}

    <form data-form-tra-loi novalidate>
      <fieldset style="border:0; padding:0; margin:0">
        <legend class="cau-hoi">Bạn hài lòng thế nào với dịch vụ?</legend>
        <p class="cau-hoi-phu">Chọn điểm từ 1 đến 5 (bắt buộc)</p>
        <div class="thang-diem">
          ${[1, 2, 3, 4, 5].map((d) => `
            <input type="radio" name="score" id="diem-${d}" value="${d}">
            <label for="diem-${d}">${d}</label>`).join('')}
        </div>
        <div class="nhan-thang"><span>Rất không hài lòng</span><span>Rất hài lòng</span></div>
      </fieldset>

      <label class="nhan-o" for="comment">Nhận xét thêm (tuỳ chọn)</label>
      <div class="o-nhan-xet">
        <textarea id="comment" name="comment" maxlength="${MAX_COMMENT}"
                  placeholder="Nhân viên hỗ trợ nhiệt tình, máy sửa nhanh hơn dự kiến…"></textarea>
        <div class="dem-ky-tu"><span data-dem>0</span> / ${MAX_COMMENT}</div>
      </div>

      <button class="nut-gui" type="submit">Gửi phản hồi</button>
      <p class="phieu__chan">Mỗi phiếu chỉ khảo sát một lần (QT-10)</p>
      <div data-ket-qua></div>
    </form>`;

  const form = wrap.querySelector('[data-form-tra-loi]');
  const dem = wrap.querySelector('[data-dem]');
  const oNhanXet = wrap.querySelector('#comment');
  const dsGui = createDataState(wrap.querySelector('[data-ket-qua]'));

  oNhanXet.addEventListener('input', () => { dem.textContent = String(oNhanXet.value.length); });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const chon = form.querySelector('input[name="score"]:checked');
    if (!chon) {                                   // chưa chọn điểm -> báo ngay, không gọi máy chủ
      dsGui.error({ message: 'Vui lòng chọn điểm 1–5', code: 'DU_LIEU_KHONG_HOP_LE' });
      return;
    }
    dsGui.loading('Đang gửi phản hồi…');
    try {
      const kq = await surveysApi.submit(khaoSat.ticket_id, maTruyCap, { score: Number(chon.value), comment: oNhanXet.value.trim() });
      form.querySelectorAll('input, textarea, button').forEach((e) => { e.disabled = true; });
      dsGui.content(`<div class="ghi-chu ghi-chu--xanh">Đã ghi nhận ${kq.score}/5. Cảm ơn quý khách đã phản hồi!</div>`);
    } catch (err) {
      dsGui.error(err, () => form.requestSubmit());
    }
  });
  return wrap;
}

function veDaTraLoi(khaoSat) {
  return `${veThePhieu(khaoSat)}
    <div class="ghi-chu ghi-chu--vang">Phiếu này đã được đánh giá ${khaoSat.score}/5
      ngày ${escapeHtml(ngay(khaoSat.responded_at))}. Mỗi phiếu chỉ khảo sát một lần (QT-10).</div>`;
}

function moKhaoSat(ticketId, maTruyCap) {
  return load(
    ds,
    () => surveysApi.getByTicket(ticketId, maTruyCap),
    (khaoSat) => (khaoSat.status === 'DA_TRA_LOI' ? veDaTraLoi(khaoSat) : veFormTraLoi(khaoSat, maTruyCap)),
    { loadingText: 'Đang mở phiếu khảo sát…' },
  );
}

formTim.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const ma = oMaPhieu.value.trim();
  const t = oMaTruyCap.value.trim().toLowerCase();
  if (!ma || !t) { ds.empty('Nhập mã phiếu và mã truy cập trong đường dẫn để mở khảo sát.'); return; }
  history.replaceState(null, '', `?ticket=${encodeURIComponent(ma)}&t=${encodeURIComponent(t)}`);
  moKhaoSat(ma, t);
});

const thamSo = new URLSearchParams(location.search);
const tuLienKet = thamSo.get('ticket');
const maTrongLienKet = thamSo.get('t');
if (tuLienKet && maTrongLienKet) {
  // Khách mở đúng đường dẫn trong tin nhắn: ẩn ô tra mã, hiện thẳng phiếu như bản thiết kế
  formTim.hidden = true;
  oMaPhieu.value = tuLienKet;
  oMaTruyCap.value = maTrongLienKet;
  moKhaoSat(tuLienKet, maTrongLienKet);
} else {
  ds.empty('Nhập mã phiếu và mã truy cập ở trên để mở khảo sát.');
}
