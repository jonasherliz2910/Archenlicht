import { MigrationShop } from './shop-worker.js';
import { productionConfig } from './production-config.js';
import { productionFetch } from './production-router.js';

export class ProductionShop extends MigrationShop {
  configuration() { return productionConfig(this.env); }
}
export default { fetch: productionFetch };
