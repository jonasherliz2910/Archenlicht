// Fetch the private session while the application code is downloading. Never
// cache this response in localStorage, a service worker or the shared CDN.
const query = new URLSearchParams(location.search);
const raw = query.get('utm_source') || query.get('quelle');
const source = raw === 'tiktok' ? 'tiktok' : ['gemeinde', 'gemeinde-qr'].includes(raw) ? 'gemeinde' : raw ? 'sonstige' : 'unbekannt';
const campaign = query.get('utm_campaign') || query.get('gemeinde') || '';
window.archenlichtInitialResponse = fetch(`/api/bootstrap?source=${source}&campaign=${encodeURIComponent(campaign)}`);
window.archenlichtInitialResponse.catch(() => {});
import('./app.js');
