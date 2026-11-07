import { describe, expect, it } from 'vitest';
import {
  MAX_QUANTITY,
  cartReducer,
  clampQuantity,
  itemCount,
  previewTotalCents,
  quantityOf,
  type CartAction,
  type CartState,
} from './cart';

const BURGER = { id: 'x-burger', name: 'X-Burger', priceCents: 1800 };
const SUCO = { id: 'suco', name: 'Suco', priceCents: 800 };

function run(...actions: CartAction[]): CartState {
  return actions.reduce<CartState>(cartReducer, []);
}

describe('carrinho', () => {
  it('adiciona um produto novo com quantidade 1 e o preço do cardápio', () => {
    expect(run({ type: 'add', product: BURGER })).toEqual([
      { productId: 'x-burger', name: 'X-Burger', priceCents: 1800, quantity: 1 },
    ]);
  });

  it('adicionar o mesmo produto soma na linha existente (sem linha duplicada)', () => {
    const cart = run({ type: 'add', product: BURGER }, { type: 'add', product: SUCO }, { type: 'add', product: BURGER });

    expect(cart.map((line) => [line.productId, line.quantity])).toEqual([
      ['x-burger', 2],
      ['suco', 1],
    ]);
  });

  it('não passa de 20 unidades, nem adicionando nem incrementando', () => {
    let cart = run({ type: 'add', product: BURGER });
    for (let i = 0; i < 25; i += 1) cart = cartReducer(cart, { type: 'add', product: BURGER });
    expect(quantityOf(cart, 'x-burger')).toBe(MAX_QUANTITY);

    cart = cartReducer(cart, { type: 'increment', productId: 'x-burger' });
    expect(quantityOf(cart, 'x-burger')).toBe(20);
  });

  it('não desce de 1 ao decrementar (remover é uma ação separada)', () => {
    const cart = run({ type: 'add', product: BURGER }, { type: 'decrement', productId: 'x-burger' });

    expect(quantityOf(cart, 'x-burger')).toBe(1);
  });

  it.each([
    [0, 1],
    [-3, 1],
    [21, 20],
    [7.9, 7],
    [Number.NaN, 1],
  ])('setQuantity(%s) fica em %s', (input, expected) => {
    const cart = run({ type: 'add', product: BURGER }, { type: 'setQuantity', productId: 'x-burger', quantity: input });

    expect(quantityOf(cart, 'x-burger')).toBe(expected);
    expect(clampQuantity(input)).toBe(expected);
  });

  it('remove só o item indicado', () => {
    const cart = run({ type: 'add', product: BURGER }, { type: 'add', product: SUCO }, { type: 'remove', productId: 'x-burger' });

    expect(cart.map((line) => line.productId)).toEqual(['suco']);
    expect(quantityOf(cart, 'x-burger')).toBe(0);
  });

  it('ações sobre produto que não está no carrinho não mudam nada', () => {
    const cart = run({ type: 'add', product: SUCO });

    expect(cartReducer(cart, { type: 'increment', productId: 'nao-existe' })).toEqual(cart);
    expect(cartReducer(cart, { type: 'remove', productId: 'nao-existe' })).toEqual(cart);
  });

  it('clear esvazia o carrinho', () => {
    expect(run({ type: 'add', product: BURGER }, { type: 'clear' })).toEqual([]);
  });

  it('prévia do total em centavos inteiros e contagem de unidades', () => {
    const cart = run(
      { type: 'add', product: BURGER },
      { type: 'add', product: BURGER },
      { type: 'add', product: SUCO },
      { type: 'setQuantity', productId: 'suco', quantity: 3 },
    );

    expect(previewTotalCents(cart)).toBe(6000);
    expect(Number.isInteger(previewTotalCents(cart))).toBe(true);
    expect(itemCount(cart)).toBe(5);
    expect(previewTotalCents([])).toBe(0);
    expect(itemCount([])).toBe(0);
  });
});
