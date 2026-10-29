# Dữ liệu mẫu trích từ bộ CSV chính thức của case study

Nguồn: bộ dữ liệu "Smart CRM – Mekong Mobile" trên LMS, sinh bằng `gen_dataset.py` với **seed = 20260901**
(16 tệp, 187.650 dòng – xem `02_case_study/15` của học liệu). Bộ đầy đủ không commit (`data/raw/` nằm trong `.gitignore`).

Thư mục này giữ một mẫu nhỏ, **chép nguyên văn các dòng gốc** (không sửa giá trị), đủ để người chấm chạy
đường nạp dữ liệu thật mà không cần tải gì thêm:

| Tệp | Số dòng | Cách chọn |
|---|---:|---|
| `service_centers.csv` | 6 | toàn bộ |
| `technicians.csv` | 38 | toàn bộ |
| `survey_responses.csv` | 1.200 | 1.200 phản hồi mới nhất theo `responded_at` (10/2025 – 09/2026) |
| `tickets_history.csv` | 1.400 | phiếu của các phản hồi trên + 200 phiếu có `ticket_id` lớn nhất (gồm phiếu chưa đóng và phiếu đã đóng chưa khảo sát) |

Tạo lại mẫu từ bộ đầy đủ (kết quả giống hệt vì cách chọn tất định):

```bash
node scripts/tao-du-lieu-mau.js data/raw data/sample 1200
```

Nạp vào CSDL (thay cho dữ liệu mô phỏng của `npm run db:setup`):

```bash
npm run import -- data/sample
```

Không dùng `customers_raw.csv`: tệp này đánh số `record_id` riêng, không liên kết được với `customer_id` của
`tickets_history.csv` (hợp nhất khách hàng là việc của luồng L1/L7), nên khách của mỗi phiếu được tạo ở mức tối thiểu
và chưa có số điện thoại – xem TD-23 trong `docs/thay-doi-thiet-ke.md`.
