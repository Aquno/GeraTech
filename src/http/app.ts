import Fastify, { type FastifyInstance } from 'fastify';
import { errorHandler } from './error-handler';
import { LOG_REDACT_PATHS, registerObservability } from './observability';
import { createHttpMetrics, type HttpMetrics } from './observability/metrics';
import { resolveRequestId } from './observability/request-id';
import { registerHealthRoute, type DatabaseCheck } from './routes/health';
import { registerOrderRoutes, type OrderUseCases } from './routes/orders';

export interface AppDependencies extends OrderUseCases {
  checkDatabase: DatabaseCheck;
}

export interface AppOptions {
  /** false desliga o log (útil em testes). */
  logLevel?: string | false;
  /** Destino das linhas de log JSON; padrão: stdout. */
  logStream?: { write(line: string): void };
  /** Registry de métricas; por padrão cada app cria o seu, com as métricas padrão do processo. */
  metrics?: HttpMetrics;
}

export function buildApp(deps: AppDependencies, options: AppOptions = {}): FastifyInstance {
  const { logLevel = 'info', logStream, metrics = createHttpMetrics() } = options;
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
    disableRequestLogging: true,
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
  registerOrderRoutes(app, deps);
  registerHealthRoute(app, deps.checkDatabase);

  return app;
}
