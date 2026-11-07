import type { FastifyInstance } from 'fastify';
import type { CancelOrder } from '../../application/cancel-order';
import type { CreateOrder, CreateOrderInput } from '../../application/create-order';
import type { GetOrder } from '../../application/get-order';
import type { ListOrders } from '../../application/list-orders';
import { toOrderResponse } from '../order-presenter';
import { cancelOrderSchema, createOrderSchema, getOrderSchema, listOrdersSchema } from '../schemas';

export interface OrderUseCases {
  createOrder: CreateOrder;
  getOrder: GetOrder;
  listOrders: ListOrders;
  cancelOrder: CancelOrder;
}

interface OrderParams {
  id: string;
}

export function registerOrderRoutes(app: FastifyInstance, useCases: OrderUseCases): void {
  app.post<{ Body: CreateOrderInput }>('/orders', { schema: createOrderSchema }, async (request, reply) => {
    const order = await useCases.createOrder.execute(request.body);
    // Sem customerName nem corpo: só identificadores e números.
    request.log.info(
      { event: 'order.created', orderId: order.id, itemCount: order.items.length, totalCents: order.totalCents },
      'order created',
    );
    return reply.code(201).header('location', `/orders/${order.id}`).send(toOrderResponse(order));
  });

  app.get('/orders', { schema: listOrdersSchema }, async () => {
    const orders = await useCases.listOrders.execute();
    return orders.map(toOrderResponse);
  });

  app.get<{ Params: OrderParams }>('/orders/:id', { schema: getOrderSchema }, async (request) => {
    const order = await useCases.getOrder.execute(request.params.id);
    return toOrderResponse(order);
  });

  app.post<{ Params: OrderParams }>('/orders/:id/cancel', { schema: cancelOrderSchema }, async (request) => {
    const order = await useCases.cancelOrder.execute(request.params.id);
    request.log.info({ event: 'order.cancelled', orderId: order.id }, 'order cancelled');
    return toOrderResponse(order);
  });
}
