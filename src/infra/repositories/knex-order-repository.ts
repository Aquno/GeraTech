import type { Knex } from 'knex';
import { Order, type OrderItem, type OrderStatus } from '../../domain/order';
import type { OrderRepository } from '../../domain/order-repository';

interface OrderRow {
  id: string;
  customer_name: string;
  status: OrderStatus;
  created_at: Date;
}

interface OrderItemRow {
  order_id: string;
  position: number;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
}

export class KnexOrderRepository implements OrderRepository {
  constructor(private readonly db: Knex) {}

  async create(order: Order): Promise<void> {
    await this.db.transaction(async (trx) => {
      await trx<OrderRow>('orders').insert({
        id: order.id,
        customer_name: order.customerName,
        status: order.status,
        created_at: order.createdAt,
      });
      await trx<OrderItemRow>('order_items').insert(
        order.items.map((item, position) => ({
          order_id: order.id,
          position,
          product_id: item.productId,
          product_name: item.name,
          quantity: item.quantity,
          unit_price_cents: item.unitPriceCents,
        })),
      );
    });
  }

  async update(order: Order): Promise<void> {
    await this.db<OrderRow>('orders').where({ id: order.id }).update({ status: order.status });
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.db<OrderRow>('orders').where({ id }).first();
    if (!row) {
      return null;
    }
    const items = await this.loadItems([id]);
    return toOrder(row, items.get(id) ?? []);
  }

  async list(): Promise<Order[]> {
    const rows = await this.db<OrderRow>('orders').orderBy([
      { column: 'created_at', order: 'desc' },
      { column: 'id', order: 'asc' },
    ]);
    const items = await this.loadItems(rows.map((row) => row.id));
    return rows.map((row) => toOrder(row, items.get(row.id) ?? []));
  }

  private async loadItems(orderIds: string[]): Promise<Map<string, OrderItem[]>> {
    const itemsByOrder = new Map<string, OrderItem[]>();
    if (orderIds.length === 0) {
      return itemsByOrder;
    }

    const rows = await this.db<OrderItemRow>('order_items')
      .whereIn('order_id', orderIds)
      .orderBy([{ column: 'order_id' }, { column: 'position' }]);

    for (const row of rows) {
      const items = itemsByOrder.get(row.order_id) ?? [];
      items.push({
        productId: row.product_id,
        name: row.product_name,
        quantity: row.quantity,
        unitPriceCents: row.unit_price_cents,
        subtotalCents: row.unit_price_cents * row.quantity,
      });
      itemsByOrder.set(row.order_id, items);
    }
    return itemsByOrder;
  }
}

function toOrder(row: OrderRow, items: OrderItem[]): Order {
  return Order.restore({
    id: row.id,
    customerName: row.customer_name,
    items,
    status: row.status,
    createdAt: row.created_at,
  });
}
