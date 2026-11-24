<div align="center">

# 🌌 Codeforces Effect

**Tiện ích Chrome mở rộng Manifest V3 tùy biến hình nền, giao diện tối/sáng và dịch thuật thông minh cho Codeforces**

<br />

<p align="center">
  <img src="https://img.shields.io/badge/CODEFORCES_EFFECT-V1.3.0_ALPHA-7B2CBF?style=for-the-badge&logo=codeforces&logoColor=white" alt="Codeforces Effect" />
  <img src="https://img.shields.io/badge/NODE.JS-%3E%3D20.12-238636?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/MANIFEST-V3-1f6feb?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/LICENSE-MIT-007ACC?style=for-the-badge" alt="License" />
</p>

<br />

### 🎬 Video Demo Trải Nghiệm


https://github.com/user-attachments/assets/ae90bd75-06f7-49f7-b89e-071c69ee9092


<sub>*(Video demo trải nghiệm trực tiếp tính năng Codeforces Effect)*</sub>

</div>

---

## ✨ Tính năng nổi bật

1. **Tải ảnh và video tùy thích qua Popup**:
   - **Tích hợp sẵn Video mẫu chất lượng cao**: Đi kèm sẵn video nền siêu mượt định dạng WebM nhẹ *Interstellar Gargantua (1080p Full HD)* và *Chilling Cat (Live Wallpaper)*.
   - **Tải tệp lên**: Kéo & thả hoặc nhấp duyệt từ máy tính. Hỗ trợ ảnh (JPG, PNG, WebP, GIF) và video (MP4, WebM).
   - **Nhập liên kết (URL)**: Dán link **YouTube** (`https://www.youtube.com/watch?v=...`, `youtu.be/...`, shorts) hoặc link trực tiếp đến ảnh / video MP4/WebM để áp dụng ngay.
   - **Video nền phát lặp lại (Loop)**: Hỗ trợ cả YouTube iframe nhúng lẫn video HTML5, tự động chạy lặp lại không tiếng (`autoplay`, `loop`, `muted`).
   - **Lưu lịch sử nền gần nhất & Cache ngầm tức thì**: Tự động lưu các nền bạn từng dùng gần đây kèm ảnh thumbnail và huy hiệu `▶ YouTube`, `▶ Video ⚡` hoặc `Ảnh ⚡`. Lần đầu tiên phát từ mạng để không phải chờ đợi, đồng thời tải và lưu ngầm bản sao vào bộ nhớ máy; các lần sau sẽ tự động phát trực tiếp từ máy siêu tốc và hỗ trợ offline.
2. **Theo dõi chuỗi ngày nộp bài liên tiếp (Streak Tracker)**:
   - Tự động nhận diện tài khoản sau khi đăng nhập Codeforces.
   - Trích xuất dữ liệu hoạt động từ `userActivityGraph` (hoặc Codeforces status API) trên trang cá nhân của bạn.
   - Hiển thị huy hiệu chuỗi ngày nộp bài ngay bên trái tên tài khoản ở thanh Header trên cùng:
     - Format hiển thị: `🔥 Streak: X`
     - **Màu sắc trạng thái**:
       - **Màu cam rực rỡ**: Khi chuỗi > 0 VÀ hôm nay đã nộp bài (chuỗi được duy trì/tăng).
       - **Màu xám**: Khi chuỗi = 0 HOẶC hôm nay chưa nộp bài để giữ chuỗi (nhắc nhở cần làm bài).
   - Khi bấm vào huy hiệu trên web: mở bảng chi tiết hiển thị **Số bài nộp trong chuỗi hiện tại**, kỷ lục dài nhất, tổng ngày nộp và nút làm mới dữ liệu.
   - Đồng thời hiển thị thẻ thống kê trực quan ngay trong Popup của tiện ích.
3. **Dịch thuật đa ngôn ngữ (Google Translate, Gemini AI & Mistral xKiro)**:
   - Tự động dịch đề bài, blog, bình luận, thông báo thi đấu sang tiếng Việt với 1 chạm hoặc chuyển đổi linh hoạt Việt - Anh.
   - **Dịch Streaming Real-Time (SSE)**: AI dịch xong đoạn/khối nào là hiển thị ngay lập tức lên trang, loại bỏ cảm giác chờ đợi khi dịch bài dài.
   - Bảo toàn 100% công thức toán học LaTeX, MathJax, mã nguồn (Code block), từ khóa in kết quả (`YES`, `NO`) và tên thí sinh (User handle).
   - Hỗ trợ công cụ dịch:
     - **Google Translate**: Dịch tốc độ cao qua hạ tầng Linguist Chrome Extension API.
     - **Gemini AI**: Chuỗi tự động chuyển đổi thông minh: Gemini 4 Hydrogen $\rightarrow$ Gemini 3.8 Flash $\rightarrow$ Gemini 3.5 Flash Lite khi hết quota RPM, hoặc tùy chỉnh model AI.
     - **Mistral (xKiro)**: Dịch AI chuẩn xác và tự nhiên với model `mistralai/mistral-small-2603`.
     - Tự động tải dịch lại bằng AI khi chuyển từ bản dịch Google Translate để câu văn mượt mà và trôi chảy hơn.
