const config = require('./config');
const { openDb } = require('./db/connection');
const { migrate } = require('./db/migrate');
const { createApp } = require('./app');

// Không có khóa ký token, hoặc khóa ngắn hơn 32 ký tự, thì KHÔNG chạy
// (tránh phát hành token ký bằng khóa mặc định ai cũng biết hoặc khóa dò được).
const loiKhoa = config.authSecretProblem(config.authSecret);
if (loiKhoa) {
  console.error(loiKhoa);                      // chỉ báo độ dài, KHÔNG in giá trị khóa
  process.exit(1);
}

const db = openDb(config.databaseFile);
migrate(db);                                   // đảm bảo CSDL luôn ở phiên bản mới nhất khi khởi động
const app = createApp({ db });
const server = app.listen(config.port, () => console.log(`API khảo sát CSAT chạy tại http://localhost:${config.port}`));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(() => { db.close(); process.exit(0); }); });
