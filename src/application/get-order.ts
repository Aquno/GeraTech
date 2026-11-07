import { OrderNotFoundError } from '../domain/errors';
import type { Order } from '../domain/order';
import type { OrderRepository } from '../domain/order-repository';

export class GetOrder {
  constructor(private readonly orders: OrderRepository) {}

  async execute(id: string): Promise<Order> {
    const order = await this.orders.findById(id);
    if (!order) {
      throw new OrderNotFoundError(id);
    }
    return order;
  }
}
