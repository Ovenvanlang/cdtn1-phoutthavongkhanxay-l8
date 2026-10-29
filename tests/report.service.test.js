// Test lớp nghiệp vụ BÁO CÁO (BS-01, BS-02, BS-05, QT-14) với repository giả:
// chỉ kiểm tra công thức và quy tắc, không phụ thuộc SQL.
const { test } = require('node:test');
const assert = require('node:assert');
const { createReportService } = require('../src/backend/services/report.service');

const NOW = () => new Date('2026-10-10T08:00:00Z');   // quý 4/2026
const CENTERS = [{ center_id: 1, center_name: 'HCM-01', city: 'TP.HCM' }, { center_id: 2, center_name: 'CT-01', city: 'Cần Thơ' }];

const RONG = { total_responses: 0, high_count: null, low_count: null, avg_score: null };

/**
 * @param {object} [o]
 * @param {object} [o.summary] số liệu kỳ đang xem
 * @param {object} [o.previous] số liệu kỳ trước (mặc định rỗng)
 * @param {object} [o.company] số liệu toàn hệ thống (mặc định = summary)
 */
function setup({ summary = RONG, previous = RONG, company, distribution = [], byTechnician = [], trend = [] } = {}) {
  const goi = { summary: [] };
  const reportRepo = {
    // Lần gọi đầu là kỳ đang xem; kỳ khác "from" là kỳ trước; centerId null khi đang lọc trung tâm là toàn hệ thống
    summary: (f) => {
      goi.summary.push(f);
      if (goi.summary.length === 1) return summary;
      if (f.from !== goi.summary[0].from) return previous;
      return company || summary;
    },
    closedTickets: (f) => { goi.closedTickets = f; return 380; },
    distribution: () => distribution,
    byTechnician: () => byTechnician,
    trend: (f) => { goi.trend = f; return trend; },
  };
  const centerRepo = { findAll: () => CENTERS, findById: (id) => CENTERS.find((c) => c.center_id === id) };
  const surveyService = { list: (user, q) => { goi.list = q; return { data: [], meta: { page: 1, limit: 20, total: 0 } }; } };
  return { service: createReportService({ reportRepo, centerRepo, surveyService, now: NOW }), goi };
}

const BGD = { role: 'bgd', centerId: null };
const QUAN_LY_1 = { role: 'quan_ly', centerId: 1 };
const MARKETING = { role: 'marketing', centerId: null };

test('BS-01: CSAT% = số phản hồi 4–5 điểm / tổng phản hồi đã trả lời, làm tròn 1 chữ số', () => {
  const { service } = setup({
    summary: { total_responses: 28, high_count: 25, low_count: 3, avg_score: 4.464 },
    distribution: [{ score: 1, n: 2 }, { score: 2, n: 1 }, { score: 4, n: 4 }, { score: 5, n: 21 }],
  });
  const d = service.csat(BGD, { from: '2026-01-01', to: '2026-12-31' }).data;
  assert.strictEqual(d.csat_percent, 89.3);            // 25/28 = 89.2857 -> 89.3
  assert.strictEqual(d.avg_score, 4.46);   // 2 chữ số thập phân theo bản thiết kế
  assert.strictEqual(d.low_score_count, 3);
  assert.deepStrictEqual(d.distribution, { 1: 2, 2: 1, 3: 0, 4: 4, 5: 21 });
  assert.strictEqual(d.warning, null);
  assert.strictEqual(d.closed_tickets, 380, 'thẻ KPI hiển thị "trên N phiếu đã đóng"');
});

test('BS-02 (biên): đúng 5 phản hồi -> không cảnh báo; 4 phản hồi -> MAU_CHUA_DU_TIN_CAY', () => {
  const du = setup({ summary: { total_responses: 5, high_count: 4, low_count: 0, avg_score: 4.2 } }).service;
  assert.strictEqual(du.csat(BGD, {}).data.warning, null, '5 phản hồi là ngưỡng ĐỦ tin cậy');
  assert.strictEqual(du.csat(BGD, {}).data.csat_percent, 80);

  const thieu = setup({ summary: { total_responses: 4, high_count: 4, low_count: 0, avg_score: 4.5 } }).service;
  const d = thieu.csat(BGD, {}).data;
  assert.strictEqual(d.warning, 'MAU_CHUA_DU_TIN_CAY');
  assert.strictEqual(d.csat_percent, 100, 'vẫn trả số, chỉ kèm cảnh báo');
});

