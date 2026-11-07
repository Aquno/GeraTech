import { describe, expect, it } from 'vitest';
import { ListProducts } from '../../../src/application/list-products';
import { buildApp } from '../../../src/http/app';
import { createHttpMetrics } from '../../../src/http/observability/metrics';
import type { MenuItem } from '../../../src/domain/product';
import { inMemoryDependencies } from '../support/app';
import { InMemoryMenuRepository, MENU_BATATA, MENU_SUCO, MENU_X_BURGER } from '../support/menu';

function appWithMenu(items: MenuItem[]) {
  const metrics = createHttpMetrics({ collectDefault: false });
  const listProducts = new ListProducts(new InMemoryMenuRepository(items));
  return { app: buildApp(inMemoryDependencies({ listProducts }), { logLevel: false, metrics }), metrics };
}

describe('HTTP: GET /products', () => {
  it('responde 200 com o cardápio ordenado e só os campos do contrato', async () => {
    const { app } = appWithMenu([MENU_SUCO, MENU_BATATA, MENU_X_BURGER]);

    const response = await app.inject({ method: 'GET', url: '/products' });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual([
      { id: 'x-burger', name: 'X-Burger', description: 'Clássico.', category: 'lanches', priceCents: 1800 },
      { id: 'batata-frita', name: 'Batata Frita', description: 'Crocante.', category: 'acompanhamentos', priceCents: 1000 },
      { id: 'suco', name: 'Suco', description: 'Natural.', category: 'bebidas', priceCents: 800 },
    ]);
  });

  it('responde lista vazia quando não há produtos', async () => {
    const { app } = appWithMenu([]);

    const response = await app.inject({ method: 'GET', url: '/products' });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('registra a métrica com o template da rota /products', async () => {
    const { app, metrics } = appWithMenu([MENU_SUCO]);

    await app.inject({ method: 'GET', url: '/products' });
    await app.close();

    expect(await metrics.registry.metrics()).toContain(
      'http_request_duration_seconds_count{method="GET",route="/products",status_code="200"} 1',
    );
  });

  it('o app padrão dos testes já expõe o cardápio fake completo', async () => {
    const app = buildApp(inMemoryDependencies(), { logLevel: false, metrics: createHttpMetrics({ collectDefault: false }) });

    const response = await app.inject({ method: 'GET', url: '/products' });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json<{ id: string }[]>().map((p) => p.id)).toEqual([
      'x-burger',
      'x-salada',
      'batata-frita',
      'refrigerante',
      'suco',
    ]);
  });

  it('o contrato servido em /docs/json inclui GET /products com o schema Product', async () => {
    const app = buildApp(inMemoryDependencies(), { logLevel: false, metrics: createHttpMetrics({ collectDefault: false }) });

    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    await app.close();
    const document = response.json<{
      paths: Record<string, Record<string, unknown>>;
      components: { schemas: Record<string, { required?: string[] }> };
    }>();

    expect(Object.keys(document.paths['/products'] ?? {})).toEqual(['get']);
    expect(document.components.schemas.Product?.required).toEqual(['id', 'name', 'description', 'category', 'priceCents']);
  });
});
