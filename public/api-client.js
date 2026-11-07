export const SHOP_UNAVAILABLE = 'Der Shop ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.';

export async function readJsonResponse(response) {
  const type = response.headers.get('content-type') || '';
  if (!/^application\/(?:json|[^;\s]+\+json)\b/i.test(type)) throw new Error(SHOP_UNAVAILABLE);
  let data;
  try { data = await response.json(); } catch { throw new Error(SHOP_UNAVAILABLE); }
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : SHOP_UNAVAILABLE);
  return data;
}
