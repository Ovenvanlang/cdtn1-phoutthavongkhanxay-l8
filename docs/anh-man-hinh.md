# Ảnh chụp màn hình – BT2 (tag v0.2)

Chụp trên bản chạy thật (`npm run db:setup` – dữ liệu mô phỏng seed = 42, rồi `npm start`), trình duyệt Chromium 1360 px.
Tệp ảnh nằm trong `docs/img/`. Giao diện dựng theo 3 bản thiết kế wireframe của BT1 (Hình 5.1–5.3).

## Ba màn hình chính (TP3 – lấy dữ liệu từ API thật qua `src/frontend/api/`)
| Ảnh | Nội dung | Yêu cầu chứng minh |
|---|---|---|
| `bt2-03_man-hinh-1-form-khao-sat.png` | **Màn hình 1** – form khảo sát của khách: thẻ phiếu `BH-001151/2026`, 5 nút điểm, ô nhận xét có bộ đếm | UC2, wireframe 5.1 |
| `bt2-04_khao-sat-chua-chon-diem.png` | Bấm gửi khi chưa chọn điểm → báo lỗi tại chỗ, không gọi máy chủ | validation tầng giao diện |
| `bt2-05_gui-phan-hoi-thanh-cong.png` | Gửi xong: ghi nhận 4/5, khóa biểu mẫu | UC2, QT-10 |
| `bt2-06_man-hinh-2-bao-cao-csat-quan-ly.png` | **Màn hình 2** – quản lý TTBH Quận 10: 4 thẻ KPI **kèm kỳ trước**, phân bố điểm, bảng kỹ thuật viên có nhãn ⚠ n < 5 | UC3, UC4, QT-14, BS-01, BS-02, mốc so sánh |
| `bt2-07_bgd-loc-trung-tam-co-moc-toan-he-thong.png` | Ban giám đốc lọc một trung tâm: thêm dòng **"Toàn hệ thống: x%"** | mốc so sánh, TD-27 |
| `bt2-10_man-hinh-3-xu-huong-diem-thap.png` | **Màn hình 3** – CSAT theo tháng có **đường đứt nét CSAT trung bình năm**, bảng phản hồi ≤ 2 điểm kèm SĐT | UC5, UC6, BS-03, QT-15 |

## Ba trạng thái bắt buộc (đang tải · rỗng · lỗi)
| Ảnh | Trạng thái | Cách tạo lại |
|---|---|---|
| `bt2-09_dang-tai.png` | **Đang tải** – vòng quay "Đang tính CSAT…" | mạng chậm (ảnh chụp khi API bị làm chậm 4 giây) |
| `bt2-13_rong-chua-co-du-lieu.png` | **Rỗng – chưa có dữ liệu**: "Chưa có phản hồi nào trong năm 2026." (không có nút) | CSDL mới, chưa nạp seed |
| `bt2-08_rong-do-bo-loc-co-nut-xoa-bo-loc.png` | **Rỗng – bộ lọc không ra kết quả**: "Không có phản hồi nào khớp bộ lọc đang chọn." + nút **Xóa bộ lọc**; thẻ CSAT hiện "—" thay vì 0% (BS-02) | chọn 01/01/2024 – 31/01/2024 |
| `bt2-11_tat-backend-loi-va-nut-thu-lai.png` | **Lỗi kết nối** – tắt backend rồi bấm "Áp dụng": cả ba vùng báo lỗi kèm mã và nút **Thử lại**, không màn hình trắng | tắt `npm start` |
| `bt2-12_bat-lai-bam-thu-lai-tai-duoc.png` | Bật lại backend, bấm **Thử lại** → dữ liệu hiển thị bình thường | bật lại `npm start` |

## Khác
| Ảnh | Nội dung |
|---|---|
| `bt2-01_trang-chu.png` | Trang chủ: lối vào 3 màn hình và danh sách tài khoản demo |
| `bt2-02_dang-nhap-sai-mat-khau.png` | Đăng nhập sai mật khẩu: báo lỗi tại chỗ, không chuyển trang |

## Đối chiếu với bản thiết kế wireframe
| Thành phần trong thiết kế | Hiện thực |
|---|---|
| Dải đầu đỏ, nút tròn 1–5, bộ đếm `x / 500`, ghi chú QT-10 | đúng như thiết kế |
| Thanh bên tối 4 mục, mục đang mở tô đỏ, chân thanh ghi người đăng nhập | đúng |
| 4 thẻ KPI (CSAT xanh lá, Điểm trung bình, Tổng phản hồi, Điểm thấp đỏ) | đúng; **thêm** dòng so sánh kỳ trước (đề BT2 TP3 – TD-27) |
| Biểu đồ cột phân bố điểm (1–2 đỏ, 3–5 xanh, có nhãn số) | đúng |
| Bảng kỹ thuật viên xếp CSAT giảm dần, nhãn `⚠ n < 5` | đúng |
| Biểu đồ đường CSAT theo tháng, kỳ trống để hở, không nội suy | đúng; **thêm** đường đứt nét trung bình năm làm mốc |
| Bảng điểm thấp: Thời điểm · Mã phiếu · Kỹ thuật viên · Điểm · Nhận xét · SĐT | đúng; khách nạp từ CSV chưa có số ghi "chưa có SĐT" (TD-23) |
| Dòng "Thiết bị: iPhone 15 Pro Max" trên thẻ phiếu | **không hiện thực**: ERD/DDL BT1 không có bảng thiết bị (TD-18) |
| Ghi chú "phản hồi ≤ 2 điểm tạo thông báo (UC7)" | giữ câu chữ, ghi rõ "chưa hiện thực, xem TD-16" |

Nhật ký chạy thật (test, dựng CSDL 2 lần, chạy trọn luồng trên dữ liệu mô phỏng và dữ liệu case study): `ket-qua-chay-mau.txt`.
