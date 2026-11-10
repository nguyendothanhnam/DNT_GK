import { readFile } from 'node:fs/promises';
import { googleAccessToken } from './firebase-auth.mjs';
const path = process.env.FIREBASE_SERVICE_ACCOUNT || './serviceAccountKey.json';
const account = JSON.parse(await readFile(path, 'utf8'));
const token = await googleAccessToken(path);
const response = await fetch(`https://firebasedatabase.googleapis.com/v1beta/projects/${encodeURIComponent(account.project_id)}/locations/-/instances`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
if (!response.ok) {
  const configResponse = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${encodeURIComponent(account.project_id)}/adminSdkConfig`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
  if (configResponse.ok) {
    const config = await configResponse.json();
    if (config.databaseURL) { console.log(JSON.stringify([{ databaseUrl: config.databaseURL }], null, 2)); process.exit(0); }
  }
  const error = await response.json();
  console.log(JSON.stringify({ status: response.status, message: error.error?.message }, null, 2));
  process.exit(1);
}
const result = await response.json();
console.log(JSON.stringify((result.instances || []).map(instance => ({ name: instance.name, databaseUrl: instance.databaseUrl, state: instance.state })), null, 2));
