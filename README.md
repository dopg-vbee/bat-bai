# Bắt Bài 🎤

Game party chơi qua trình duyệt: nghe đoạn lời bài hát, đoán tên bài. Host chiếu màn hình lớn, người chơi dùng điện thoại quét QR là vào, không cần đăng nhập. Mỗi phòng chơi tốt với 60+ người.

## Luật chơi

1. Host vào **/admin**, chọn bộ đề, bấm **Tạo phòng chơi**. Màn hình lớn hiện QR và mã phòng 4 số.
2. Người chơi quét QR (hoặc vào trang chủ, nhập mã) rồi nhập tên.
3. Mỗi câu: đếm ngược 3 giây → **MP3 phát trên màn hình host** → người chơi gõ tên bài trên điện thoại.
   - Sai thì đoán lại được. Không cần gõ dấu, sai chính tả nhẹ vẫn tính, gõ thêm tên ca sĩ sau tên bài cũng tính. Đoán sát mà chưa đúng thì điện thoại báo **"Gần đúng rồi!"**.
   - Đúng càng nhanh càng nhiều điểm: **1000 → 500 điểm**.
   - **🔥 Chuỗi đúng:** từ câu đúng thứ 3 liên tiếp, avatar bốc cháy và mỗi câu được thưởng **+50**, tăng dần tới **+300** (chuỗi 8). Trượt một câu là mất chuỗi.
   - **⚡ Câu may mắn:** khoảng 1/5 số câu (không bao giờ là câu đầu) được chọn ngẫu nhiên tính **x2 điểm**. Chỉ lộ ra lúc đếm ngược câu đó.
   - **🎁 Hộp quà:** mỗi lần đoán đúng có 15% cơ hội được thưởng thêm ngẫu nhiên **+100 đến +300** điểm.
   - Ai đoán đúng thì avatar + tên bật lên màn hình lớn kèm tiếng "ting" (nhiều người đúng liên tiếp thì cao dần như chuỗi nốt nhạc).
4. Hết giờ (hoặc khi mọi người đều đúng): màn hình lớn hiện đáp án và phát đoạn YouTube cỡ lớn ở giữa màn hình. Phát xong tự chuyển sang **bảng xếp hạng** khoảng 5 giây (các dòng trượt tới hạng mới, điểm đếm tăng), rồi **tự sang câu tiếp**. Host bấm "Bỏ qua" / "Câu tiếp ngay" nếu muốn nhanh hơn.
   - Mỗi câu đặt được điểm **Phát từ** và **Đến**. Bỏ trống "Đến" thì phát 25 giây.
   - Nếu dán link có sẵn `?t=` (hoặc `start=`/`end=`), app tự điền hai ô này.
   - Ở trang quản lý bấm **▶ Xem trước đoạn YouTube** (trong form) hoặc **▶ YouTube 0:30 – 0:36** (ở từng câu) để nghe đúng đoạn đó.
5. Hết câu cuối sẽ hiện bục vinh danh top 3. Bằng điểm thì ai trả lời nhanh hơn (tổng thời gian) xếp trên.

**Chơi thử trước:** ở trang quản lý, nút **👁 Chơi thử** tạo một phòng y hệt ván thật, có 4 bot tự vào và tự đoán. Nút **👁 Xem thử** ở từng câu chỉ chạy riêng câu đó, để kiểm MP3 và đoạn YouTube. Trong phòng chơi thử có nút **📱 Mở màn hình người chơi**, mở cửa sổ cỡ điện thoại để tự đoán như người chơi.

**Chơi theo đội:** khi tạo phòng chọn **Chơi theo đội** (2–4 đội: Đỏ, Xanh, Vàng, Tím). Ở phòng chờ, màn hình lớn có một khung cho mỗi đội; người chơi tự chọn (và đổi) đội trên điện thoại, ai chưa chọn nằm ở khung "Chưa có đội". Chỉ bắt đầu được khi mọi người đều có đội; nút **Xếp đội ngẫu nhiên** chia lại tất cả cho đều. Ai vào sau khi game đã bắt đầu thì được xếp vào đội ít người nhất.
- **Điểm trung bình:** mọi người chơi như thường; điểm đội = trung bình điểm các thành viên (đội đông không có lợi thế). Bảng xếp hạng có thêm thanh điểm đội, cuối game có thẻ "Đội vô địch".
- **Đồng đội:** người đầu tiên trong đội đoán đúng là cả đội đúng, cùng nhận điểm đó. Bảng xếp hạng và bục vinh danh tính theo đội.

