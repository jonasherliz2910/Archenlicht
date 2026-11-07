import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createStore, postgresQuery } from '../server/async-store.js';
import { defaultConfig } from '../server/index.js';

test('Postgres-Abfragen behalten Parameter und zitierte Texte getrennt und berücksichtigen das Zielschema', () => {
  assert.equal(postgresQuery("SELECT '?' AS marker FROM users WHERE email=? AND role='FROM orders'", 'shop_test'), `SELECT '?' AS marker FROM "shop_test"."users" WHERE email=$1 AND role='FROM orders'`);
  assert.equal(postgresQuery('INSERT OR IGNORE INTO events VALUES(?,?,?,?)'), 'INSERT INTO "public"."events" VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING');
  assert.throws(() => postgresQuery('SELECT * FROM users', 'public;DROP'), /schema/i);
});

test('Asynchrone lokale Transaktionen rollen vollständig zurück und schließen parallele Verbindungen aus', async () => {
  const config = { ...defaultConfig(), storageMode: 'sqlite', dataDir: resolve('test-results', randomUUID()), adminPassword: 'Nur-Test-Admin-2026!' };
  const a = await createStore(config), b = await createStore(config);
  try {
    await assert.rejects(a.tx(async () => { await a.run('INSERT INTO visits VALUES(?,?,?,?,?)', 'rollback-test', 'unbekannt', null, Date.now(), 'test'); await Promise.resolve(); throw new Error('Rollback prüfen'); }), /Rollback/);
    assert.equal(await b.get('SELECT * FROM visits WHERE id=?', 'rollback-test'), undefined);
    const trace = [];
    await Promise.all([
      a.tx(async () => { trace.push('begin'); await a.run('INSERT INTO visits VALUES(?,?,?,?,?)', 'parallel-test', 'unbekannt', null, Date.now(), 'test'); await new Promise(r => setTimeout(r, 15)); trace.push('commit'); }),
      b.get('SELECT * FROM visits WHERE id=?', 'parallel-test').then(row => { assert.ok(row); trace.push('read'); })
    ]);
    assert.deepEqual(trace, ['begin', 'commit', 'read']);
  } finally { await a.close(); await b.close(); }
});
