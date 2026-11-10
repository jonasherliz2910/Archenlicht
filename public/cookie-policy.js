export const CONSENT_COOKIE = 'archenlicht_consent';
export const CONSENT_VERSION = 'v1';
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60;

// Unknown, outdated or malformed choices always leave optional statistics off.
export function readConsent(cookies = '', now = Date.now()) {
  const value = cookies.split(';').map(part => part.trim()).find(part => part.startsWith(`${CONSENT_COOKIE}=`))?.slice(CONSENT_COOKIE.length + 1);
  const match = /^v1\.(necessary|statistics)\.(\d{13})$/.exec(value || '');
  if (!match) return null;
  const chosenAt = Number(match[2]);
  if (chosenAt > now + 60000 || now - chosenAt >= CONSENT_MAX_AGE * 1000) return null;
  return { statistics: match[1] === 'statistics', chosenAt, version: CONSENT_VERSION };
}
