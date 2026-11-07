import { InvalidOrderError, OrderAlreadyCancelledError, type FieldError } from './errors';
import type { Product } from './product';

export const MIN_ITEM_QUANTITY = 1;
export const MAX_ITEM_QUANTITY = 20;
export const MAX_CUSTOMER_NAME_LENGTH = 100;

export type OrderStatus = 'PENDING' | 'CANCELLED';

export interface OrderItem {
  readonly productId: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly subtotalCents: number;
}

/** Linha de um pedido novo: o produto já resolvido no cardápio e a quantidade pedida. */
export interface NewOrderLine {
  readonly product: Product;
  readonly quantity: number;
}

export interface CreateOrderProps {
  readonly id: string;
  readonly customerName: string;
  readonly lines: readonly NewOrderLine[];
  readonly createdAt: Date;
}

/** Estado persistido de um pedido, usado para reconstruí-lo a partir do repositório. */
export interface OrderSnapshot {
  readonly id: string;
  readonly customerName: string;
  readonly items: readonly OrderItem[];
  readonly status: OrderStatus;
  readonly createdAt: Date;
}

export class Order {
  private constructor(
    readonly id: string,
    readonly customerName: string,
    readonly items: readonly OrderItem[],
    private currentStatus: OrderStatus,
    readonly createdAt: Date,
  ) {}

  static create(props: CreateOrderProps): Order {
    const errors = validate(props);
    if (errors.length > 0) {
      throw new InvalidOrderError(errors);
    }

    // O preço vem sempre do cardápio e fica congelado no item.
    const items = props.lines.map(({ product, quantity }) => ({
      productId: product.id,
      name: product.name,
      quantity,
      unitPriceCents: product.priceCents,
      subtotalCents: product.priceCents * quantity,
    }));

    return new Order(props.id, props.customerName, items, 'PENDING', props.createdAt);
  }

  static restore(snapshot: OrderSnapshot): Order {
    return new Order(snapshot.id, snapshot.customerName, snapshot.items, snapshot.status, snapshot.createdAt);
  }

  get status(): OrderStatus {
    return this.currentStatus;
  }

  get totalCents(): number {
    return this.items.reduce((total, item) => total + item.subtotalCents, 0);
  }

  cancel(): void {
    if (this.currentStatus !== 'PENDING') {
      throw new OrderAlreadyCancelledError(this.id);
    }
    this.currentStatus = 'CANCELLED';
  }
}

function validate({ customerName, lines }: CreateOrderProps): FieldError[] {
  const errors: FieldError[] = [];

  if (customerName.trim().length === 0 || customerName.length > MAX_CUSTOMER_NAME_LENGTH) {
    errors.push({ field: 'customerName', message: `must have between 1 and ${MAX_CUSTOMER_NAME_LENGTH} characters` });
  }

  if (lines.length === 0) {
    errors.push({ field: 'items', message: 'must contain at least 1 item' });
  }

  const seen = new Set<string>();
  lines.forEach(({ product, quantity }, index) => {
    if (!Number.isInteger(quantity) || quantity < MIN_ITEM_QUANTITY || quantity > MAX_ITEM_QUANTITY) {
      errors.push({
        field: `items[${index}].quantity`,
        message: `must be an integer between ${MIN_ITEM_QUANTITY} and ${MAX_ITEM_QUANTITY}`,
      });
    }
    if (seen.has(product.id)) {
      errors.push({ field: `items[${index}].productId`, message: `product "${product.id}" is duplicated in the order` });
    }
    seen.add(product.id);
  });

  return errors;
}
