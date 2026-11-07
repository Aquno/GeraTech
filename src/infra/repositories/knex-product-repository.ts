import type { Knex } from 'knex';
import type { MenuItem, Product, ProductCategory } from '../../domain/product';
import type { MenuProductRepository } from '../../domain/product-repository';

interface ProductRow {
  id: string;
  name: string;
  price_cents: number;
  description: string;
  category: ProductCategory;
}

export class KnexProductRepository implements MenuProductRepository {
  constructor(private readonly db: Knex) {}

  async findByIds(ids: readonly string[]): Promise<Product[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db<ProductRow>('products').whereIn('id', [...ids]);
    return rows.map((row) => ({ id: row.id, name: row.name, priceCents: row.price_cents }));
  }

  async listMenu(): Promise<MenuItem[]> {
    const rows = await this.db<ProductRow>('products');
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      priceCents: row.price_cents,
      description: row.description,
      category: row.category,
    }));
  }
}
