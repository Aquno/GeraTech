import type { FastifyInstance } from 'fastify';
import type { ListProducts } from '../../application/list-products';
import { listProductsSchema } from '../schemas';

export function registerProductRoutes(app: FastifyInstance, listProducts: ListProducts): void {
  app.get('/products', { schema: listProductsSchema }, async () => {
    const menu = await listProducts.execute();
    return menu.map(({ id, name, description, category, priceCents }) => ({ id, name, description, category, priceCents }));
  });
}
