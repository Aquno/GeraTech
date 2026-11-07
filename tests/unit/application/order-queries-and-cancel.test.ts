import { beforeEach, describe, expect, it } from 'vitest';
import { CancelOrder } from '../../../src/application/cancel-order';
import { CreateOrder } from '../../../src/application/create-order';
import { GetOrder } from '../../../src/application/get-order';
import { ListOrders } from '../../../src/application/list-orders';
import { OrderAlreadyCancelledError, OrderNotFoundError } from '../../../src/domain/errors';
import {
  InMemoryOrderRepository,
  InMemoryProductRepository,
  SUCO,
  X_BURGER,
  captureError,
  sequentialIds,
  steppingClock,
} from '../support/fakes';

describe('GetOrder, ListOrders e CancelOrder', () => {
  let orders: InMemoryOrderRepository;
  let createOrder: CreateOrder;

  beforeEach(() => {
    orders = new InMemoryOrderRepository();
    createOrder = new CreateOrder(orders, new InMemoryProductRepository([X_BURGER, SUCO]), sequentialIds(), steppingClock());
  });

  describe('GetOrder', () => {
    it('retorna o pedido salvo', async () => {
      await createOrder.execute({ customerName: 'Maria', items: [{ productId: 'suco', quantity: 2 }] });

      const order = await new GetOrder(orders).execute('order-1');

      expect(order.id).toBe('order-1');
      expect(order.customerName).toBe('Maria');
      expect(order.totalCents).toBe(1600);
    });

    it('lança OrderNotFoundError (404) para id inexistente', async () => {
      const error = await captureError(() => new GetOrder(orders).execute('nao-existe'));

      expect(error).toBeInstanceOf(OrderNotFoundError);
      expect(error).toMatchObject({ message: 'Order not found', orderId: 'nao-existe' });
    });
  });

  describe('ListOrders', () => {
    it('retorna lista vazia quando não há pedidos', async () => {
      expect(await new ListOrders(orders).execute()).toEqual([]);
    });

    it('retorna os pedidos do repositório, do mais recente para o mais antigo', async () => {
      await createOrder.execute({ customerName: 'Primeiro', items: [{ productId: 'suco', quantity: 1 }] });
      await createOrder.execute({ customerName: 'Segundo', items: [{ productId: 'x-burger', quantity: 1 }] });

      const list = await new ListOrders(orders).execute();

      expect(list.map((order) => [order.id, order.customerName])).toEqual([
        ['order-2', 'Segundo'],
        ['order-1', 'Primeiro'],
      ]);
    });
  });

  describe('CancelOrder', () => {
    it('cancela e persiste o novo status', async () => {
      await createOrder.execute({ customerName: 'Maria', items: [{ productId: 'x-burger', quantity: 1 }] });

      const cancelled = await new CancelOrder(orders).execute('order-1');

      expect(cancelled.status).toBe('CANCELLED');
      expect((await orders.findById('order-1'))?.status).toBe('CANCELLED');
    });

    it('lança OrderAlreadyCancelledError (409) ao cancelar de novo', async () => {
      await createOrder.execute({ customerName: 'Maria', items: [{ productId: 'x-burger', quantity: 1 }] });
      const cancelOrder = new CancelOrder(orders);
      await cancelOrder.execute('order-1');

      const error = await captureError(() => cancelOrder.execute('order-1'));

      expect(error).toBeInstanceOf(OrderAlreadyCancelledError);
      expect(error).toMatchObject({ message: 'Order is already cancelled', orderId: 'order-1' });
      expect((await orders.findById('order-1'))?.status).toBe('CANCELLED');
    });

    it('lança OrderNotFoundError (404) para id inexistente', async () => {
      const error = await captureError(() => new CancelOrder(orders).execute('nao-existe'));

      expect(error).toBeInstanceOf(OrderNotFoundError);
      expect(error).toMatchObject({ orderId: 'nao-existe' });
    });
  });
});
