import type { FastifyInstance } from 'fastify';
import type { Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/composition';
import { MENU } from '../../src/infra/db/menu-seed';
import { connectToTestDatabase, migrateAndSeed, truncateOrders } from './support/test-database';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

interface OrderBody {
  id: string;
  customerName: string;
  items: { productId: string; name: string; quantity: number; unitPriceCents: number; subtotalCents: number }[];
  totalCents: number;
  status: string;
  createdAt: string;
}

describe('Orders API contra PostgreSQL real', () => {
  let db: Knex;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = connectToTestDatabase();
    await migrateAndSeed(db);
    app = createApplication(db, { logLevel: false });
    await app.ready();
  });

  beforeEach(async () => {
    await truncateOrders(db);
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  function createOrder(payload: unknown) {
    return app.inject({ method: 'POST', url: '/orders', payload: payload as Record<string, unknown> });
  }

  it('o seed popula o cardápio com os 5 produtos em centavos', async () => {
    const rows = await db('products').select('id', 'name', 'price_cents').orderBy('id');

    expect(rows).toEqual(
      [...MENU]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((product) => ({ id: product.id, name: product.name, price_cents: product.priceCents })),
    );
  });

  it('percorre o fluxo completo: criar, consultar, listar, cancelar, cancelar de novo e produto inexistente', async () => {
    // 1. Criar
    const created = await createOrder({
      customerName: 'Maria',
      items: [
        { productId: 'x-burger', quantity: 2 },
        { productId: 'refrigerante', quantity: 1 },
      ],
    });
    expect(created.statusCode).toBe(201);
    const order = created.json<OrderBody>();
    expect(order.id).toMatch(UUID);
    expect(created.headers.location).toBe(`/orders/${order.id}`);
    expect(order).toEqual({
      id: order.id,
      customerName: 'Maria',
      items: [
        { productId: 'x-burger', name: 'X-Burger', quantity: 2, unitPriceCents: 1800, subtotalCents: 3600 },
        { productId: 'refrigerante', name: 'Refrigerante', quantity: 1, unitPriceCents: 600, subtotalCents: 600 },
      ],
      totalCents: 4200,
      status: 'PENDING',
      createdAt: order.createdAt,
    });
    expect(order.createdAt).toMatch(ISO_DATE);

    // 2. Consultar
    const fetched = await app.inject({ method: 'GET', url: `/orders/${order.id}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toEqual(order);

    // 3. Listar
    const listed = await app.inject({ method: 'GET', url: '/orders' });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual([order]);

    // 4. Cancelar
    const cancelled = await app.inject({ method: 'POST', url: `/orders/${order.id}/cancel` });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toEqual({ ...order, status: 'CANCELLED' });
    const afterCancel = await app.inject({ method: 'GET', url: `/orders/${order.id}` });
    expect(afterCancel.json<OrderBody>().status).toBe('CANCELLED');

    // 5. Cancelar de novo
    const again = await app.inject({ method: 'POST', url: `/orders/${order.id}/cancel` });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ statusCode: 409, error: 'Conflict', message: 'Order is already cancelled' });

    // 6. Produto inexistente
    const unknown = await createOrder({
      customerName: 'Ana',
      items: [
        { productId: 'x-burger', quantity: 1 },
        { productId: 'x-tudo', quantity: 1 },
      ],
    });
    expect(unknown.statusCode).toBe(422);
    expect(unknown.json()).toEqual({
      statusCode: 422,
      error: 'Unprocessable Entity',
      message: 'Unknown product in menu',
      details: [{ field: 'items[1].productId', message: 'product "x-tudo" does not exist' }],
    });
    const finalList = await app.inject({ method: 'GET', url: '/orders' });
    expect(finalList.json<OrderBody[]>().map((o) => o.id)).toEqual([order.id]);
  });

  it('lista do mais recente para o mais antigo', async () => {
    const first = (await createOrder({ customerName: 'Primeiro', items: [{ productId: 'suco', quantity: 1 }] })).json<OrderBody>();
    const second = (await createOrder({ customerName: 'Segundo', items: [{ productId: 'x-salada', quantity: 3 }] })).json<OrderBody>();

    const response = await app.inject({ method: 'GET', url: '/orders' });

    expect(response.statusCode).toBe(200);
    expect(response.json<OrderBody[]>().map((o) => [o.customerName, o.totalCents])).toEqual([
      ['Segundo', 6000],
      ['Primeiro', 800],
    ]);
    expect(new Date(second.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(first.createdAt).getTime());
  });

  it('grava os itens com preço congelado e na ordem enviada', async () => {
    const order = (
      await createOrder({
        customerName: 'João',
        items: [
          { productId: 'suco', quantity: 4 },
          { productId: 'batata-frita', quantity: 2 },
        ],
      })
    ).json<OrderBody>();

    const rows = await db('order_items')
      .where({ order_id: order.id })
      .orderBy('position')
      .select('position', 'product_id', 'product_name', 'quantity', 'unit_price_cents');

    expect(rows).toEqual([
      { position: 0, product_id: 'suco', product_name: 'Suco', quantity: 4, unit_price_cents: 800 },
      { position: 1, product_id: 'batata-frita', product_name: 'Batata Frita', quantity: 2, unit_price_cents: 1000 },
    ]);
    expect(order.customerName).toBe('João');
    expect(order.totalCents).toBe(5200);
  });

  it('não persiste nada quando há produto duplicado (400)', async () => {
    const response = await createOrder({
      customerName: 'Maria',
      items: [
        { productId: 'suco', quantity: 1 },
        { productId: 'suco', quantity: 1 },
      ],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      details: [{ field: 'items[1].productId', message: 'product "suco" is duplicated in the order' }],
    });
    expect(await db('orders').count({ total: '*' })).toEqual([{ total: '0' }]);
  });

  it('404 para pedido inexistente', async () => {
    const response = await app.inject({ method: 'GET', url: '/orders/00000000-0000-4000-8000-000000000000' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ statusCode: 404, error: 'Not Found', message: 'Order not found' });
  });

  it('expõe request id e métricas com o template da rota na aplicação real', async () => {
    const created = await createOrder({ customerName: 'Maria', items: [{ productId: 'suco', quantity: 1 }] });
    const order = created.json<OrderBody>();
    await app.inject({ method: 'GET', url: `/orders/${order.id}` });

    const metrics = await app.inject({ method: 'GET', url: '/metrics' });

    expect(created.headers['x-request-id']).toMatch(UUID);
    expect(metrics.statusCode).toBe(200);
    expect(metrics.body).toMatch(/http_request_duration_seconds_count\{method="POST",route="\/orders",status_code="201"\} \d+/);
    expect(metrics.body).toMatch(/http_request_duration_seconds_count\{method="GET",route="\/orders\/:id",status_code="200"\} \d+/);
    expect(metrics.body).not.toContain(order.id);
  });

  it('GET /health responde 200 com o banco no ar', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', database: 'up' });
  });
});
