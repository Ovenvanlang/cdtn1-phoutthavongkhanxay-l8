// Lớp service: báo cáo CSAT (UC3, UC4, UC5, UC6). Không chứa SQL, không biết gì về HTTP.
// Quy tắc áp dụng:
//   BS-01  CSAT% = (số phản hồi có điểm >= 4) / (tổng số phản hồi ĐÃ TRẢ LỜI) * 100, làm tròn 1 chữ số.
//          Phiếu đã gửi mà chưa trả lời (DA_GUI) KHÔNG nằm ở mẫu số.
//   BS-02  Dưới 5 phản hồi: vẫn trả số nhưng kèm cảnh báo MAU_CHUA_DU_TIN_CAY.
//          Không có phản hồi nào: csat_percent = null + CHUA_CO_PHAN_HOI (tuyệt đối không hiển thị 0%).
//   BS-03  Điểm <= 2 là phản hồi điểm thấp.
//   BS-05  Marketing chỉ xem số liệu TỔNG HỢP toàn hệ thống: không lọc theo trung tâm,
//          không xem bảng theo kỹ thuật viên.
//   QT-14  Quản lý trung tâm chỉ thấy dữ liệu trung tâm mình.
//   Mốc so sánh: mỗi con số CSAT đi kèm kỳ trước cùng độ dài (và toàn hệ thống khi BGĐ lọc một trung tâm);
//          xu hướng kèm CSAT trung bình cả năm.
const E = require('../errors/AppError');

const MIN_SAMPLE = 5;      // BS-02
const HIGH_SCORE = 4;      // BS-01
const LOW_SCORE = 2;       // BS-03

function percent(high, total) {
  if (!total) return null;                               // BS-02: không có phản hồi -> null, KHÔNG phải 0
  return Math.round((high / total) * 1000) / 10;
}

/** Điểm trung bình hiển thị 2 chữ số thập phân (ví dụ 4,21 trên bản thiết kế). */
function round2(value) {
  return value == null ? null : Math.round(value * 100) / 100;
}

function warningFor(total) {
  if (!total) return 'CHUA_CO_PHAN_HOI';                 // BS-02
  if (total < MIN_SAMPLE) return 'MAU_CHUA_DU_TIN_CAY';  // BS-02
  return null;
}

const DAY_MS = 86400000;

/** Khoảng mặc định: từ đầu năm đến hôm nay (TD-27). */
function yearToDateRange(today) {
  return { from: `${today.getUTCFullYear()}-01-01`, to: today.toISOString().slice(0, 10) };
}

/** Kỳ trước để so sánh: cùng số ngày, liền ngay trước `from` (ví dụ 01/01–29/10 -> 05/03–31/12 năm trước). */
function previousRange({ from, to }) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - start) / DAY_MS) + 1;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  return { from: iso(start - days * DAY_MS), to: iso(start - DAY_MS) };
}

/** Chênh lệch CSAT (điểm phần trăm, 1 chữ số); thiếu một phía thì không so sánh được -> null. */
function delta(current, previous) {
  return current == null || previous == null ? null : Math.round((current - previous) * 10) / 10;
}

/** Gói số liệu tổng hợp của một phạm vi để làm mốc so sánh. */
function benchmark(sum, range) {
  const total = sum.total_responses || 0;
  return {
    ...range,
    total_responses: total,
    csat_percent: percent(sum.high_count || 0, total),
    avg_score: round2(sum.avg_score),
    low_score_count: sum.low_count || 0,
  };
}

