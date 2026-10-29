// Component DataState: MỌI vùng dữ liệu trên giao diện đều đi qua đây nên luôn có đủ
// 3 trạng thái "đang tải / không có dữ liệu / lỗi + nút Thử lại" — không trang nào phải tự vẽ lại.
// Trạng thái rỗng có hai nghĩa phải nói khác nhau (bài 65): "chưa có dữ liệu" và "bộ lọc không ra kết quả";
// loại thứ hai kèm nút hành động (ví dụ "Xóa bộ lọc") để người dùng biết vấn đề nằm ở bộ lọc.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const SPINNER = '<span class="quay" aria-hidden="true"></span>';

/**
 * @param {HTMLElement} el phần tử chứa vùng dữ liệu
 * @returns {{state:string, loading:Function, empty:Function, error:Function, content:Function}}
 */
export function createDataState(el, { emptyText = 'Chưa có dữ liệu cho bộ lọc này' } = {}) {
  if (!el) throw new Error('DataState cần một phần tử chứa');
  el.dataset.state = 'idle';

  const set = (state, html) => {
    el.dataset.state = state;
    el.innerHTML = html;
  };

  return {
    get state() {
      return el.dataset.state;
    },
    get element() {
      return el;
    },

    loading(text = 'Đang tải dữ liệu…') {
      set('loading', `<div class="ds ds--loading" role="status" aria-live="polite">${SPINNER}
        <span class="ds__text">${escapeHtml(text)}</span></div>`);
    },

    /**
     * @param {string} [text]
     * @param {{actionLabel?: string, onAction?: Function, kind?: 'chua-co-du-lieu'|'bo-loc'}} [opts]
     */
    empty(text = emptyText, { actionLabel, onAction, kind = 'chua-co-du-lieu' } = {}) {
      const button = actionLabel && onAction
        ? `<button type="button" class="nut-vien" data-ds-action>${escapeHtml(actionLabel)}</button>` : '';
      set('empty', `<div class="ds ds--empty" data-kind="${kind}"><p class="ds__text">${escapeHtml(text)}</p>${button}</div>`);
      if (button) el.querySelector('[data-ds-action]').addEventListener('click', () => onAction());
    },

    /** @param {{message?:string, code?:string}} err @param {Function} [onRetry] */
    error(err, onRetry) {
      const message = escapeHtml(err?.message || 'Có lỗi xảy ra, vui lòng thử lại');
      const code = err?.code ? `<p class="ds__code">Mã lỗi: ${escapeHtml(err.code)}</p>` : '';
      const button = onRetry ? '<button type="button" class="nut-vien" data-ds-retry>Thử lại</button>' : '';
      set('error', `<div class="ds ds--error" role="alert">
        <p class="ds__text">${message}</p>${code}${button}</div>`);
      if (onRetry) el.querySelector('[data-ds-retry]').addEventListener('click', () => onRetry());
    },

    /** @param {string|Node} content chuỗi HTML đã làm sạch hoặc một phần tử DOM */
    content(content) {
      el.dataset.state = 'content';
      if (typeof content === 'string') el.innerHTML = content;
      else {
        el.innerHTML = '';
        el.append(content);
      }
    },
  };
}

/**
 * Nạp dữ liệu qua DataState: tự chuyển trạng thái và tự gắn nút "Thử lại" gọi lại chính nó.
 * @param {ReturnType<createDataState>} ds
 * @param {() => Promise<any>} loader hàm gọi API (lấy từ lớp api/, trang không gọi fetch)
 * @param {(data:any) => (string|Node|null)} render trả về null/'' nếu coi là KHÔNG CÓ DỮ LIỆU
 * @param {{loadingText?:string, emptyText?:string, emptyOptions?:object}} [opts] emptyOptions chuyển cho ds.empty()
 */
export async function load(ds, loader, render, { loadingText, emptyText, emptyOptions } = {}) {
  ds.loading(loadingText);
  try {
    const data = await loader();
    const view = render(data);
    if (view === null || view === undefined || view === '') ds.empty(emptyText, emptyOptions);
    else ds.content(view);
    return data;
  } catch (err) {
    ds.error(err, () => load(ds, loader, render, { loadingText, emptyText, emptyOptions }));
    return null;
  }
}
