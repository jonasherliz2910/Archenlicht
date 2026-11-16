import { MigrationShop } from './shop-worker.js';
import { sandboxConfig } from './sandbox-config.js';
import { sandboxFetch } from './sandbox-router.js';

export class SandboxShop extends MigrationShop {
  configuration() { return sandboxConfig(this.env); }
}
export default { fetch: sandboxFetch };
