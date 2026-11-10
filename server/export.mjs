import { mkdir, writeFile } from 'node:fs/promises';
import { createStore, keyForEmail } from './store.mjs';
const users = Object.fromEntries((await createStore().all()).map(user => [keyForEmail(user.email), user]));
await mkdir('data', { recursive: true });
await writeFile('data/export.json', JSON.stringify({ users }, null, 2));
console.log('Đã xuất data/export.json. File chứa mật khẩu băm; chỉ dùng để nộp bài, không đăng dữ liệu thật.');
