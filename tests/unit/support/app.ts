import { CancelOrder } from '../../../src/application/cancel-order';
import { CreateOrder } from '../../../src/application/create-order';
import { GetOrder } from '../../../src/application/get-order';
import { ListOrders } from '../../../src/application/list-orders';
import type { AppDependencies } from '../../../src/http/app';
import { InMemoryOrderRepository, InMemoryProductRepository, SUCO, X_BURGER } from './fakes';

export const ORDER_ID = '11111111-1111-4111-8111-111111111111';
export const MISSING_ID = '00000000-0000-4000-8000-000000000000';

/** Dependências do app com repositórios em memória; o pedido criado sempre recebe ORDER_ID. */
export function inMemoryDependencies(overrides: Partial<AppDependencies> = {}): AppDependencies {
  const orders = new InMemoryOrderRepository();
  return {
    createOrder: new CreateOrder(orders, new InMemoryProductRepository([X_BURGER, SUCO]), () => ORDER_ID),
    getOrder: new GetOrder(orders),
    listOrders: new ListOrders(orders),
    cancelOrder: new CancelOrder(orders),
    checkDatabase: () => Promise.resolve(),
    ...overrides,
  };
}

export type LogLine = Record<string, unknown>;

/** Stream de log em memória: cada linha JSON do pino vira um objeto. */
export function captureLogs(): { lines: LogLine[]; raw: string[]; stream: { write(line: string): void } } {
  const lines: LogLine[] = [];
  const raw: string[] = [];
  return {
    lines,
    raw,
    stream: {
      write(line: string) {
        raw.push(line);
        lines.push(JSON.parse(line) as LogLine);
      },
    },
  };
}
