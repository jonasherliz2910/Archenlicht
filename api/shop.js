import { waitUntil } from '@vercel/functions';
import { createApp, defaultConfig } from '../server/index.js';

export function createVercelHandler(configuration = defaultConfig()) {
  let application;
  const getApplication = () => {
    if (!application) {
      application = createApp({ ...configuration, serverless: true, ...(process.env.VERCEL === '1' ? { background: waitUntil } : {}) });
      application.catch(() => { application = null; });
    }
    return application;
  };
  const handler = async (request, response) => {
  try {
    const url = new URL(request.url, 'https://archenlicht.vercel.app');
    const route = url.searchParams.get('__shop_path');
    if (route !== null) {
      url.searchParams.delete('__shop_path');
      request.url = '/' + route.replace(/^\/+/, '') + (url.searchParams.size ? '?' + url.searchParams : '');
    }
    const app = await getApplication();
    await app.handler(request, response);
  } catch {
    console.error('Shopstart fehlgeschlagen. Datenbank- und Serverkonfiguration prüfen; keine Eingabedaten protokolliert.');
    if (response.headersSent) return response.end();
    response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ error: 'Der Shop ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.' }));
  }
  };
  handler.close = async () => { if (application) await (await application).shop.close(); };
  return handler;
}

export default createVercelHandler();
