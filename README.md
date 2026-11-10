# UserSpace — React Native + Firebase Cloud Firestore

Ứng dụng giữa kỳ, mã nguồn tạo tháng 11/2026. Expo SDK 58, TypeScript và backend Node.js dùng Firestore project `dntgk-c5558`. Phiên bản React và React Native được căn chỉnh theo SDK trong `package.json`. Mỗi người dùng có đúng bốn trường `email`, `matkhau`, `hoten`, `hinhanh`.

## Chạy ứng dụng

Yêu cầu Node.js 22.13+ hoặc 24.3+ LTS. Workspace hiện tại đã cấu hình `.env` dùng Firestore và tạo admin.

Terminal 1:

```powershell
npm.cmd run api
```

Terminal 2:

```powershell
npm.cmd run web
```

Mở địa chỉ Expo in ra, thường http://localhost:8081. Đăng nhập **admin@example.com / Admin@123456**. Đổi mật khẩu bằng chức năng Sửa khi dùng thật.

## Cài lại từ source

```powershell
npm.cmd install
Copy-Item .env.example .env
```

Không ghi đè `.env` nếu đã cấu hình. Đặt private key `serviceAccountKey.json` ở gốc dự án và sửa `.env`:

```dotenv
DB_MODE=firestore
FIREBASE_PROJECT_ID=dntgk-c5558
FIREBASE_SERVICE_ACCOUNT=./serviceAccountKey.json
ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=Admin@123456
EXPO_PUBLIC_API_URL=http://localhost:3001
```

Chạy `npm.cmd run seed`, sau đó chạy API và web ở hai terminal. Seed không ghi đè tài khoản đã tồn tại. Thay `SEED_ADMIN_PASSWORD` không đổi mật khẩu đã lưu; hãy dùng giao diện Sửa.

Firebase Console → Firestore Database → database `(default)` → Data → collection `users`. Document ID là base64url(email). Backend dùng service account lấy OAuth2 access token; không cần URL Realtime Database. Không đưa `.env` hoặc private key lên GitHub, vào báo cáo hay video; `.gitignore` đã loại chúng.

