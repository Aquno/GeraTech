import type { ReactNode } from 'react';
import type { ProductCategory } from '../api/types';

// Ilustrações próprias, todas no mesmo estilo: contorno marrom de 3px com cantos arredondados,
// cores chapadas da paleta e um disco de fundo (cor via CSS, para acompanhar o tema).
const INK = '#3B2314';
const stroke = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

function Burger({ salad = false }: { salad?: boolean }) {
  return (
    <>
      <path d="M26 58c0-17 15-28 34-28s34 11 34 28z" fill="#F2B45A" {...stroke} />
      <path d="M38 44l3-2M52 38l3-1M66 39l3 1M78 45l2 2M58 48l3-1" {...stroke} stroke="#FFF4DC" />
      {salad && <path d="M22 60q6 7 12 0t12 0 12 0 12 0 12 0 12 0 12 0v4H22z" fill="#6DAA45" {...stroke} />}
      <path d="M24 64h72l-8 9-8-5-8 6-8-6-8 6-8-6-8 5z" fill="#F6C431" {...stroke} />
      <rect x="24" y="68" width="72" height="11" rx="5.5" fill="#7A3E22" {...stroke} />
      {salad && <ellipse cx="46" cy="66" rx="9" ry="3.5" fill="#D9472B" {...stroke} />}
      <path d="M26 83h68v3a9 9 0 0 1-9 9H35a9 9 0 0 1-9-9z" fill="#F2B45A" {...stroke} />
    </>
  );
}

function Fries() {
  return (
    <>
      <path d="M46 40v28M54 34v34M62 38v30M70 33v35M78 41v27" stroke={INK} strokeWidth="11" strokeLinecap="round" />
      <path d="M46 40v28M54 34v34M62 38v30M70 33v35M78 41v27" stroke="#F6C431" strokeWidth="5" strokeLinecap="round" />
      <path d="M36 56h52l-6 39H42z" fill="#D9472B" {...stroke} />
      <path d="M47 70q15 9 30 0" fill="none" {...stroke} stroke="#FFF4DC" />
    </>
  );
}

function Soda() {
  return (
    <>
      <path d="M68 26l6-6 8 3" fill="none" {...stroke} />
      <rect x="40" y="30" width="40" height="64" rx="8" fill="#D9472B" {...stroke} />
      <path d="M44 30h32" {...stroke} />
      <rect x="40" y="52" width="40" height="18" fill="#FFF4DC" {...stroke} />
      <path d="M50 61q10-6 20 0" fill="none" {...stroke} stroke="#D9472B" />
      <path d="M48 38v8M48 76v10" {...stroke} stroke="#FFF4DC" />
    </>
  );
}

function Juice() {
  return (
    <>
      <path d="M70 22l-6 30" fill="none" {...stroke} />
      <path d="M38 40h44l-6 54H44z" fill="#FFF4DC" {...stroke} />
      <path d="M41 56h38l-4 38H44z" fill="#F59E2B" {...stroke} />
      <circle cx="82" cy="42" r="11" fill="#F6C431" {...stroke} />
      <path d="M82 31v22M71 42h22M74 34l16 16M90 34L74 50" stroke="#F59E2B" strokeWidth="2" strokeLinecap="round" />
      <path d="M48 66v16" {...stroke} stroke="#FFF4DC" />
    </>
  );
}

function Plate() {
  return (
    <>
      <ellipse cx="60" cy="70" rx="34" ry="14" fill="#FFF4DC" {...stroke} />
      <path d="M40 66q20-22 40 0" fill="#F2B45A" {...stroke} />
    </>
  );
}

const BY_PRODUCT: Record<string, { label: string; art: ReactNode }> = {
  'x-burger': { label: 'Ilustração de um hambúrguer com queijo', art: <Burger /> },
  'x-salada': { label: 'Ilustração de um hambúrguer com queijo, alface e tomate', art: <Burger salad /> },
  'batata-frita': { label: 'Ilustração de uma porção de batatas fritas', art: <Fries /> },
  refrigerante: { label: 'Ilustração de uma lata de refrigerante', art: <Soda /> },
  suco: { label: 'Ilustração de um copo de suco com rodela de laranja', art: <Juice /> },
};

const BY_CATEGORY: Record<ProductCategory, { label: string; art: ReactNode }> = {
  lanches: { label: 'Ilustração de um lanche', art: <Burger /> },
  acompanhamentos: { label: 'Ilustração de um acompanhamento', art: <Plate /> },
  bebidas: { label: 'Ilustração de uma bebida', art: <Juice /> },
};

interface Props {
  productId: string;
  category: ProductCategory;
  className?: string;
  /** Uso decorativo (ao lado de um texto que já diz o mesmo): escondido de leitores de tela. */
  decorative?: boolean;
}

/** Produtos sem desenho próprio usam o desenho genérico da categoria. */
export function ProductIllustration({ productId, category, className, decorative = false }: Props) {
  const { label, art } = BY_PRODUCT[productId] ?? BY_CATEGORY[category];
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      <circle className="illustration-backdrop" cx="60" cy="62" r="50" />
      <ellipse cx="60" cy="100" rx="30" ry="5" fill={INK} opacity="0.12" />
      {art}
    </svg>
  );
}
