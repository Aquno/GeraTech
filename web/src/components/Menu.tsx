import type { Product, ProductCategory } from '../api/types';
import { MAX_QUANTITY } from '../cart/cart';
import { formatCents } from '../lib/money';
import { ProductIllustration } from './ProductIllustration';

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  lanches: 'Lanches',
  acompanhamentos: 'Acompanhamentos',
  bebidas: 'Bebidas',
};

/** Agrupa mantendo a ordem da API (que já vem ordenada por categoria e nome). */
export function groupByCategory(products: readonly Product[]): { category: ProductCategory; products: Product[] }[] {
  const groups = new Map<ProductCategory, Product[]>();
  for (const product of products) {
    const group = groups.get(product.category) ?? [];
    group.push(product);
    groups.set(product.category, group);
  }
  return [...groups].map(([category, items]) => ({ category, products: items }));
}

interface CardProps {
  product: Product;
  quantityInCart: number;
  onAdd: (product: Product) => void;
}

function ProductCard({ product, quantityInCart, onAdd }: CardProps) {
  const atLimit = quantityInCart >= MAX_QUANTITY;
  return (
    <li className="product-card">
      <ProductIllustration productId={product.id} category={product.category} className="product-art" />
      <div className="product-body">
        <h4 className="product-name">{product.name}</h4>
        <p className="product-description">{product.description}</p>
        <div className="product-footer">
          <span className="product-price">{formatCents(product.priceCents)}</span>
          <button
            type="button"
            className="button button-primary"
            onClick={() => onAdd(product)}
            disabled={atLimit}
            aria-label={atLimit ? `${product.name}: limite de ${MAX_QUANTITY} unidades` : `Adicionar ${product.name} ao carrinho`}
          >
            {atLimit ? `Limite de ${MAX_QUANTITY}` : 'Adicionar'}
          </button>
        </div>
        {quantityInCart > 0 && <p className="product-in-cart">{quantityInCart} no carrinho</p>}
      </div>
    </li>
  );
}

interface MenuProps {
  products: readonly Product[];
  quantityOf: (productId: string) => number;
  onAdd: (product: Product) => void;
}

export function Menu({ products, quantityOf, onAdd }: MenuProps) {
  const groups = groupByCategory(products);
  return (
    <section className="menu" aria-labelledby="menu-title">
      <h2 id="menu-title" className="section-title">
        Cardápio
      </h2>
      <nav aria-label="Categorias" className="category-nav">
        <ul>
          {groups.map(({ category }) => (
            <li key={category}>
              <a href={`#categoria-${category}`} className="chip">
                {CATEGORY_LABELS[category]}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {groups.map(({ category, products: items }) => (
        <section key={category} id={`categoria-${category}`} className="category" aria-labelledby={`titulo-${category}`}>
          <h3 id={`titulo-${category}`} className="category-title">
            {CATEGORY_LABELS[category]}
          </h3>
          <ul className="product-grid">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} quantityInCart={quantityOf(product.id)} onAdd={onAdd} />
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
