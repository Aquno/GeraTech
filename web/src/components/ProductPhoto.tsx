import type { ProductCategory } from '../api/types';
import batataFrita480 from '../assets/products/batata-frita-480.webp';
import batataFrita800 from '../assets/products/batata-frita-800.webp';
import refrigerante480 from '../assets/products/refrigerante-480.webp';
import refrigerante800 from '../assets/products/refrigerante-800.webp';
import suco480 from '../assets/products/suco-480.webp';
import suco800 from '../assets/products/suco-800.webp';
import xBurger480 from '../assets/products/x-burger-480.webp';
import xBurger800 from '../assets/products/x-burger-800.webp';
import xSalada480 from '../assets/products/x-salada-480.webp';
import xSalada800 from '../assets/products/x-salada-800.webp';
import { ProductIllustration } from './ProductIllustration';

// Fotos CC0/domínio público, 4:3, em WebP (origem e licença em src/assets/products/CREDITS.md).
// Importadas pelo Vite: ganham hash no nome e cache longo no nginx.
const PHOTOS: Record<string, { small: string; large: string; alt: string }> = {
  'x-burger': { small: xBurger480, large: xBurger800, alt: 'Foto de cheeseburgers com queijo derretido no pão brioche' },
  'x-salada': { small: xSalada480, large: xSalada800, alt: 'Foto de hambúrguer com alface, tomate e molho no prato' },
  'batata-frita': { small: batataFrita480, large: batataFrita800, alt: 'Foto de batatas fritas douradas com sal grosso' },
  refrigerante: { small: refrigerante480, large: refrigerante800, alt: 'Foto de latas de refrigerante geladas vistas de cima' },
  suco: { small: suco480, large: suco800, alt: 'Foto de copo de suco natural com laranjas cortadas' },
};

export const PHOTO_WIDTH = 800;
export const PHOTO_HEIGHT = 600;

export function hasPhoto(productId: string): boolean {
  return productId in PHOTOS;
}

interface Props {
  productId: string;
  category: ProductCategory;
  className?: string;
  /** Tamanho exibido, para o navegador escolher entre 480w e 800w. */
  sizes?: string;
  /** Decorativa (ao lado do nome do produto): alt vazio, ignorada por leitores de tela. */
  decorative?: boolean;
  /** Fotos visíveis logo de cara carregam sem esperar a rolagem. */
  eager?: boolean;
}

/** Foto do produto; sem foto cadastrada, usa a ilustração SVG da categoria. */
export function ProductPhoto({ productId, category, className, sizes = '(min-width: 560px) 50vw, 100vw', decorative = false, eager = false }: Props) {
  const photo = PHOTOS[productId];
  if (!photo) {
    return <ProductIllustration productId={productId} category={category} decorative={decorative} {...(className ? { className } : {})} />;
  }
  return (
    <img
      className={className}
      src={photo.large}
      srcSet={`${photo.small} 480w, ${photo.large} 800w`}
      sizes={sizes}
      width={PHOTO_WIDTH}
      height={PHOTO_HEIGHT}
      alt={decorative ? '' : photo.alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
