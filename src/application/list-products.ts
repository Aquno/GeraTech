import { compareMenuItems, type MenuItem } from '../domain/product';
import type { MenuProductRepository } from '../domain/product-repository';

export class ListProducts {
  constructor(private readonly products: MenuProductRepository) {}

  /** Cardápio ordenado por categoria (lanches, acompanhamentos, bebidas) e nome. */
  async execute(): Promise<MenuItem[]> {
    const menu = await this.products.listMenu();
    return [...menu].sort(compareMenuItems);
  }
}
