import Fastify, { type FastifyInstance } from 'fastify';
import { errorHandler } from './error-handler';
import { registerHealthRoute, type DatabaseCheck } from './routes/health';
import { registerOrderRoutes, type OrderUseCases } from './routes/orders';

export interface AppDependencies extends OrderUseCases {
  checkDatabase: DatabaseCheck;
}

export interface AppOptions {
  /** false desliga o log (útil em testes). */
  logLevel?: string | false;
}

export function buildApp(deps: AppDependencies, options: AppOptions = {}): FastifyInstance {
  const { logLevel = 'info' } = options;
  const app = Fastify({
    logger: logLevel === false ? false : { level: logLevel },
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
  registerOrderRoutes(app, deps);
  registerHealthRoute(app, deps.checkDatabase);

  return app;
}
