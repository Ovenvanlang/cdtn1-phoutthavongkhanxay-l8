// Test lớp giao diện: component DataState (3 trạng thái + nút Thử lại) và quy ước
// "các trang không được gọi fetch trực tiếp". Dùng jsdom nên không cần mở trình duyệt.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { JSDOM } = require('jsdom');

const FRONTEND = path.join(__dirname, '..', 'src', 'frontend');
// import() động cần URL file:// – đường dẫn tuyệt đối kiểu C:\... trên Windows sẽ bị Node từ chối (ERR_UNSUPPORTED_ESM_URL_SCHEME)
const nhapModule = (...phan) => import(pathToFileURL(path.join(FRONTEND, ...phan)).href);
const nhapDataState = () => nhapModule('components', 'DataState.mjs');

function oTrong() {
  const dom = new JSDOM('<div id="vung"></div>');
  return dom.window.document.getElementById('vung');
}

test('DataState: đủ ba trạng thái đang tải / không có dữ liệu / lỗi', async () => {
  const { createDataState } = await nhapDataState();
  const el = oTrong();
  const ds = createDataState(el);

  ds.loading('Đang tính CSAT…');
  assert.strictEqual(ds.state, 'loading');
  assert.match(el.textContent, /Đang tính CSAT/);

  ds.empty();
  assert.strictEqual(ds.state, 'empty');
  assert.match(el.textContent, /Chưa có dữ liệu/);

  ds.error({ message: 'Không kết nối được tới máy chủ', code: 'KHONG_KET_NOI_DUOC' });
  assert.strictEqual(ds.state, 'error');
  assert.match(el.textContent, /Không kết nối được tới máy chủ/);
  assert.match(el.textContent, /KHONG_KET_NOI_DUOC/);
});

test('DataState: trạng thái lỗi có nút "Thử lại" và bấm vào thì gọi lại hàm nạp dữ liệu', async () => {
  const { createDataState } = await nhapDataState();
  const el = oTrong();
  const ds = createDataState(el);
  let soLanGoi = 0;

  ds.error({ message: 'Máy chủ không phản hồi', code: 'KHONG_KET_NOI_DUOC' }, () => { soLanGoi += 1; });
  const nut = el.querySelector('[data-ds-retry]');
  assert.ok(nut, 'phải có nút Thử lại');
  assert.strictEqual(nut.textContent.trim(), 'Thử lại');
  nut.click();
  assert.strictEqual(soLanGoi, 1);
});

test('DataState.load: tắt backend (API ném lỗi) -> hiện lỗi + Thử lại, bấm lại thì nạp được', async () => {
  const { createDataState, load } = await nhapDataState();
  const el = oTrong();
  const ds = createDataState(el);

  let backendTat = true;                                  // mô phỏng "tắt backend rồi bật lại"
  const api = async () => {
    if (backendTat) throw Object.assign(new Error('Không kết nối được tới máy chủ'), { code: 'KHONG_KET_NOI_DUOC' });
    return { csat_percent: 92.6 };
  };

  await load(ds, api, (d) => `<p>CSAT ${d.csat_percent}%</p>`);
  assert.strictEqual(ds.state, 'error');

  backendTat = false;
  el.querySelector('[data-ds-retry]').click();
  await new Promise((r) => setTimeout(r, 10));            // chờ lần nạp lại
  assert.strictEqual(ds.state, 'content');
  assert.match(el.textContent, /CSAT 92.6%/);
});

test('DataState.load: API trả rỗng -> trạng thái "không có dữ liệu", không phải lỗi', async () => {
  const { createDataState, load } = await nhapDataState();
  const ds = createDataState(oTrong(), { emptyText: 'Không có phản hồi điểm thấp' });
  await load(ds, async () => [], (rows) => (rows.length ? '<table></table>' : null));
  assert.strictEqual(ds.state, 'empty');
  assert.match(ds.element.textContent, /Không có phản hồi điểm thấp/);
});

test('DataState: hai kiểu rỗng – "chưa có dữ liệu" không có nút; "bộ lọc không ra kết quả" có nút Xóa bộ lọc', async () => {
  const { createDataState, load } = await nhapDataState();
  const chuaCo = createDataState(oTrong());
  chuaCo.empty('Chưa có phản hồi nào trong năm 2026.');
  assert.strictEqual(chuaCo.element.querySelector('[data-ds-action]'), null);
  assert.strictEqual(chuaCo.element.querySelector('.ds').dataset.kind, 'chua-co-du-lieu');

  const boLoc = createDataState(oTrong());
  let daXoa = 0;
  await load(boLoc, async () => ({ rows: [] }), () => null, {
    emptyText: 'Không có phản hồi nào khớp bộ lọc đang chọn.',
    emptyOptions: { actionLabel: 'Xóa bộ lọc', onAction: () => { daXoa += 1; }, kind: 'bo-loc' },
  });
  assert.strictEqual(boLoc.state, 'empty');
  assert.strictEqual(boLoc.element.querySelector('.ds').dataset.kind, 'bo-loc');
  const nut = boLoc.element.querySelector('[data-ds-action]');
  assert.strictEqual(nut.textContent.trim(), 'Xóa bộ lọc');
  nut.click();
  assert.strictEqual(daXoa, 1);
});

test('Định dạng mốc so sánh: chênh lệch có dấu và mũi tên, thiếu số thì "—"', async () => {
  const { chenhLech } = await nhapModule('components', 'dinh-dang.mjs');
  assert.strictEqual(chenhLech(3.4), '▲ +3,4 điểm');
  assert.strictEqual(chenhLech(-2), '▼ −2,0 điểm');
  assert.strictEqual(chenhLech(0), '= 0,0 điểm');
  assert.strictEqual(chenhLech(null), '—');
});

test('DataState: nội dung do máy chủ trả về được thoát ký tự (chống XSS)', async () => {
  const { createDataState, escapeHtml } = await nhapDataState();
  const el = oTrong();
  createDataState(el).error({ message: '<img src=x onerror="alert(1)">', code: 'LOI_HE_THONG' });
  assert.strictEqual(el.querySelector('img'), null, 'không được chèn thẻ HTML từ dữ liệu');
  assert.strictEqual(escapeHtml('<b>&"</b>'), '&lt;b&gt;&amp;&quot;&lt;/b&gt;');
});

test('Quy ước kiến trúc: không trang nào trong pages/ gọi fetch( trực tiếp', () => {
  const pages = fs.readdirSync(path.join(FRONTEND, 'pages'));
  assert.ok(pages.length >= 3, 'phải có ít nhất 3 màn hình');
  for (const file of pages) {
    const noiDung = fs.readFileSync(path.join(FRONTEND, 'pages', file), 'utf8');
    assert.ok(!/\bfetch\s*\(/.test(noiDung), `${file} phải gọi API qua lớp api/, không dùng fetch( trực tiếp`);
    assert.match(noiDung, /from '\.\.\/api\//, `${file} phải dùng lớp api/`);
  }
});
