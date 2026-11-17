import { DurableObject } from 'cloudflare:workers';
import { migrationConfig } from './migration-config.js';
import { nodeHandlerResponse } from './node-handler.js';
import { migrationAccess } from './migration-access.js';
import { JobScheduler, mayQueueWork } from './job-scheduler.js';
import { ShopRequestQueue } from './shop-request-queue.js';

export class MigrationShop extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env); this.requests = new ShopRequestQueue(); this.printQueue = Promise.resolve(); this.application = null;
    this.scheduler = new JobScheduler(ctx.storage, async origin => (await this.getApplication(origin)).shop);
  }
  serial(work) {
    return this.requests.serial(work);
  }
  fetch(request) { return this.requests.fetch(request, () => this.handle(request)); }
  alarm() { return this.serial(() => this.scheduler.run()); }
  configuration(origin) { return migrationConfig(this.env, origin); }
  async getApplication(origin) {
    if (!this.application) {
      this.application = (async () => {
        const { createApp } = await import('../server/index.js');
        const { prepareDesign } = await import('../server/design-assets.js');
        const config = this.configuration(origin);
        return createApp({ ...config, jobStatus: () => this.scheduler.status(), prepareDesign: id => prepareDesign(id, this.env.ASSETS), serializePreview: work => {
          const task = this.printQueue.then(work);
          this.printQueue = task.catch(() => {});
          return task;
        } });
      })();
      this.application.catch(() => { this.application = null; });
    }
    return this.application;
  }
  async handle(request) {
    try {
      const origin = new URL(request.url).origin;
      // Arm before a request can commit payment, email or fulfillment work.
      // A first request also discovers outstanding work from an earlier runtime.
      if (!this.application || mayQueueWork(request)) await this.scheduler.arm(origin);
      const { handler } = await this.getApplication(origin);
      return await nodeHandlerResponse(handler, request, request.headers.get('x-forwarded-for') || 'unknown');
    } catch {
      console.error('Cloudflare shop could not start; no credentials or request data logged.');
      return Response.json({ error: 'Der Shop ist gerade nicht erreichbar. Bitte versuche es später erneut.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  }
}

export default {
  async fetch(request, env) {
    const access = migrationAccess(request, env.MIGRATION_ACCESS_PASSWORD);
    if (!access.authorized) {
      return new Response('Geschützter Archenlicht-Umzugstest.', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Archenlicht Umzugstest"', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
    }
    const url = new URL(request.url);
    let response;
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/prints/') || url.pathname.startsWith('/rechtliches/')) {
      const forwarded = new Request(request);
      // Cloudflare supplies the source address. Never trust a visitor's X-Forwarded-For.
      forwarded.headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || 'unknown');
      // Once staging sets its own cookie, the shop's guest Bearer links work unchanged.
      if (forwarded.headers.get('authorization')?.startsWith('Basic ')) forwarded.headers.delete('authorization');
      response = await env.SHOP.get(env.SHOP.idFromName('isolated-migration-v1')).fetch(forwarded);
    } else {
      response = await env.ASSETS.fetch(request);
    }
    const result = new Response(response.body, response);
    result.headers.set('X-Robots-Tag', 'noindex, nofollow');
    result.headers.set('Cache-Control', 'private, no-store');
    if (access.cookie) result.headers.append('Set-Cookie', access.cookie);
    return result;
  }
};
