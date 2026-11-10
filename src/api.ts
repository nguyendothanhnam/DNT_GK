export type User = { email: string; hoten: string; hinhanh: string };
export type UserInput = User & { matkhau: string };
export type Session = { token: string; user: User; isAdmin: boolean; mode: string };
const BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, token?: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    response = await fetch(`${BASE}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
    });
  } catch { throw new Error('Không thể kết nối máy chủ. Vui lòng thử lại.'); }
  finally { clearTimeout(timeout); }
  const result = await response.json();
  if (!response.ok) throw new ApiError(result.message || 'Yêu cầu thất bại.', response.status);
  return result;
}
