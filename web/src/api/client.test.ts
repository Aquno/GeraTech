import { describe, expect, it, vi } from 'vitest';
import { json, order, PRODUCTS } from '../test/fake-api';
import { ApiError, cancelOrder, createOrder, fetchProducts } from './client';

describe('cliente da API', () => {
  it('GET /api/products devolve o cardápio', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json(200, PRODUCTS)));
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchProducts()).toEqual(PRODUCTS);
    expect(fetchMock).toHaveBeenCalledWith('/api/products', { headers: { Accept: 'application/json' } });
  });

  it('POST /api/orders envia JSON com Content-Type', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json(201, order())));
    vi.stubGlobal('fetch', fetchMock);
    const input = { customerName: 'Maria', items: [{ productId: 'suco', quantity: 1 }] };

    expect(await createOrder(input)).toEqual(order());
    expect(fetchMock).toHaveBeenCalledWith('/api/orders', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
  });

  it('cancelamento codifica o id na URL', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json(200, order({ status: 'CANCELLED' }))));
    vi.stubGlobal('fetch', fetchMock);

    await cancelOrder('a/b');

    expect(fetchMock).toHaveBeenCalledWith('/api/orders/a%2Fb/cancel', expect.objectContaining({ method: 'POST' }));
  });

  it('erro HTTP vira ApiError com status e corpo do contrato', async () => {
    const body = { statusCode: 422, error: 'Unprocessable Entity', message: 'Unknown product in menu', details: [] };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(422, body))));

    const error = await createOrder({ customerName: 'x', items: [] }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, body });
  });

  it('resposta de erro que não é JSON (ex.: 502 do nginx) vira ApiError sem corpo', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('<html>Bad Gateway</html>', { status: 502 }))));

    await expect(fetchProducts()).rejects.toMatchObject({ status: 502, body: null });
  });

  it('JSON de erro fora do formato do contrato não é aceito como corpo', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(500, { oops: true }))));

    await expect(fetchProducts()).rejects.toMatchObject({ status: 500, body: null });
  });

  it('falha de rede vira ApiError com status null', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));

    await expect(fetchProducts()).rejects.toMatchObject({ status: null, message: 'Network error' });
  });
});
