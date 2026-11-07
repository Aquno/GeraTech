import { Order } from '../../../src/domain/order';
import type { OrderRepository } from '../../../src/domain/order-repository';
import type { Product } from '../../../src/domain/product';
import type { ProductRepository } from '../../../src/domain/product-repository';

export const X_BURGER: Product = { id: 'x-burger', name: 'X-Burger', priceCents: 1800 };
export const X_SALADA: Product = { id: 'x-salada', name: 'X-Salada', priceCents: 2000 };
export const BATATA_FRITA: Product = { id: 'batata-frita', name: 'Batata Frita', priceCents: 1000 };
export const REFRIGERANTE: Product = { id: 'refrigerante', name: 'Refrigerante', priceCents: 600 };
export const SUCO: Product = { id: 'suco', name: 'Suco', priceCents: 800 };

export const FIXED_DATE = new Date('2026-01-15T12:00:00.000Z');

/**
 * Guarda snapshots, não as instâncias: uma alteração no objeto só "persiste" se o caso de uso
 * chamar update(), como num banco de verdade.
 */
export class InMemoryOrderRepository implements OrderRepository {
  private readonly snapshots = new Map<string, Parameters<typeof Order.restore>[0]>();

  create(order: Order): Promise<void> {
    this.store(order);
    return Promise.resolve();
  }

  update(order: Order): Promise<void> {
    this.store(order);
    return Promise.resolve();
  }

  findById(id: string): Promise<Order | null> {
    const snapshot = this.snapshots.get(id);
    return Promise.resolve(snapshot ? Order.restore(snapshot) : null);
  }

  list(): Promise<Order[]> {
    const orders = [...this.snapshots.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((snapshot) => Order.restore(snapshot));
    return Promise.resolve(orders);
  }

  get size(): number {
    return this.snapshots.size;
  }

  private store(order: Order): void {
    this.snapshots.set(order.id, {
      id: order.id,
      customerName: order.customerName,
      items: order.items.map((item) => ({ ...item })),
      status: order.status,
      createdAt: order.createdAt,
    });
  }
}

export class InMemoryProductRepository implements ProductRepository {
  readonly requestedIds: string[][] = [];

  constructor(private readonly products: readonly Product[]) {}

  findByIds(ids: readonly string[]): Promise<Product[]> {
    this.requestedIds.push([...ids]);
    return Promise.resolve(this.products.filter((product) => ids.includes(product.id)));
  }
}

/** Gera "order-1", "order-2", ... de forma determinística. */
export function sequentialIds(prefix = 'order'): () => string {
  let next = 0;
  return () => `${prefix}-${++next}`;
}

/** Relógio que avança 1 minuto a cada chamada, a partir de FIXED_DATE. */
export function steppingClock(start: Date = FIXED_DATE): () => Date {
  let current = start.getTime();
  return () => {
    const now = new Date(current);
    current += 60_000;
    return now;
  };
}

/** Executa fn e devolve o erro lançado; falha o teste se nada for lançado. */
export async function captureError(fn: () => unknown): Promise<unknown> {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new Error('Esperava que a função lançasse um erro, mas ela não lançou.');
}
