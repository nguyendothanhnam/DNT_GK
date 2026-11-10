import { createStore } from './store.mjs';
import { hashPassword, normalizeEmail, validateUser } from './security.mjs';
const store = createStore();
const email = normalizeEmail(process.env.ADMIN_EMAIL || 'admin@example.com');
const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
const admin = { email, matkhau: password, hoten: 'Quản trị viên', hinhanh: '' };
const error = validateUser(admin);
if (error) throw new Error(error);
if (await store.get(email)) console.log('Quản trị viên đã tồn tại; không ghi đè.');
else { await store.put({ ...admin, matkhau: hashPassword(password) }); console.log(`Đã tạo quản trị viên ${email} trong ${store.mode}.`); }
