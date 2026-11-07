import type { Knex } from 'knex';

// Categoria dos produtos que o seed já tinha criado antes desta migration. Fica fixa aqui (e não
// importada do seed) porque uma migration é uma foto do schema/dados no momento em que foi escrita.
const EXISTING_PRODUCT_CATEGORIES: Record<string, string> = {
  'x-burger': 'lanches',
  'x-salada': 'lanches',
  'batata-frita': 'acompanhamentos',
  refrigerante: 'bebidas',
  suco: 'bebidas',
};

/**
 * 1. adiciona as colunas (category ainda anulável);
 * 2. preenche category dos produtos existentes (banco novo: tabela vazia, nada a fazer);
 * 3. torna category NOT NULL. Se sobrar algum produto desconhecido sem categoria, este passo falha
 *    e a migration inteira é revertida (roda em transação): nada fica com uma categoria inventada.
 */
export async function up(db: Knex): Promise<void> {
  await db.schema.alterTable('products', (table) => {
    table.string('description', 200).notNullable().defaultTo('');
    table.string('category', 20).nullable();
  });

  for (const [id, category] of Object.entries(EXISTING_PRODUCT_CATEGORIES)) {
    await db('products').where({ id }).update({ category });
  }

  await db.raw('alter table products alter column category set not null');
  // SQL explícito: table.check() com binding (??) dentro de alterTable gera SQL inválido no Knex.
  await db.raw(
    "alter table products add constraint products_category_valid check (category in ('lanches', 'acompanhamentos', 'bebidas'))",
  );
}

export async function down(db: Knex): Promise<void> {
  await db.raw('alter table products drop constraint products_category_valid');
  await db.schema.alterTable('products', (table) => {
    table.dropColumn('category');
    table.dropColumn('description');
  });
}
