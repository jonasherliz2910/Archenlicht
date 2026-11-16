import { Client } from '@neondatabase/serverless';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const magic = Buffer.from('ARCHENLICHT-BACKUP-1\n');
const identifier = value => { if (!/^[a-z_][a-z0-9_]{0,60}$/.test(value)) throw new Error('Unsupported SQL identifier'); return `"${value}"`; };
const digest = value => createHash('sha256').update(value).digest('hex');
const tableHash = rows => digest(rows.map(row => JSON.stringify(row)).sort().join('\n'));
const tableQuery = `SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' ORDER BY table_name`;
const columnQuery = `SELECT table_name,column_name,data_type,column_default,is_nullable,is_identity,is_generated FROM information_schema.columns WHERE table_schema=$1 ORDER BY table_name,ordinal_position`;
const constraintQuery = `SELECT c.relname AS table_name,k.conname AS name,k.contype AS type,pg_get_constraintdef(k.oid) AS definition,r.relname AS referenced_table,rn.nspname AS referenced_schema FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_class r ON r.oid=k.confrelid LEFT JOIN pg_namespace rn ON rn.oid=r.relnamespace WHERE n.nspname=$1 ORDER BY c.relname,k.conname`;

export function encryptBackup(snapshot, key) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(magic);
  const content = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(snapshot)))), cipher.final()]);
  return Buffer.concat([magic, iv, cipher.getAuthTag(), content]);
}
export function decryptBackup(bytes, key) {
  if (!bytes.subarray(0, magic.length).equals(magic)) throw new Error('Unsupported backup format');
  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(magic.length, magic.length + 12));
  decipher.setAAD(magic); decipher.setAuthTag(bytes.subarray(magic.length + 12, magic.length + 28));
  return JSON.parse(gunzipSync(Buffer.concat([decipher.update(bytes.subarray(magic.length + 28)), decipher.final()])).toString('utf8'));
}
async function connect(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 15000 });
  client.on('error', () => {}); await client.connect(); return client;
}

export async function snapshotShop(databaseUrl, schema = 'public') {
  identifier(schema);
  const client = await connect(databaseUrl);
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const names = (await client.query(tableQuery, [schema])).rows.map(r => r.table_name);
    const columns = (await client.query(columnQuery, [schema])).rows;
    const constraints = (await client.query(constraintQuery, [schema])).rows;
    const extra = (await client.query(`SELECT
      (SELECT count(*) FROM information_schema.views WHERE table_schema=$1)::int AS views,
      (SELECT count(*) FROM information_schema.sequences WHERE sequence_schema=$1)::int AS sequences,
      (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND NOT t.tgisinternal)::int AS triggers,
      (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND (c.relrowsecurity OR c.relispartition))::int AS policies_or_partitions,
      (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND NOT EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conindid=i.indexrelid))::int AS extra_indexes`, [schema])).rows[0];
    if (Object.values(extra).some(Boolean)) throw new Error('Schema has additional objects; use a full pg_dump instead of this shop-specific backup');
    if (!names.includes('users') || !names.includes('orders') || !names.includes('print_files')) throw new Error('Expected shop tables missing');
    if (columns.some(c => !['text', 'bigint'].includes(c.data_type) || c.is_identity !== 'NO' || c.is_generated !== 'NEVER')) throw new Error('Unsupported schema type');
    if (constraints.some(c => !['p', 'u', 'f', 'n'].includes(c.type) || c.type === 'f' && c.referenced_schema !== schema)) throw new Error('Unsupported constraint or external schema dependency');
    const tables = [];
    for (const name of names) {
      const rows = (await client.query(`SELECT * FROM ${identifier(schema)}.${identifier(name)}`)).rows;
      tables.push({ name, rows, hash: tableHash(rows) });
    }
    const result = { format: 1, createdAt: new Date().toISOString(), schema, columns, constraints, tables };
    await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { await client.end().catch(() => {}); }
}

