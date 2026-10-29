-- 002: chỉ mục phục vụ NFR1 (báo cáo CSAT <= 2 giây).
CREATE INDEX IF NOT EXISTS idx_ticket_center_tech ON ticket(center_id, technician_id);
CREATE INDEX IF NOT EXISTS idx_survey_resp_date   ON survey_response(responded_date);
CREATE INDEX IF NOT EXISTS idx_survey_status      ON survey_response(status, is_deleted);