test('BS-02 (ngoại lệ): không có phản hồi -> csat_percent = null và CHUA_CO_PHAN_HOI, tuyệt đối không phải 0%', () => {
  const { service } = setup({ summary: { total_responses: 0, high_count: null, low_count: null, avg_score: null } });
  const d = service.csat(BGD, {}).data;
  assert.strictEqual(d.csat_percent, null);
  assert.notStrictEqual(d.csat_percent, 0);
  assert.strictEqual(d.avg_score, null);
  assert.strictEqual(d.warning, 'CHUA_CO_PHAN_HOI');
});

test('Khoảng thời gian: mặc định từ đầu năm đến hôm nay; from > to (kể cả khi một đầu lấy mặc định) -> lỗi dữ liệu', () => {
  const { service, goi } = setup({ summary: { total_responses: 0, high_count: 0, low_count: 0, avg_score: null } });
  const d = service.csat(BGD, {}).data;
  assert.strictEqual(d.filters.from, '2026-01-01', 'mặc định lấy từ đầu năm 2026');
  assert.strictEqual(d.filters.to, '2026-10-10');
  assert.strictEqual(goi.summary[0].from, '2026-01-01');

  assert.throws(() => service.csat(BGD, { from: '2026-12-31' }), (e) => e.code === 'DU_LIEU_KHONG_HOP_LE' && e.field === 'from',
    'from sau "hôm nay" (đầu to mặc định) phải bị từ chối');
});

test('QT-14: quản lý bị ép theo trung tâm mình, xin trung tâm khác -> 403', () => {
  const { service, goi } = setup({ summary: { total_responses: 1, high_count: 1, low_count: 0, avg_score: 5 } });
  const d = service.csat(QUAN_LY_1, {}).data;
  assert.strictEqual(goi.summary[0].centerId, 1);
  assert.strictEqual(d.filters.center_name, 'HCM-01');
  assert.throws(() => service.csat(QUAN_LY_1, { centerId: 2 }), (e) => e.code === 'KHONG_DU_QUYEN');
  assert.strictEqual(service.listCenters(QUAN_LY_1).data.length, 1, 'bộ lọc chỉ có trung tâm của mình');
});

test('BS-05: Marketing chỉ xem tổng hợp – không có bảng kỹ thuật viên, không lọc theo trung tâm', () => {
  const { service } = setup({
    summary: { total_responses: 10, high_count: 9, low_count: 1, avg_score: 4.6 },
    byTechnician: [{ technician_id: 1, full_name: 'KTV A', level: 'SO_CAP', total_responses: 10, high_count: 9, low_count: 1, avg_score: 4.6 }],
  });
  assert.strictEqual(service.csat(MARKETING, {}).data.by_technician, null);
  assert.throws(() => service.csat(MARKETING, { centerId: 1 }), (e) => e.code === 'KHONG_DU_QUYEN');
  assert.deepStrictEqual(service.listCenters(MARKETING).data, []);
});

test('UC4: bảng kỹ thuật viên xếp theo CSAT giảm dần và gắn cảnh báo mẫu nhỏ cho từng người', () => {
  const { service } = setup({
    summary: { total_responses: 12, high_count: 9, low_count: 2, avg_score: 4 },
    byTechnician: [
      { technician_id: 1, full_name: 'KTV A', level: 'SO_CAP', total_responses: 8, high_count: 6, low_count: 1, avg_score: 4 },
      { technician_id: 2, full_name: 'KTV B', level: 'CAO_CAP', total_responses: 4, high_count: 4, low_count: 0, avg_score: 4.75 },
    ],
  });
  const bang = service.csat(BGD, {}).data.by_technician;
  assert.strictEqual(bang[0].full_name, 'KTV B');            // 100% xếp trước 75%
  assert.strictEqual(bang[0].warning, 'MAU_CHUA_DU_TIN_CAY'); // chỉ 4 phản hồi
  assert.strictEqual(bang[1].csat_percent, 75);
  assert.strictEqual(bang[1].warning, null);
});

