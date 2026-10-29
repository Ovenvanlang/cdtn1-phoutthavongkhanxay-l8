// Lớp repository: CHỈ chứa SQL cho bảng app_user. Không chứa quy tắc nghiệp vụ.
// Các câu SELECT công khai KHÔNG bao giờ trả cột password_hash.
const PUBLIC_COLUMNS = `
  u.user_id, u.username, u.full_name, u.role, u.center_id, sc.center_name, u.is_active`;
const FROM_USER = `
  FROM app_user u
  LEFT JOIN service_center sc ON sc.center_id = u.center_id`;

const toPublic = (row) => (row ? { ...row, is_active: Boolean(row.is_active) } : row);

function createUserRepository(db) {
  const byUsername = db.prepare(
    `SELECT user_id, username, password_hash, full_name, role, center_id, is_active
       FROM app_user WHERE username = ?`);
  const byId = db.prepare(`SELECT ${PUBLIC_COLUMNS} ${FROM_USER} WHERE u.user_id = ?`);
  const insert = db.prepare(
    'INSERT INTO app_user(username, password_hash, full_name, role, center_id) VALUES (?,?,?,?,?)');
  const count = db.prepare('SELECT COUNT(*) AS n FROM app_user');
  const countActiveRole = db.prepare('SELECT COUNT(*) AS n FROM app_user WHERE role = ? AND is_active = 1');

  return {
    /** Dùng cho đăng nhập: có password_hash. */
    findByUsername: (username) => byUsername.get(username),
    findById: (userId) => toPublic(byId.get(userId)),
    insert: (u) => Number(insert.run(u.username, u.passwordHash, u.fullName, u.role, u.centerId ?? null).lastInsertRowid),
    count: () => count.get().n,
    countActiveByRole: (role) => countActiveRole.get(role).n,

    /** Danh sách có lọc + phân trang; mảnh SQL cố định, giá trị truyền qua tham số. */
    list({ role, centerId, isActive, limit, offset }) {
      const where = [];
      const params = [];
      if (role)             { where.push('u.role = ?');      params.push(role); }
      if (centerId != null) { where.push('u.center_id = ?'); params.push(centerId); }
      if (isActive != null) { where.push('u.is_active = ?'); params.push(isActive ? 1 : 0); }
      const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = db.prepare(`SELECT COUNT(*) AS n FROM app_user u ${w}`).get(...params).n;
      const rows = db.prepare(`SELECT ${PUBLIC_COLUMNS} ${FROM_USER} ${w} ORDER BY u.user_id LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);
      return { rows: rows.map(toPublic), total };
    },

    /** Cập nhật các cột được truyền (tên cột lấy từ danh sách cố định, không lấy từ người dùng). */
    update(userId, changes) {
      const COLUMNS = { fullName: 'full_name', role: 'role', centerId: 'center_id', passwordHash: 'password_hash', isActive: 'is_active' };
      const sets = [];
      const params = [];
      for (const [key, column] of Object.entries(COLUMNS)) {
        if (!(key in changes)) continue;
        sets.push(`${column} = ?`);
        params.push(key === 'isActive' ? (changes[key] ? 1 : 0) : changes[key]);
      }
      if (!sets.length) return 0;
      return db.prepare(`UPDATE app_user SET ${sets.join(', ')} WHERE user_id = ?`).run(...params, userId).changes;
    },
  };
}

module.exports = { createUserRepository };
