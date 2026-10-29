-- DDL thiết kế ở BT1 (Chương 4) – luồng L8 Khảo sát hài lòng CSAT. Giữ nguyên làm mốc đối chiếu.
-- Bản ĐÃ HIỆN THỰC là migrations/001–004 (thêm app_user – TD-14; customer.phone cho phép trống – TD-23);
-- sơ đồ thực tế: docs/erd-thuc-te.png. Tên tệp cũ: DDL_LB.sql (đổi tên ở TD-29).
PRAGMA foreign_keys = ON;

CREATE TABLE service_center (
  center_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  center_name VARCHAR(60) NOT NULL UNIQUE,
  city        VARCHAR(40) NOT NULL
);

CREATE TABLE technician (
  technician_id INTEGER PRIMARY KEY AUTOINCREMENT,
  center_id     INTEGER NOT NULL REFERENCES service_center(center_id),
  full_name     VARCHAR(120) NOT NULL,
  level         VARCHAR(10) NOT NULL
                CHECK (level IN ('SO_CAP','TRUNG_CAP','CAO_CAP')),
  is_active     BOOLEAN NOT NULL DEFAULT 1
);

CREATE TABLE customer (
  customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name   VARCHAR(120) NOT NULL,
  phone       VARCHAR(20)  NOT NULL UNIQUE
);

CREATE TABLE ticket (
  ticket_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_code   VARCHAR(20) NOT NULL UNIQUE,
  customer_id   INTEGER NOT NULL REFERENCES customer(customer_id),
  center_id     INTEGER NOT NULL REFERENCES service_center(center_id),
  technician_id INTEGER REFERENCES technician(technician_id),
  status        VARCHAR(20) NOT NULL
                CHECK (status IN ('MOI','DA_PHAN_CONG','DANG_XU_LY',
                       'CHO_LINH_KIEN','HOAN_TAT','DA_DONG','DA_HUY')),
  closed_at     TIMESTAMP
);

CREATE TABLE dim_date (
  date_id DATE PRIMARY KEY,
  day     SMALLINT NOT NULL,
  month   SMALLINT NOT NULL,
  quarter SMALLINT NOT NULL,
  year    SMALLINT NOT NULL
);

CREATE TABLE survey_response (
  response_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id      INTEGER NOT NULL UNIQUE REFERENCES ticket(ticket_id),
  status         VARCHAR(12) NOT NULL DEFAULT 'DA_GUI'
                 CHECK (status IN ('DA_GUI','DA_TRA_LOI')),
  sent_at        TIMESTAMP NOT NULL,
  score          SMALLINT CHECK (score BETWEEN 1 AND 5),
  comment        TEXT CHECK (comment IS NULL OR length(comment) <= 500),
  responded_at   TIMESTAMP,
  responded_date DATE REFERENCES dim_date(date_id),
  is_deleted     BOOLEAN NOT NULL DEFAULT 0,
  CHECK (
    (status = 'DA_GUI'     AND score IS NULL     AND responded_at IS NULL) OR
    (status = 'DA_TRA_LOI' AND score IS NOT NULL AND responded_at IS NOT NULL)
  )
);

CREATE INDEX idx_ticket_center_tech ON ticket(center_id, technician_id);
CREATE INDEX idx_survey_resp_date   ON survey_response(responded_date);
