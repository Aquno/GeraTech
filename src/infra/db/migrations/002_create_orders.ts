import type { Knex } from 'knex';

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable('orders', (table) => {
    table.uuid('id').primary();
    table.string('customer_name', 100).notNullable();
    table.string('status', 20).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable();
    table.check("?? in ('PENDING', 'CANCELLED')", ['status'], 'orders_status_valid');
    table.index(['created_at'], 'orders_created_at_idx');
  });

  await db.schema.createTable('order_items', (table) => {
    table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.integer('position').notNullable();
    table.string('product_id', 50).notNullable().references('id').inTable('products');
    // Nome e preço são copiados do cardápio na criação do pedido.
    table.string('product_name', 100).notNullable();
    table.integer('quantity').notNullable();
    table.integer('unit_price_cents').notNullable();
    table.primary(['order_id', 'position']);
    table.unique(['order_id', 'product_id'], { indexName: 'order_items_product_unique' });
    table.check('?? between 1 and 20', ['quantity'], 'order_items_quantity_range');
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTable('order_items');
  await db.schema.dropTable('orders');
}
