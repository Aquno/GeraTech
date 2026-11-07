import type { Knex } from 'knex';
import type { Product } from '../../domain/product';
import type { ProductRepository } from '../../domain/product-repository';

interface ProductRow {
  id: string;
  name: string;
  price_cents: number;
}

export class KnexProductRepository implements ProductRepository {
  constructor(private readonly db: Knex) {}

  async findByIds(ids: readonly string[]): Promise<Product[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db<ProductRow>('products').whereIn('id', [...ids]);
    return rows.map((row) => ({ id: row.id, name: row.name, priceCents: row.price_cents }));
  }
}
