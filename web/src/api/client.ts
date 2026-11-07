import type { CreateOrderInput, ErrorBody, Order, Product } from './types';

/** Prefixo servido pelo nginx (e pelo proxy do Vite em dev): mesma origem, sem CORS. */
export const API_BASE = '/api';

/** Falha numa chamada à API. status null = a requisição nem chegou a ter resposta (rede/servidor fora). */
export class ApiError extends Error {
  constructor(
    readonly status: number | null,
    readonly body: ErrorBody | null,
  ) {
    super(status === null ? 'Network error' : `HTTP ${status}`);
    this.name = 'ApiError';
  }
}

function isErrorBody(value: unknown): value is ErrorBody {
  return typeof value === 'object' && value !== null && 'statusCode' in value && 'message' in value;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  } catch {
    throw new ApiError(null, null);
  }

  // Respostas de erro podem não ser JSON (ex.: página 502 do nginx com a API fora).
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, isErrorBody(body) ? body : null);
  }
  return body as T;
}

export function fetchProducts(): Promise<Product[]> {
  return request<Product[]>('/products');
}

export function createOrder(input: CreateOrderInput): Promise<Order> {
  return request<Order>('/orders', { method: 'POST', body: JSON.stringify(input) });
}

export function cancelOrder(orderId: string): Promise<Order> {
  return request<Order>(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST' });
}
