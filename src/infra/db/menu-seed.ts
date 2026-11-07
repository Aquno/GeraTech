import type { Knex } from 'knex';
import type { MenuItem } from '../../domain/product';

export const MENU: readonly MenuItem[] = [
  {
    id: 'x-burger',
    name: 'X-Burger',
    priceCents: 1800,
    category: 'lanches',
    description: 'Hambúrguer bovino suculento com queijo derretido no pão brioche tostado.',
  },
  {
    id: 'x-salada',
    name: 'X-Salada',
    priceCents: 2000,
    category: 'lanches',
    description: 'Hambúrguer bovino, queijo, alface crocante, tomate fresco e maionese da casa.',
  },
  {
    id: 'batata-frita',
    name: 'Batata Frita',
    priceCents: 1000,
    category: 'acompanhamentos',
    description: 'Batatas sequinhas, crocantes por fora e macias por dentro, com sal na medida.',
  },
  {
    id: 'refrigerante',
    name: 'Refrigerante',
    priceCents: 600,
    category: 'bebidas',
    description: 'Lata de 350 ml, servida bem gelada.',
  },
  {
    id: 'suco',
    name: 'Suco',
    priceCents: 800,
    category: 'bebidas',
    description: 'Suco natural da fruta, feito na hora, 500 ml.',
  },
];

/** Idempotente: pode rodar a cada inicialização sem duplicar produtos (upsert pelo id). */
export async function seedMenu(db: Knex): Promise<void> {
  await db('products')
    .insert(
      MENU.map((product) => ({
        id: product.id,
        name: product.name,
        price_cents: product.priceCents,
        description: product.description,
        category: product.category,
      })),
    )
    .onConflict('id')
    .merge();
}
