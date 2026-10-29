// Test tầng validation 1 (validators/): chỉ kiểm định dạng & kiểu, không cần CSDL hay HTTP.
// Mỗi lỗi phải có mã DU_LIEU_KHONG_HOP_LE và nói rõ trường nào sai.
const { test } = require('node:test');
const assert = require('node:assert');
const survey = require('../src/backend/validators/survey.validator');
const report = require('../src/backend/validators/report.validator');
const auth = require('../src/backend/validators/auth.validator');

const loiTruong = (field) => (e) => e.code === 'DU_LIEU_KHONG_HOP_LE' && e.field === field;

test('Luồng đúng: thân yêu cầu hợp lệ được chuẩn hóa (cắt khoảng trắng, chuỗi số -> số)', () => {
  assert.deepStrictEqual(survey.submitBody({ score: 4, comment: '  Tốt  ' }), { score: 4, comment: 'Tốt' });
  assert.deepStrictEqual(survey.submitBody({ score: 5, comment: '   ' }), { score: 5, comment: null });
  assert.deepStrictEqual(survey.createBody({ ticket_id: 149 }), { ticketId: 149 });
  assert.strictEqual(survey.ticketId('12'), 12);
  assert.deepStrictEqual(survey.listQuery({ center_id: '2', score_max: '2', page: '3' }),
    { status: null, centerId: 2, scoreMax: 2, page: 3, limit: 20 });
  assert.deepStrictEqual(auth.loginBody({ username: ' bgd ', password: 'x' }), { username: 'bgd', password: 'x' });
});

test('Giá trị biên: điểm 1 và 5 nhận, 0 và 6 từ chối; nhận xét đúng 500 ký tự nhận, 501 từ chối', () => {
  assert.strictEqual(survey.submitBody({ score: 1 }).score, 1);
  assert.strictEqual(survey.submitBody({ score: 5 }).score, 5);
  assert.throws(() => survey.submitBody({ score: 0 }), loiTruong('score'));
  assert.throws(() => survey.submitBody({ score: 6 }), loiTruong('score'));
  assert.strictEqual(survey.submitBody({ score: 3, comment: 'x'.repeat(500) }).comment.length, 500);
  assert.throws(() => survey.submitBody({ score: 3, comment: 'x'.repeat(501) }), loiTruong('comment'));
});

test('Giá trị biên: limit 100 nhận, 101 từ chối; from = to (một ngày) nhận', () => {
  assert.strictEqual(report.lowScoreQuery({ limit: '100' }).limit, 100);
  assert.throws(() => report.lowScoreQuery({ limit: '101' }), loiTruong('limit'));
  assert.deepStrictEqual(report.csatQuery({ from: '2026-10-01', to: '2026-10-01' }),
    { centerId: null, from: '2026-10-01', to: '2026-10-01' });
});

test('Dữ liệu sai: thiếu trường bắt buộc / sai kiểu -> lỗi rõ ràng kèm tên trường', () => {
  assert.throws(() => survey.submitBody({ comment: 'quên điểm' }), loiTruong('score'));
  assert.throws(() => survey.submitBody({ score: '5' }), loiTruong('score'), 'chuỗi "5" không phải số');
  assert.throws(() => survey.submitBody({ score: 2.5 }), loiTruong('score'));
  assert.throws(() => survey.submitBody({ score: 4, comment: 123 }), loiTruong('comment'));
  assert.throws(() => survey.submitBody(null), loiTruong('body'));
  assert.throws(() => survey.submitBody([4]), loiTruong('body'));
  assert.throws(() => survey.createBody({}), loiTruong('ticket_id'));
  assert.throws(() => survey.ticketId('abc'), loiTruong('ticket_id'));
  assert.throws(() => survey.ticketId('0'), loiTruong('ticket_id'));
  assert.throws(() => survey.listQuery({ status: 'XOA' }), loiTruong('status'));
  assert.throws(() => survey.listQuery({ score_max: '9' }), loiTruong('score_max'));
  assert.throws(() => auth.loginBody({ username: 'ql1' }), loiTruong('password'));
  assert.throws(() => auth.loginBody({}), loiTruong('username'));
});

test('Dữ liệu sai: ngày không có thật, sai định dạng, from > to; năm và chu kỳ ngoài tập cho phép', () => {
  assert.throws(() => report.csatQuery({ from: '10/01/2026' }), loiTruong('from'));
  assert.throws(() => report.csatQuery({ to: '2026-02-30' }), loiTruong('to'), '30/02 không tồn tại');
  assert.throws(() => report.csatQuery({ from: '2026-12-31', to: '2026-01-01' }), loiTruong('from'));
  assert.throws(() => report.csatQuery({ center_id: 'HCM' }), loiTruong('center_id'));
  assert.throws(() => report.trendQuery({ granularity: 'tuan' }), loiTruong('granularity'));
  assert.throws(() => report.trendQuery({ year: '1800' }), loiTruong('year'));
  assert.throws(() => report.trendQuery({ year: '20x6' }), loiTruong('year'));
  assert.deepStrictEqual(report.trendQuery({}), { centerId: null, granularity: 'month', year: null });
});
