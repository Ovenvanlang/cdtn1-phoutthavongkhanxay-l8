-- 004 (TD-23): customer.phone cho phép trống và ràng buộc QT-02 ngay ở CSDL.
-- Lý do: bộ dữ liệu case study không có bảng khách hàng sạch liên kết được với tickets_history
-- (customers_raw.csv dùng record_id riêng, ~20% trùng – việc hợp nhất thuộc luồng L1/L7), nên khi
-- nhập phiếu thật, khách chỉ biết mã mà không biết số điện thoại. Có số thì phải đúng 10 chữ số bắt đầu bằng 0.
-- SQLite không sửa được ràng buộc cột nên dựng lại bảng theo quy trình 12 bước (tắt khóa ngoại,
-- dựng bảng mới, chép dữ liệu, đổi tên); migrate.js chạy PRAGMA foreign_key_check trước khi COMMIT.
-- migrate:foreign_keys=off

CREATE TABLE customer_new (
  customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name   VARCHAR(120) NOT NULL,
  phone       VARCHAR(20) UNIQUE
              CHECK (phone IS NULL OR phone GLOB '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]')
);

INSERT INTO customer_new(customer_id, full_name, phone)
SELECT customer_id, full_name,
       CASE WHEN phone GLOB '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' THEN phone END
  FROM customer;

DROP TABLE customer;
ALTER TABLE customer_new RENAME TO customer;
