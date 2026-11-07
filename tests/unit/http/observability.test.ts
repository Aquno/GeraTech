import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/http/app';
import { createHttpMetrics, HTTP_DURATION_BUCKETS, type HttpMetrics } from '../../../src/http/observability/metrics';
import { resolveRequestId } from '../../../src/http/observability/request-id';
import { MISSING_ID, ORDER_ID, captureLogs, inMemoryDependencies, type LogLine } from '../support/app';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CUSTOMER_NAME = 'Maria Dado Pessoal';
const VALID_ORDER = { customerName: CUSTOMER_NAME, items: [{ productId: 'x-burger', quantity: 2 }, { productId: 'suco', quantity: 1 }] };

interface Harness {
  app: FastifyInstance;
  logs: LogLine[];
  raw: string[];
  metrics: HttpMetrics;
}

function setup(logLevel = 'info'): Harness {
  const { lines, raw, stream } = captureLogs();
  const metrics = createHttpMetrics({ collectDefault: false });
  const app = buildApp(inMemoryDependencies(), { logLevel, logStream: stream, metrics });
  return { app, logs: lines, raw, metrics };
}

async function histogramValue(metrics: HttpMetrics, suffix: '_count' | '_sum', labels: Record<string, string>) {
  const { values } = await metrics.httpRequestDuration.get();
  return values.find(
    (v) =>
      v.metricName === `http_request_duration_seconds${suffix}` &&
      Object.entries(labels).every(([key, value]) => (v.labels as Record<string, unknown>)[key] === value),
  )?.value;
}

