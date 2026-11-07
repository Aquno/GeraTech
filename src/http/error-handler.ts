import { STATUS_CODES } from 'node:http';
import type { FastifyError, FastifyReply, FastifyRequest, FastifySchemaValidationError } from 'fastify';
import {
  DomainError,
  InvalidOrderError,
  OrderAlreadyCancelledError,
  OrderNotFoundError,
  UnknownProductError,
  type FieldError,
} from '../domain/errors';

/** Corpo de erro padronizado do contrato (components.schemas.Error). */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: FieldError[];
}

export function errorResponse(statusCode: number, message: string, details?: readonly FieldError[]): ErrorResponse {
  return {
    statusCode,
    error: STATUS_CODES[statusCode] ?? 'Error',
    message,
    ...(details && details.length > 0 ? { details: [...details] } : {}),
  };
}

function statusForDomainError(error: DomainError): number {
  if (error instanceof OrderNotFoundError) return 404;
  if (error instanceof OrderAlreadyCancelledError) return 409;
  if (error instanceof UnknownProductError) return 422;
  if (error instanceof InvalidOrderError) return 400;
  return 400;
}

export function errorHandler(error: DomainError | FastifyError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  if (error instanceof DomainError) {
    const status = statusForDomainError(error);
    return reply.code(status).send(errorResponse(status, error.message, error.details));
  }

  if (error.validation) {
    const context = error.validationContext ?? 'request';
    const details = error.validation.map((issue) => ({
      field: fieldPath(issue, context),
      message: issue.message ?? 'is invalid',
    }));
    return reply.code(400).send(errorResponse(400, 'Invalid request', details));
  }

  // Erros 4xx do próprio Fastify (JSON malformado, content-type não suportado, corpo grande demais...).
  const status = error.statusCode ?? 500;
  if (status >= 400 && status < 500) {
    return reply.code(status).send(errorResponse(status, error.message));
  }

  request.log.error({ err: error }, 'unhandled error');
  return reply.code(500).send(errorResponse(500, 'Internal server error'));
}

/** Converte "/items/0/quantity" em "items[0].quantity", no mesmo formato dos erros de domínio. */
function fieldPath(issue: FastifySchemaValidationError, context: string): string {
  const segments = issue.instancePath.split('/').filter(Boolean);
  const { missingProperty, additionalProperty } = issue.params;
  const property = missingProperty ?? additionalProperty;
  if (typeof property === 'string') {
    segments.push(property);
  }

  const path = segments.reduce(
    (acc, segment) => (/^\d+$/.test(segment) ? `${acc}[${segment}]` : acc ? `${acc}.${segment}` : segment),
    '',
  );
  return path || context;
}