4. **Chế độ Giao diện Tối & Sáng (Dark & Light Mode)**:
   - Công tắc chuyển đổi giao diện sáng/tối trực tiếp trên thanh menu Codeforces.
   - Bảng màu tương phản tối ưu, phối hợp hài hòa với nền kính mờ (Frosted Glassmorphism).
5. **Cập nhật tức thì (Real-time)**:
   - Khi bạn đổi ảnh hoặc kéo thanh trượt trong popup, trang Codeforces đang mở sẽ đổi ngay lập tức mà không cần phải tải lại trang.
6. **Không bị giật chớp trắng khi tải trang**:
   - Sử dụng `run_at: "document_start"` và chèn CSS động giúp hình nền hiển thị ngay từ khung hình đầu tiên.
7. **Tùy chỉnh linh hoạt**:
   - **Bật / Tắt**: Công tắc chuyển đổi nhanh để về nền trắng mặc định bất cứ lúc nào.
   - **Độ mờ (Blur)**: Làm mờ nhẹ nền (0 - 25px) giúp tập trung đọc đề bài và code hơn.
   - **Lớp tối (Dim / Dark overlay)**: Phủ một lớp tối (0 - 80%) để hình nền không bị chói mắt.
   - **Khung Blur Kính Bo Tròn (Rounded Blur Frames)**:
     - Thanh menu chính và menu phụ hiển thị dưới dạng khung kính blur bo tròn trong suốt theo bố cục tự nhiên của Codeforces.
     - Biến các khối như thẻ bài viết (`roundbox`, `sidebox`, `topic`, `problem-statement`,...) thành **các khung kính mờ (blur) trong suốt bo tròn góc 14px** (`backdrop-filter: blur(20px)`).
     - Tăng khoảng cách lề trong (padding) rộng rãi từ chữ đến viền khung.
   - **Chế độ hiển thị (Background Size)**:
     - Tràn viền (Cover)
     - Vừa vặn (Contain)
     - Lặp lại (Tile)
   - **Xóa / Đổi ảnh & Đặt lại mặc định**: Thao tác chỉ với 1 click.

---

## 🚀 Hướng dẫn cài đặt trên trình duyệt (Chrome, Edge, Brave, Cốc Cốc)

1. Mở trình duyệt và truy cập trang quản lý tiện ích:
   - **Chrome / Cốc Cốc**: Nhập `chrome://extensions/` vào thanh địa chỉ.
   - **Edge**: Nhập `edge://extensions/`.
   - **Brave**: Nhập `brave://extensions/`.
2. Bật chế độ **"Chế độ dành cho nhà phát triển" (Developer mode)** ở góc trên bên phải.
3. Nhấp vào nút **"Tải tiện ích đã giải nén" (Load unpacked)** ở góc trên bên trái.
4. Chọn thư mục chứa mã nguồn tiện ích đã tải về (thư mục `codeforces-effect`).
5. Tiện ích **Codeforces Effect** sẽ xuất hiện trên thanh công cụ của trình duyệt. Bạn có thể ghim (Pin) icon lên thanh công cụ để mở nhanh bất cứ lúc nào!

---

## 🎯 Cách sử dụng

1. Truy cập vào trang web [Codeforces](https://codeforces.com).
2. Nhấp vào biểu tượng icon tiện ích trên thanh công cụ trình duyệt để mở popup.
3. Nhấp vào khung tải ảnh (hoặc kéo thả ảnh vào) để chọn hình nền yêu thích.
4. Điều chỉnh độ mờ (Blur), độ tối (Dim) hoặc độ trong suốt theo ý muốn.
5. Thưởng thức giao diện Codeforces mới!

---

## 📄 Bản quyền & Mã nguồn (License & Source)

- **Repository**: [https://github.com/PTK-2411/codeforces-effect](https://github.com/PTK-2411/codeforces-effect)
- **License**: Phát hành theo giấy phép [MIT License](LICENSE) (Copyright (c) 2026 PTK-2411).
- **Cơ chế cập nhật**: Tự động kiểm tra bản phát hành trên GitHub; nếu đang ở bản `TEST` và phát hiện có bản chính thức (`Official`) thì sẽ hiển thị thông báo và nút cập nhật trực tiếp trên Popup.
