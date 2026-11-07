import type { MenuItem, Product } from './product';

/** Cardápio somente leitura: os produtos vêm de seed, sem cadastro via API. */
export interface ProductRepository {
  /** Retorna os produtos encontrados; ids inexistentes são simplesmente omitidos. */
  findByIds(ids: readonly string[]): Promise<Product[]>;
}

/**
 * Segregação de interfaces: CreateOrder só precisa buscar produtos por id (ProductRepository) e
 * não deve depender da listagem do cardápio; ListProducts usa esta extensão. O KnexProductRepository
 * implementa as duas.
 */
export interface MenuProductRepository extends ProductRepository {
  /** Todos os produtos do cardápio; a ordem de apresentação é responsabilidade do domínio. */
  listMenu(): Promise<MenuItem[]>;
}
