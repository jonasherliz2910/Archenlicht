import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { readJsonResponse, SHOP_UNAVAILABLE } from '../public/api-client.js';
import { LEGAL_PAGES } from '../public/legal-content.js';

test('API-Antworten liefern JSON und behalten verständliche Serverfehler bei', async () => {
  assert.deepEqual(await readJsonResponse(Response.json({ ok: true })), { ok: true });
  assert.deepEqual(await readJsonResponse(Response.json([{ id: 'case' }])), [{ id: 'case' }]);
  await assert.rejects(readJsonResponse(Response.json({ error: 'Bitte melde dich zuerst an.' }, { status: 401 })), /Bitte melde dich zuerst an/);
});

test('Hosting-404, HTML und beschädigtes JSON erscheinen als verständlicher Verbindungsfehler', async () => {
  for (const response of [
    new Response('The page could not be found\nNOT_FOUND', { status: 404, headers: { 'content-type': 'text/plain' } }),
    new Response('<html>Hosting error</html>', { headers: { 'content-type': 'text/html' } }),
    new Response('{broken', { headers: { 'content-type': 'application/json' } })
  ]) await assert.rejects(readJsonResponse(response), { message: SHOP_UNAVAILABLE });
});

test('Fehlgeschlagener Shopstart zeigt eine Wiederholungsaktion und fängt Navigation vor Initialisierung nicht ab', async () => {
  const listeners = new Map(), content = { innerHTML: '' }; let pushed = 0;
  const context = vm.createContext({
    readJsonResponse, SHOP_UNAVAILABLE, LEGAL_PAGES, URL, URLSearchParams, Intl,
    location: { origin: 'https://shop.example', pathname: '/', search: '', hash: '' },
    history: { pushState: () => { pushed++; } },
    document: { querySelector: selector => selector === '#inhalt' ? content : null, addEventListener: (type, callback) => listeners.set(type, callback) },
    window: { addEventListener() {} }, setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => new Response('The page could not be found\nNOT_FOUND', { status: 404, headers: { 'content-type': 'text/plain' } })
  });
  const source = readFileSync('public/app.js', 'utf8').replace(/^import .*;\r?\n/gm, '');
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(content.innerHTML, /Der Shop ist gerade nicht erreichbar/);
  assert.match(content.innerHTML, /Erneut versuchen/);
  assert.doesNotMatch(content.innerHTML, /Unexpected token|NOT_FOUND|not valid JSON/);
  for (const retry of [false, true]) {
    let prevented = false;
    const link = { href: 'https://shop.example/', target: '', hasAttribute: name => name === 'data-reload' && retry };
    await listeners.get('click')({ target: { closest: selector => selector === 'a' ? link : null }, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, false, 'Browser darf Startseite vollständig neu laden');
  }
  assert.equal(pushed, 0);
});
