import type { Knex } from 'knex';

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable('products', (table) => {
    table.string('id', 50).primary();
    table.string('name', 100).notNullable();
    table.integer('price_cents').notNullable();
    table.check('?? > 0', ['price_cents'], 'products_price_cents_positive');
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTable('products');
}
