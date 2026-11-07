import type { FastifyInstance } from 'fastify';
import type { Knex } from 'knex';
import { CancelOrder } from './application/cancel-order';
import { CreateOrder } from './application/create-order';
import { GetOrder } from './application/get-order';
import { ListOrders } from './application/list-orders';
import { buildApp, type AppOptions } from './http/app';
import { KnexOrderRepository } from './infra/repositories/knex-order-repository';
import { KnexProductRepository } from './infra/repositories/knex-product-repository';

/** Monta a aplicação real (repositórios Knex + casos de uso + HTTP) sobre uma conexão de banco. */
export function createApplication(db: Knex, options: AppOptions = {}): FastifyInstance {
  const orders = new KnexOrderRepository(db);
  const products = new KnexProductRepository(db);

  return buildApp(
    {
      createOrder: new CreateOrder(orders, products),
      getOrder: new GetOrder(orders),
      listOrders: new ListOrders(orders),
      cancelOrder: new CancelOrder(orders),
      checkDatabase: async () => {
        await db.raw('select 1');
      },
    },
    options,
  );
}
