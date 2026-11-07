import { randomUUID } from 'node:crypto';
import { UnknownProductError, type FieldError } from '../domain/errors';
import { Order, type NewOrderLine } from '../domain/order';
import type { OrderRepository } from '../domain/order-repository';
import type { ProductRepository } from '../domain/product-repository';

export interface CreateOrderInput {
  readonly customerName: string;
  readonly items: readonly { readonly productId: string; readonly quantity: number }[];
}

export class CreateOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly products: ProductRepository,
    private readonly generateId: () => string = randomUUID,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const found = productIds.length > 0 ? await this.products.findByIds(productIds) : [];
    const productsById = new Map(found.map((product) => [product.id, product]));

    const lines: NewOrderLine[] = [];
    const unknown: FieldError[] = [];
    input.items.forEach((item, index) => {
      const product = productsById.get(item.productId);
      if (product) {
        lines.push({ product, quantity: item.quantity });
      } else {
        unknown.push({ field: `items[${index}].productId`, message: `product "${item.productId}" does not exist` });
      }
    });
    if (unknown.length > 0) {
      throw new UnknownProductError(unknown);
    }

    const order = Order.create({
      id: this.generateId(),
      customerName: input.customerName,
      lines,
      createdAt: this.now(),
    });
    await this.orders.create(order);
    return order;
  }
}