export async function verifyRestore(databaseUrl, snapshot) {
  if (snapshot.format !== 1) throw new Error('Unsupported backup format');
  const schema = 'cf_restore_' + randomBytes(8).toString('hex'), client = await connect(databaseUrl);
  let created = false;
  try {
    // A restore test can only create a brand new, randomly named schema. It
    // never deletes, updates or replaces production tables or existing schemas.
    await client.query(`CREATE SCHEMA ${identifier(schema)}`); created = true;
    await client.query('BEGIN');
    for (const table of snapshot.tables) {
      const columns = snapshot.columns.filter(c => c.table_name === table.name);
      const namedNotNull = snapshot.constraints.some(c => c.table_name === table.name && c.type === 'n');
      const definitions = columns.map(c => `${identifier(c.column_name)} ${c.data_type}${!namedNotNull && c.is_nullable === 'NO' ? ' NOT NULL' : ''}${c.column_default === null ? '' : ' DEFAULT ' + c.column_default}`);
      await client.query(`CREATE TABLE ${identifier(schema)}.${identifier(table.name)} (${definitions.join(',')})`);
      for (let i = 0; i < table.rows.length; i += 20) {
        const rows = table.rows.slice(i, i + 20), values = [];
        const placeholders = rows.map(row => '(' + columns.map(c => { values.push(row[c.column_name]); return '$' + values.length; }).join(',') + ')');
        await client.query(`INSERT INTO ${identifier(schema)}.${identifier(table.name)} (${columns.map(c => identifier(c.column_name)).join(',')}) VALUES ${placeholders.join(',')}`, values);
      }
    }
    // Primary/unique keys precede foreign keys, which then validate every row.
    for (const constraint of [...snapshot.constraints.filter(c => c.type === 'n'), ...snapshot.constraints.filter(c => ['p', 'u'].includes(c.type)), ...snapshot.constraints.filter(c => c.type === 'f')]) {
      let definition = constraint.definition;
      if (constraint.type === 'f') definition = definition.replace(/REFERENCES\s+(?:"?[a-z_][a-z0-9_]*"?\.)?"?[a-z_][a-z0-9_]*"?\s*\(/, `REFERENCES ${identifier(schema)}.${identifier(constraint.referenced_table)}(`);
      await client.query(`ALTER TABLE ${identifier(schema)}.${identifier(constraint.table_name)} ADD CONSTRAINT ${identifier(constraint.name)} ${definition}`);
    }
    await client.query('COMMIT');
    for (const table of snapshot.tables) {
      const restored = (await client.query(`SELECT * FROM ${identifier(schema)}.${identifier(table.name)}`)).rows;
      if (tableHash(restored) !== table.hash || restored.length !== table.rows.length) throw new Error('Restored data does not match: ' + table.name);
    }
    const columns = (await client.query(columnQuery, [schema])).rows;
    if (JSON.stringify(columns) !== JSON.stringify(snapshot.columns)) throw new Error('Restored columns differ');
    const normalize = c => ({ ...c, referenced_schema: c.referenced_schema ? 'RESTORED_SCHEMA' : null, definition: c.definition.replace(new RegExp(`(?:"?${schema}"?|"?${snapshot.schema}"?)\\.`, 'g'), '') });
    const constraints = (await client.query(constraintQuery, [schema])).rows;
    if (JSON.stringify(constraints.map(normalize)) !== JSON.stringify(snapshot.constraints.map(normalize))) throw new Error('Restored constraints differ');
    return { passed: true, tables: snapshot.tables.length, rows: snapshot.tables.reduce((n, t) => n + t.rows.length, 0), schemaRemoved: true };
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    if (created) { if (!/^cf_restore_[a-f0-9]{16}$/.test(schema)) throw new Error('Unsafe cleanup schema'); await client.query(`DROP SCHEMA ${identifier(schema)} CASCADE`); }
    await client.end().catch(() => {});
  }
}

async function main() {
  const [sourceEnv, destination, keyPath] = process.argv.slice(2);
  if (!sourceEnv || !destination || !keyPath) throw new Error('Usage: node scripts/shop-backup.mjs <source.env.local> <ignored backup directory> <ignored key file>');
  const env = parseEnv(await readFile(sourceEnv, 'utf8'));
  const dir = resolve(destination); await mkdir(dir, { recursive: true });
  let key;
  try { key = Buffer.from((await readFile(keyPath, 'utf8')).trim(), 'base64'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; key = randomBytes(32); await writeFile(keyPath, key.toString('base64') + '\n', { flag: 'wx' }); }
  if (key.length !== 32) throw new Error('Invalid backup key');
  const snapshot = await snapshotShop(env.DATABASE_URL, env.DATABASE_SCHEMA || 'public');
  const filename = 'shop-' + snapshot.createdAt.replace(/[:.]/g, '-') + '.albackup';
  const encrypted = encryptBackup(snapshot, key); await writeFile(resolve(dir, filename), encrypted, { flag: 'wx' });
  // Verify the bytes read back from disk, not just the in-memory original.
  const recovered = decryptBackup(await readFile(resolve(dir, filename)), key);
  const report = { createdAt: snapshot.createdAt, file: filename, sha256: digest(encrypted), bytes: encrypted.length,
    tables: snapshot.tables.map(t => ({ name: t.name, rows: t.rows.length, sha256: t.hash })) };
  await writeFile(resolve(dir, filename + '.json'), JSON.stringify(report, null, 2));
  report.restore = await verifyRestore(env.DATABASE_URL, recovered);
  await writeFile(resolve(dir, filename + '.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ file: resolve(dir, filename), bytes: report.bytes, restore: report.restore }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {
  // Database errors can include SQL values, addresses or connection details.
  console.error('Backup/restore did not complete; no customer data logged. Error category: ' + error.name);
  process.exitCode = 1;
});
