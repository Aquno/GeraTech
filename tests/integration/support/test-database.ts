import type { Knex } from 'knex';
import { createDatabase } from '../../../src/infra/db/database';
import { seedMenu } from '../../../src/infra/db/menu-seed';
import { migrationSource } from '../../../src/infra/db/migration-source';

/** Padrão: o PostgreSQL do docker-compose, num banco separado do de desenvolvimento (orders_dev). */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://orders_user:orders_pass@localhost:5432/orders_test';

/** Proteção: os testes apagam dados, então só rodam contra um banco cujo nome termina em "_test". */
export function testDatabaseName(url: string = TEST_DATABASE_URL): string {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!name.endsWith('_test')) {
    throw new Error(`TEST_DATABASE_URL deve apontar para um banco terminado em "_test" (recebido: "${name}").`);
  }
  return name;
}

/** Recria o schema do zero (rollback de tudo + latest): cada execução parte do mesmo estado e exercita os down(). */
export async function migrateAndSeed(db: Knex): Promise<void> {
  await db.migrate.rollback({ migrationSource }, true);
  await db.migrate.latest({ migrationSource });
  await seedMenu(db);
}

export async function truncateOrders(db: Knex): Promise<void> {
  await db.raw('truncate table order_items, orders');
}

export function connectToTestDatabase(): Knex {
  testDatabaseName();
  return createDatabase(TEST_DATABASE_URL);
}
