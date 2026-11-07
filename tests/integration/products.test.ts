import type { FastifyInstance } from 'fastify';
import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/composition';
import { seedMenu } from '../../src/infra/db/menu-seed';
import { migrationSource } from '../../src/infra/db/migration-source';
import { connectToTestDatabase, migrateAndSeed } from './support/test-database';

describe('Cardápio (GET /products) contra PostgreSQL real', () => {
  let db: Knex;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = connectToTestDatabase();
    await migrateAndSeed(db);
    app = createApplication(db, { logLevel: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('lista o cardápio real do seed, ordenado por categoria e nome', async () => {
    const response = await app.inject({ method: 'GET', url: '/products' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: 'x-burger',
        name: 'X-Burger',
        description: 'Hambúrguer bovino suculento com queijo derretido no pão brioche tostado.',
        category: 'lanches',
        priceCents: 1800,
      },
      {
        id: 'x-salada',
        name: 'X-Salada',
        description: 'Hambúrguer bovino, queijo, alface crocante, tomate fresco e maionese da casa.',
        category: 'lanches',
        priceCents: 2000,
      },
      {
        id: 'batata-frita',
        name: 'Batata Frita',
        description: 'Batatas sequinhas, crocantes por fora e macias por dentro, com sal na medida.',
        category: 'acompanhamentos',
        priceCents: 1000,
      },
      {
        id: 'refrigerante',
        name: 'Refrigerante',
        description: 'Lata de 350 ml, servida bem gelada.',
        category: 'bebidas',
        priceCents: 600,
      },
      {
        id: 'suco',
        name: 'Suco',
        description: 'Suco natural da fruta, feito na hora, 500 ml.',
        category: 'bebidas',
        priceCents: 800,
      },
    ]);
  });

  it('o seed é idempotente: rodar de novo não duplica nem altera produtos', async () => {
    const before = await db('products').select('*').orderBy('id');

    await seedMenu(db);
    await seedMenu(db);

    expect(await db('products').select('*').orderBy('id')).toEqual(before);
    expect(before).toHaveLength(5);
  });

  it('o seed corrige descrição e categoria alteradas no banco', async () => {
    await db('products').where({ id: 'suco' }).update({ description: 'alterado', category: 'lanches' });

    await seedMenu(db);

    expect(await db('products').where({ id: 'suco' }).first('description', 'category')).toEqual({
      description: 'Suco natural da fruta, feito na hora, 500 ml.',
      category: 'bebidas',
    });
  });

  it('o banco rejeita produto sem categoria (NOT NULL)', async () => {
    await expect(
      db('products').insert({ id: 'teste-sem-categoria', name: 'Sem categoria', price_cents: 100 }),
    ).rejects.toThrow(/null value in column "category"/);

    expect(await db('products').where({ id: 'teste-sem-categoria' }).first()).toBeUndefined();
  });

  it('a migration 003 preenche a categoria de um banco que já tinha os produtos do seed', async () => {
    // Volta ao schema anterior à 003, mantendo os 5 produtos já gravados (sem description/category).
    await db.migrate.down({ migrationSource });
    try {
      expect(await db('products').count({ total: '*' })).toEqual([{ total: '5' }]);
      expect(await db.schema.hasColumn('products', 'category')).toBe(false);

      await db.migrate.up({ migrationSource });

      expect(await db('products').select('id', 'category').orderBy('id')).toEqual([
        { id: 'batata-frita', category: 'acompanhamentos' },
        { id: 'refrigerante', category: 'bebidas' },
        { id: 'suco', category: 'bebidas' },
        { id: 'x-burger', category: 'lanches' },
        { id: 'x-salada', category: 'lanches' },
      ]);
      const column = await db('information_schema.columns')
        .where({ table_name: 'products', column_name: 'category' })
        .first<{ is_nullable: string }>('is_nullable');
      expect(column?.is_nullable).toBe('NO');
    } finally {
      await db.migrate.latest({ migrationSource });
      await seedMenu(db);
    }
  });

  it('a migration 003 falha e é revertida se existir produto desconhecido sem categoria', async () => {
    await db.migrate.down({ migrationSource });
    await db('products').insert({ id: 'produto-desconhecido', name: 'Desconhecido', price_cents: 100 });
    try {
      await expect(db.migrate.up({ migrationSource })).rejects.toThrow(/contains null values/);

      // Transação revertida: a 003 não ficou aplicada e as colunas não foram criadas pela metade.
      expect(await db.schema.hasColumn('products', 'category')).toBe(false);
      expect(await db('knex_migrations').where({ name: '003_add_product_menu_fields' }).first()).toBeUndefined();
    } finally {
      await db('products').where({ id: 'produto-desconhecido' }).delete();
      await db.migrate.latest({ migrationSource });
      await seedMenu(db);
    }
  });

  it('o banco rejeita categoria fora da lista', async () => {
    await expect(db('products').where({ id: 'suco' }).update({ category: 'sobremesas' })).rejects.toThrow(
      /products_category_valid/,
    );
  });

  it('pedidos continuam usando o preço do cardápio após a migration nova', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: { customerName: 'Teste', items: [{ productId: 'batata-frita', quantity: 2 }] },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      items: [{ productId: 'batata-frita', name: 'Batata Frita', unitPriceCents: 1000, subtotalCents: 2000 }],
      totalCents: 2000,
    });
  });
});
