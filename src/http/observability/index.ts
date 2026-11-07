import type { FastifyInstance } from 'fastify';
import { UNMATCHED_ROUTE, type HttpMetrics } from './metrics';
import { REQUEST_ID_HEADER } from './request-id';

/**
 * Caminhos que o pino troca por "[REDACTED]". O app não registra corpos nem dados pessoais;
 * isto é uma rede de segurança caso alguém passe um desses objetos para o logger no futuro.
 */
export const LOG_REDACT_PATHS = [
  'req.body',
  'body',
  'customerName',
  '*.customerName',
  '*.*.customerName',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
];

/** Request id na resposta, um log por requisição e o histograma de duração; expõe GET /metrics. */
export function registerObservability(app: FastifyInstance, metrics: HttpMetrics): void {
  app.addHook('onRequest', (request, reply, done) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
    done();
  });

  app.addHook('onResponse', (request, reply, done) => {
    // Template da rota (/orders/:id), nunca a URL real: mantém a cardinalidade dos labels fixa.
    const route = request.routeOptions.url ?? UNMATCHED_ROUTE;
    const durationMs = reply.elapsedTime;

    metrics.httpRequestDuration.observe(
      { method: request.method, route, status_code: String(reply.statusCode) },
      durationMs / 1000,
    );
    request.log.info(
      { method: request.method, route, statusCode: reply.statusCode, responseTimeMs: Math.round(durationMs * 100) / 100 },
      'request completed',
    );
    done();
  });

  app.get('/metrics', async (_request, reply) => {
    const body = await metrics.registry.metrics();
    return reply.type(metrics.registry.contentType).send(body);
  });
}
