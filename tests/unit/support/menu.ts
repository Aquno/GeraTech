import type { MenuItem, Product } from '../../../src/domain/product';
import type { MenuProductRepository } from '../../../src/domain/product-repository';

export const MENU_X_SALADA: MenuItem = {
  id: 'x-salada',
  name: 'X-Salada',
  priceCents: 2000,
  category: 'lanches',
  description: 'Com alface e tomate.',
};
export const MENU_X_BURGER: MenuItem = {
  id: 'x-burger',
  name: 'X-Burger',
  priceCents: 1800,
  category: 'lanches',
  description: 'Clássico.',
};
export const MENU_BATATA: MenuItem = {
  id: 'batata-frita',
  name: 'Batata Frita',
  priceCents: 1000,
  category: 'acompanhamentos',
  description: 'Crocante.',
};
export const MENU_SUCO: MenuItem = {
  id: 'suco',
  name: 'Suco',
  priceCents: 800,
  category: 'bebidas',
  description: 'Natural.',
};
export const MENU_REFRIGERANTE: MenuItem = {
  id: 'refrigerante',
  name: 'Refrigerante',
  priceCents: 600,
  category: 'bebidas',
  description: 'Gelado.',
};

/** Cardápio em memória; devolve os itens na ordem recebida, para os testes provarem a ordenação. */
export class InMemoryMenuRepository implements MenuProductRepository {
  listMenuCalls = 0;

  constructor(private readonly items: readonly MenuItem[]) {}

  findByIds(ids: readonly string[]): Promise<Product[]> {
    return Promise.resolve(this.items.filter((item) => ids.includes(item.id)));
  }

  listMenu(): Promise<MenuItem[]> {
    this.listMenuCalls += 1;
    return Promise.resolve([...this.items]);
  }
}
