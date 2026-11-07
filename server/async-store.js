import { AsyncLocalStorage } from 'node:async_hooks';
import { resolve } from 'node:path';
import { Client, neon, types } from '@neondatabase/serverless';
import { openStore, token, passwordHash } from './store.js';
import { TABLES } from './schema.js';
import { MODELS, DESIGNS } from './catalog.js';

types.setTypeParser(20, value => Number(value));
const transactions = new AsyncLocalStorage(), localGates = new Map(), prepared = new Map();
const LOCK = 1846012910;
const tableNames = new Set([...TABLES.map(sql => /EXISTS (\w+)/.exec(sql)[1]), 'artwork_blobs', 'print_files']);

// The existing query vocabulary is shared by local SQLite and PostgreSQL.
// Parameters remain separate; quoted SQL strings never become placeholders.
export function postgresQuery(source, schema = 'public') {
  if (!/^[a-z_][a-z0-9_]{0,60}$/.test(schema)) throw new Error('Ungültiges Datenbankschema.');
  let sql = '', quoted = false, parameter = 0;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === "'") { sql += char; if (quoted && source[i + 1] === "'") sql += source[++i]; else quoted = !quoted; }
    else sql += char === '?' && !quoted ? `$${++parameter}` : char;
  }
  const ignore = /^INSERT OR IGNORE /i.test(sql);
  if (ignore) sql = sql.replace(/^INSERT OR IGNORE /i, 'INSERT ') + ' ON CONFLICT DO NOTHING';
  return sql.split(/('(?:''|[^'])*')/).map((part, index) => index % 2 ? part : part.replace(/\bAS (expMonth|expYear)\b/g, 'AS "$1"').replace(/\b(FROM|JOIN|INTO|UPDATE|REFERENCES|TABLE IF NOT EXISTS)\s+(\w+)/gi, (match, keyword, table) => tableNames.has(table) ? `${keyword} "${schema}"."${table}"` : match)).join('');
}

function localStore(config) {
  const local = openStore(config.dataDir, config), key = resolve(config.dataDir);
  if (!localGates.has(key)) localGates.set(key, { tail: Promise.resolve() });
  const gate = localGates.get(key), identity = {};
  const serial = work => {
    if (transactions.getStore()?.identity === identity) return Promise.resolve().then(work);
    const next = gate.tail.then(() => transactions.run({ identity }, work));
    gate.tail = next.catch(() => {}); return next;
  };
  return {
    remote: false, dir: local.dir,
    run: (...args) => serial(() => local.run(...args)),
    get: (...args) => serial(() => local.get(...args)),
    all: (...args) => serial(() => local.all(...args)),
    tx: work => serial(async () => {
      local.db.exec('BEGIN IMMEDIATE');
      try { const result = await work(); local.db.exec('COMMIT'); return result; }
      catch (error) { local.db.exec('ROLLBACK'); throw error; }
    }),
    close: () => serial(() => local.close())
  };
}

async function postgresStore(config) {
  if (!config.databaseUrl || !config.adminPassword) throw new Error('Für den gehosteten Testshop fehlen Datenbank oder Admin-Konfiguration.');
  const http = neon(config.databaseUrl, { fullResults: true }), identity = {}, schema = config.databaseSchema || 'public';
  const schemaKey = config.databaseUrl + ':' + schema;
  const query = async (sql, params) => {
    const client = transactions.getStore();
    return client?.identity === identity ? client.connection.query(postgresQuery(sql, schema), params) : http.query(postgresQuery(sql, schema), params, { fetchOptions: { signal: AbortSignal.timeout(15000) } });
  };
  const store = {
    remote: true,
    async run(sql, ...params) { const result = await query(sql, params); return { changes: result.rowCount }; },
    async get(sql, ...params) { return (await query(sql, params)).rows[0]; },
    async all(sql, ...params) { return (await query(sql, params)).rows; },
    async tx(work) {
      if (transactions.getStore()?.identity === identity) throw new Error('Verschachtelte Transaktionen werden nicht unterstützt.');
      const connection = new Client({ connectionString: config.databaseUrl, connectionTimeoutMillis: 15000 });
      await connection.connect();
      try {
        await connection.query('BEGIN');
        await connection.query('SELECT pg_advisory_xact_lock($1)', [LOCK]);
        const result = await transactions.run({ identity, connection }, work);
        await connection.query('COMMIT'); return result;
      } catch (error) { await connection.query('ROLLBACK').catch(() => {}); throw error; }
      finally { await connection.end(); }
    },
    async close() {} // HTTP queries own no persistent connections; each tx closes its client.
  };
  if (!prepared.has(schemaKey)) {
    const initialization = store.tx(async () => {
      if (!/^[a-z_][a-z0-9_]{0,60}$/.test(schema)) throw new Error('Ungültiges Datenbankschema.');
      await store.run(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      for (const table of TABLES) await store.run(table.replace(/\bINTEGER\b/g, 'BIGINT'));
      await store.run('CREATE TABLE IF NOT EXISTS artwork_blobs(hash TEXT PRIMARY KEY,data_url TEXT NOT NULL)');
      await store.run('CREATE TABLE IF NOT EXISTS print_files(hash TEXT PRIMARY KEY REFERENCES assets(hash),content TEXT NOT NULL)');
      const values = [], params = [];
      for (const model of MODELS) for (const design of DESIGNS) { values.push('(?,?,1,1,?)'); params.push(model.id, design.id, 'test'); }
      await store.run(`INSERT OR IGNORE INTO variants VALUES${values.join(',')}`, ...params);
      const email = config.adminEmail || 'jonas@archenlicht.test';
      if (!await store.get('SELECT id FROM users WHERE email=?', email)) await store.run('INSERT INTO users VALUES(?,?,?,?,?)', token(), email, passwordHash(config.adminPassword), 'admin', Date.now());
    });
    prepared.set(schemaKey, initialization);
    initialization.catch(() => prepared.delete(schemaKey));
  }
  await prepared.get(schemaKey);
  return store;
}

export async function createStore(config) {
  if (config.storageMode === 'postgres') return postgresStore(config);
  if (config.storageMode && config.storageMode !== 'sqlite') throw new Error('Unbekannter Datenspeicher.');
  return localStore(config);
}
