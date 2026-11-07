import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type AppDependencies } from '../../../src/http/app';
import { MISSING_ID, ORDER_ID, inMemoryDependencies as dependencies } from '../support/app';

function postOrder(app: FastifyInstance, payload: unknown) {
  return app.inject({ method: 'POST', url: '/orders', payload: payload as Record<string, unknown> });
}

describe('HTTP: validação e mapeamento de erros', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildApp(dependencies(), { logLevel: false });
  });

  afterEach(async () => {
    await app.close();
  });

  it('responde 201 com Location e corpo do contrato', async () => {
    const response = await postOrder(app, { customerName: 'Maria', items: [{ productId: 'suco', quantity: 2 }] });

    expect(response.statusCode).toBe(201);
    expect(response.headers.location).toBe(`/orders/${ORDER_ID}`);
    expect(response.json()).toEqual({
      id: ORDER_ID,
      customerName: 'Maria',
      items: [{ productId: 'suco', name: 'Suco', quantity: 2, unitPriceCents: 800, subtotalCents: 1600 }],
      totalCents: 1600,
      status: 'PENDING',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) as unknown,
    });
  });

  it('400 com details quando o corpo traz unitPrice (campo fora do contrato)', async () => {
    const response = await postOrder(app, {
      customerName: 'Maria',
      items: [{ productId: 'suco', quantity: 1, unitPrice: 1 }],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Invalid request',
      details: [{ field: 'items[0].unitPrice', message: 'must NOT have additional properties' }],
    });
  });

  it.each([
    [{ items: [{ productId: 'suco', quantity: 1 }] }, 'customerName', "must have required property 'customerName'"],
    [{ customerName: 'Maria', items: [{ productId: 'suco', quantity: 21 }] }, 'items[0].quantity', 'must be <= 20'],
    [{ customerName: 'Maria', items: [{ productId: 'suco', quantity: '2' }] }, 'items[0].quantity', 'must be integer'],
    [{ customerName: 'Maria', items: [{ productId: 'X Burger', quantity: 1 }] }, 'items[0].productId', 'must match pattern "^[a-z0-9]+(-[a-z0-9]+)*$"'],
    [{ customerName: 'Maria', items: [] }, 'items', 'must NOT have fewer than 1 items'],
  ])('400 de formato: %j', async (payload, field, message) => {
    const response = await postOrder(app, payload);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ statusCode: 400, error: 'Bad Request', details: [{ field, message }] });
  });

  it('400 do domínio para productId duplicado', async () => {
    const response = await postOrder(app, {
      customerName: 'Maria',
      items: [
        { productId: 'suco', quantity: 1 },
        { productId: 'suco', quantity: 3 },
      ],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Invalid order',
      details: [{ field: 'items[1].productId', message: 'product "suco" is duplicated in the order' }],
    });
  });

  it('400 para JSON malformado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { 'content-type': 'application/json' },
      payload: '{"customerName":',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ statusCode: 400, error: 'Bad Request' });
  });

  it('422 para produto fora do cardápio', async () => {
    const response = await postOrder(app, { customerName: 'Maria', items: [{ productId: 'x-tudo', quantity: 1 }] });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      statusCode: 422,
      error: 'Unprocessable Entity',
      message: 'Unknown product in menu',
      details: [{ field: 'items[0].productId', message: 'product "x-tudo" does not exist' }],
    });
  });

  it('400 para id que não é UUID', async () => {
    const response = await app.inject({ method: 'GET', url: '/orders/abc' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ details: [{ field: 'id', message: 'must match format "uuid"' }] });
  });

  it.each([
    ['GET', `/orders/${MISSING_ID}`],
    ['POST', `/orders/${MISSING_ID}/cancel`],
  ] as const)('404 em %s %s', async (method, url) => {
    const response = await app.inject({ method, url });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ statusCode: 404, error: 'Not Found', message: 'Order not found' });
  });

  it('409 ao cancelar duas vezes', async () => {
    await postOrder(app, { customerName: 'Maria', items: [{ productId: 'suco', quantity: 1 }] });
    const first = await app.inject({ method: 'POST', url: `/orders/${ORDER_ID}/cancel` });

    const second = await app.inject({ method: 'POST', url: `/orders/${ORDER_ID}/cancel` });

    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ status: 'CANCELLED' });
    expect(second.statusCode).toBe(409);
    expect(second.json()).toEqual({ statusCode: 409, error: 'Conflict', message: 'Order is already cancelled' });
  });
});

describe('HTTP: erros inesperados e health', () => {
  it('500 genérico sem expor a mensagem interna', async () => {
    const failingList = { execute: () => Promise.reject(new Error('connection refused at 10.0.0.5')) } as unknown as AppDependencies['listOrders'];
    const app = buildApp(dependencies({ listOrders: failingList }), { logLevel: false });

    const response = await app.inject({ method: 'GET', url: '/orders' });
    await app.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ statusCode: 500, error: 'Internal Server Error', message: 'Internal server error' });
  });

  it('GET /health responde 200 quando o banco responde', async () => {
    const app = buildApp(dependencies(), { logLevel: false });

    const response = await app.inject({ method: 'GET', url: '/health' });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', database: 'up' });
  });

  it('GET /health responde 503 quando o banco falha', async () => {
    const app = buildApp(dependencies({ checkDatabase: () => Promise.reject(new Error('down')) }), { logLevel: false });

    const response = await app.inject({ method: 'GET', url: '/health' });
    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'error', database: 'down' });
  });
});
