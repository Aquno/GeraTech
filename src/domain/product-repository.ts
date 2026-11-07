import type { Product } from './product';

/** Cardápio somente leitura: os produtos vêm de seed, sem cadastro via API. */
export interface ProductRepository {
  /** Retorna os produtos encontrados; ids inexistentes são simplesmente omitidos. */
  findByIds(ids: readonly string[]): Promise<Product[]>;
}
