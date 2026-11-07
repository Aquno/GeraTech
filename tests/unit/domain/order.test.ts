import { describe, expect, it } from 'vitest';
import { InvalidOrderError, OrderAlreadyCancelledError } from '../../../src/domain/errors';
import { Order, type NewOrderLine } from '../../../src/domain/order';
import { BATATA_FRITA, FIXED_DATE, REFRIGERANTE, SUCO, X_BURGER, X_SALADA, captureError } from '../support/fakes';

function createOrder(lines: NewOrderLine[], customerName = 'Maria'): Order {
  return Order.create({ id: 'order-1', customerName, lines, createdAt: FIXED_DATE });
}

describe('Order.create', () => {
  it('cria um pedido PENDING com itens, subtotais e total em centavos', () => {
    const order = createOrder([
      { product: X_BURGER, quantity: 2 },
      { product: REFRIGERANTE, quantity: 1 },
    ]);

    expect(order.id).toBe('order-1');
    expect(order.customerName).toBe('Maria');
    expect(order.status).toBe('PENDING');
    expect(order.createdAt).toEqual(FIXED_DATE);
    expect(order.items).toEqual([
      { productId: 'x-burger', name: 'X-Burger', quantity: 2, unitPriceCents: 1800, subtotalCents: 3600 },
      { productId: 'refrigerante', name: 'Refrigerante', quantity: 1, unitPriceCents: 600, subtotalCents: 600 },
    ]);
    expect(order.totalCents).toBe(4200);
  });

  it('soma o total de vários itens com quantidades diferentes', () => {
    const order = createOrder([
      { product: X_BURGER, quantity: 2 }, // 3600
      { product: X_SALADA, quantity: 1 }, // 2000
      { product: BATATA_FRITA, quantity: 3 }, // 3000
      { product: SUCO, quantity: 4 }, // 3200
    ]);

    expect(order.items.map((item) => item.subtotalCents)).toEqual([3600, 2000, 3000, 3200]);
    expect(order.totalCents).toBe(11800);
    expect(Number.isInteger(order.totalCents)).toBe(true);
  });

  it('aceita os limites de quantidade 1 e 20', () => {
    const order = createOrder([
      { product: X_BURGER, quantity: 1 },
      { product: SUCO, quantity: 20 },
    ]);

    expect(order.items.map((item) => item.quantity)).toEqual([1, 20]);
    expect(order.totalCents).toBe(1800 + 16000);
  });

  it('rejeita lista de itens vazia', async () => {
    const error = await captureError(() => createOrder([]));

    expect(error).toBeInstanceOf(InvalidOrderError);
    expect(error).toMatchObject({
      message: 'Invalid order',
      details: [{ field: 'items', message: 'must contain at least 1 item' }],
    });
  });

  it.each([0, 21, -1, 1.5])('rejeita quantidade %s', async (quantity) => {
    const error = await captureError(() => createOrder([{ product: X_BURGER, quantity }]));

    expect(error).toBeInstanceOf(InvalidOrderError);
    expect(error).toMatchObject({
      details: [{ field: 'items[0].quantity', message: 'must be an integer between 1 and 20' }],
    });
  });

  it('rejeita o mesmo productId repetido e aponta o item duplicado', async () => {
    const error = await captureError(() =>
      createOrder([
        { product: SUCO, quantity: 1 },
        { product: X_BURGER, quantity: 1 },
        { product: SUCO, quantity: 2 },
      ]),
    );

    expect(error).toBeInstanceOf(InvalidOrderError);
    expect(error).toMatchObject({
      details: [{ field: 'items[2].productId', message: 'product "suco" is duplicated in the order' }],
    });
  });

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['com 101 caracteres', 'a'.repeat(101)],
  ])('rejeita customerName %s', async (_label, customerName) => {
    const error = await captureError(() => createOrder([{ product: X_BURGER, quantity: 1 }], customerName));

    expect(error).toBeInstanceOf(InvalidOrderError);
    expect(error).toMatchObject({
      details: [{ field: 'customerName', message: 'must have between 1 and 100 characters' }],
    });
  });

  it('aceita customerName com exatamente 100 caracteres', () => {
    const order = createOrder([{ product: X_BURGER, quantity: 1 }], 'a'.repeat(100));

    expect(order.customerName).toHaveLength(100);
  });

  it('reporta todos os problemas de uma vez', async () => {
    const error = await captureError(() =>
      createOrder(
        [
          { product: X_BURGER, quantity: 0 },
          { product: X_BURGER, quantity: 21 },
        ],
        '',
      ),
    );

    expect(error).toBeInstanceOf(InvalidOrderError);
    expect((error as InvalidOrderError).details).toEqual([
      { field: 'customerName', message: 'must have between 1 and 100 characters' },
      { field: 'items[0].quantity', message: 'must be an integer between 1 and 20' },
      { field: 'items[1].quantity', message: 'must be an integer between 1 and 20' },
      { field: 'items[1].productId', message: 'product "x-burger" is duplicated in the order' },
    ]);
  });
});

describe('Order.cancel', () => {
  it('muda um pedido PENDING para CANCELLED sem alterar itens nem total', () => {
    const order = createOrder([{ product: X_BURGER, quantity: 2 }]);

    order.cancel();

    expect(order.status).toBe('CANCELLED');
    expect(order.totalCents).toBe(3600);
    expect(order.items).toHaveLength(1);
  });

  it('não permite cancelar um pedido já CANCELLED', async () => {
    const order = createOrder([{ product: X_BURGER, quantity: 1 }]);
    order.cancel();

    const error = await captureError(() => order.cancel());

    expect(error).toBeInstanceOf(OrderAlreadyCancelledError);
    expect(error).toMatchObject({ message: 'Order is already cancelled', orderId: 'order-1' });
    expect(order.status).toBe('CANCELLED');
  });
});

describe('Order.restore', () => {
  it('reconstrói o pedido persistido com status e total', () => {
    const order = Order.restore({
      id: 'order-9',
      customerName: 'João',
      items: [{ productId: 'suco', name: 'Suco', quantity: 3, unitPriceCents: 800, subtotalCents: 2400 }],
      status: 'CANCELLED',
      createdAt: FIXED_DATE,
    });

    expect(order.status).toBe('CANCELLED');
    expect(order.totalCents).toBe(2400);
    expect(order.customerName).toBe('João');
  });
});
