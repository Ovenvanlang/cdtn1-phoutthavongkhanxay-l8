// Chạy lại MỘT (hoặc vài) test case của Test Report theo mã:  npm run tc -- TC-05   |   npm run tc -- TC-1[01]
// Không có mã thì chạy cả 12 case. In kết quả thực tế (dòng ℹ) để đối chiếu cột "Kết quả thực tế".
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ma = process.argv[2];
const args = ['--disable-warning=ExperimentalWarning', '--test', '--test-reporter=spec'];
if (ma) args.push(`--test-name-pattern=^${ma}\\b`);
args.push(path.join(__dirname, '..', 'tests', 'test-cases.test.js'));
const kq = spawnSync(process.execPath, args, { stdio: 'inherit' });
process.exit(kq.status ?? 1);
