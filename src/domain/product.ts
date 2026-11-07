export interface Product {
  readonly id: string;
  readonly name: string;
  readonly priceCents: number;
}

/** Categorias do cardápio, na ordem em que o cardápio é apresentado. */
export const PRODUCT_CATEGORIES = ['lanches', 'acompanhamentos', 'bebidas'] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Produto como aparece no cardápio: os dados usados no pedido mais os de apresentação. */
export interface MenuItem extends Product {
  readonly description: string;
  readonly category: ProductCategory;
}

/** Ordena por categoria (na ordem de PRODUCT_CATEGORIES) e, dentro dela, por nome. */
export function compareMenuItems(a: MenuItem, b: MenuItem): number {
  const byCategory = PRODUCT_CATEGORIES.indexOf(a.category) - PRODUCT_CATEGORIES.indexOf(b.category);
  return byCategory !== 0 ? byCategory : a.name.localeCompare(b.name, 'pt-BR');
}
