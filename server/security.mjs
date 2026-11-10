import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128 || typeof stored !== 'string') return false;
  const [kind, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hash || '')) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex'));
}
export function normalizeEmail(value) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }
export function validateUser(body, editing = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Dữ liệu không hợp lệ.';
  if (Object.keys(body).some(k => !['email', 'matkhau', 'hoten', 'hinhanh'].includes(k))) return 'Chỉ chấp nhận đúng bốn trường của đề.';
  const email = normalizeEmail(body.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return 'Email không hợp lệ.';
  if (typeof body.hoten !== 'string' || body.hoten.trim().length < 2 || body.hoten.trim().length > 100) return 'Họ tên phải có từ 2 đến 100 ký tự.';
  if (!(editing && body.matkhau === '') && (typeof body.matkhau !== 'string' || body.matkhau.length < 8 || body.matkhau.length > 128)) return 'Mật khẩu phải có từ 8 đến 128 ký tự.';
  if (typeof body.hinhanh !== 'string') return 'Hình ảnh không hợp lệ.';
  if (body.hinhanh && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(body.hinhanh) || body.hinhanh.length > 819200)) return 'Ảnh phải là JPEG, PNG hoặc WebP và không vượt quá 600 KB.';
  return null;
}
export function publicUser(user) {
  const { email, hoten, hinhanh } = user;
  return { email, hoten, hinhanh };
}