**Thả cảm xúc:** ai đoán đúng rồi (và cả lúc xem đáp án, bảng xếp hạng) có thanh 👍 ❤️ 😆 🔥 👏 😮 ở cuối màn hình điện thoại; bấm là emoji bật lên đâu đó dưới đáy màn hình lớn rồi bay lên, ẩn danh. Mỗi người tối đa 8 lần trong 2 giây.

**Điều khiển bằng điện thoại:** menu ☰ trên màn hình host → **Điều khiển bằng điện thoại** → quét mã QR. Điện thoại có các nút Bắt đầu / Hiện đáp án / Câu tiếp, Tạm dừng, Hiện mã QR vào phòng và Kết thúc. Ai quét mã này cũng điều khiển được phòng, nên mở nó khi người chơi không nhìn màn hình.

**Giao diện sáng/tối:** mặc định là tối. Bấm nút mặt trời/mặt trăng (trên thanh tiêu đề, hoặc góc trên bên phải ở trang chủ) để đổi. Mỗi máy tự nhớ lựa chọn của mình.

Người chơi rớt mạng hoặc khóa màn hình thì mở lại trang là vào tiếp, giữ nguyên điểm. Host có thể mời người chơi ra khỏi phòng (di chuột vào tên ở phòng chờ, bấm ×).

## Chạy trên máy

Cần Node.js 22.18 trở lên.

```bash
npm install
npm run build
npm start            # http://localhost:3000, mật khẩu mặc định: batbai
```

- Đặt mật khẩu thật: copy `.env.example` thành `.env` và sửa `ADMIN_PASSWORD`.
- **Chơi trong mạng LAN** (laptop nối TV, mọi người dùng chung Wi-Fi): cứ mở `http://localhost:3000` trên laptop.
  - Mã QR tự trỏ sang IP Wi-Fi của máy, bỏ qua các card mạng ảo (Hyper-V, WSL, VPN…). Lúc khởi động, terminal cũng in dòng `Điện thoại vào: http://…`.
  - Điện thoại quét QR mà chỉ thấy **màn hình trắng hoặc đen, không tải được**: kiểm tra điện thoại có cùng Wi-Fi với laptop không. Sau đó kiểm tra tường lửa Windows có cho Node.js ở mạng **Private** không (Windows Security → Firewall → Allow an app → Node.js). Wi-Fi ở nhà nên đặt là Private.
  - Vẫn không được thì đặt `PUBLIC_URL=http://<IP-Wi-Fi>:3000` trong `.env`, QR sẽ dùng đúng địa chỉ đó.
- Khi phát triển: `npm run dev` (tự reload khi sửa code).

## Deploy online: Render + Cloudflare R2 (miễn phí)

App là **một service duy nhất** (web + realtime). Câu hỏi và MP3 lưu trên **Cloudflare R2**, nên server khởi động lại, deploy lại hay ngủ đông đều không mất dữ liệu.

### 1. Tạo kho lưu trữ R2