`database/firestore.rules` là rules khóa truy cập trực tiếp từ client. Có thể dán vào tab Rules nếu project chỉ dành cho bài tập; không ghi đè rules của ứng dụng khác. Backend service account dùng quyền IAM. Xem [tài liệu Firestore REST](https://firebase.google.com/docs/firestore/use-rest-api).

## Chạy trên điện thoại

1. Dùng Expo Go hỗ trợ SDK 58 hoặc development build. Nếu Expo Go báo SDK không tương thích, cập nhật Expo Go; kiểm tra phiên bản tại https://expo.dev/go.
2. Máy tính và điện thoại cùng Wi-Fi. Chạy `ipconfig`, tìm IPv4 máy tính, ví dụ `192.168.1.10`.
3. Đặt `.env`: `EXPO_PUBLIC_API_URL=http://10.60.6.157:3001`. API phải đang chạy; cho phép Node qua Windows Firewall trên mạng riêng nếu cần.
4. Chạy `npm.cmd start -- --clear`, quét QR. Không dùng `localhost` làm API URL trên điện thoại.
5. Đăng nhập admin để thêm/sửa và chọn ảnh thư viện. Đăng nhập thành viên để hiển thị họ tên/email/ảnh. Web và điện thoại tự tải dữ liệu mới mỗi 3 giây khi đang mở, đồng thời tải lại khi quay về ứng dụng. Cả hai cần cùng kết nối API và có mạng; tài khoản thành viên chỉ xem hồ sơ của chính mình.

Nếu mở web bằng IP LAN, thêm origin tương ứng, ví dụ `http://192.168.1.10:8081`, vào `ALLOWED_ORIGINS` và khởi động lại API. HTTP LAN phục vụ demo; triển khai Internet cần HTTPS.

## Khi không kết nối được máy chủ

Kiểm tra API đang chạy bằng `npm.cmd run api`. Trong `.env`, `EXPO_PUBLIC_API_URL` phải chứa địa chỉ IP đầy đủ; IP Wi-Fi ở lần cấu hình gần nhất là `http://192.168.1.3:3001`. Nếu đổi mạng, chạy `ipconfig` để lấy IP mới. Có thể mở `http://192.168.1.3:3001/api/health` để kiểm tra API (phải trả về JSON).

Sau khi thay URL, dừng Expo bằng Ctrl+C và chạy `npm.cmd run web -- --clear` hoặc `npm.cmd start -- --clear` trên điện thoại. Nếu thay `ALLOWED_ORIGINS`, khởi động lại API. Khi báo `EADDRINUSE` ở cổng 3001, kiểm tra tiến trình API đã chạy trước đó; không mở thêm API thứ hai trên cùng cổng.

## Đối chiếu đề

| Yêu cầu | Hiện thực |
| --- | --- |
| React Native, Firebase, chạy web | Expo, react-native-web, backend đọc/ghi Firestore thật |
| Nhập và hiển thị người dùng | Form thêm, danh sách họ tên/email/ảnh |
| Đăng nhập, sửa, xóa | Phiên đăng nhập, quyền admin, sửa tên/mật khẩu/ảnh, xác nhận xóa |
| Nâng cao | Chống email trùng, giới hạn đăng nhập, băm mật khẩu và thu hồi phiên |
| Nhập ảnh/hiển thị trên di động | expo-image-picker và hồ sơ cá nhân |
| Chỉ bốn trường | email, matkhau, hoten, hinhanh |
| File CSDL bắt buộc | `npm.cmd run export:db` → `data/export.json` |

Mật khẩu có nút hiện/ẩn khi đang nhập, **không hiển thị lại sau khi lưu**. Danh sách không nhận mật khẩu hoặc bản băm. Nếu giảng viên yêu cầu hiển thị mật khẩu đã lưu, cần trao đổi lại cách hiểu vì thiết kế dùng băm một chiều.

Email cố định vì là định danh; sửa được tên, mật khẩu và ảnh. Để trống mật khẩu khi sửa để giữ giá trị hiện tại. Admin được cấu hình bằng `ADMIN_EMAIL`. Phiên và bộ đếm đăng nhập nằm trong bộ nhớ backend, không thêm role/id/ngày tạo vào CSDL. API khởi động lại sẽ yêu cầu đăng nhập lại. Cơ chế ghi tuần tự hiện tại dành cho một tiến trình API.

`matkhau` chứa `scrypt$salt$hash`. `hinhanh` chứa data URI base64 JPEG/PNG/WebP tối đa 600 KB ảnh gốc để phù hợp giới hạn document Firestore; chưa có ảnh thì chuỗi rỗng. Document ID và metadata tự động của Firestore không phải trường tự thêm.

## Kiểm tra

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build:web
npm.cmd run check:firebase
```

Test API local kiểm tra xác thực, phân quyền, CRUD, email trùng cả khi gửi đồng thời, từ chối trường thừa, ảnh, mật khẩu băm, giữ/đổi mật khẩu và thu hồi phiên. `check:firebase` ghi một document kiểm thử ngẫu nhiên rồi đọc/sửa/xóa chính document đó; không xóa dữ liệu khác.

Đã kiểm tra CRUD trên Firestore thật bằng service account. Chưa kiểm tra thao tác giao diện trực tiếp trong trình duyệt hoặc điện thoại thật. Bản dựng web nằm trong `dist`; build thành công không thay thế kiểm thử thiết bị.

## Báo cáo và nộp bài

- `npm.cmd run export:db` xuất **data/export.json**, bắt buộc nộp kèm Word. Đây là JSON của ứng dụng, không phải managed backup Firestore và không import trực tiếp qua Console. `database/sample.json` là dữ liệu mẫu đúng bốn trường.
- Nội dung báo cáo: `docs/BAO_CAO.md`; Word mới nhất: **docs/Bao_cao_UserSpace_Firestore.docx**. Tạo lại bằng `python docs/create_report.py`, không cần thư viện Python. Đóng Word trước khi tạo lại.
- Điền họ tên/MSSV/lớp, chèn ảnh thực tế tại vị trí đánh dấu, thêm link GitHub và video. Word hiện là khung báo cáo, chưa phải bản nộp hoàn chỉnh.
- Kịch bản quay: `docs/KICH_BAN_DEMO.md`. Chưa tạo repository GitHub, đăng source hoặc quay/tải video.

## Chế độ khác

`DB_MODE=local` lưu `data/local.json` để thử offline; chưa đạt điều kiện Firebase/MongoDB để nộp. `DB_MODE=firebase` dùng Realtime Database với `FIREBASE_DATABASE_URL` và service account hoặc database secret; rules tham khảo `database/database.rules.json`. Project hiện tại dùng **DB_MODE=firestore**. Chế độ CSDL được cấu hình ở backend.

Tài liệu: [Nâng cấp Expo SDK](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/), [Expo SDK 58](https://expo.dev/changelog/sdk-58), [ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/).
