import type { Knex } from 'knex';
import type { Product } from '../../domain/product';

export const MENU: readonly Product[] = [
  { id: 'x-burger', name: 'X-Burger', priceCents: 1800 },
  { id: 'x-salada', name: 'X-Salada', priceCents: 2000 },
  { id: 'batata-frita', name: 'Batata Frita', priceCents: 1000 },
  { id: 'refrigerante', name: 'Refrigerante', priceCents: 600 },
  { id: 'suco', name: 'Suco', priceCents: 800 },
];

/** Idempotente: pode rodar a cada inicialização sem duplicar produtos. */
export async function seedMenu(db: Knex): Promise<void> {
  await db('products')
    .insert(MENU.map((product) => ({ id: product.id, name: product.name, price_cents: product.priceCents })))
    .onConflict('id')
    .merge();
}
