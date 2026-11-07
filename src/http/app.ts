import Fastify, { LogController, type FastifyInstance } from 'fastify';
import { registerApiDocs } from './api-docs';
import { errorHandler } from './error-handler';
import { LOG_REDACT_PATHS, registerObservability } from './observability';
import { createHttpMetrics, type HttpMetrics } from './observability/metrics';
import { resolveRequestId } from './observability/request-id';
import { registerHealthRoute, type DatabaseCheck } from './routes/health';
import { registerOrderRoutes, type OrderUseCases } from './routes/orders';
import { registerProductRoutes } from './routes/products';
import type { ListProducts } from '../application/list-products';

export interface AppDependencies extends OrderUseCases {
  checkDatabase: DatabaseCheck;
  listProducts: ListProducts;
}

export interface AppOptions {
  /** false desliga o log (útil em testes). */
  logLevel?: string | false;
  /** Destino das linhas de log JSON; padrão: stdout. */
  logStream?: { write(line: string): void };
  /** Registry de métricas; por padrão cada app cria o seu, com as métricas padrão do processo. */
  metrics?: HttpMetrics;
  /** Caminho do contrato OpenAPI servido em /docs; padrão: docs/openapi.yaml. */
  openapiPath?: string;
}

export function buildApp(deps: AppDependencies, options: AppOptions = {}): FastifyInstance {
  const { logLevel = 'info', logStream, metrics = createHttpMetrics(), openapiPath } = options;
  const app = Fastify({
    logger:
      logLevel === false
        ? false
        : {
            level: logLevel,
            redact: { paths: LOG_REDACT_PATHS, censor: '[REDACTED]' },
            ...(logStream ? { stream: logStream } : {}),
          },
    genReqId: resolveRequestId,
    // O log padrão do Fastify gera duas linhas por requisição; registerObservability emite uma só.
    logController: new LogController({ disableRequestLogging: true }),
    ajv: {
      customOptions: {
        // Rejeita campos fora do contrato (ex.: unitPrice) em vez de removê-los silenciosamente.
        removeAdditional: false,
        // Não converte "2" em 2: tipos precisam vir corretos no JSON.
        coerceTypes: false,
      },
    },
  });

  app.setErrorHandler(errorHandler);
  registerObservability(app, metrics);
  registerApiDocs(app, openapiPath);
  registerOrderRoutes(app, deps);
  registerHealthRoute(app, deps.checkDatabase);
  registerProductRoutes(app, deps.listProducts);

  return app;
}
