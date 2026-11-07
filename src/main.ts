import 'dotenv/config';
import { CancelOrder } from './application/cancel-order';
import { CreateOrder } from './application/create-order';
import { GetOrder } from './application/get-order';
import { ListOrders } from './application/list-orders';
import { loadConfigOrExit } from './config';
import { buildApp } from './http/app';
import { createDatabase } from './infra/db/database';
import { KnexOrderRepository } from './infra/repositories/knex-order-repository';
import { KnexProductRepository } from './infra/repositories/knex-product-repository';

async function main(): Promise<void> {
  const config = loadConfigOrExit();
  const db = createDatabase(config.databaseUrl);

  const orders = new KnexOrderRepository(db);
  const products = new KnexProductRepository(db);

  const app = buildApp(
    {
      createOrder: new CreateOrder(orders, products),
      getOrder: new GetOrder(orders),
      listOrders: new ListOrders(orders),
      cancelOrder: new CancelOrder(orders),
      checkDatabase: async () => {
        await db.raw('select 1');
      },
    },
    { logLevel: config.logLevel },
  );

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await db.destroy();
    process.exit(0);
  };
  process.once('SIGINT', (signal) => void shutdown(signal));
  process.once('SIGTERM', (signal) => void shutdown(signal));

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((error: unknown) => {
  console.error('Falha ao iniciar a aplicação:', error);
  process.exit(1);
});
