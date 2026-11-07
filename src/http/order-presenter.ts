import type { Order, OrderItem, OrderStatus } from '../domain/order';

export interface OrderResponse {
  id: string;
  customerName: string;
  items: OrderItem[];
  totalCents: number;
  status: OrderStatus;
  createdAt: string;
}

export function toOrderResponse(order: Order): OrderResponse {
  return {
    id: order.id,
    customerName: order.customerName,
    items: order.items.map((item) => ({ ...item })),
    totalCents: order.totalCents,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
  };
}
