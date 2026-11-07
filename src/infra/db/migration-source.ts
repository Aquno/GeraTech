import type { Knex } from 'knex';
import * as createProducts from './migrations/001_create_products';
import * as createOrders from './migrations/002_create_orders';

// Lista explícita em vez de leitura de diretório: funciona igual com tsx (.ts) e no build (.js).
const migrations: Record<string, Knex.Migration> = {
  '001_create_products': createProducts,
  '002_create_orders': createOrders,
};

export const migrationSource: Knex.MigrationSource<string> = {
  getMigrations: () => Promise.resolve(Object.keys(migrations)),
  getMigrationName: (name) => name,
  getMigration: (name) => {
    const migration = migrations[name];
    if (!migration) {
      return Promise.reject(new Error(`Unknown migration: ${name}`));
    }
    return Promise.resolve(migration);
  },
};
