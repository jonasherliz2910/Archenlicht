import { ShopError } from './layout.js';

const PAGE_SIZE = 25;
const pageNumber = value => Math.min(100000, Math.max(1, Math.floor(Number(value) || 1)));
// The two supported databases use different JSON operators; field names are
// fixed here, while search values and identifiers always remain parameters.
export class AdminCustomers {
  constructor(store) { this.s = store; }
  json(column, field) { return this.s.remote ? `(${column}::jsonb)->>'${field}'` : `json_extract(${column}, '$.${field}')`; }
  orderEmail() { return `LOWER(COALESCE(ou.email, ${this.json('o.recipient', 'email')}))`; }
  contacts() {
    return `WITH contacts AS (
      SELECT LOWER(u.email) AS email,COALESCE(${this.json('p.address', 'name')},'') AS name,u.created AS seen,'account:' || u.id AS contact_key FROM users u LEFT JOIN account_profiles p ON p.user_id=u.id
      UNION ALL SELECT ${this.orderEmail()},COALESCE(${this.json('o.recipient', 'name')},''),o.created,'order:' || o.id FROM orders o LEFT JOIN users ou ON ou.id=o.user_id
      UNION ALL SELECT LOWER(email),first_name || ' ' || last_name,requested_at,'newsletter:' || id FROM newsletter_subscribers
    ), matched AS (SELECT DISTINCT email FROM contacts WHERE LOWER(email) LIKE ? OR LOWER(name) LIKE ?),
    grouped AS (SELECT email,MAX(name) AS name,MIN(seen) AS first_seen,MAX(seen) AS last_seen,MIN(contact_key) AS contact_key FROM contacts GROUP BY email),
    order_totals AS (SELECT ${this.orderEmail()} AS email,COUNT(*) AS order_count,SUM(CASE WHEN o.paid_at IS NOT NULL THEN 1 ELSE 0 END) AS paid_count,SUM(CASE WHEN o.paid_at IS NOT NULL THEN o.amount ELSE 0 END) AS paid_total FROM orders o LEFT JOIN users ou ON ou.id=o.user_id GROUP BY ${this.orderEmail()}),
    customers AS (SELECT c.email,c.contact_key,c.first_seen,c.last_seen,COALESCE(NULLIF(${this.json('p.address', 'name')},''),NULLIF(n.first_name || ' ' || n.last_name,''),NULLIF(c.name,''),'') AS name,u.id AS account_id,u.role,n.status AS newsletter_status,COALESCE(ot.order_count,0) AS order_count,COALESCE(ot.paid_count,0) AS paid_count,COALESCE(ot.paid_total,0) AS paid_total
      FROM grouped c JOIN matched m ON m.email=c.email LEFT JOIN users u ON LOWER(u.email)=c.email LEFT JOIN account_profiles p ON p.user_id=u.id LEFT JOIN newsletter_subscribers n ON LOWER(n.email)=c.email LEFT JOIN order_totals ot ON ot.email=c.email)`;
  }
  async list({ search = '', page = 1, filter = 'all' } = {}) {
    search = String(search).trim().slice(0, 100).toLowerCase(); page = pageNumber(page);
    const filters = { all: '1=1', accounts: 'account_id IS NOT NULL', guests: 'account_id IS NULL AND order_count>0', newsletter: 'newsletter_status IS NOT NULL' };
    if (!Object.hasOwn(filters, filter)) throw new ShopError('Ungültiger Kundenfilter.');
    const match = `%${search}%`, cte = this.contacts(), where = filters[filter];
    const count = await this.s.get(`${cte} SELECT COUNT(*) AS n FROM customers WHERE ${where}`, match, match);
    const pages = Math.max(1, Math.ceil(count.n / PAGE_SIZE)); page = Math.min(page, pages);
    const customers = await this.s.all(`${cte} SELECT * FROM customers WHERE ${where} ORDER BY last_seen DESC,email LIMIT ? OFFSET ?`, match, match, PAGE_SIZE, (page - 1) * PAGE_SIZE);
    return { customers: customers.map(c => ({ ...c, paid_total: Number(c.paid_total) })), total: count.n, page, pages, pageSize: PAGE_SIZE, search, filter };
  }
  async emailFor(key) {
    const match = /^(account|order|newsletter):([A-Za-z0-9_-]{1,80})$/.exec(key || '');
    if (!match) throw new ShopError('Kundenkontakt nicht gefunden.', 404);
    const [, kind, id] = match;
    const row = kind === 'account' ? await this.s.get('SELECT email FROM users WHERE id=?', id)
      : kind === 'newsletter' ? await this.s.get('SELECT email FROM newsletter_subscribers WHERE id=?', id)
      : await this.s.get(`SELECT ${this.orderEmail()} AS email FROM orders o LEFT JOIN users ou ON ou.id=o.user_id WHERE o.id=?`, id);
    if (!row?.email) throw new ShopError('Kundenkontakt nicht gefunden.', 404);
    return row.email.toLowerCase();
  }
  async detail(key, requestedPage = 1) {
    const email = await this.emailFor(key);
    const account = await this.s.get('SELECT id,email,role,created FROM users WHERE LOWER(email)=?', email);
    const profile = account && await this.s.get('SELECT address,updated FROM account_profiles WHERE user_id=?', account.id);
    const newsletter = await this.s.get('SELECT first_name,last_name,status,requested_at,confirmed_at,unsubscribed_at,consent_version FROM newsletter_subscribers WHERE LOWER(email)=?', email);
    const from = `FROM orders o LEFT JOIN users ou ON ou.id=o.user_id WHERE ${this.orderEmail()}=?`;
    const totals = await this.s.get(`SELECT COUNT(*) AS n,SUM(CASE WHEN o.paid_at IS NOT NULL THEN o.amount ELSE 0 END) AS paid_total ${from}`, email);
    const pages = Math.max(1, Math.ceil(totals.n / PAGE_SIZE)), page = Math.min(pageNumber(requestedPage), pages);
    const orders = (await this.s.all(`SELECT o.id,o.number,o.recipient,o.amount,o.currency,o.status,o.payment_method,o.mode,o.created,o.paid_at ${from} ORDER BY o.created DESC,o.id LIMIT ? OFFSET ?`, email, PAGE_SIZE, (page - 1) * PAGE_SIZE)).map(o => ({ ...o, recipient: JSON.parse(o.recipient) }));
    const latest = await this.s.get(`SELECT o.recipient ${from} ORDER BY o.created DESC,o.id LIMIT 1`, email);
    const savedAddress = profile?.address ? JSON.parse(profile.address) : null, latestAddress = latest ? JSON.parse(latest.recipient) : null;
    return { key, email, name: savedAddress?.name || (newsletter ? `${newsletter.first_name} ${newsletter.last_name}` : '') || latestAddress?.name || '', account: account || null, savedAddress, latestAddress, newsletter: newsletter || null, orders, totalOrders: totals.n, paidTotal: Number(totals.paid_total || 0), page, pages };
  }
}
