import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { DESIGNS, MODELS } from './catalog.js';
import { MAIL_TABLES } from './schema.js';
export const token = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(String(value)).digest('hex');
export function passwordHash(value) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(value, salt, 64).toString('hex')}`; }
export function passwordMatches(value, encoded) { const [salt, hash] = encoded.split(':'); const candidate = scryptSync(value, salt, 64); return timingSafeEqual(candidate, Buffer.from(hash, 'hex')); }
export function openStore(dir, options = {}) {
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, 'shop.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'customer',created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS account_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),address TEXT,address_version INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS payment_customers(user_id TEXT NOT NULL REFERENCES users(id),provider TEXT NOT NULL,customer_id TEXT UNIQUE NOT NULL,PRIMARY KEY(user_id,provider));
    CREATE TABLE IF NOT EXISTS local_payment_methods(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),brand TEXT NOT NULL,last4 TEXT NOT NULL,exp_month INTEGER NOT NULL,exp_year INTEGER NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,csrf TEXT NOT NULL,user_id TEXT REFERENCES users(id),visit_id TEXT NOT NULL,expires INTEGER NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS order_access(session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,order_id TEXT NOT NULL REFERENCES orders(id),PRIMARY KEY(session_id,order_id));
    CREATE TABLE IF NOT EXISTS visits(id TEXT PRIMARY KEY,source TEXT NOT NULL,campaign TEXT,created INTEGER NOT NULL,mode TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events(visit_id TEXT NOT NULL,type TEXT NOT NULL,kind TEXT NOT NULL,design_id TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(visit_id,type,kind,design_id));
    CREATE TABLE IF NOT EXISTS variants(model_id TEXT NOT NULL,design_id TEXT NOT NULL,available INTEGER NOT NULL,print_approved INTEGER NOT NULL,approval_mode TEXT NOT NULL,PRIMARY KEY(model_id,design_id));
    CREATE TABLE IF NOT EXISTS cart(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,configuration TEXT NOT NULL,quantity INTEGER NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS assets(hash TEXT PRIMARY KEY,configuration TEXT NOT NULL,print_text TEXT NOT NULL,svg TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,number TEXT UNIQUE NOT NULL,session_id TEXT NOT NULL,user_id TEXT REFERENCES users(id),guest_hash TEXT UNIQUE NOT NULL,recipient TEXT NOT NULL,items TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,payment_method TEXT NOT NULL,payment_id TEXT UNIQUE,source TEXT NOT NULL,visit_id TEXT NOT NULL,mode TEXT NOT NULL,purpose TEXT NOT NULL DEFAULT 'Keine Angabe',created INTEGER NOT NULL,paid_at INTEGER);
    CREATE TABLE IF NOT EXISTS payment_events(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),payment_id TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS stripe_payments(order_id TEXT PRIMARY KEY REFERENCES orders(id),session_id TEXT UNIQUE,payment_intent_id TEXT,tax_treatment TEXT NOT NULL,tax_amount INTEGER,verified_at INTEGER);
    CREATE TABLE IF NOT EXISTS checkout_preferences(order_id TEXT PRIMARY KEY REFERENCES orders(id),user_id TEXT REFERENCES users(id),save_address INTEGER NOT NULL DEFAULT 0,address_version INTEGER NOT NULL DEFAULT 0,customer_id TEXT);
    CREATE TABLE IF NOT EXISTS fulfillment(order_id TEXT PRIMARY KEY REFERENCES orders(id),state TEXT NOT NULL,provider_id TEXT UNIQUE,error TEXT,tracking TEXT,tracking_url TEXT,attempts INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS provider_orders(id TEXT PRIMARY KEY,external_id TEXT UNIQUE NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL,tracking TEXT,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mail_outbox(id TEXT PRIMARY KEY,order_id TEXT REFERENCES orders(id),kind TEXT NOT NULL,recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(order_id,kind));
    CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,visit_id TEXT NOT NULL,reason TEXT NOT NULL,created INTEGER NOT NULL);
  `);
  for (const statement of MAIL_TABLES) db.exec(statement);
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  const get = (sql, ...params) => db.prepare(sql).get(...params);
  const all = (sql, ...params) => db.prepare(sql).all(...params);
  const tx = fn => { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const now = Date.now();
  tx(() => { for (const m of MODELS) for (const d of DESIGNS) run('INSERT OR IGNORE INTO variants VALUES(?,?,1,1,?)', m.id, d.id, 'test'); });
  const adminEmail = options.adminEmail || 'jonas@archenlicht.test';
  if (!get('SELECT id FROM users WHERE email=?', adminEmail)) {
    const password = options.adminPassword || token().slice(0, 22);
    run('INSERT INTO users VALUES(?,?,?,?,?)', token(), adminEmail, passwordHash(password), 'admin', now);
    if (!options.adminPassword) writeFileSync(join(dir, 'admin-access.txt'), `Nur lokaler Testbetrieb. Nicht veröffentlichen.\nE-Mail: ${adminEmail}\nPasswort: ${password}\nAnmeldung: /konto\nAuswertung: /auswertung\n`, { mode: 0o600 });
  }
  return { db, dir, run, get, all, tx, close: () => db.close() };
}
