const MIN_DELAY = 30000;
const FAILURE_DELAY = 60000;

// Only wake for work the configured providers can actually process. Completed,
// rejected and manually held jobs must not keep a free database awake forever.
export async function pendingWork(shop) {
  const { config, s } = shop;
  const enabled = config.shopMode !== 'live' || config.podbaseSubmissionEnabled === true;
  const skipSimulatedPolling = config.podbaseMode === 'local' && !config.autoShip;
  const due = "CASE WHEN f.state IN ('awaiting_approval','production') THEN f.updated+1800000 WHEN f.state IN ('sending','uncertain') THEN f.updated+300000 WHEN f.error IS NOT NULL THEN f.updated+60000 ELSE 0 END";
  const jobs = enabled ? await s.all(`SELECT f.order_id,CASE WHEN f.lease_until>=${due} THEN f.lease_until+1 ELSE ${due} END AS due FROM fulfillment f JOIN orders o ON o.id=f.order_id WHERE o.mode=? AND o.paid_at IS NOT NULL AND f.state IN ('ready','sending','uncertain','awaiting_approval','production')${skipSimulatedPolling ? " AND f.state NOT IN ('awaiting_approval','production')" : ''} ORDER BY due,f.updated LIMIT 3`, config.shopMode) : [];
  let mailAt = null;
  if (shop.mailer.enabled || config.newsletterMode === 'resend') {
    const mail = await s.get("SELECT MIN(CASE WHEN d.lease_until>=d.next_attempt THEN d.lease_until+1 ELSE d.next_attempt END) AS due FROM mail_deliveries d JOIN mail_outbox m ON m.id=d.mail_id LEFT JOIN orders o ON o.id=m.order_id WHERE d.state IN ('queued','sending') AND ((m.kind IN ('newsletter-confirm','newsletter-welcome') AND ?=1) OR (m.kind NOT IN ('newsletter-confirm','newsletter-welcome') AND ?=1)) AND ((o.paid_at IS NOT NULL AND o.mode=? AND o.created>=?) OR m.kind IN ('newsletter-confirm','newsletter-welcome') OR (m.kind IN ('withdrawal-receipt','withdrawal-notification') AND EXISTS(SELECT 1 FROM withdrawal_mail wm JOIN withdrawals w ON w.id=wm.withdrawal_id WHERE wm.mail_id=m.id AND w.mode=?)))", Number(config.newsletterMode === 'resend'), Number(shop.mailer.enabled), config.shopMode, Date.parse(config.mailEnabledSince) || 0, config.shopMode);
    if (mail?.due != null) mailAt = Number(mail.due);
  }
  const times = jobs.map(job => Number(job.due));
  if (mailAt != null) times.push(mailAt);
  return { jobs, mailAt, nextAt: times.length ? Math.min(...times) : null };
}

export function mayQueueWork(request) {
  const path = new URL(request.url).pathname;
  if (path === '/api/jobs' || path.startsWith('/api/orders/')) return true;
  return !['GET', 'HEAD'].includes(request.method) && /^\/api\/(checkout|webhooks\/|newsletter\/|withdrawals|admin\/)/.test(path);
}

export class JobScheduler {
  constructor(storage, getShop, now = Date.now) { this.storage = storage; this.getShop = getShop; this.now = now; }
  async arm(origin) {
    if (await this.storage.get('job-origin') !== origin) await this.storage.put('job-origin', origin);
    const next = this.now() + MIN_DELAY, current = await this.storage.getAlarm();
    if (current == null || current > next) await this.storage.setAlarm(next);
  }
  async run() {
    // Set recovery before touching external state. An isolate restart after a
    // commit cannot lose the only wake-up, even if automatic retries run out.
    await this.storage.setAlarm(this.now() + FAILURE_DELAY);
    try {
      const origin = await this.storage.get('job-origin');
      if (!origin) throw new Error('Missing job origin');
      const shop = await this.getShop(origin), plan = await pendingWork(shop);
      let processed = 0;
      for (const job of plan.jobs) {
        if (Number(job.due) > this.now()) continue;
        await shop.tick({ orderId: job.order_id, limit: 1, budgetMs: 40000 });
        processed++;
      }
      if (plan.mailAt != null && plan.mailAt <= this.now()) await shop.mailer.flush({ limit: 2 });
      const next = await pendingWork(shop);
      const nextAlarm = next.nextAt == null ? null : Math.max(this.now() + MIN_DELAY, next.nextAt);
      const previous = await this.storage.get('job-status');
      await this.storage.put('job-status', { runs: (previous?.runs || 0) + 1, lastRun: this.now(), processed, failures: 0, nextAlarm });
      if (nextAlarm == null) await this.storage.deleteAlarm(); else await this.storage.setAlarm(nextAlarm);
      return { processed, nextAlarm };
    } catch {
      const previous = await this.storage.get('job-status'), failures = (previous?.failures || 0) + 1;
      const nextAlarm = this.now() + Math.min(900000, FAILURE_DELAY * 2 ** Math.min(failures - 1, 4));
      await this.storage.setAlarm(nextAlarm);
      await this.storage.put('job-status', { ...previous, failures, lastFailure: this.now(), nextAlarm });
      console.error('Hintergrundabgleich unterbrochen; erneuter Versuch ist gespeichert.');
      return { retry: true, nextAlarm };
    }
  }
}
