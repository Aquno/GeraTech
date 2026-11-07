import { ApiError } from '../api/client';

export interface UserMessage {
  title: string;
  details: string[];
}

export type ErrorContext = 'load-menu' | 'create-order' | 'cancel-order';

const ITEM_FIELD = /^items\[(\d+)\]\.(productId|quantity)$/;

/** Traduz um detalhe de validação da API para algo que o cliente entende, usando o nome do produto. */
function describeDetail(field: string, message: string, itemNames: readonly string[]): string {
  if (field === 'customerName') {
    return 'Informe seu nome (até 100 caracteres).';
  }
  const match = ITEM_FIELD.exec(field);
  if (match) {
    const name = itemNames[Number(match[1])] ?? 'Um item';
    if (match[2] === 'quantity') return `${name}: a quantidade deve ser de 1 a 20.`;
    if (message.includes('does not exist')) return `${name} não está mais no cardápio.`;
    if (message.includes('duplicated')) return `${name} aparece mais de uma vez no pedido.`;
  }
  return 'Há um dado inválido no pedido.';
}

/**
 * Converte qualquer falha numa mensagem clara. Nunca deixa o erro "vazar" como tela quebrada.
 * itemNames: nomes dos itens na ordem enviada, para explicar erros como items[1].productId.
 */
export function describeError(error: unknown, context: ErrorContext, itemNames: readonly string[] = []): UserMessage {
  if (!(error instanceof ApiError)) {
    return { title: 'Algo inesperado aconteceu. Tente novamente.', details: [] };
  }

  const { status, body } = error;
  const details = (body?.details ?? []).map((d) => describeDetail(d.field, d.message, itemNames));

  if (status === null || status === 502 || status === 503 || status === 504) {
    return {
      title: 'Não conseguimos falar com a lanchonete agora. Verifique sua conexão e tente novamente em instantes.',
      details: [],
    };
  }
  if (status >= 500) {
    return { title: 'Algo deu errado do nosso lado. Tente novamente em instantes.', details: [] };
  }
  if (status === 422) {
    return { title: 'Alguns itens não estão mais disponíveis.', details };
  }
  if (status === 409 && context === 'cancel-order') {
    return { title: 'Este pedido já estava cancelado.', details: [] };
  }
  if (status === 404 && context === 'cancel-order') {
    return { title: 'Não encontramos este pedido.', details: [] };
  }
  if (status === 400) {
    return { title: 'Confira os dados do pedido.', details };
  }
  return { title: `Não foi possível concluir a operação (erro ${status}).`, details };
}
