import { Shop } from '../server/shop.js';
import { defaultConfig } from '../server/index.js';
import { passwordHash } from '../server/store.js';
import { randomUUID } from 'node:crypto';
const shop = new Shop({ ...defaultConfig(), autoShip: false });
try {
  if (shop.s.get("SELECT id FROM users WHERE email='anna@example.test'")) { console.log('Demo-Testdaten sind bereits vorhanden. Keine doppelten Bestellungen angelegt.'); process.exitCode = 0; }
  else {
    const accountId = randomUUID();
    shop.s.run('INSERT INTO users VALUES(?,?,?,?,?)', accountId, 'anna@example.test', passwordHash('Nur-Test-Anna-2026!'), 'customer', Date.now());
    for (const [index, source] of ['tiktok', 'gemeinde'].entries()) {
      const { session } = shop.createSession(source, source === 'tiktok' ? 'fluegel-video' : 'gemeinde-muster');
      if (index) { shop.s.run('UPDATE sessions SET user_id=? WHERE id=?', accountId, session.id); session.user_id = accountId; }
      const c = index ? { kind: 'custom', designId: 'nach-dem-sturm', modelId: 'samsung-galaxy-s24', verseId: 'jes41-10', dedication: 'Für Anna · 2026' } : { kind: 'fixed', designId: 'unter-seinen-fluegeln', modelId: 'iphone-15', dedication: '' };
      shop.track(session, 'view', c.kind, c.designId); shop.saveCart(session, c);
      const result = await shop.checkout(session, { method: index ? 'card' : 'paypal', recipient: { name: index ? 'Anna Mustermann' : 'Mara Mustermann', email: index ? 'anna@example.test' : 'mara@example.test', phone: '+4915112345678', street: 'Testweg 12', postalCode: '10115', city: 'Berlin', country: 'DE' } });
      const order = shop.s.get('SELECT * FROM orders WHERE id=?', result.orderId);
      shop.acceptPayment({ id: `seed-${order.id}`, orderId: order.id, paymentId: order.payment_id, amount: order.amount, currency: 'EUR', completed: true });
      await shop.tick(); shop.podbase.advance(order.id); await shop.tick();
      shop.s.run('UPDATE orders SET purpose=? WHERE id=?', index ? 'Für mich' : 'Als Geschenk', order.id);
      console.log(`${order.number} · ${index ? 'Wunschvers / Karte / Konto' : 'Flügelmotiv / PayPal / Gast'} · ${order.amount / 100} EUR · SIMULIERT`);
    }
    console.log('Zwei Demokäufe angelegt. Testumsatz: 64,80 EUR. Demokonto: anna@example.test / Nur-Test-Anna-2026!');
  }
} finally { shop.close(); }