function createReportService({ reportRepo, centerRepo, surveyService, now = () => new Date() }) {
  /** Xác định trung tâm được xem: QT-14 cho quản lý, BS-05 cho marketing, BGĐ xem mọi nơi. */
  function resolveCenter(user, centerId) {
    if (user.role === 'quan_ly') {
      if (!user.centerId) throw E.forbidden('Quản lý phải thuộc một trung tâm');
      if (centerId != null && centerId !== user.centerId) throw E.forbidden('Không được xem dữ liệu trung tâm khác (QT-14)');
      return user.centerId;
    }
    if (user.role === 'marketing') {
      if (centerId != null) throw E.forbidden('Marketing chỉ xem số liệu tổng hợp toàn hệ thống (BS-05)');
      return null;
    }
    if (centerId == null) return null;                   // bgd: null = toàn hệ thống
    if (!centerRepo.findById(centerId)) throw E.notFound('Không có trung tâm này');
    return centerId;
  }

  /** Khoảng thời gian: thiếu đầu nào thì lấy theo mặc định (quy tắc báo cáo), rồi kiểm tra thứ tự. */
  function resolveRange({ from, to }) {
    const def = yearToDateRange(now());
    const range = { from: from || def.from, to: to || def.to };
    if (range.from > range.to) throw E.invalid('from phải nhỏ hơn hoặc bằng to', 'from');
    return range;
  }

  return {
    /** UC3 + UC4 – CSAT theo trung tâm, kèm bảng theo kỹ thuật viên. */
    csat(user, { centerId: requested = null, from: fromIn = null, to: toIn = null } = {}) {
      const centerId = resolveCenter(user, requested);
      const { from, to } = resolveRange({ from: fromIn, to: toIn });
      const filters = { centerId, from, to };

      const sum = reportRepo.summary(filters);
      const total = sum.total_responses || 0;
      const high = sum.high_count || 0;

      const dist = reportRepo.distribution(filters);
      const byScore = Object.fromEntries([1, 2, 3, 4, 5].map((s) => [s, 0]));
      for (const row of dist) byScore[row.score] = row.n;

      // UC4: Marketing không được xem chi tiết theo kỹ thuật viên (BS-05)
      const byTechnician = user.role === 'marketing' ? null : reportRepo.byTechnician(filters)
        .map((r) => ({
          technician_id: r.technician_id,
          full_name: r.full_name,
          level: r.level,
          total_responses: r.total_responses,
          csat_percent: percent(r.high_count || 0, r.total_responses),
          avg_score: round2(r.avg_score),
          low_score_count: r.low_count || 0,
          warning: warningFor(r.total_responses),
        }))
        .sort((a, b) => (b.csat_percent ?? -1) - (a.csat_percent ?? -1) || b.total_responses - a.total_responses);

      // Mốc so sánh (TP3 – "số liệu phải có mốc"): kỳ trước cùng độ dài, và toàn hệ thống khi BGĐ lọc một trung tâm.
      // Quản lý trung tâm KHÔNG nhận số toàn hệ thống (QT-14: chỉ xem dữ liệu trung tâm mình).
      const prevRange = previousRange({ from, to });
      const previous = benchmark(reportRepo.summary({ centerId, ...prevRange }), prevRange);
      const company = centerId != null && user.role === 'bgd'
        ? benchmark(reportRepo.summary({ centerId: null, from, to }), { from, to })
        : null;
      const csatPercent = percent(high, total);

      return {
        data: {
          filters: {
            center_id: centerId,
            center_name: centerId ? centerRepo.findById(centerId).center_name : 'Toàn hệ thống',
            from,
            to,
          },
          total_responses: total,
          closed_tickets: reportRepo.closedTickets ? reportRepo.closedTickets(filters) : null,
          csat_percent: csatPercent,                     // BS-01
          avg_score: round2(sum.avg_score),
          high_score_count: high,
          low_score_count: sum.low_count || 0,           // BS-03
          distribution: byScore,
          warning: warningFor(total),                    // BS-02
          min_sample: MIN_SAMPLE,
          by_technician: byTechnician,                   // UC4 (null với Marketing – BS-05)
          comparison: {
            previous,
            csat_delta: delta(csatPercent, previous.csat_percent),
            company,
          },
        },
        meta: { generated_at: now().toISOString() },
      };
    },

    /** UC5 – xu hướng CSAT theo tháng/quý của một năm. Kỳ không có phản hồi KHÔNG được nội suy. */
    trend(user, { centerId: requested = null, granularity = 'month', year: yearIn = null } = {}) {
      const centerId = resolveCenter(user, requested);
      const year = yearIn ?? now().getUTCFullYear();

      const rows = reportRepo.trend({ granularity, year, centerId });
      // Mốc tham chiếu cho biểu đồ: CSAT trung bình cả năm (vẽ đường đứt nét)
      const yearRange = { from: `${year}-01-01`, to: `${year}-12-31` };
      const yearSummary = benchmark(reportRepo.summary({ centerId, ...yearRange }), yearRange);
      return {
        data: {
          filters: { center_id: centerId, granularity, year },
          year_summary: yearSummary,
          points: rows.map((r) => ({
            period: r.period,
            label: granularity === 'quarter' ? `Q${r.period}/${year}` : `${String(r.period).padStart(2, '0')}/${year}`,
            total_responses: r.total_responses,
            csat_percent: percent(r.high_count || 0, r.total_responses),
            avg_score: round2(r.avg_score),
            warning: warningFor(r.total_responses),      // BS-02 cho từng kỳ
          })),
        },
        meta: { generated_at: now().toISOString(), min_sample: MIN_SAMPLE },
      };
    },

    /** UC6 – danh sách phản hồi điểm thấp (<= 2). Dùng lại Survey Service để không lặp quy tắc QT-14/QT-15. */
    lowScore(user, { centerId = null, page = 1, limit = 20 } = {}) {
      const result = surveyService.list(user, { status: 'DA_TRA_LOI', scoreMax: LOW_SCORE, centerId, page, limit });
      return { ...result, meta: { ...result.meta, low_score_threshold: LOW_SCORE } };
    },

    /** Danh sách trung tâm cho bộ lọc trên giao diện (quản lý chỉ thấy trung tâm mình – QT-14). */
    listCenters(user) {
      if (user.role === 'quan_ly') {
        const own = centerRepo.findById(user.centerId);
        return { data: own ? [own] : [] };
      }
      if (user.role === 'marketing') return { data: [] };   // BS-05: không lọc theo trung tâm
      return { data: centerRepo.findAll() };
    },
  };
}

module.exports = { createReportService, previousRange, MIN_SAMPLE, HIGH_SCORE, LOW_SCORE };
