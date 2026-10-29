// Hai biểu đồ theo bản thiết kế, dựng bằng Chart.js (phục vụ cục bộ từ /vendor/chartjs).
//  - Cột "Phân bố điểm (1–5)": điểm 1–2 màu đỏ, 3–5 màu xanh, có nhãn số trên đầu cột.
//  - Đường "CSAT theo tháng/quý": có nhãn số tại mỗi điểm; kỳ không có dữ liệu để TRỐNG (không nội suy).
import { phanTram } from './dinh-dang.mjs';

const DO = '#d62828';
const XANH = '#4f7fc0';

/** Plugin nhỏ: vẽ nhãn giá trị, thay cho việc thêm thư viện datalabels. */
function nhanGiaTri({ font = '600 12px "Segoe UI", sans-serif', mau = '#1f2328', doiY = -6, dinhDang = (v) => v }) {
  return {
    id: 'nhan-gia-tri',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.font = font;
      ctx.fillStyle = mau;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      for (const meta of chart.getSortedVisibleDatasetMetas()) {
        if (meta.index > 0) continue;                // chỉ ghi nhãn cho chuỗi dữ liệu chính, không cho đường tham chiếu
        meta.data.forEach((diem, i) => {
          const giaTri = meta._parsed[i]?.y;
          if (giaTri === null || giaTri === undefined) return;
          ctx.fillText(dinhDang(giaTri), diem.x, diem.y + doiY);
        });
      }
      ctx.restore();
    },
  };
}

/** Plugin nhỏ: ghi "T5: không có dữ liệu" ngay tại chỗ trống của đường xu hướng. */
const nhanKyTrong = {
  id: 'nhan-ky-trong',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const giaTri = chart.data.datasets[0]?.data || [];
    ctx.save();
    ctx.font = 'italic 12.5px "Segoe UI", sans-serif';
    ctx.fillStyle = '#8a9099';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    giaTri.forEach((v, i) => {
      if (v !== null && v !== undefined) return;
      const x = scales.x.getPixelForValue(i);
      ctx.fillText(`${chart.data.labels[i]}: không có dữ liệu`, x, chartArea.top + chartArea.height * 0.65);
    });
    ctx.restore();
  },
};

export function veCotPhanBo(canvas, distribution) {
  if (!canvas || !globalThis.Chart) return null;
  const duLieu = [1, 2, 3, 4, 5].map((s) => distribution[s] || 0);
  return new globalThis.Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['1', '2', '3', '4', '5'],
      datasets: [{
        data: duLieu,
        backgroundColor: duLieu.map((_, i) => (i < 2 ? DO : XANH)),
        barPercentage: 0.55,
      }],
    },
    options: {
      maintainAspectRatio: false,
      layout: { padding: { top: 22 } },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: { title: { display: true, text: 'Điểm hài lòng', color: '#6b7280' }, grid: { display: false } },
        y: { display: false, beginAtZero: true, grace: '12%' },
      },
    },
    plugins: [nhanGiaTri({})],
  });
}

/**
 * @param {{label:string, value:number|null}[]} points
 * @param {{value:number, label:string}|null} [thamChieu] đường ngang đứt nét làm MỐC SO SÁNH (ví dụ CSAT trung bình cả năm)
 */
export function veDuongXuHuong(canvas, points, thamChieu = null) {
  if (!canvas || !globalThis.Chart) return null;
  // Trục Y chia chẵn 10 điểm phần trăm bao quanh dữ liệu và mốc (ví dụ 77–86 -> 70, 80, 90)
  const coGiaTri = points.map((p) => p.value).filter((v) => v != null);
  if (thamChieu?.value != null) coGiaTri.push(thamChieu.value);
  const yMin = Math.max(0, Math.floor((Math.min(...coGiaTri) - 3) / 10) * 10);
  const yMax = Math.min(100, Math.ceil((Math.max(...coGiaTri) + 3) / 10) * 10);
  return new globalThis.Chart(canvas, {
    type: 'line',
    data: {
      labels: points.map((p) => p.label),
      datasets: [{
        data: points.map((p) => p.value),          // null = kỳ không có dữ liệu -> để trống
        borderColor: XANH,
        backgroundColor: XANH,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
        spanGaps: false,                           // KHÔNG nối qua kỳ trống (BS-02)
        tension: 0,
      },
      ...(thamChieu?.value != null ? [{
        label: thamChieu.label,
        data: points.map(() => thamChieu.value),
        borderColor: '#8a9099',
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
      }] : [])],
    },
    options: {
      maintainAspectRatio: false,
      layout: { padding: { top: 24 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item) => item.datasetIndex === 0,
          callbacks: { label: (c) => phanTram(c.parsed.y) },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: yMin, max: yMax,
          ticks: { stepSize: 10, color: '#8a9099' },
          border: { display: false },
          grid: { color: '#dfe2e6' },
        },
      },
    },
    plugins: [nhanGiaTri({ dinhDang: (v) => Math.round(v) }), nhanKyTrong],
  });
}
