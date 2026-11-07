import type { FastifyInstance } from 'fastify';

/** Lança erro se o banco não responder. */
export type DatabaseCheck = () => Promise<void>;

export function registerHealthRoute(app: FastifyInstance, checkDatabase: DatabaseCheck): void {
  app.get('/health', async (request, reply) => {
    try {
      await checkDatabase();
      return { status: 'ok', database: 'up' };
    } catch (error) {
      request.log.warn({ err: error }, 'health check: database unavailable');
      return reply.code(503).send({ status: 'error', database: 'down' });
    }
  });
}
