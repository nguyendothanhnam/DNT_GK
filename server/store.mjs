import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { googleAccessToken } from './firebase-auth.mjs';

export const keyForEmail = email => Buffer.from(email).toString('base64url');
function createFirestoreStore({ serviceAccount, projectId }) {
  if (!serviceAccount) throw new Error('Firestore cần FIREBASE_SERVICE_ACCOUNT.');
  const project = projectId || process.env.FIREBASE_PROJECT_ID;
  if (!project) throw new Error('Cần FIREBASE_PROJECT_ID để kết nối Firestore.');
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/users`;
  async function request(url, method = 'GET', body) {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await googleAccessToken(serviceAccount)}` }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (response.status === 404 && method === 'GET') return null;
    if (!response.ok) throw new Error(`Firestore trả về HTTP ${response.status}. Kiểm tra database và quyền service account.`);
    return response.json();
  }
  const decode = document => Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, value.stringValue ?? '']));
  return {
    mode: 'firestore',
    async all() {
      const users = []; let pageToken;
      do {
        const url = new URL(base); url.searchParams.set('pageSize', '300');
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const data = await request(url);
        users.push(...(data?.documents || []).map(decode)); pageToken = data?.nextPageToken;
      } while (pageToken);
      return users;
    },
    async get(email) { const document = await request(`${base}/${keyForEmail(email)}`); return document ? decode(document) : null; },
    async put(user) { return request(`${base}/${keyForEmail(user.email)}`, 'PATCH', { fields: Object.fromEntries(Object.entries(user).map(([key, value]) => [key, { stringValue: value }])) }); },
    async remove(email) { return request(`${base}/${keyForEmail(email)}`, 'DELETE'); }
  };
}
export function createStore({ mode = process.env.DB_MODE || 'local', file = resolve('data/local.json'), url = process.env.FIREBASE_DATABASE_URL, secret = process.env.FIREBASE_DATABASE_SECRET, serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT } = {}) {
  if (mode === 'firestore') return createFirestoreStore({ serviceAccount });
  if (!['local', 'firebase'].includes(mode)) throw new Error('DB_MODE phải là local, firestore hoặc firebase (Realtime Database).');
  if (mode === 'firebase' && (!url?.startsWith('https://') || (!secret && !serviceAccount))) throw new Error('Cần cấu hình URL và service account (hoặc secret) Firebase trong .env.');
  async function firebase(path, method = 'GET', body) {
    const endpoint = new URL(`${url.replace(/\/$/, '')}/users${path}.json`);
    const headers = { 'Content-Type': 'application/json' };
    if (serviceAccount) headers.Authorization = `Bearer ${await googleAccessToken(serviceAccount)}`;
    else endpoint.searchParams.set('auth', secret);
    const response = await fetch(endpoint, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Firebase trả về HTTP ${response.status}. Kiểm tra cấu hình backend.`);
    return response.json();
  }
  async function read() {
    if (mode === 'firebase') return (await firebase('')) || {};
    try { return (JSON.parse(await readFile(file, 'utf8'))).users || {}; }
    catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  }
  async function writeLocal(users) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(`${file}.tmp`, JSON.stringify({ users }, null, 2), 'utf8');
    await rename(`${file}.tmp`, file);
  }
  return {
    mode,
    async all() { return Object.values(await read()); },
    async get(email) { return (await read())[keyForEmail(email)] || null; },
    async put(user) {
      const key = keyForEmail(user.email);
      if (mode === 'firebase') return firebase(`/${key}`, 'PUT', user);
      const users = await read(); users[key] = user; await writeLocal(users);
    },
    async remove(email) {
      const key = keyForEmail(email);
      if (mode === 'firebase') return firebase(`/${key}`, 'DELETE');
      const users = await read(); delete users[key]; await writeLocal(users);
    }
  };
}
