import type { Order } from '../domain/order';
import type { OrderRepository } from '../domain/order-repository';

export class ListOrders {
  constructor(private readonly orders: OrderRepository) {}

  execute(): Promise<Order[]> {
    return this.orders.list();
  }
}
