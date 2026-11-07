// JSON Schemas das rotas, espelhando docs/openapi.yaml.

const productId = {
  type: 'string',
  pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
} as const;

const quantity = { type: 'integer', minimum: 1, maximum: 20 } as const;

const customerName = { type: 'string', minLength: 1, maxLength: 100 } as const;

const error = {
  type: 'object',
  required: ['statusCode', 'error', 'message'],
  properties: {
    statusCode: { type: 'integer' },
    error: { type: 'string' },
    message: { type: 'string' },
    details: {
      type: 'array',
      items: {
        type: 'object',
        required: ['field', 'message'],
        properties: {
          field: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
  },
} as const;

const order = {
  type: 'object',
  required: ['id', 'customerName', 'items', 'totalCents', 'status', 'createdAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    customerName: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['productId', 'name', 'quantity', 'unitPriceCents', 'subtotalCents'],
        properties: {
          productId: { type: 'string' },
          name: { type: 'string' },
          quantity: { type: 'integer' },
          unitPriceCents: { type: 'integer' },
          subtotalCents: { type: 'integer' },
        },
      },
    },
    totalCents: { type: 'integer' },
    status: { type: 'string', enum: ['PENDING', 'CANCELLED'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

const orderIdParams = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', format: 'uuid' },
  },
} as const;

export const createOrderSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['customerName', 'items'],
    properties: {
      customerName,
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['productId', 'quantity'],
          properties: { productId, quantity },
        },
      },
    },
  },
  response: { 201: order, 400: error, 422: error },
} as const;

export const listOrdersSchema = {
  response: { 200: { type: 'array', items: order } },
} as const;

export const getOrderSchema = {
  params: orderIdParams,
  response: { 200: order, 400: error, 404: error },
} as const;

export const cancelOrderSchema = {
  params: orderIdParams,
  response: { 200: order, 400: error, 404: error, 409: error },
} as const;

const product = {
  type: 'object',
  required: ['id', 'name', 'description', 'category', 'priceCents'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    category: { type: 'string', enum: ['lanches', 'acompanhamentos', 'bebidas'] },
    priceCents: { type: 'integer' },
  },
} as const;

export const listProductsSchema = {
  response: { 200: { type: 'array', items: product } },
} as const;
