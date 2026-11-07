import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_OPENAPI_PATH } from '../../../src/http/api-docs';
import { buildApp } from '../../../src/http/app';
import { captureError } from '../support/fakes';
import { inMemoryDependencies } from '../support/app';

interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
}

describe('Documentação da API (GET /docs)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('usa docs/openapi.yaml da raiz do projeto como padrão', () => {
    expect(DEFAULT_OPENAPI_PATH).toBe(join(__dirname, '..', '..', '..', 'docs', 'openapi.yaml'));
  });

  it('GET /docs responde 200 com a página do Swagger UI', async () => {
    app = buildApp(inMemoryDependencies(), { logLevel: false });

    const response = await app.inject({ method: 'GET', url: '/docs' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('<title>Swagger UI</title>');
    expect(response.body).toContain('id="swagger-ui"');
  });

  it('a UI carrega o contrato de /docs/json', async () => {
    app = buildApp(inMemoryDependencies(), { logLevel: false });

    const initializer = await app.inject({ method: 'GET', url: '/docs/static/swagger-initializer.js' });

    expect(initializer.statusCode).toBe(200);
    expect(initializer.body).toContain('./json');
  });

  it('/docs/json é o próprio docs/openapi.yaml, sem contrato duplicado no código', async () => {
    app = buildApp(inMemoryDependencies(), { logLevel: false });
    const yamlVersion = /^\s+version: (\S+)$/m.exec(readFileSync(DEFAULT_OPENAPI_PATH, 'utf8'))?.[1];

    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const document = response.json<OpenApiDocument>();

    expect(response.statusCode).toBe(200);
    expect(document.openapi).toBe('3.1.0');
    expect(document.info).toMatchObject({ title: 'Orders API', version: yamlVersion });
    // O contrato só recebe adições: os paths originais precisam continuar presentes.
    expect(Object.keys(document.paths)).toEqual(expect.arrayContaining(['/orders', '/orders/{id}', '/orders/{id}/cancel']));
    expect(Object.keys(document.paths['/orders'] ?? {})).toEqual(['post', 'get']);
  });

  it('/docs/yaml devolve o contrato em YAML', async () => {
    app = buildApp(inMemoryDependencies(), { logLevel: false });

    const response = await app.inject({ method: 'GET', url: '/docs/yaml' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatch(/^openapi: 3\.1\.0/);
    expect(response.body).toContain('/orders/{id}/cancel:');
  });

  it('não sobe se o arquivo do contrato não existir', async () => {
    app = buildApp(inMemoryDependencies(), { logLevel: false, openapiPath: join(__dirname, 'nao-existe.yaml') });

    const error = await captureError(() => app?.ready());

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('nao-existe.yaml does not exist');
  });
});
