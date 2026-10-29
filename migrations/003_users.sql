-- 003: bảng tài khoản phục vụ đăng nhập (Buổi 10). Mật khẩu chỉ lưu DẠNG BĂM (scrypt), không lưu bản rõ.
CREATE TABLE IF NOT EXISTS app_user (
  user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  username      VARCHAR(40)  NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  role          VARCHAR(12)  NOT NULL
                CHECK (role IN ('he_thong','quan_ly','bgd','marketing')),
  center_id     INTEGER REFERENCES service_center(center_id),
  is_active     BOOLEAN NOT NULL DEFAULT 1,
  -- QT-14: quản lý trung tâm BẮT BUỘC gắn với đúng một trung tâm; các vai trò khác xem toàn hệ thống
  CHECK (role <> 'quan_ly' OR center_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_app_user_role ON app_user(role, is_active);