1. Đăng nhập [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage**. Cloudflare yêu cầu gắn thẻ hoặc PayPal để bật R2; dùng dưới 10GB thì không mất tiền.
2. **Create bucket** → đặt tên `bat-bai`.
3. Vào **R2 → Manage API tokens → Create API token**:
   - Permissions: **Object Read & Write**
   - Specify bucket: `bat-bai`
4. Lưu lại 3 thông tin: **Access Key ID**, **Secret Access Key** và **endpoint** dạng `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

### 2. Đưa code lên GitHub

Tạo một repo trên GitHub (để private cũng được), rồi push thư mục này lên.

### 3. Tạo service trên Render

1. Đăng nhập [render.com](https://render.com) bằng GitHub → **New → Blueprint** → chọn repo. Render tự đọc file `render.yaml`.
2. Điền các biến:

| Biến | Giá trị |
|---|---|
| `ADMIN_PASSWORD` | mật khẩu host tự đặt |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | `bat-bai` |
| `S3_ACCESS_KEY_ID` | lấy ở bước 1 |
| `S3_SECRET_ACCESS_KEY` | lấy ở bước 1 |

3. Bấm **Apply**. Vài phút sau có link dạng `https://batbai.onrender.com` (tên đã có người dùng thì Render thêm đuôi ngẫu nhiên). Mở `/admin` để thêm câu hỏi.

> **Gói free của Render** ngủ sau 15 phút không có ai truy cập, lần mở đầu tiên mất khoảng 1 phút để khởi động. Host chỉ cần mở trang trước giờ chơi một chút. Muốn luôn sẵn sàng thì nâng lên gói Starter ($7/tháng). Ván đang chơi dở sẽ mất nếu server khởi động lại; thư viện câu hỏi thì không bao giờ mất.

## Lưu trữ & sao lưu

Bố cục kho lưu trữ (thư mục `data/` khi chạy trên máy, hoặc bucket R2 khi chạy online):

```
library.json              toàn bộ bộ đề và câu hỏi
history/library-*.json    một bản lưu cho mỗi lần sửa (giữ 100 bản gần nhất)
audio/<sha256>.mp3        file âm thanh, đặt tên theo nội dung, không bao giờ bị ghi đè
```

Các lớp bảo vệ:

- **Ghi an toàn:** file được ghi trọn vẹn rồi mới thay bản cũ, nên tắt điện giữa chừng cũng không hỏng dữ liệu. Nếu `library.json` hỏng, server tự lấy bản gần nhất trong `history/`.
- **Xóa mềm:** xóa câu hỏi hoặc bộ đề chỉ là ẩn đi, file MP3 vẫn còn.
- **Không lộ đáp án:** thẻ ID3 (tên bài, ca sĩ) bị xóa khỏi MP3 khi upload.
- **Bản sao ngoài:** tải toàn bộ dữ liệu về máy bằng lệnh dưới đây.

### Sao lưu về máy

Tạo `.env` có cùng các biến `S3_*` như trên Render (chạy trên máy thì không cần), rồi chạy:

```bash
npm run backup                       # → backups/<thời gian>/
npm run backup -- D:/BatBai-backup   # hoặc chỉ định thư mục (chạy lại chỉ tải MP3 mới)
```

Nên chạy mỗi tuần một lần, hoặc đặt lịch bằng Windows Task Scheduler.

### Khôi phục

```bash
npm run restore -- --list                         # xem các phiên bản trong history/
npm run restore -- --history library-2026-...json # quay về một phiên bản cũ (sửa nhầm, xóa nhầm)
npm run restore -- backups/2026-10-23T...         # khôi phục toàn bộ từ bản sao lưu
```

Trước khi khôi phục, script luôn lưu bản hiện tại vào `history/`, nên việc khôi phục cũng hoàn tác được. **Sau khi khôi phục cần khởi động lại server** (trên Render: Manual Deploy → Restart service).

Muốn chuyển dữ liệu từ máy lên R2: chạy `npm run backup` khi chưa có biến S3, sau đó thêm biến `S3_*` vào `.env` và chạy `npm run restore -- backups/<thư mục vừa tạo>`.

## Kiểm thử

```bash
npm test             # unit test + 1 ván đầy đủ 60 người qua Socket.IO + test khởi động lại server
npm run typecheck
npm run loadtest -- --url http://localhost:3000 --rooms 3 --players 60
```

`loadtest` cần server đang chạy và ít nhất một bộ đề có câu hỏi. Nó cho bot chơi trọn các ván rồi báo độ trễ. Đo trên máy dev với 3 phòng × 60 người: gửi đáp án p95 khoảng 8ms, không lỗi.

## Cấu trúc

```
src/server/   Express + Socket.IO: phòng chơi, chấm đáp án, API quản lý, lưu trữ (thư mục / S3)
  game/       room (luồng một ván), player, luck (điểm, câu x2, hộp quà), teams, awards, match
src/client/   React: trang chủ, màn người chơi, màn host, trang quản lý
  styles/     CSS theo khu vực; styles.css nạp chúng theo đúng thứ tự
src/shared/   kiểu dữ liệu, xử lý link YouTube, danh sách emoji dùng chung
scripts/      backup, restore, loadtest, build-emoji
tests/        vitest
```

Server chạy thẳng TypeScript bằng Node (type stripping), không cần bước biên dịch server.

**Emoji:** icon giao diện dùng [Lucide](https://lucide.dev). Emoji là [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (MIT), được sinh thành file SVG trong `src/client/public/emoji/` mỗi lần `npm run dev` / `npm run build`. Muốn dùng emoji mới thì thêm vào `src/shared/emoji.ts`. Các khoảnh khắc ăn mừng dùng emoji động [Google Noto](https://googlefonts.github.io/noto-emoji-animation/), nếu không tải được sẽ tự lùi về emoji Fluent tĩnh.
