import { dirname, resolve } from 'node:path';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

/**
 * docs/openapi.yaml é a fonte única do contrato. O caminho relativo é o mesmo em src/http (tsx, testes)
 * e em dist/http (build), e o Dockerfile copia docs/openapi.yaml para a imagem.
 */
export const DEFAULT_OPENAPI_PATH = resolve(__dirname, '../../docs/openapi.yaml');

/** Swagger UI em GET /docs (e o contrato em /docs/json e /docs/yaml), servido a partir do arquivo. */
export function registerApiDocs(app: FastifyInstance, specificationPath: string = DEFAULT_OPENAPI_PATH): void {
  void app.register(fastifySwagger, {
    mode: 'static',
    specification: { path: specificationPath, baseDir: dirname(specificationPath) },
  });
  void app.register(fastifySwaggerUi, { routePrefix: '/docs' });
}
