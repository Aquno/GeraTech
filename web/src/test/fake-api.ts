import { vi } from 'vitest';
import type { Order, Product } from '../api/types';

export const PRODUCTS: Product[] = [
  { id: 'x-burger', name: 'X-Burger', description: 'Hambúrguer com queijo.', category: 'lanches', priceCents: 1800 },
  { id: 'x-salada', name: 'X-Salada', description: 'Com alface e tomate.', category: 'lanches', priceCents: 2000 },
  { id: 'batata-frita', name: 'Batata Frita', description: 'Crocante.', category: 'acompanhamentos', priceCents: 1000 },
  { id: 'refrigerante', name: 'Refrigerante', description: 'Lata gelada.', category: 'bebidas', priceCents: 600 },
  { id: 'suco', name: 'Suco', description: 'Natural.', category: 'bebidas', priceCents: 800 },
];

export const ORDER_ID = '7a1d2c3b-4e5f-4a6b-8c9d-0e1f2a3b4c5d';

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function order(overrides: Partial<Order> = {}): Order {
  return {
    id: ORDER_ID,
    customerName: 'Maria',
    items: [
      { productId: 'x-burger', name: 'X-Burger', quantity: 2, unitPriceCents: 1800, subtotalCents: 3600 },
      { productId: 'suco', name: 'Suco', quantity: 1, unitPriceCents: 800, subtotalCents: 800 },
    ],
    totalCents: 4400,
    status: 'PENDING',
    createdAt: '2026-11-07T20:00:00.000Z',
    ...overrides,
  };
}

type Handler = (body: unknown) => Response | Promise<Response>;

export interface FakeApiRoutes {
  'GET /api/products'?: Handler;
  'POST /api/orders'?: Handler;
  'POST /api/orders/:id/cancel'?: Handler;
}

/**
 * Substitui o fetch global por um roteador em memória. Rotas não configuradas respondem 404.
 * Um handler pode lançar para simular falha de rede (fetch rejeitado).
 */
export function mockApi(routes: FakeApiRoutes) {
  const defaults: Required<FakeApiRoutes> = {
    'GET /api/products': () => json(200, PRODUCTS),
    'POST /api/orders': () => json(201, order()),
    'POST /api/orders/:id/cancel': () => json(200, order({ status: 'CANCELLED' })),
  };
  const table = { ...defaults, ...routes };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    const method = init?.method ?? 'GET';
    const route = `${method} ${url.replace(/\/orders\/[^/]+\/cancel$/, '/orders/:id/cancel')}` as keyof FakeApiRoutes;
    const handler = table[route];
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    return handler ? handler(body) : json(404, { statusCode: 404, error: 'Not Found', message: 'Route not found' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Corpo JSON enviado na n-ésima chamada a uma rota (para conferir o que o front mandou à API). */
export function sentBody(fetchMock: ReturnType<typeof mockApi>, method: string, url: string): unknown {
  const call = fetchMock.mock.calls.find(([input, init]) => input === url && (init?.method ?? 'GET') === method);
  return call?.[1]?.body ? JSON.parse(call[1].body as string) : undefined;
}
