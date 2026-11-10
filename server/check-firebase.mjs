import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createStore } from './store.mjs';
import { hashPassword, verifyPassword } from './security.mjs';
const store = createStore();
if (store.mode === 'local') throw new Error('Kiểm tra này cần DB_MODE=firestore hoặc firebase.');
const email = `check-${randomUUID()}@example.com`;
let created = false;
try {
  assert.equal(await store.get(email), null);
  const user = { email, matkhau: hashPassword('Check@123456'), hoten: 'Kiểm thử Firebase', hinhanh: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=' };
  await store.put(user); created = true;
  assert.deepEqual(await store.get(email), user);
  assert.deepEqual(Object.keys(await store.get(email)).sort(), ['email', 'hinhanh', 'hoten', 'matkhau']);
  assert.ok(verifyPassword('Check@123456', (await store.get(email)).matkhau));
  await store.put({ ...user, hoten: 'Đã cập nhật trên Firebase' });
  assert.equal((await store.get(email)).hoten, 'Đã cập nhật trên Firebase');
  assert.ok((await store.all()).some(u => u.email === email));
  await store.remove(email); created = false;
  assert.equal(await store.get(email), null);
  console.log(`PASS: ${store.mode} thật — thêm, đọc, sửa, danh sách, ảnh, đúng bốn trường, mật khẩu băm, xóa. Bản ghi kiểm thử đã dọn.`);
} finally { if (created) await store.remove(email); }
