import type { Order } from './order';

export interface OrderRepository {
  create(order: Order): Promise<void>;
  update(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
  /** Pedidos ordenados por createdAt decrescente. */
  list(): Promise<Order[]>;
}
