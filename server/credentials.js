import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';

export const token = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(String(value)).digest('hex');
export function passwordHash(value) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(value, salt, 64).toString('hex')}`; }
export function passwordMatches(value, encoded) { const [salt, hash] = encoded.split(':'); const candidate = scryptSync(value, salt, 64); return timingSafeEqual(candidate, Buffer.from(hash, 'hex')); }
