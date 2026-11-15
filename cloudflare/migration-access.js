import { createHmac, timingSafeEqual } from 'node:crypto';
const COOKIE = '__Host-archenlicht_migration';
const lifetime = 7200;
const equal = (left, right) => {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
const sign = (expiry, password) => createHmac('sha256', password).update('migration-access-v1:' + expiry).digest('hex');
export function migrationAccess(request, password, now = Math.floor(Date.now() / 1000)) {
  if (!password || password.length < 24) return { authorized: false };
  const token = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(token || '');
  if (match && Number(match[1]) > now && Number(match[1]) <= now + lifetime && equal(match[2], sign(match[1], password))) return { authorized: true };
  const expected = 'Basic ' + Buffer.from('preview:' + password).toString('base64');
  if (!equal(request.headers.get('authorization') || '', expected)) return { authorized: false };
  const expiry = String(now + lifetime);
  return { authorized: true, cookie: `${COOKIE}=${expiry}.${sign(expiry, password)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${lifetime}` };
}