describe('Observabilidade', () => {
  let harness: Harness | undefined;

  afterEach(async () => {
    await harness?.app.close();
    harness = undefined;
  });

  describe('request id', () => {
    it('gera um UUID quando o header não vem e o devolve na resposta e em todos os logs da requisição', async () => {
      harness = setup();
      const response = await harness.app.inject({ method: 'POST', url: '/orders', payload: VALID_ORDER });

      const requestId = response.headers['x-request-id'];
      expect(requestId).toMatch(UUID);
      const requestLogs = harness.logs.filter((line) => 'reqId' in line);
      expect(requestLogs.map((line) => line.msg)).toEqual(['order created', 'request completed']);
      expect(requestLogs.every((line) => line.reqId === requestId)).toBe(true);
    });

    it('aceita o x-request-id enviado pelo cliente', async () => {
      harness = setup();
      const response = await harness.app.inject({ method: 'GET', url: '/orders', headers: { 'x-request-id': 'abc-123.gateway:7' } });

      expect(response.headers['x-request-id']).toBe('abc-123.gateway:7');
      expect(harness.logs.find((line) => line.msg === 'request completed')?.reqId).toBe('abc-123.gateway:7');
    });

    it('devolve o request id também em respostas de erro', async () => {
      harness = setup();
      const response = await harness.app.inject({ method: 'GET', url: `/orders/${MISSING_ID}`, headers: { 'x-request-id': 'req-404' } });

      expect(response.statusCode).toBe(404);
      expect(response.headers['x-request-id']).toBe('req-404');
    });

    it.each([
      ['com espaço e quebra de linha', 'abc def\nfake-log'],
      ['vazio', ''],
      ['com mais de 128 caracteres', 'a'.repeat(129)],
    ])('troca um x-request-id inválido (%s) por um UUID novo', (_label, value) => {
      expect(resolveRequestId({ headers: { 'x-request-id': value } })).toMatch(UUID);
    });

    it('usa o primeiro valor quando o header vem repetido', () => {
      expect(resolveRequestId({ headers: { 'x-request-id': ['primeiro', 'segundo'] } })).toBe('primeiro');
    });
  });

  describe('logs', () => {
    it('emite uma única linha JSON por requisição com método, rota, status e tempo', async () => {
      harness = setup();
      await harness.app.inject({ method: 'GET', url: `/orders/${MISSING_ID}` });

      const completed = harness.logs.filter((line) => line.msg === 'request completed');
      expect(completed).toHaveLength(1);
      expect(completed[0]).toMatchObject({ level: 30, method: 'GET', route: '/orders/:id', statusCode: 404 });
      expect(typeof completed[0]?.responseTimeMs).toBe('number');
      expect(harness.logs.some((line) => line.msg === 'incoming request')).toBe(false);
    });

    it('registra o evento order.created com orderId, quantidade de itens e totalCents', async () => {
      harness = setup();
      await harness.app.inject({ method: 'POST', url: '/orders', payload: VALID_ORDER });

      const event = harness.logs.find((line) => line.event === 'order.created');
      expect(event).toMatchObject({ msg: 'order created', orderId: ORDER_ID, itemCount: 2, totalCents: 4400 });
    });

    it('registra o evento order.cancelled com orderId', async () => {
      harness = setup();
      await harness.app.inject({ method: 'POST', url: '/orders', payload: VALID_ORDER });
      await harness.app.inject({ method: 'POST', url: `/orders/${ORDER_ID}/cancel` });

      expect(harness.logs.filter((line) => line.event === 'order.cancelled')).toEqual([
        expect.objectContaining({ msg: 'order cancelled', orderId: ORDER_ID }),
      ]);
    });

    it('não registra eventos de negócio quando a operação falha', async () => {
      harness = setup();
      await harness.app.inject({ method: 'POST', url: `/orders/${MISSING_ID}/cancel` });
      await harness.app.inject({ method: 'POST', url: '/orders', payload: { customerName: 'X', items: [{ productId: 'x-tudo', quantity: 1 }] } });

      expect(harness.logs.filter((line) => 'event' in line)).toEqual([]);
    });

    it('nunca escreve customerName nem o corpo da requisição, nem em sucesso nem em erro', async () => {
      harness = setup('trace');
      await harness.app.inject({ method: 'POST', url: '/orders', payload: VALID_ORDER });
      await harness.app.inject({ method: 'POST', url: '/orders', payload: { ...VALID_ORDER, items: [{ productId: 'x-burger', quantity: 99 }] } });
      await harness.app.inject({ method: 'POST', url: '/orders', payload: { ...VALID_ORDER, items: [{ productId: 'x-tudo', quantity: 1 }] } });

      expect(harness.logs.map((line) => line.msg)).toEqual(['order created', 'request completed', 'request completed', 'request completed']);
      const allLogs = harness.raw.join('');
      expect(allLogs).not.toContain(CUSTOMER_NAME);
      expect(allLogs).not.toContain('customerName');
      expect(allLogs).not.toContain('"quantity":99');
    });

    it('o redact substitui customerName e body se alguém os passar ao logger', () => {
      harness = setup();
      harness.app.log.info({ customerName: CUSTOMER_NAME, body: { a: 1 }, order: { customerName: CUSTOMER_NAME } }, 'teste');

      const line = harness.logs.find((l) => l.msg === 'teste');
      expect(line).toMatchObject({ customerName: '[REDACTED]', body: '[REDACTED]', order: { customerName: '[REDACTED]' } });
      expect(harness.raw.join('')).not.toContain(CUSTOMER_NAME);
    });

    it('respeita LOG_LEVEL: em warn, logs info não são emitidos', async () => {
      harness = setup('warn');
      await harness.app.inject({ method: 'POST', url: '/orders', payload: VALID_ORDER });

      expect(harness.logs).toEqual([]);
    });
  });

  describe('métricas', () => {
    it('uma requisição incrementa o histograma com method, template de rota e status_code', async () => {
      harness = setup();
      await harness.app.inject({ method: 'POST', url: '/orders', payload: VALID_ORDER });

      expect(await histogramValue(harness.metrics, '_count', { method: 'POST', route: '/orders', status_code: '201' })).toBe(1);
      const sum = await histogramValue(harness.metrics, '_sum', { method: 'POST', route: '/orders', status_code: '201' });
      expect(sum).toBeGreaterThan(0);
      expect(sum).toBeLessThan(5);
    });

    it('usa /orders/:id como label, nunca o id real', async () => {
      harness = setup();
      await harness.app.inject({ method: 'POST', url: '/orders', payload: VALID_ORDER });
      await harness.app.inject({ method: 'GET', url: `/orders/${ORDER_ID}` });
      await harness.app.inject({ method: 'GET', url: `/orders/${ORDER_ID}` });
      await harness.app.inject({ method: 'GET', url: `/orders/${MISSING_ID}` });

      expect(await histogramValue(harness.metrics, '_count', { method: 'GET', route: '/orders/:id', status_code: '200' })).toBe(2);
      expect(await histogramValue(harness.metrics, '_count', { method: 'GET', route: '/orders/:id', status_code: '404' })).toBe(1);
      const exposition = await harness.metrics.registry.metrics();
      expect(exposition).not.toContain(ORDER_ID);
      expect(exposition).not.toContain(MISSING_ID);
    });

    it('agrupa rotas inexistentes no label "unmatched"', async () => {
      harness = setup();
      await harness.app.inject({ method: 'GET', url: '/qualquer/coisa/123' });

      expect(await histogramValue(harness.metrics, '_count', { method: 'GET', route: 'unmatched', status_code: '404' })).toBe(1);
      expect(await harness.metrics.registry.metrics()).not.toContain('/qualquer/coisa');
    });

    it('distribui a observação nos buckets, incluindo o limite de 300 ms do SLO', async () => {
      harness = setup();
      await harness.app.inject({ method: 'GET', url: '/orders' });

      const { values } = await harness.metrics.httpRequestDuration.get();
      const buckets = values
        .filter((v) => v.metricName === 'http_request_duration_seconds_bucket' && v.labels.route === '/orders')
        .map((v) => ({ le: (v.labels as Record<string, unknown>).le, value: v.value }));
      expect(buckets.map((b) => b.le)).toEqual([...HTTP_DURATION_BUCKETS, '+Inf']);
      expect(buckets.find((b) => b.le === 0.3)?.value).toBe(1);
      expect(buckets.find((b) => b.le === '+Inf')?.value).toBe(1);
    });

    it('GET /metrics responde no formato de exposição do Prometheus', async () => {
      harness = setup();
      await harness.app.inject({ method: 'POST', url: '/orders', payload: VALID_ORDER });

      const response = await harness.app.inject({ method: 'GET', url: '/metrics' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.body).toContain('# TYPE http_request_duration_seconds histogram');
      expect(response.body).toContain('http_request_duration_seconds_count{method="POST",route="/orders",status_code="201"} 1');
      expect(response.body).toContain('http_request_duration_seconds_bucket{le="0.3",method="POST",route="/orders",status_code="201"} 1');
    });

    it('inclui as métricas padrão do processo quando habilitadas', async () => {
      const app = buildApp(inMemoryDependencies(), { logLevel: false, metrics: createHttpMetrics() });

      const response = await app.inject({ method: 'GET', url: '/metrics' });
      await app.close();

      expect(response.body).toContain('# TYPE process_cpu_user_seconds_total counter');
      expect(response.body).toContain('# TYPE nodejs_heap_size_used_bytes gauge');
    });
  });
});
