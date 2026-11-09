export const MAIL_TABLES = [
  "CREATE TABLE IF NOT EXISTS mail_deliveries(mail_id TEXT PRIMARY KEY REFERENCES mail_outbox(id),state TEXT NOT NULL,payload TEXT NOT NULL,provider_id TEXT UNIQUE,attempts INTEGER NOT NULL DEFAULT 0,first_attempt INTEGER,next_attempt INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,lease_token TEXT,last_error TEXT,created INTEGER NOT NULL,accepted_at INTEGER)",
  "CREATE TABLE IF NOT EXISTS mail_events(event_id TEXT PRIMARY KEY,provider_id TEXT NOT NULL,type TEXT NOT NULL,event_at INTEGER NOT NULL,created INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS mail_suppressions(address_hash TEXT PRIMARY KEY,reason TEXT NOT NULL,created INTEGER NOT NULL)"
];
export const TABLES = [
  "CREATE TABLE IF NOT EXISTS newsletter_subscribers(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,first_name TEXT NOT NULL,last_name TEXT NOT NULL,status TEXT NOT NULL,confirm_hash TEXT UNIQUE NOT NULL,confirm_expires INTEGER NOT NULL,unsubscribe_hash TEXT UNIQUE NOT NULL,code TEXT UNIQUE,code_hash TEXT UNIQUE,consent_version TEXT NOT NULL,requested_at INTEGER NOT NULL,confirmed_at INTEGER,unsubscribed_at INTEGER)",
  "CREATE TABLE IF NOT EXISTS newsletter_consents(id TEXT PRIMARY KEY,subscriber_id TEXT NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,action TEXT NOT NULL,version TEXT NOT NULL,consent_text TEXT NOT NULL,created INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS newsletter_limits(id TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'customer',created INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS account_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),address TEXT,address_version INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS payment_customers(user_id TEXT NOT NULL REFERENCES users(id),provider TEXT NOT NULL,customer_id TEXT UNIQUE NOT NULL,PRIMARY KEY(user_id,provider))",
  "CREATE TABLE IF NOT EXISTS local_payment_methods(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),brand TEXT NOT NULL,last4 TEXT NOT NULL,exp_month INTEGER NOT NULL,exp_year INTEGER NOT NULL,created INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,csrf TEXT NOT NULL,user_id TEXT REFERENCES users(id),visit_id TEXT NOT NULL,expires INTEGER NOT NULL,created INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS visits(id TEXT PRIMARY KEY,source TEXT NOT NULL,campaign TEXT,created INTEGER NOT NULL,mode TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS events(visit_id TEXT NOT NULL,type TEXT NOT NULL,kind TEXT NOT NULL,design_id TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(visit_id,type,kind,design_id))",
  "CREATE TABLE IF NOT EXISTS variants(model_id TEXT NOT NULL,design_id TEXT NOT NULL,available INTEGER NOT NULL,print_approved INTEGER NOT NULL,approval_mode TEXT NOT NULL,PRIMARY KEY(model_id,design_id))",
  "CREATE TABLE IF NOT EXISTS cart(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,configuration TEXT NOT NULL,quantity INTEGER NOT NULL,created INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS assets(hash TEXT PRIMARY KEY,configuration TEXT NOT NULL,print_text TEXT NOT NULL,svg TEXT NOT NULL,created INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,number TEXT UNIQUE NOT NULL,session_id TEXT NOT NULL,user_id TEXT REFERENCES users(id),guest_hash TEXT UNIQUE NOT NULL,recipient TEXT NOT NULL,items TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,payment_method TEXT NOT NULL,payment_id TEXT UNIQUE,source TEXT NOT NULL,visit_id TEXT NOT NULL,mode TEXT NOT NULL,purpose TEXT NOT NULL DEFAULT 'Keine Angabe',created INTEGER NOT NULL,paid_at INTEGER)",
  "CREATE TABLE IF NOT EXISTS order_access(session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,order_id TEXT NOT NULL REFERENCES orders(id),PRIMARY KEY(session_id,order_id))",
  "CREATE TABLE IF NOT EXISTS payment_events(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),payment_id TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS stripe_payments(order_id TEXT PRIMARY KEY REFERENCES orders(id),session_id TEXT UNIQUE,payment_intent_id TEXT,tax_treatment TEXT NOT NULL,tax_amount INTEGER,verified_at INTEGER)",
  "CREATE TABLE IF NOT EXISTS checkout_preferences(order_id TEXT PRIMARY KEY REFERENCES orders(id),user_id TEXT REFERENCES users(id),save_address INTEGER NOT NULL DEFAULT 0,address_version INTEGER NOT NULL DEFAULT 0,customer_id TEXT)",
  "CREATE TABLE IF NOT EXISTS fulfillment(order_id TEXT PRIMARY KEY REFERENCES orders(id),state TEXT NOT NULL,provider_id TEXT UNIQUE,error TEXT,tracking TEXT,tracking_url TEXT,attempts INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS provider_orders(id TEXT PRIMARY KEY,external_id TEXT UNIQUE NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL,tracking TEXT,created INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS mail_outbox(id TEXT PRIMARY KEY,order_id TEXT REFERENCES orders(id),kind TEXT NOT NULL,recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(order_id,kind))",
  "CREATE TABLE IF NOT EXISTS newsletter_mail(mail_id TEXT PRIMARY KEY REFERENCES mail_outbox(id),subscriber_id TEXT NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,generation TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS newsletter_redemptions(subscriber_id TEXT NOT NULL REFERENCES newsletter_subscribers(id),mode TEXT NOT NULL,order_id TEXT UNIQUE NOT NULL REFERENCES orders(id),redeemed_at INTEGER,PRIMARY KEY(subscriber_id,mode))",
  "CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,visit_id TEXT NOT NULL,reason TEXT NOT NULL,created INTEGER NOT NULL)",
  ...MAIL_TABLES
];
