-- 005 (BUG-006): mỗi khảo sát có MÃ TRUY CẬP ngẫu nhiên 128 bit, gửi cho khách trong đường dẫn
--   khao-sat.html?ticket=<id>&t=<access_token>
-- Trước đây form công khai chỉ cần ticket_id (số tăng dần) nên ai cũng đoán được và gửi điểm thay khách (OWASP A01).
ALTER TABLE survey_response ADD COLUMN access_token TEXT;

UPDATE survey_response SET access_token = lower(hex(randomblob(16))) WHERE access_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_survey_access_token ON survey_response(access_token);

-- Mọi nơi tạo khảo sát (API UC1, seed, nạp CSV) đều tự có mã, không phụ thuộc mã nguồn có nhớ sinh hay không
CREATE TRIGGER IF NOT EXISTS trg_survey_access_token
AFTER INSERT ON survey_response
WHEN NEW.access_token IS NULL
BEGIN
  UPDATE survey_response SET access_token = lower(hex(randomblob(16))) WHERE response_id = NEW.response_id;
END;
