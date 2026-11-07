import { beforeEach, describe, expect, it } from 'vitest';
import { CreateOrder } from '../../../src/application/create-order';
import { InvalidOrderError, UnknownProductError } from '../../../src/domain/errors';
import {
  FIXED_DATE,
  InMemoryOrderRepository,
  InMemoryProductRepository,
  REFRIGERANTE,
  SUCO,
  X_BURGER,
  captureError,
  sequentialIds,
  steppingClock,
} from '../support/fakes';

describe('CreateOrder', () => {
  let orders: InMemoryOrderRepository;
  let products: InMemoryProductRepository;
  let createOrder: CreateOrder;

  beforeEach(() => {
    orders = new InMemoryOrderRepository();
    products = new InMemoryProductRepository([X_BURGER, REFRIGERANTE, SUCO]);
    createOrder = new CreateOrder(orders, products, sequentialIds(), steppingClock());
  });

  it('copia nome e preço do cardápio, usa o id e o relógio injetados e persiste o pedido', async () => {
    const order = await createOrder.execute({
      customerName: 'Maria',
      items: [
        { productId: 'x-burger', quantity: 2 },
        { productId: 'refrigerante', quantity: 3 },
      ],
    });

    expect(order.id).toBe('order-1');
    expect(order.createdAt).toEqual(FIXED_DATE);
    expect(order.status).toBe('PENDING');
    expect(order.items).toEqual([
      { productId: 'x-burger', name: 'X-Burger', quantity: 2, unitPriceCents: 1800, subtotalCents: 3600 },
      { productId: 'refrigerante', name: 'Refrigerante', quantity: 3, unitPriceCents: 600, subtotalCents: 1800 },
    ]);
    expect(order.totalCents).toBe(5400);

    const stored = await orders.findById('order-1');
    expect(stored?.totalCents).toBe(5400);
    expect(stored?.items).toEqual(order.items);
  });

  it('usa o preço que o cardápio informar, não um valor fixo', async () => {
    const promo = new InMemoryProductRepository([{ id: 'x-burger', name: 'X-Burger Promo', priceCents: 1234 }]);
    const useCase = new CreateOrder(orders, promo, sequentialIds(), steppingClock());

    const order = await useCase.execute({ customerName: 'Ana', items: [{ productId: 'x-burger', quantity: 2 }] });

    expect(order.items[0]).toEqual({
      productId: 'x-burger',
      name: 'X-Burger Promo',
      quantity: 2,
      unitPriceCents: 1234,
      subtotalCents: 2468,
    });
    expect(order.totalCents).toBe(2468);
  });

  it('consulta o cardápio uma vez, com ids sem repetição', async () => {
    await createOrder.execute({
      customerName: 'Maria',
      items: [
        { productId: 'suco', quantity: 1 },
        { productId: 'x-burger', quantity: 1 },
      ],
    });

    expect(products.requestedIds).toEqual([['suco', 'x-burger']]);
  });

  it('lança UnknownProductError (422) apontando cada produto inexistente e não persiste nada', async () => {
    const error = await captureError(() =>
      createOrder.execute({
        customerName: 'Maria',
        items: [
          { productId: 'x-tudo', quantity: 1 },
          { productId: 'x-burger', quantity: 1 },
          { productId: 'milkshake', quantity: 2 },
        ],
      }),
    );

    expect(error).toBeInstanceOf(UnknownProductError);
    expect(error).toMatchObject({
      message: 'Unknown product in menu',
      details: [
        { field: 'items[0].productId', message: 'product "x-tudo" does not exist' },
        { field: 'items[2].productId', message: 'product "milkshake" does not exist' },
      ],
    });
    expect(orders.size).toBe(0);
  });

  it('propaga a regra de produto duplicado do domínio e não persiste nada', async () => {
    const error = await captureError(() =>
      createOrder.execute({
        customerName: 'Maria',
        items: [
          { productId: 'suco', quantity: 1 },
          { productId: 'suco', quantity: 1 },
        ],
      }),
    );

    expect(error).toBeInstanceOf(InvalidOrderError);
    expect(error).toMatchObject({
      details: [{ field: 'items[1].productId', message: 'product "suco" is duplicated in the order' }],
    });
    expect(orders.size).toBe(0);
  });

  it('rejeita pedido sem itens sem consultar o cardápio', async () => {
    const error = await captureError(() => createOrder.execute({ customerName: 'Maria', items: [] }));

    expect(error).toBeInstanceOf(InvalidOrderError);
    expect(error).toMatchObject({ details: [{ field: 'items', message: 'must contain at least 1 item' }] });
    expect(products.requestedIds).toEqual([]);
    expect(orders.size).toBe(0);
  });
});
