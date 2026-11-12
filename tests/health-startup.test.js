// Khởi động an toàn và /health thật (đối chiếu tự học buổi 15, bài 46 §1 và 46a §3).
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { openDb } = require('../src/backend/db/connection');
const { migrate } = require('../src/backend/db/migrate');
const { createApp } = require('../src/backend/app');
const { authSecretProblem } = require('../src/backend/config');

const SERVER = path.join(__dirname, '..', 'src', 'backend', 'server.js');
function chayServer(secret) {
  const tep = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'csat-start-')), 'k.db');
  return spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', SERVER], {
    env: { ...process.env, AUTH_SECRET: secret, DATABASE_FILE: tep, PORT: '0' }, encoding: 'utf8', timeout: 10000,
  });
}

test('AUTH_SECRET thiếu hoặc ngắn hơn 32 ký tự -> server dừng ngay (mã 1), thông báo KHÔNG in lại giá trị khóa', () => {
  const ngan = chayServer('khoa-ngan-31-ky-tu-xxxxxxxxxxxx');
  assert.strictEqual(ngan.status, 1);
  assert.match(ngan.stderr, /AUTH_SECRET quá ngắn \(31 ký tự, cần ít nhất 32\)/);
  assert.ok(!ngan.stderr.includes('khoa-ngan-31'), 'không lộ khóa trong log');
  assert.match(authSecretProblem(''), /Thiếu AUTH_SECRET/);
  assert.strictEqual(authSecretProblem('x'.repeat(32)), null, 'đúng 32 ký tự là đủ');
});

test('/health kiểm cả CSDL: up -> 200 {status ok, db up}; CSDL hỏng -> 503 db down, API -> 500 không lộ chi tiết', async (t) => {
  const db = openDb(':memory:');
  migrate(db);
  const server = createApp({ db, authSecret: 'x'.repeat(32) }).listen(0);
  await new Promise((r) => server.once('listening', r));
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}`;

  const up = await fetch(`${base}/health`);
  assert.strictEqual(up.status, 200);
  assert.deepStrictEqual(await up.json(), { status: 'ok', db: 'up' });

  db.close();                                                      // giả lập CSDL không dùng được
  const loiGoc = console.error; console.error = () => {};          // lỗi 500 vẫn ghi log máy chủ; tắt in trong test
  try {
    const down = await fetch(`${base}/health`);
    assert.strictEqual(down.status, 503);
    assert.deepStrictEqual(await down.json(), { status: 'error', db: 'down' });
    const api = await fetch(`${base}/api/surveys/1`, { headers: { 'X-Survey-Code': 'a'.repeat(32) } });
    const body = await api.text();
    assert.strictEqual(api.status, 500);
    assert.deepStrictEqual(JSON.parse(body), { error: 'LOI_HE_THONG', message: 'Có lỗi hệ thống, vui lòng thử lại' });
    assert.doesNotMatch(body, /sqlite|survey_response|SELECT|at \w+ \(|node_modules/i);
  } finally {
    console.error = loiGoc;
  }
});
