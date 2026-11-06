-- 006 (BUG-007): tính lại responded_date của dữ liệu ĐÃ CÓ theo giờ Việt Nam (UTC+7, không có giờ mùa hè).
-- Bản cũ cắt ngày từ chuỗi ISO UTC nên phản hồi 00:00–06:59 giờ VN bị gán sang ngày hôm trước.
-- Chỉ sửa dòng có responded_at dạng UTC (kết thúc bằng Z – do API và seed ghi). Dòng nạp từ CSV case study
-- ghi giờ địa phương không kèm múi giờ, ngày đã đúng nên giữ nguyên. Chạy lại không đổi gì thêm.
INSERT OR IGNORE INTO dim_date(date_id, day, month, quarter, year)
SELECT DISTINCT d,
       CAST(strftime('%d', d) AS INTEGER),
       CAST(strftime('%m', d) AS INTEGER),
       (CAST(strftime('%m', d) AS INTEGER) + 2) / 3,
       CAST(strftime('%Y', d) AS INTEGER)
  FROM (SELECT date(responded_at, '+7 hours') AS d FROM survey_response WHERE responded_at LIKE '%Z');

UPDATE survey_response
   SET responded_date = date(responded_at, '+7 hours')
 WHERE responded_at LIKE '%Z'
   AND responded_date IS NOT date(responded_at, '+7 hours');
