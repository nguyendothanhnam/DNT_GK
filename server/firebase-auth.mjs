import { readFile } from 'node:fs/promises';
import { createSign } from 'node:crypto';

let cached;
export async function googleAccessToken(path) {
  if (cached && cached.path === path && Date.now() < cached.until) return cached.token;
  const account = JSON.parse(await readFile(path, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Không xác thực được service account (HTTP ${response.status}).`);
  const data = await response.json();
  cached = { path, token: data.access_token, until: Date.now() + 3300000 };
  return cached.token;
}
