// Lớp HTTP: gom mọi lỗi về một định dạng { "error": "<MA_LOI>", "message": "...", "field"?: "..." }
// và là nơi DUY NHẤT quy mã lỗi nghiệp vụ ra mã trạng thái HTTP.
const { AppError } = require('../errors/AppError');

const HTTP_STATUS_BY_CODE = {
  DU_LIEU_KHONG_HOP_LE: 400,
  CHUA_DANG_NHAP: 401,
  TOKEN_KHONG_HOP_LE: 401,
  SAI_TAI_KHOAN_HOAC_MAT_KHAU: 401,
  KHONG_DU_QUYEN: 403,
  KHONG_TIM_THAY: 404,
  PHIEU_CHUA_DONG: 409,
  DA_KHAO_SAT: 409,
  TEN_DANG_NHAP_DA_TON_TAI: 409,
  KHONG_TU_THAO_TAC: 409,
  PHAI_CON_MOT_BGD: 409,
};

function notFound(req, res) {
  res.status(404).json({ error: 'KHONG_TIM_THAY', message: `Không có đường dẫn ${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError && HTTP_STATUS_BY_CODE[err.code]) {
    const body = { error: err.code, message: err.message };
    if (err.field) body.field = err.field;
    return res.status(HTTP_STATUS_BY_CODE[err.code]).json(body);
  }
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError)
    return res.status(400).json({ error: 'DU_LIEU_KHONG_HOP_LE', message: 'Nội dung gửi lên không phải JSON hợp lệ' });
  if (err.type === 'entity.too.large')
    return res.status(400).json({ error: 'DU_LIEU_KHONG_HOP_LE', message: 'Nội dung gửi lên quá lớn' });
  console.error(err);                              // lỗi ngoài dự kiến: ghi log, KHÔNG trả chi tiết thô cho người dùng
  res.status(500).json({ error: 'LOI_HE_THONG', message: 'Có lỗi hệ thống, vui lòng thử lại' });
}

module.exports = { notFound, errorHandler, HTTP_STATUS_BY_CODE };
