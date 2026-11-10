import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword, normalizeEmail, validateUser, publicUser } from './security.mjs';

export function createApp(store, { adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com' } = {}) {
  adminEmail = normalizeEmail(adminEmail);
  const sessions = new Map(), attempts = new Map();
  let writeQueue = Promise.resolve();
  function serial(action) {
    const result = writeQueue.then(action); writeQueue = result.catch(() => {}); return result;
  }
  const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081,http://localhost:19006').split(',');
  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    res.setHeader('Vary', 'Origin');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    if (origin && !allowed.includes(origin)) return send(403, { message: 'Nguồn truy cập chưa được cho phép trong ALLOWED_ORIGINS.' });
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/api/health' && req.method === 'GET') return send(200, { mode: store.mode });
      async function readBody() {
        const chunks = []; let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 3000000) { const e = new Error('Dữ liệu quá lớn.'); e.status = 413; throw e; }
          chunks.push(chunk);
        }
        try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { const e = new Error('JSON không hợp lệ.'); e.status = 400; throw e; }
      }
      if (path === '/api/login' && req.method === 'POST') {
        const ip = req.socket.remoteAddress;
        const now = Date.now();
        for (const [key, value] of attempts) if (now > value.until) attempts.delete(key);
        const entry = attempts.get(ip) || { count: 0, until: now + 60000 };
        if (entry.count >= 10) return send(429, { message: 'Thử đăng nhập quá nhiều. Vui lòng chờ một phút.' });
        entry.count++; attempts.set(ip, entry);
        const body = await readBody();
        const user = await store.get(normalizeEmail(body?.email));
        if (!user || !verifyPassword(body?.matkhau, user.matkhau)) return send(401, { message: 'Email hoặc mật khẩu không đúng.' });
        attempts.delete(ip);
        for (const [key, value] of sessions) if (now > value.expires) sessions.delete(key);
        const token = randomBytes(32).toString('hex');
        sessions.set(token, { email: user.email, expires: now + 8 * 3600000 });
        return send(200, { token, user: publicUser(user), isAdmin: user.email === adminEmail, mode: store.mode });
      }
      const token = req.headers.authorization?.replace(/^Bearer /, '');
      const session = sessions.get(token);
      if (!session || Date.now() > session.expires) return send(401, { message: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' });
      const actor = await store.get(session.email);
      if (!actor) { sessions.delete(token); return send(401, { message: 'Tài khoản không còn tồn tại.' }); }
      if (path === '/api/logout' && req.method === 'POST') { sessions.delete(token); return send(200, { message: 'Đã đăng xuất.' }); }
      if (path === '/api/me' && req.method === 'GET') return send(200, publicUser(actor));
      if (actor.email !== adminEmail) return send(403, { message: 'Chỉ quản trị viên được quản lý người dùng.' });
      if (path === '/api/users' && req.method === 'GET') return send(200, (await store.all()).map(publicUser));
      if (path === '/api/export' && req.method === 'GET') {
        const users = Object.fromEntries((await store.all()).map(u => [Buffer.from(u.email).toString('base64url'), u]));
        return send(200, { users });
      }
      if (path === '/api/users' && req.method === 'POST') {
        const body = await readBody(); const error = validateUser(body);
        if (error) return send(400, { message: error });
        return await serial(async () => {
          const email = normalizeEmail(body.email);
          if (await store.get(email)) return send(409, { message: 'Email đã tồn tại.' });
          const user = { email, matkhau: hashPassword(body.matkhau), hoten: body.hoten.trim(), hinhanh: body.hinhanh };
          await store.put(user); send(201, publicUser(user));
        });
      }
      if (path.startsWith('/api/users/') && ['PUT', 'DELETE'].includes(req.method)) {
        const email = normalizeEmail(decodeURIComponent(path.slice('/api/users/'.length)));
        const body = req.method === 'PUT' ? await readBody() : null;
        return await serial(async () => {
          const user = await store.get(email);
          if (!user) return send(404, { message: 'Không tìm thấy người dùng.' });
          if (req.method === 'DELETE') {
            if (email === adminEmail) return send(400, { message: 'Không thể xóa tài khoản quản trị viên.' });
            await store.remove(email);
            for (const [key, value] of sessions) if (value.email === email) sessions.delete(key);
            return send(200, { message: 'Đã xóa người dùng.' });
          }
          const error = validateUser(body, true);
          if (error) return send(400, { message: error });
          if (normalizeEmail(body.email) !== email) return send(400, { message: 'Email là khóa định danh, không được thay đổi.' });
          const updated = { email, matkhau: body.matkhau ? hashPassword(body.matkhau) : user.matkhau, hoten: body.hoten.trim(), hinhanh: body.hinhanh };
          await store.put(updated);
          if (body.matkhau) for (const [key, value] of sessions) if (value.email === email && key !== token) sessions.delete(key);
          return send(200, publicUser(updated));
        });
      }
      send(404, { message: 'Không tìm thấy API.' });
    } catch (error) {
      if (!res.headersSent) send(error.status || 500, { message: error.status ? error.message : 'Không thể xử lý yêu cầu. Kiểm tra kết nối cơ sở dữ liệu và cấu hình backend.' });
      if (!error.status) console.error(error.message);
    }
  });
}
