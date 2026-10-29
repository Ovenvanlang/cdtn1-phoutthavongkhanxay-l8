// Chạy các tệp migrations/*.sql (thư mục migrations/ ở gốc dự án) theo thứ tự tên,
// mỗi tệp một lần (ghi vào schema_migrations) nên chạy lại bao nhiêu lần cũng không lỗi.
const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'migrations');

// Tệp có dòng này thì chạy khi TẮT khóa ngoại (quy trình dựng lại bảng 12 bước của SQLite),
// rồi kiểm tra toàn vẹn bằng PRAGMA foreign_key_check trước khi COMMIT.
const FK_OFF_MARKER = '-- migrate:foreign_keys=off';

function migrate(db, dir = MIGRATIONS_DIR) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
             name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
  const done = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name));
  const applied = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const fkOff = sql.includes(FK_OFF_MARKER);
    if (fkOff) db.exec('PRAGMA foreign_keys = OFF');      // chỉ có tác dụng NGOÀI transaction
    db.exec('BEGIN');
    try {
      db.exec(sql);
      if (fkOff) {
        const broken = db.prepare('PRAGMA foreign_key_check').all();
        if (broken.length) throw new Error(`${broken.length} dòng vi phạm khóa ngoại sau khi dựng lại bảng`);
      }
      db.prepare('INSERT INTO schema_migrations(name, applied_at) VALUES (?, ?)')
        .run(file, new Date().toISOString());
      db.exec('COMMIT');
      applied.push(file);
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${file} thất bại: ${err.message}`);
    } finally {
      if (fkOff) db.exec('PRAGMA foreign_keys = ON');
    }
  }
  return applied;
}

module.exports = { migrate };

if (require.main === module) {
  const { openDb } = require('./connection');
  const config = require('../config');
  const db = openDb(config.databaseFile);
  const applied = migrate(db);
  console.log(applied.length ? `Đã chạy migration: ${applied.join(', ')}` : 'CSDL đã ở phiên bản mới nhất.');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  console.log('Bảng hiện có:', tables.map((t) => t.name).join(', '));
  db.close();
}
