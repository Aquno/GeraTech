import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';

// Só aceita ids "bem comportados" vindos do cliente: evita valores enormes ou com caracteres
// de controle nos logs. Fora disso, gera um novo.
const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function resolveRequestId(request: Pick<IncomingMessage, 'headers'>): string {
  const header = request.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(header) ? header[0] : header;
  return candidate !== undefined && VALID_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}
