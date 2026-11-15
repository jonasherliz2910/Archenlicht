import { DurableObject } from 'cloudflare:workers';
import { scryptSync, timingSafeEqual } from 'node:crypto';

const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer'
};
const json = (value, status = 200) => Response.json(value, { status, headers });

export class PrintTest extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.window = 0; this.count = 0; this.queue = Promise.resolve(); }
  fetch(request) {
    const task = this.queue.then(() => this.handle(request));
    this.queue = task.catch(() => {});
    return task;
  }
  async handle(request) {
    const path = new URL(request.url).pathname;
    if (path === '/api/catalog' && request.method === 'GET') {
      const { catalog } = await import('./print-entry.js');
      return json(catalog());
    }
    if (request.method !== 'POST' || !['/api/render', '/api/check-password'].includes(path)) return json({ error: 'Nicht gefunden.' }, 404);
    if (Date.now() - this.window >= 60000) { this.window = Date.now(); this.count = 0; }
    if (++this.count > 20) return json({ error: 'Bitte warte eine Minute vor dem nächsten Drucktest.' }, 429);
    try {
      if (path === '/api/check-password') {
        // Same scrypt parameters as the shop; deliberately no real user input or account.
        const start = performance.now();
        const hash = scryptSync('cloudflare-test-password', 'cloudflare-test-salt', 64);
        const correct = scryptSync('cloudflare-test-password', 'cloudflare-test-salt', 64);
        const wrong = scryptSync('different-test-password', 'cloudflare-test-salt', 64);
        return json({ ok: timingSafeEqual(hash, correct) && !timingSafeEqual(hash, wrong), elapsedMs: Math.round(performance.now() - start), accountCreated: false });
      }
      const reader = request.body?.getReader(); let body = '', bytes = 0;
      if (!reader) return json({ error: 'Leere Eingabe.' }, 400);
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > 4096) { await reader.cancel(); return json({ error: 'Eingabe zu groß.' }, 413); }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
      let input; try { input = JSON.parse(body); } catch { return json({ error: 'Ungültige Eingabe.' }, 400); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: 'Ungültige Eingabe.' }, 400);
      const { print } = await import('./print-entry.js');
      const start = performance.now(), { png, layout } = await print(input, this.env.ASSETS);
      return new Response(png, { headers: { ...headers,
        'Content-Type': 'image/png', 'X-Print-Width': String(layout.width), 'X-Print-Height': String(layout.height),
        'X-Print-Dpi': '300', 'X-Print-Hash': layout.hash,
        'X-Print-Placement': JSON.stringify(layout.configuration.productionPrint.placement),
        'X-Print-Template': layout.configuration.productionPrint.templateHash,
        'X-Print-Safety': 'passed', 'X-Render-Ms': String(Math.round(performance.now() - start))
      } });
    } catch (error) {
      if (error.status && error.status >= 400 && error.status < 500) return json({ error: error.message }, error.status);
      console.error('Cloudflare-Drucktest fehlgeschlagen; keine Eingaben protokolliert.');
      return json({ error: 'Der technische Drucktest ist fehlgeschlagen. Es wurde keine Bestellung angelegt.' }, 500);
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({ ok: true, mode: 'cloudflare-compatibility-test', checkoutEnabled: false, podbaseOrderSubmissionEnabled: false, customerDatabaseConnected: false });
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!['/api/catalog', '/api/render', '/api/check-password'].includes(url.pathname)) return json({ error: 'In dieser Testversion nicht verfügbar.' }, 404);
    if (request.method === 'POST') {
      if (request.headers.get('Origin') !== url.origin || request.headers.get('X-Archenlicht-Test') !== '1') return json({ error: 'Zugriff nicht erlaubt.' }, 403);
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'Bitte JSON verwenden.' }, 415);
    }
    const id = env.PRINT_TEST.idFromName('print-compatibility-v1');
    return env.PRINT_TEST.get(id).fetch(request);
  }
};
