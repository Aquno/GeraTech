export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 20;

export interface CartProduct {
  id: string;
  name: string;
  priceCents: number;
}

export interface CartLine {
  productId: string;
  name: string;
  /** Preço do cardápio no momento em que o item entrou: só para a prévia; o servidor recalcula. */
  priceCents: number;
  quantity: number;
}

export type CartState = readonly CartLine[];

export type CartAction =
  | { type: 'add'; product: CartProduct }
  | { type: 'increment'; productId: string }
  | { type: 'decrement'; productId: string }
  | { type: 'setQuantity'; productId: string; quantity: number }
  | { type: 'remove'; productId: string }
  | { type: 'clear' };

export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return MIN_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(quantity)));
}

function updateQuantity(state: CartState, productId: string, next: (current: number) => number): CartState {
  return state.map((line) => (line.productId === productId ? { ...line, quantity: clampQuantity(next(line.quantity)) } : line));
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const existing = state.find((line) => line.productId === action.product.id);
      if (existing) {
        // O mesmo produto não pode aparecer duas vezes no pedido (regra da API): soma na linha existente.
        return updateQuantity(state, existing.productId, (q) => q + 1);
      }
      const { id, name, priceCents } = action.product;
      return [...state, { productId: id, name, priceCents, quantity: MIN_QUANTITY }];
    }
    case 'increment':
      return updateQuantity(state, action.productId, (q) => q + 1);
    case 'decrement':
      return updateQuantity(state, action.productId, (q) => q - 1);
    case 'setQuantity':
      return updateQuantity(state, action.productId, () => action.quantity);
    case 'remove':
      return state.filter((line) => line.productId !== action.productId);
    case 'clear':
      return [];
  }
}

/** Prévia em centavos inteiros. O valor oficial é sempre o totalCents devolvido pela API. */
export function previewTotalCents(state: CartState): number {
  return state.reduce((total, line) => total + line.priceCents * line.quantity, 0);
}

/** Total de unidades no carrinho (o número do contador). */
export function itemCount(state: CartState): number {
  return state.reduce((total, line) => total + line.quantity, 0);
}

export function quantityOf(state: CartState, productId: string): number {
  return state.find((line) => line.productId === productId)?.quantity ?? 0;
}