test('UC5: xu hướng chỉ trả các kỳ CÓ phản hồi (không nội suy); mặc định năm hiện tại', () => {
  const { service } = setup({
    trend: [{ period: 1, total_responses: 6, high_count: 6, avg_score: 4.7 },
            { period: 3, total_responses: 2, high_count: 1, avg_score: 3 }],
  });
  const d = service.trend(BGD, { granularity: 'quarter', year: 2026 }).data;
  assert.deepStrictEqual({ from: d.year_summary.from, to: d.year_summary.to }, { from: '2026-01-01', to: '2026-12-31' },
    'mốc tham chiếu của biểu đồ: CSAT trung bình cả năm');
  assert.strictEqual(d.points.length, 2, 'quý 2 không có dữ liệu thì không xuất hiện');
  assert.deepStrictEqual(d.points.map((p) => p.label), ['Q1/2026', 'Q3/2026']);
  assert.strictEqual(d.points[0].csat_percent, 100);
  assert.strictEqual(d.points[1].csat_percent, 50);
  assert.strictEqual(d.points[1].warning, 'MAU_CHUA_DU_TIN_CAY');
  assert.strictEqual(service.trend(BGD, {}).data.filters.year, 2026, 'thiếu năm -> lấy năm hiện tại');
});

test('UC6: danh sách điểm thấp luôn ép status=DA_TRA_LOI và score_max=2 (BS-03)', () => {
  const { service, goi } = setup({ summary: { total_responses: 0, high_count: 0, low_count: 0, avg_score: null } });
  const kq = service.lowScore(QUAN_LY_1, { limit: 5 });
  assert.strictEqual(goi.list.status, 'DA_TRA_LOI');
  assert.strictEqual(goi.list.scoreMax, 2);
  assert.strictEqual(kq.meta.low_score_threshold, 2);
});

test('Mốc so sánh: kỳ trước cùng độ dài liền trước; chênh lệch CSAT tính theo điểm phần trăm', () => {
  const { service, goi } = setup({
    summary: { total_responses: 20, high_count: 15, low_count: 2, avg_score: 4 },      // 75%
    previous: { total_responses: 10, high_count: 6, low_count: 3, avg_score: 3.6 },    // 60%
  });
  const d = service.csat(BGD, { from: '2026-10-01', to: '2026-10-10' }).data;
  assert.deepStrictEqual({ from: goi.summary[1].from, to: goi.summary[1].to }, { from: '2026-09-21', to: '2026-09-30' },
    '10 ngày 01–10/10 -> kỳ trước là 10 ngày 21–30/09');
  assert.strictEqual(d.comparison.previous.csat_percent, 60);
  assert.strictEqual(d.comparison.csat_delta, 15);
  assert.strictEqual(d.comparison.company, null, 'không lọc trung tâm thì chính nó đã là toàn hệ thống');
});

test('Mốc so sánh (biên): kỳ trước không có phản hồi -> csat_delta = null, không bịa ra 0', () => {
  const { service } = setup({ summary: { total_responses: 5, high_count: 4, low_count: 0, avg_score: 4.2 } });
  const d = service.csat(BGD, {}).data;
  assert.strictEqual(d.comparison.previous.csat_percent, null);
  assert.strictEqual(d.comparison.csat_delta, null);
});

test('Mốc toàn hệ thống: BGĐ lọc một trung tâm thì có; quản lý trung tâm thì KHÔNG (QT-14)', () => {
  const opts = { summary: { total_responses: 8, high_count: 6, low_count: 1, avg_score: 4 },
    company: { total_responses: 100, high_count: 70, low_count: 15, avg_score: 3.9 } };
  assert.strictEqual(setup(opts).service.csat(BGD, { centerId: 1 }).data.comparison.company.csat_percent, 70);
  assert.strictEqual(setup(opts).service.csat(QUAN_LY_1, {}).data.comparison.company, null);
});
